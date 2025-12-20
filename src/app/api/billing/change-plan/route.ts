import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, STRIPE_PRICES, PLANS } from '@/lib/stripe';

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { targetPlanId } = body;

        if (!targetPlanId || !Object.values(PLANS).includes(targetPlanId)) {
            return NextResponse.json({ ok: false, error: 'Invalid plan ID' }, { status: 400 });
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
            return NextResponse.json({ ok: false, error: 'Error fetching subscription' }, { status: 500 });
        }

        const currentPlanId = userSub.plan_id;
        console.log('[BILLING] Current plan:', currentPlanId, '→ Target:', targetPlanId);

        // Same plan - do nothing
        if (currentPlanId === targetPlanId) {
            return NextResponse.json({ ok: false, error: 'Already on this plan' });
        }

        // ============================================================
        // CASE A: Target is FREE (Cancellation)
        // ============================================================
        if (targetPlanId === 'free') {
            if (currentPlanId === 'free') {
                return NextResponse.json({ ok: false, error: 'Already on free plan' });
            }

            if (!userSub.stripe_subscription_id) {
                return NextResponse.json({ ok: false, error: 'No active subscription to cancel' }, { status: 400 });
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
                action: 'cancel_scheduled',
                effectiveDate: userSub.current_period_end
            });
        }

        // ============================================================
        // CASE B: User is on FREE → Need Checkout
        // ============================================================
        if (currentPlanId === 'free') {
            console.log('[BILLING] User on free plan, needs checkout flow');
            
            // Create checkout session directly
            const targetPriceId = STRIPE_PRICES[targetPlanId as keyof typeof STRIPE_PRICES];
            if (!targetPriceId) {
                return NextResponse.json({ ok: false, error: 'Price not configured' }, { status: 500 });
            }

            // Call checkout endpoint internally
            const checkoutResponse = await fetch(new URL('/api/billing/checkout', req.url).toString(), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Cookie': req.headers.get('Cookie') || ''
                },
                body: JSON.stringify({ planId: targetPlanId })
            });

            if (!checkoutResponse.ok) {
                return NextResponse.json({ ok: false, error: 'Failed to create checkout' }, { status: 500 });
            }

            const { url } = await checkoutResponse.json();
            return NextResponse.json({
                ok: false,
                needsCheckout: true,
                checkoutUrl: url
            });
        }

        // ============================================================
        // From here: User has PAID plan → Upgrade or Downgrade
        // ============================================================

        const targetPriceId = STRIPE_PRICES[targetPlanId as keyof typeof STRIPE_PRICES];
        if (!targetPriceId) {
            return NextResponse.json({ ok: false, error: 'Price not configured for target plan' }, { status: 500 });
        }

        // Fallback: Lookup subscription if missing stripe_subscription_id
        let subscriptionId = userSub.stripe_subscription_id;
        if (!subscriptionId) {
            console.warn('[BILLING] Missing stripe_subscription_id, attempting lookup...');
            
            if (!userSub.stripe_customer_id) {
                return NextResponse.json({ ok: false, error: 'No Stripe customer found' }, { status: 400 });
            }

            const subs = await stripe.subscriptions.list({
                customer: userSub.stripe_customer_id,
                status: 'active',
                limit: 1
            });

            if (subs.data.length === 0) {
                return NextResponse.json({ ok: false, error: 'No active subscription found' }, { status: 400 });
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
        // CASE C: UPGRADE (Target is higher tier) - Charge now, new cycle
        // ============================================================
        if (targetIndex > currentIndex) {
            console.log('[BILLING] Upgrade detected, applying immediately');

            // Update subscription: new price, charge now, no proration
            await stripe.subscriptions.update(subscriptionId, {
                items: [{
                    id: currentSubscriptionItemId,
                    price: targetPriceId
                }],
                billing_cycle_anchor: 'now',
                proration_behavior: 'none',
                cancel_at_period_end: false
            });

            // Update DB immediately (webhook will confirm)
            await supabase
                .from('user_subscriptions')
                .update({ 
                    plan_id: targetPlanId,
                    status: 'active'
                })
                .eq('user_id', user.id);

            console.log('[BILLING] Upgrade applied, new billing cycle started');

            return NextResponse.json({
                ok: true,
                action: 'upgraded'
            });
        }

        // ============================================================
        // CASE D: DOWNGRADE (Target is lower tier) - Cancel current + create new with trial
        // ============================================================
        console.log('[BILLING] Downgrade detected, scheduling for next period');

        const periodEnd = subscription.current_period_end;

        // Step 1: Cancel current subscription at period end
        await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true
        });

        console.log('[BILLING] Current subscription will cancel at period end');

        // Step 2: Create new subscription with trial until period end
        const newSubscription = await stripe.subscriptions.create({
            customer: userSub.stripe_customer_id,
            items: [{
                price: targetPriceId
            }],
            trial_end: periodEnd,
            metadata: {
                userId: user.id,
                planId: targetPlanId,
                isPendingDowngrade: 'true'
            }
        });

        console.log('[BILLING] New subscription created with trial:', newSubscription.id);

        // Step 3: Save pending info to DB
        await supabase
            .from('user_subscriptions')
            .update({
                status: 'active', // Keep active until period end
                pending_plan_id: targetPlanId,
                pending_effective_date: new Date(periodEnd * 1000).toISOString(),
                pending_subscription_id: newSubscription.id
            })
            .eq('user_id', user.id);

        console.log('[BILLING] Downgrade scheduled successfully');

        return NextResponse.json({
            ok: true,
            action: 'downgrade_scheduled',
            effectiveDate: new Date(periodEnd * 1000).toISOString()
        });

    } catch (error: any) {
        console.error('[BILLING] Change plan error:', error);
        console.error('[BILLING] Error details:', error.message, error.stack);
        return NextResponse.json({ 
            ok: false, 
            error: error.message || 'Internal Error' 
        }, { status: 500 });
    }
}
