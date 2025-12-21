import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe, getPlanFromPriceId, PLANS, STRIPE_PRICES } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { adjustUserTokens } from '@/lib/tokens';

// Initialize Supabase Admin Client (Service Role)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Check if a webhook event has already been processed (idempotency)
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
        .from('stripe_webhook_events')
        .select('id')
        .eq('id', eventId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('[WEBHOOK] Error checking event:', error);
    }

    return !!data;
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
        .insert({
            id: eventId,
            type: eventType,
            data: eventData || null,
            status,
            error: errorMessage || null
        });

    if (error) {
        console.error('[WEBHOOK] Error marking event as processed:', error);
    }
}

/**
 * Reset user tokens to exact plan amount
 */
async function resetUserTokens(
    userId: string,
    targetTokens: number,
    reason: string,
    metadata?: any
): Promise<void> {
    console.log('[WEBHOOK] Resetting tokens to exact amount:', {
        userId,
        targetTokens,
        reason
    });

    try {
        const { data, error } = await supabaseAdmin
            .rpc('set_user_tokens', {
                p_user_id: userId,
                p_target_amount: targetTokens,
                p_reason: reason,
                p_metadata: metadata || {}
            });

        if (error) {
            console.error('[WEBHOOK] Error setting tokens:', error);
        } else {
            console.log('[WEBHOOK] ✅ Tokens set to:', data);
        }
    } catch (err) {
        console.error('[WEBHOOK] Exception setting tokens:', err);
    }
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

    // Idempotency check
    const alreadyProcessed = await isEventProcessed(event.id);
    if (alreadyProcessed) {
        console.log(`[WEBHOOK] Event ${event.id} already processed, skipping.`);
        return new NextResponse(null, { status: 200 });
    }

    console.log(`[WEBHOOK] Processing event ${event.id} of type ${event.type}`);

    const session = event.data.object as any;

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                console.log('[WEBHOOK] checkout.session.completed');
                const subscriptionId = session.subscription;
                const userId = session.metadata?.userId;
                const planId = session.metadata?.planId;
                const customerId = session.customer;

                if (!userId || !planId) {
                    console.warn('[WEBHOOK] Missing userId or planId in metadata:', session.metadata);
                    break;
                }

                console.log('[WEBHOOK] Checkout data:', { subscriptionId, userId, planId, customerId });

                // Get current subscription from DB
                const { data: currentSub } = await supabaseAdmin
                    .from('user_subscriptions')
                    .select('stripe_subscription_id')
                    .eq('user_id', userId)
                    .single();

                // Cancel old subscription if exists and is different
                if (currentSub?.stripe_subscription_id && currentSub.stripe_subscription_id !== subscriptionId) {
                    console.log('[WEBHOOK] Canceling old subscription:', currentSub.stripe_subscription_id);
                    try {
                        await stripe.subscriptions.cancel(currentSub.stripe_subscription_id);
                    } catch (err) {
                        console.warn('[WEBHOOK] Failed to cancel old subscription:', err);
                    }
                }

                // Retrieve subscription details
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                // UPSERT user subscription (create or update)
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
                    console.error('[WEBHOOK] Upsert error:', upsertError);
                } else {
                    console.log('[WEBHOOK] ✅ Subscription upserted for user:', userId, 'plan:', planId);
                }

                // RESET tokens to plan amount
                const { data: planData } = await supabaseAdmin
                    .from('subscription_plans')
                    .select('monthly_tokens')
                    .eq('id', planId)
                    .single();

                if (planData) {
                    await resetUserTokens(
                        userId,
                        planData.monthly_tokens,
                        'subscription_reset',
                        { planId, subscriptionId }
                    );
                } else {
                    console.warn('[WEBHOOK] Plan not found:', planId);
                }

                break;
            }

            case 'invoice.paid': {
                console.log('[WEBHOOK] invoice.paid');
                const invoice = event.data.object;
                const subscriptionId = invoice.subscription;
                const customerId = invoice.customer;
                const billingReason = invoice.billing_reason;

                console.log('[WEBHOOK] Invoice:', { subscriptionId, customerId, billingReason });

                if (!subscriptionId || typeof subscriptionId !== 'string') {
                    console.warn('[WEBHOOK] Invalid subscription ID');
                    break;
                }

                // Find user
                const { data: userSub } = await supabaseAdmin
                    .from('user_subscriptions')
                    .select('user_id, plan_id, stripe_subscription_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (!userSub) {
                    console.warn('[WEBHOOK] No user subscription found for customer:', customerId);
                    break;
                }

                // RACE CONDITION FIX: Only process if this is the active subscription
                if (userSub.stripe_subscription_id !== subscriptionId) {
                    console.log('[WEBHOOK] Ignoring invoice.paid for non-active subscription:', subscriptionId, 'current:', userSub.stripe_subscription_id);
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

                console.log('[WEBHOOK] Dates updated for user:', userSub.user_id);

                // RESET tokens on monthly renewal
                if (billingReason === 'subscription_cycle') {
                    console.log('[WEBHOOK] Monthly renewal detected - resetting tokens');

                    const { data: planData } = await supabaseAdmin
                        .from('subscription_plans')
                        .select('monthly_tokens')
                        .eq('id', userSub.plan_id)
                        .single();

                    if (planData) {
                        await resetUserTokens(
                            userSub.user_id,
                            planData.monthly_tokens,
                            'monthly_refresh_reset',
                            { planId: userSub.plan_id, subscriptionId }
                        );
                    }
                } else {
                    console.log('[WEBHOOK] Not a renewal (billing_reason:', billingReason + '), skipping tokens');
                }

                break;
            }

            case 'invoice.payment_failed': {
                console.log('[WEBHOOK] invoice.payment_failed');
                const invoice = event.data.object;
                const customerId = invoice.customer;

                const { data: userSub } = await supabaseAdmin
                    .from('user_subscriptions')
                    .select('user_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (!userSub) {
                    console.warn('[WEBHOOK] No user subscription found for customer:', customerId);
                    break;
                }

                await supabaseAdmin
                    .from('user_subscriptions')
                    .update({ status: 'past_due' })
                    .eq('user_id', userSub.user_id);

                console.log('[WEBHOOK] Subscription marked as past_due for user:', userSub.user_id);
                break;
            }

            case 'customer.subscription.updated': {
                console.log('[WEBHOOK] customer.subscription.updated');
                const subscription = event.data.object as any;
                const customerId = subscription.customer;
                const subscriptionId = subscription.id;

                const { data: userSub } = await supabaseAdmin
                    .from('user_subscriptions')
                    .select('user_id, stripe_subscription_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (!userSub) {
                    console.warn('[WEBHOOK] No user subscription found for customer:', customerId);
                    break;
                }

                // RACE CONDITION FIX: Only process if this is the active subscription
                if (userSub.stripe_subscription_id !== subscriptionId) {
                    console.log('[WEBHOOK] Ignoring subscription.updated for non-active subscription:', subscriptionId, 'current:', userSub.stripe_subscription_id);
                    break;
                }

                await supabaseAdmin
                    .from('user_subscriptions')
                    .update({
                        status: subscription.status,
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                    })
                    .eq('user_id', userSub.user_id);

                console.log('[WEBHOOK] ✅ Subscription updated for user:', userSub.user_id, 'status:', subscription.status);
                break;
            }

            case 'customer.subscription.deleted': {
                console.log('[WEBHOOK] customer.subscription.deleted');
                const subscription = event.data.object as any;
                const customerId = subscription.customer;
                const deletedSubId = subscription.id;

                console.log('[WEBHOOK] Deleted subscription:', deletedSubId);

                const { data: userSub } = await supabaseAdmin
                    .from('user_subscriptions')
                    .select('user_id, stripe_subscription_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (!userSub) {
                    console.warn('[WEBHOOK] No user subscription found for customer:', customerId);
                    break;
                }

                // RACE CONDITION FIX: Only reset to free if this is the ACTIVE subscription
                if (userSub.stripe_subscription_id && userSub.stripe_subscription_id !== deletedSubId) {
                    console.log('[WEBHOOK] ⚠️ Ignoring deletion of old subscription:', deletedSubId, 'current active:', userSub.stripe_subscription_id);
                    break;
                }

                // This is the active subscription being deleted → reset to free
                console.log('[WEBHOOK] Active subscription deleted, resetting to free');

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

                console.log('[WEBHOOK] ✅ User reset to free:', userSub.user_id);
                break;
            }

            default:
                console.log('[WEBHOOK] Unhandled event type:', event.type);
        }

        // Mark event as processed
        await markEventProcessed(event.id, event.type, event.data.object, 'processed');
        console.log(`[WEBHOOK] ✅ Event ${event.id} marked as processed`);

    } catch (error: any) {
        console.error('[WEBHOOK] ❌ ERROR:', error);
        console.error('[WEBHOOK] Error stack:', error.stack);
        
        await markEventProcessed(
            event.id, 
            event.type, 
            event.data.object, 
            'failed',
            error.message || 'Unknown error'
        );

        return new NextResponse('Internal Error', { status: 500 });
    }

    return new NextResponse(null, { status: 200 });
}
