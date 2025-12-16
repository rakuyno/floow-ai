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
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
    }

    const session = event.data.object as any;

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
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
                // Monthly renewal
                const subscriptionId = session.subscription;
                const customerId = session.customer;

                // Find user by stripe_customer_id
                const { data: userSub } = await supabaseAdmin
                    .from('user_subscriptions')
                    .select('user_id, plan_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (!userSub) break;

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
                }

                break;
            }

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as any;
                const customerId = subscription.customer;

                // Find user
                const { data: userSub } = await supabaseAdmin
                    .from('user_subscriptions')
                    .select('user_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (userSub) {
                    // If canceled, maybe downgrade to free? 
                    // For now just update status.
                    // If we wanted to downgrade to free immediately on cancel, we'd do it here,
                    // but usually you wait until period end.
                    // Stripe handles status 'canceled', 'past_due' etc.

                    await supabaseAdmin
                        .from('user_subscriptions')
                        .update({
                            status: subscription.status,
                            current_period_end: new Date(subscription.current_period_end * 1000)
                        })
                        .eq('user_id', userSub.user_id);
                }
                break;
            }
        }
    } catch (error) {
        console.error('[WEBHOOK HANDLER ERROR]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }

    return new NextResponse(null, { status: 200 });
}
