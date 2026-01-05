import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe, getPlanFromPriceId, PLANS, STRIPE_PRICES } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client (Service Role)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Check if a webhook event has already been processed (idempotency)
 * Only skip if status is 'processed', not 'failed'
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
        .from('stripe_webhook_events')
        .select('id, status')
        .eq('id', eventId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('[WEBHOOK] Error checking event:', error);
        return false;
    }

    // Only skip if processed, allow retry if failed
    return data?.status === 'processed';
}

/**
 * Mark a webhook event as processed (idempotency)
 */
async function markEventProcessed(
    eventId: string, 
    eventType: string, 
    eventData?: any,
    status: 'processed' | 'failed' = 'processed',
    errorMessage?: string
): Promise<void> {
    const { error } = await supabaseAdmin
        .from('stripe_webhook_events')
        .upsert({
            id: eventId,
            type: eventType,
            data: eventData || null,
            status,
            error: errorMessage || null,
            processed_at: new Date().toISOString()
        }, {
            onConflict: 'id'
        });

    if (error) {
        console.error('[WEBHOOK] Error marking event:', error);
    }
}

/**
 * Normalize Stripe object to ID string
 */
function normalizeId(obj: any): string | null {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'object' && obj.id) return obj.id;
    return null;
}

/**
 * Find user subscription robustly
 */
async function findUserSubscription(customerId: string | null, subscriptionId?: string | null) {
    if (!customerId) return null;
    
    // First try by customer_id
    let result = await supabaseAdmin
        .from('user_subscriptions')
        .select('*')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

    if (result.data) {
        return result.data;
    }

    // Fallback: try by subscription_id
    if (subscriptionId) {
        result = await supabaseAdmin
            .from('user_subscriptions')
            .select('*')
            .eq('stripe_subscription_id', subscriptionId)
            .maybeSingle();
    }

    return result.data;
}

export async function POST(req: Request) {
    const body = await req.text();
    const signature = headers().get('Stripe-Signature') as string;

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (error: any) {
        console.error('[WEBHOOK] Signature verification failed:', error.message);
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
    }

    // Idempotency check (only skip if processed, not if failed)
    const alreadyProcessed = await isEventProcessed(event.id);
    if (alreadyProcessed) {
        console.log(`[WEBHOOK] Event ${event.id} already processed successfully, skipping.`);
        return new NextResponse(null, { status: 200 });
    }

    console.log(`[WEBHOOK] ========================================`);
    console.log(`[WEBHOOK] Processing event ${event.id}`);
    console.log(`[WEBHOOK] Type: ${event.type}`);

    const session = event.data.object as any;

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                console.log('[WEBHOOK] checkout.session.completed');
                
                const customerId = normalizeId(session.customer);
                const userId = session.metadata?.userId;
                const purchaseType = session.metadata?.purchaseType;

                console.log('[WEBHOOK] Mode:', session.mode);
                console.log('[WEBHOOK] Metadata:', session.metadata);

                // Check if this is a TOKEN PURCHASE (one-time payment)
                if (session.mode === 'payment' && purchaseType === 'token_package') {
                    console.log('[WEBHOOK] 🪙 Token purchase detected');
                    
                    const tokenAmount = parseInt(session.metadata?.tokenAmount || '0');
                    
                    if (!userId || !tokenAmount) {
                        console.error('[WEBHOOK] ❌ Missing userId or tokenAmount');
                        throw new Error('Missing userId or tokenAmount for token purchase');
                    }

                    console.log('[WEBHOOK] 💰 Adding tokens:', tokenAmount);

                    // Use adjust_tokens to add tokens
                    const { error: tokensError } = await supabaseAdmin
                        .rpc('adjust_tokens', {
                            p_user_id: userId,
                            p_amount: tokenAmount,
                            p_reason: 'token_purchase',
                            p_metadata: {
                                tokenAmount,
                                sessionId: session.id,
                                from: 'checkout.session.completed'
                            }
                        });

                    if (tokensError) {
                        console.error('[WEBHOOK] ❌ adjust_tokens error:', tokensError);
                        throw tokensError;
                    }

                    console.log('[WEBHOOK] ✅ Tokens added successfully:', tokenAmount);
                    break;
                }

                // Otherwise, it's a SUBSCRIPTION
                const subscriptionId = normalizeId(session.subscription);
                const planId = session.metadata?.planId;

                console.log('[WEBHOOK] Data:', { subscriptionId, customerId, userId, planId });

                if (!userId || !planId) {
                    console.warn('[WEBHOOK] ⚠️ Missing userId or planId in metadata:', session.metadata);
                    break;
                }

                if (!subscriptionId || !customerId) {
                    console.error('[WEBHOOK] ❌ Missing subscription or customer ID');
                    throw new Error('Missing subscription or customer ID');
                }

                // Get current subscription from DB
                const { data: currentSub } = await supabaseAdmin
                    .from('user_subscriptions')
                    .select('stripe_subscription_id')
                    .eq('user_id', userId)
                    .maybeSingle();

                // Cancel old subscription if exists and is different
                if (currentSub?.stripe_subscription_id && currentSub.stripe_subscription_id !== subscriptionId) {
                    console.log('[WEBHOOK] 🔄 Canceling old subscription:', currentSub.stripe_subscription_id);
                    try {
                        await stripe.subscriptions.cancel(currentSub.stripe_subscription_id);
                    } catch (err) {
                        console.warn('[WEBHOOK] ⚠️ Failed to cancel old subscription:', err);
                    }
                }

                // Retrieve subscription details
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                // UPSERT user subscription
                const { error: upsertError } = await supabaseAdmin
                    .from('user_subscriptions')
                    .upsert({
                        user_id: userId,
                        stripe_subscription_id: subscriptionId,
                        stripe_customer_id: customerId,
                        plan_id: planId,
                        status: 'active',
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                        pending_plan_id: null,
                        pending_effective_date: null,
                        pending_subscription_id: null
                    }, {
                        onConflict: 'user_id'
                    });

                if (upsertError) {
                    console.error('[WEBHOOK] ❌ Upsert error:', upsertError);
                    throw upsertError;
                }

                console.log('[WEBHOOK] ✅ Subscription upserted:', { userId, planId, subscriptionId });

                // ACCUMULATE TOKENS (not reset)
                console.log('[WEBHOOK] 💰 Granting plan tokens (accumulate)');
                const { data: tokensResult, error: tokensError } = await supabaseAdmin
                    .rpc('grant_plan_tokens', {
                        p_user_id: userId,
                        p_plan_id: planId,
                        p_reason: 'plan_change_grant',
                        p_metadata: {
                            subscriptionId,
                            from: 'checkout.session.completed'
                        }
                    });

                if (tokensError) {
                    console.error('[WEBHOOK] ❌ grant_plan_tokens error:', tokensError);
                    throw tokensError;
                }

                console.log('[WEBHOOK] ✅ Tokens granted, new balance:', tokensResult);

                break;
            }

            case 'invoice.paid': {
                console.log('[WEBHOOK] invoice.paid');
                
                const invoice = event.data.object;
                const subscriptionId = normalizeId(invoice.subscription);
                const customerId = normalizeId(invoice.customer);
                const billingReason = invoice.billing_reason;

                console.log('[WEBHOOK] Data:', { subscriptionId, customerId, billingReason });

                if (!subscriptionId || !customerId) {
                    console.warn('[WEBHOOK] ⚠️ Invalid subscription or customer ID');
                    break;
                }

                // Find user robustly
                const userSub = await findUserSubscription(customerId, subscriptionId);

                if (!userSub) {
                    console.warn('[WEBHOOK] ⚠️ No user subscription found for customer:', customerId);
                    break;
                }

                // RACE CONDITION FIX: Only process if this is the active subscription
                if (userSub.stripe_subscription_id !== subscriptionId) {
                    console.log('[WEBHOOK] ⚠️ Ignoring invoice.paid for non-active subscription');
                    console.log('[WEBHOOK] Event sub:', subscriptionId, 'DB sub:', userSub.stripe_subscription_id);
                    break;
                }

                // Retrieve subscription
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                // Update dates
                await supabaseAdmin
                    .from('user_subscriptions')
                    .update({
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                        status: 'active'
                    })
                    .eq('user_id', userSub.user_id);

                console.log('[WEBHOOK] ✅ Dates updated');

                // RESET tokens on monthly renewal ONLY
                if (billingReason === 'subscription_cycle') {
                    console.log('[WEBHOOK] 🔄 Monthly renewal - RESETTING tokens to plan amount');

                    const { data: planData } = await supabaseAdmin
                        .from('subscription_plans')
                        .select('monthly_tokens')
                        .eq('id', userSub.plan_id)
                        .single();

                    if (!planData) {
                        console.error('[WEBHOOK] ❌ Plan not found:', userSub.plan_id);
                        throw new Error(`Plan not found: ${userSub.plan_id}`);
                    }

                    console.log('[WEBHOOK] Resetting to:', planData.monthly_tokens, 'tokens');

                    const { data: tokensResult, error: tokensError } = await supabaseAdmin
                        .rpc('set_user_tokens', {
                            p_user_id: userSub.user_id,
                            p_target_amount: planData.monthly_tokens,
                            p_reason: 'monthly_reset',
                            p_metadata: { subscriptionId, planId: userSub.plan_id }
                        });

                    if (tokensError) {
                        console.error('[WEBHOOK] ❌ set_user_tokens error:', tokensError);
                        throw tokensError;
                    }

                    console.log('[WEBHOOK] ✅ Tokens reset to:', tokensResult);
                } else {
                    console.log('[WEBHOOK] Not a renewal (billing_reason:', billingReason + '), tokens unchanged');
                }

                break;
            }

            case 'invoice.payment_failed': {
                console.log('[WEBHOOK] invoice.payment_failed');
                
                const invoice = event.data.object;
                const customerId = normalizeId(invoice.customer);

                const userSub = await findUserSubscription(customerId);

                if (!userSub) {
                    console.warn('[WEBHOOK] ⚠️ No user subscription found');
                    break;
                }

                await supabaseAdmin
                    .from('user_subscriptions')
                    .update({ status: 'past_due' })
                    .eq('user_id', userSub.user_id);

                console.log('[WEBHOOK] ✅ Status set to past_due');
                break;
            }

            case 'customer.subscription.updated': {
                console.log('[WEBHOOK] customer.subscription.updated');
                
                const subscription = event.data.object as any;
                const subscriptionId = normalizeId(subscription.id);
                const customerId = normalizeId(subscription.customer);

                if (!subscriptionId || !customerId) {
                    console.warn('[WEBHOOK] ⚠️ Invalid IDs');
                    break;
                }

                const userSub = await findUserSubscription(customerId, subscriptionId);

                if (!userSub) {
                    console.warn('[WEBHOOK] ⚠️ No user subscription found');
                    break;
                }

                // RACE CONDITION FIX: Only process if this is the active subscription
                if (userSub.stripe_subscription_id !== subscriptionId) {
                    console.log('[WEBHOOK] ⚠️ Ignoring subscription.updated for non-active subscription');
                    console.log('[WEBHOOK] Event sub:', subscriptionId, 'DB sub:', userSub.stripe_subscription_id);
                    break;
                }

                await supabaseAdmin
                    .from('user_subscriptions')
                    .update({
                        status: subscription.status,
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                    })
                    .eq('user_id', userSub.user_id);

                console.log('[WEBHOOK] ✅ Status/dates updated:', subscription.status);
                break;
            }

            case 'customer.subscription.deleted': {
                console.log('[WEBHOOK] customer.subscription.deleted');
                
                const subscription = event.data.object as any;
                const deletedSubId = normalizeId(subscription.id);
                const customerId = normalizeId(subscription.customer);

                console.log('[WEBHOOK] Deleted sub:', deletedSubId);

                if (!deletedSubId || !customerId) {
                    console.warn('[WEBHOOK] ⚠️ Invalid IDs');
                    break;
                }

                const userSub = await findUserSubscription(customerId, deletedSubId);

                if (!userSub) {
                    console.warn('[WEBHOOK] ⚠️ No user subscription found');
                    break;
                }

                // RACE CONDITION FIX: Only reset to free if this is the ACTIVE subscription
                if (userSub.stripe_subscription_id && userSub.stripe_subscription_id !== deletedSubId) {
                    console.log('[WEBHOOK] ⚠️ Ignoring deletion of old subscription');
                    console.log('[WEBHOOK] Deleted:', deletedSubId, 'Active:', userSub.stripe_subscription_id);
                    break;
                }

                // This is the active subscription → reset to free
                console.log('[WEBHOOK] 🔄 Active subscription deleted, resetting to free');

                await supabaseAdmin
                    .from('user_subscriptions')
                    .update({
                        plan_id: 'free',
                        status: 'active',
                        stripe_subscription_id: null,
                        pending_plan_id: null,
                        pending_effective_date: null,
                        pending_subscription_id: null
                    })
                    .eq('user_id', userSub.user_id);

                console.log('[WEBHOOK] ✅ User reset to free (tokens unchanged)');
                break;
            }

            default:
                console.log('[WEBHOOK] Unhandled event type:', event.type);
        }

        // Mark event as processed
        await markEventProcessed(event.id, event.type, event.data.object, 'processed');
        console.log(`[WEBHOOK] ✅ Event ${event.id} marked as processed`);

    } catch (error: any) {
        console.error('[WEBHOOK] ❌ ERROR:', error.message);
        console.error('[WEBHOOK] Stack:', error.stack);
        
        // Mark as failed for retry
        await markEventProcessed(
            event.id, 
            event.type, 
            event.data.object, 
            'failed',
            error.message || 'Unknown error'
        );

        // Return 500 so Stripe retries
        return new NextResponse('Internal Error', { status: 500 });
    }

    return new NextResponse(null, { status: 200 });
}
