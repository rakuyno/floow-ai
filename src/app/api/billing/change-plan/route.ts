import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, STRIPE_PRICES, PLANS } from '@/lib/stripe';

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = await req.json();
        const { targetPlanId } = body;

        if (!targetPlanId || !Object.values(PLANS).includes(targetPlanId)) {
            return new NextResponse('Invalid plan ID', { status: 400 });
        }

        console.log('[BILLING] Change plan request:', { userId: user.id, targetPlanId });

        // Get user's current subscription
        const { data: userSub, error: subError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (subError) {
            console.error('[BILLING] Error fetching subscription:', subError);
            return new NextResponse('Error fetching subscription', { status: 500 });
        }

        const currentPlanId = userSub.plan_id;
        console.log('[BILLING] Current plan:', currentPlanId, '→ Target:', targetPlanId);

        // ============================================================
        // CASE A: Target is FREE (Cancellation)
        // ============================================================
        if (targetPlanId === 'free') {
            if (currentPlanId === 'free') {
                return NextResponse.json({ 
                    ok: false, 
                    error: 'Already on free plan' 
                });
            }

            if (!userSub.stripe_subscription_id) {
                return new NextResponse('No active subscription to cancel', { status: 400 });
            }

            // Cancel at period end
            await stripe.subscriptions.update(userSub.stripe_subscription_id, {
                cancel_at_period_end: true
            });

            // Update DB status
            await supabase
                .from('user_subscriptions')
                .update({ 
                    status: 'canceling',
                    pending_plan_id: 'free',
                    pending_effective_date: userSub.current_period_end
                })
                .eq('user_id', user.id);

            console.log('[BILLING] Subscription set to cancel at period end');

            return NextResponse.json({
                ok: true,
                action: 'canceling',
                effectiveDate: userSub.current_period_end,
                message: 'Subscription will be canceled at the end of the billing period'
            });
        }

        // ============================================================
        // CASE B: User is on FREE → Need Checkout
        // ============================================================
        if (currentPlanId === 'free') {
            console.log('[BILLING] User on free plan, needs checkout flow');
            return NextResponse.json({
                ok: false,
                needsCheckout: true,
                message: 'Please complete checkout to subscribe'
            });
        }

        // ============================================================
        // From here: User has PAID plan → Upgrade or Downgrade
        // ============================================================

        const targetPriceId = STRIPE_PRICES[targetPlanId as keyof typeof STRIPE_PRICES];
        if (!targetPriceId) {
            return new NextResponse('Price not configured for target plan', { status: 500 });
        }

        // Fallback: Lookup subscription if missing stripe_subscription_id
        let subscriptionId = userSub.stripe_subscription_id;
        if (!subscriptionId) {
            console.warn('[BILLING] Missing stripe_subscription_id, attempting lookup...');
            
            if (!userSub.stripe_customer_id) {
                return new NextResponse('No Stripe customer found', { status: 400 });
            }

            const subs = await stripe.subscriptions.list({
                customer: userSub.stripe_customer_id,
                status: 'active',
                limit: 1
            });

            if (subs.data.length === 0) {
                return new NextResponse('No active subscription found', { status: 400 });
            }

            subscriptionId = subs.data[0].id;
            
            // Save it to DB
            await supabase
                .from('user_subscriptions')
                .update({ stripe_subscription_id: subscriptionId })
                .eq('user_id', user.id);

            console.log('[BILLING] Recovered subscription ID:', subscriptionId);
        }

        // Retrieve current subscription from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentSubscriptionItemId = subscription.items.data[0].id;

        // Determine plan order for upgrade/downgrade detection
        const planOrder = ['free', 'starter', 'growth', 'agency'];
        const currentIndex = planOrder.indexOf(currentPlanId);
        const targetIndex = planOrder.indexOf(targetPlanId);

        // ============================================================
        // CASE C: UPGRADE (Target is higher tier)
        // ============================================================
        if (targetIndex > currentIndex) {
            console.log('[BILLING] Upgrade detected, applying immediately with proration');

            // Update subscription in Stripe (proration will be created automatically)
            await stripe.subscriptions.update(subscriptionId, {
                items: [{
                    id: currentSubscriptionItemId,
                    price: targetPriceId
                }],
                proration_behavior: 'create_prorations'
            });

            // DO NOT update plan_id in DB here - let webhook handle it
            console.log('[BILLING] Stripe subscription updated, webhook will sync plan_id');

            return NextResponse.json({
                ok: true,
                action: 'upgraded',
                message: 'Plan upgraded immediately with prorated billing'
            });
        }

        // ============================================================
        // CASE D: DOWNGRADE (Target is lower tier) - Use Subscription Schedule
        // ============================================================
        console.log('[BILLING] Downgrade detected, scheduling for next period');

        const periodEnd = subscription.current_period_end;

        // Check if schedule already exists for this subscription
        const existingSchedules = await stripe.subscriptionSchedules.list({
            subscription: subscriptionId,
            limit: 1
        });

        if (existingSchedules.data.length > 0) {
            // Update existing schedule
            const schedule = existingSchedules.data[0];
            
            await stripe.subscriptionSchedules.update(schedule.id, {
                phases: [
                    {
                        // Current phase: keep current plan until period end
                        items: [{
                            price: subscription.items.data[0].price.id,
                            quantity: 1
                        }],
                        start_date: subscription.current_period_start,
                        end_date: periodEnd
                    },
                    {
                        // Next phase: switch to target plan
                        items: [{
                            price: targetPriceId,
                            quantity: 1
                        }],
                        start_date: periodEnd
                    }
                ]
            });

            console.log('[BILLING] Updated existing subscription schedule');
        } else {
            // Create new schedule
            await stripe.subscriptionSchedules.create({
                from_subscription: subscriptionId,
                phases: [
                    {
                        // Current phase: keep current plan until period end
                        items: [{
                            price: subscription.items.data[0].price.id,
                            quantity: 1
                        }],
                        start_date: subscription.current_period_start,
                        end_date: periodEnd
                    },
                    {
                        // Next phase: switch to target plan
                        items: [{
                            price: targetPriceId,
                            quantity: 1
                        }],
                        start_date: periodEnd
                    }
                ]
            });

            console.log('[BILLING] Created subscription schedule for downgrade');
        }

        // Save pending info to DB (for UI display only)
        await supabase
            .from('user_subscriptions')
            .update({
                pending_plan_id: targetPlanId,
                pending_effective_date: new Date(periodEnd * 1000).toISOString()
            })
            .eq('user_id', user.id);

        console.log('[BILLING] Downgrade scheduled successfully');

        return NextResponse.json({
            ok: true,
            action: 'scheduled',
            effectiveDate: new Date(periodEnd * 1000).toISOString(),
            message: 'Plan change scheduled for end of billing period'
        });

    } catch (error: any) {
        console.error('[BILLING] Change plan error:', error);
        return new NextResponse(error.message || 'Internal Error', { status: 500 });
    }
}
