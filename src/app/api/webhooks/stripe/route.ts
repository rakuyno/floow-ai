import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe, getPlanFromPriceId, PLANS } from '@/lib/stripe';
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

                // Add Initial Tokens for the Plan
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
                }

                break;
            }

            case 'invoice.paid': {
                console.log('[WEBHOOK] Processing invoice.paid');
                // Monthly renewal
                const subscriptionId = session.subscription;
                const customerId = session.customer;

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

                // Refresh Tokens
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
                    .select('user_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (userSub) {
                    // Update status from Stripe
                    // Stripe handles status: 'active', 'canceled', 'past_due', etc.
                    await supabaseAdmin
                        .from('user_subscriptions')
                        .update({
                            status: subscription.status,
                            current_period_end: new Date(subscription.current_period_end * 1000)
                        })
                        .eq('user_id', userSub.user_id);

                    console.log('[WEBHOOK] Subscription status updated to:', subscription.status, 'for user:', userSub.user_id);
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
