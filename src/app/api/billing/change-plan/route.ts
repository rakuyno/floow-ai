import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, getPriceId, type PlanId } from '@/lib/stripe';
import { normalizeMarket, type Market, marketFromPath, MARKET_COOKIE_NAME } from '@/lib/market';

/**
 * Simple plan change: Always redirect to Stripe Checkout
 * No upgrades, no downgrades, no schedules, no prorations
 * Just: cancel old sub + create new checkout
 * NOW WITH MULTI-MARKET SUPPORT
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { targetPlanId, market: clientMarket } = body;

        console.log('[BILLING] Change plan request:', { userId: user.id, targetPlanId, clientMarket });

        // Determine market from multiple sources with priority
        let market: Market;
        
        if (clientMarket) {
            market = normalizeMarket(clientMarket);
        } else {
            const referer = req.headers.get('referer');
            if (referer) {
                const refererUrl = new URL(referer);
                const pathMarket = marketFromPath(refererUrl.pathname);
                market = pathMarket || normalizeMarket(req.cookies.get(MARKET_COOKIE_NAME)?.value);
            } else {
                market = normalizeMarket(req.cookies.get(MARKET_COOKIE_NAME)?.value);
            }
        }

        console.log('[BILLING] Market detected:', market);

        // Get current subscription
        const { data: userSub } = await supabase
            .from('user_subscriptions')
            .select('plan_id, stripe_subscription_id, stripe_customer_id')
            .eq('user_id', user.id)
            .single();

        const currentPlanId = userSub?.plan_id || 'free';

        // Same plan - do nothing
        if (currentPlanId === targetPlanId) {
            return NextResponse.json({ ok: false, error: 'Already on this plan' });
        }

        // ============================================================
        // CASE 1: Target is FREE (Cancel)
        // ============================================================
        if (targetPlanId === 'free') {
            if (!userSub?.stripe_subscription_id) {
                return NextResponse.json({ ok: false, error: 'No active subscription to cancel' });
            }
            
            // Cancel immediately in Stripe
            await stripe.subscriptions.cancel(userSub.stripe_subscription_id);

            // Update DB immediately (don't wait for webhook)
            await supabase
                .from('user_subscriptions')
                .update({
                    plan_id: 'free',
                    status: 'active',
                    stripe_subscription_id: null,
                    pending_plan_id: null,
                    pending_effective_date: null,
                    pending_subscription_id: null
                })
                .eq('user_id', user.id);

            console.log('[BILLING] Subscription canceled and DB updated to free');

            return NextResponse.json({ ok: true, action: 'canceled' });
        }

        // ============================================================
        // CASE 2: Any paid plan → Cancel old sub + Create Checkout Session
        // ============================================================
        
        const targetPriceId = getPriceId(market, targetPlanId as PlanId);
        if (!targetPriceId) {
            console.error('[BILLING] No price ID configured for market:', market, 'plan:', targetPlanId);
            return NextResponse.json({ ok: false, error: 'Price not configured' }, { status: 500 });
        }

        // IMPORTANT: Cancel old subscription FIRST if exists
        if (userSub?.stripe_subscription_id) {
            console.log('[BILLING] Canceling old subscription before creating new one:', userSub.stripe_subscription_id);
            try {
                await stripe.subscriptions.cancel(userSub.stripe_subscription_id);
                console.log('[BILLING] ✅ Old subscription canceled successfully');
            } catch (cancelError: any) {
                console.error('[BILLING] ⚠️ Failed to cancel old subscription:', cancelError.message);
                // Continue anyway - webhook will handle cleanup
            }
        }

        // Determine app URL
        const forwardedHost = req.headers.get('x-forwarded-host');
        const forwardedProto = req.headers.get('x-forwarded-proto');
        
        let appUrl: string;
        if (forwardedHost) {
            appUrl = `${forwardedProto || 'https'}://${forwardedHost}`;
        } else {
            appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        }

        console.log('[BILLING] Creating checkout for:', targetPlanId, 'market:', market, 'customer:', userSub?.stripe_customer_id);

        // Create checkout session directly with market-specific price
        const session = await stripe.checkout.sessions.create({
            customer: userSub?.stripe_customer_id || undefined,
            customer_email: userSub?.stripe_customer_id ? undefined : user.email,
            line_items: [
                {
                    price: targetPriceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${appUrl}/${market}/app/billing?success=true`,
            cancel_url: `${appUrl}/${market}/app/billing?canceled=true`,
            metadata: {
                userId: user.id,
                planId: targetPlanId,
                market: market, // Store market for webhook processing
            },
        });

        console.log('[BILLING] Checkout session created:', session.id, 'for market:', market);
        
        return NextResponse.json({
            ok: true,
            needsCheckout: true,
            checkoutUrl: session.url
        });

    } catch (error: any) {
        console.error('[BILLING] Change plan error:', error);
        return NextResponse.json({ 
            ok: false, 
            error: error.message || 'Internal Error' 
        }, { status: 500 });
    }
}
