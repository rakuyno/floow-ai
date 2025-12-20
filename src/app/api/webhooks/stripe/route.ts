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

    // ✅ IDEMPOTENCY CHECK: Has this event already been processed?
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
                console.log('[WEBHOOK] Processing checkout.session.completed');
                const subscriptionId = session.subscription;
                const userId = session.metadata.userId;
                const planId = session.metadata.planId;

                if (!userId || !planId) break;

                // Retrieve subscription details to get dates
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                // Update User Subscription
                await supabaseAdmin
                    .from('user_subscriptions')
                    .update({
                        stripe_subscription_id: subscriptionId,
                        stripe_customer_id: session.customer,
                        plan_id: planId,
                        status: 'active',
                        current_period_start: new Date(subscription.current_period_start * 1000),
                        current_period_end: new Date(subscription.current_period_end * 1000),
                    })
                    .eq('user_id', userId);

                // ✅ FIX #3: Dedupe tokens with simple query (no JSONB filter)
                // Check if user already received initial tokens for ANY subscription
                const { data: existingInitial } = await supabaseAdmin
                    .from('user_token_ledger')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('reason', 'subscription_initial')
                    .limit(1)
                    .single();

                // Only add initial tokens if this is truly the FIRST subscription
                if (!existingInitial) {
                    const { data: planData } = await supabaseAdmin
                        .from('subscription_plans')
                        .select('monthly_tokens')
                        .eq('id', planId)
                        .single();

                    if (planData) {
                        await adjustUserTokens(
                            supabaseAdmin,
                            userId,
                            planData.monthly_tokens,
                            'subscription_initial',
                            { planId, subscriptionId }
                        );
                        console.log('[WEBHOOK] Initial tokens assigned:', planData.monthly_tokens);
                    }
                } else {
                    console.log('[WEBHOOK] Skipping initial tokens (already assigned previously)');
                }

                break;
            }

            case 'invoice.paid': {
                console.log('[WEBHOOK] Processing invoice.paid');
                const invoice = event.data.object;
                const subscriptionId = invoice.subscription;
                const customerId = invoice.customer;
                const billingReason = invoice.billing_reason;

                console.log('[WEBHOOK] Invoice billing_reason:', billingReason);

                // Find user by stripe_customer_id
                const { data: userSub } = await supabaseAdmin
                    .from('user_subscriptions')
                    .select('user_id, plan_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (!userSub) {
                    console.warn('[WEBHOOK] No user subscription found for customer:', customerId);
                    break;
                }

                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                // Update dates
                await supabaseAdmin
                    .from('user_subscriptions')
                    .update({
                        current_period_start: new Date(subscription.current_period_start * 1000),
                        current_period_end: new Date(subscription.current_period_end * 1000),
                        status: 'active'
                    })
                    .eq('user_id', userSub.user_id);

                console.log('[WEBHOOK] Subscription updated to active for user:', userSub.user_id);

                // ✅ FIX #1: NO aplicar pending_plan_id aquí (Subscription Schedules lo hace)
                // ✅ FIX #3: Solo refrescar tokens si es renovación real del ciclo
                if (billingReason === 'subscription_cycle') {
                    console.log('[WEBHOOK] Monthly renewal detected, refreshing tokens');

                    const { data: planData } = await supabaseAdmin
                        .from('subscription_plans')
                        .select('monthly_tokens')
                        .eq('id', userSub.plan_id)
                        .single();

                    if (planData) {
                        await adjustUserTokens(
                            supabaseAdmin,
                            userSub.user_id,
                            planData.monthly_tokens,
                            'monthly_refresh',
                            { planId: userSub.plan_id, subscriptionId }
                        );
                        console.log('[WEBHOOK] Tokens refreshed:', planData.monthly_tokens, 'for user:', userSub.user_id);
                    }
                } else {
                    console.log('[WEBHOOK] Not a renewal (billing_reason:', billingReason + '), skipping token refresh');
                }

                break;
            }

            case 'invoice.payment_failed': {
                console.log('[WEBHOOK] Processing invoice.payment_failed');
                const subscriptionId = session.subscription;
                const customerId = session.customer;

                // Find user by stripe_customer_id
                const { data: userSub } = await supabaseAdmin
                    .from('user_subscriptions')
                    .select('user_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (!userSub) {
                    console.warn('[WEBHOOK] No user subscription found for customer:', customerId);
                    break;
                }

                // Mark subscription as past_due (Stripe will retry payment automatically)
                await supabaseAdmin
                    .from('user_subscriptions')
                    .update({
                        status: 'past_due'
                    })
                    .eq('user_id', userSub.user_id);

                console.log('[WEBHOOK] Subscription marked as past_due for user:', userSub.user_id);
                // Note: We do NOT deduct tokens here. Let Stripe handle retries.
                // If subscription eventually cancels, that will be handled by customer.subscription.deleted

                break;
            }

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                console.log('[WEBHOOK] Processing', event.type);
                const subscription = event.data.object as any;
                const customerId = subscription.customer;

                // Find user
                const { data: userSub } = await supabaseAdmin
                    .from('user_subscriptions')
                    .select('user_id, pending_plan_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (userSub) {
                    if (event.type === 'customer.subscription.deleted') {
                        // Subscription canceled/deleted → reset to free
                        await supabaseAdmin
                            .from('user_subscriptions')
                            .update({
                                plan_id: 'free',
                                status: 'active',
                                stripe_subscription_id: null,
                                pending_plan_id: null,
                                pending_effective_date: null,
                                current_period_end: new Date(subscription.current_period_end * 1000)
                            })
                            .eq('user_id', userSub.user_id);

                        console.log('[WEBHOOK] Subscription deleted, user reset to free:', userSub.user_id);
                    } else {
                        // ✅ FIX #2: Sync plan_id from Stripe (source of truth)
                        // Map price.id → plan_id using existing mapping
                        const priceId = subscription.items?.data?.[0]?.price?.id;
                        let syncedPlanId = userSub.pending_plan_id || null; // Default to pending if exists

                        if (priceId) {
                            // Find plan by matching price ID
                            for (const [planKey, planPriceId] of Object.entries(STRIPE_PRICES)) {
                                if (planPriceId === priceId) {
                                    syncedPlanId = planKey;
                                    console.log('[WEBHOOK] Synced plan_id from Stripe price:', priceId, '→', planKey);
                                    break;
                                }
                            }
                        }

                        // Update DB with synced data
                        const updateData: any = {
                            status: subscription.status,
                            current_period_end: new Date(subscription.current_period_end * 1000)
                        };

                        // Only update plan_id if we successfully mapped it from Stripe
                        if (syncedPlanId) {
                            updateData.plan_id = syncedPlanId;
                            
                            // Clear pending if it was applied
                            if (userSub.pending_plan_id === syncedPlanId) {
                                updateData.pending_plan_id = null;
                                updateData.pending_effective_date = null;
                                console.log('[WEBHOOK] Pending plan applied, clearing pending fields');
                            }
                        }

                        await supabaseAdmin
                            .from('user_subscriptions')
                            .update(updateData)
                            .eq('user_id', userSub.user_id);

                        console.log('[WEBHOOK] Subscription updated for user:', userSub.user_id, 'status:', subscription.status, 'plan:', syncedPlanId);
                    }
                } else {
                    console.warn('[WEBHOOK] No user subscription found for customer:', customerId);
                }
                break;
            }

            default:
                console.log('[WEBHOOK] Unhandled event type:', event.type);
        }

        // ✅ Mark event as successfully processed (idempotency)
        await markEventProcessed(event.id, event.type, event.data.object, 'processed');
        console.log(`[WEBHOOK] Event ${event.id} marked as processed`);

    } catch (error: any) {
        console.error('[WEBHOOK HANDLER ERROR]', error);
        
        // ❌ Mark event as failed (with error message)
        await markEventProcessed(
            event.id, 
            event.type, 
            event.data.object, 
            'failed',
            error.message || 'Unknown error'
        );

        // Return 500 so Stripe retries (but our idempotency will prevent duplicate processing)
        return new NextResponse('Internal Error', { status: 500 });
    }

    return new NextResponse(null, { status: 200 });
}
