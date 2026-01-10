import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, getPriceId, PLANS, type PlanId } from '@/lib/stripe';
import { normalizeMarket, type Market, marketFromPath, MARKET_COOKIE_NAME } from '@/lib/market';

function resolveAppUrl(req: Request) {
    const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (fromEnv) {
        const withoutTrailingSlash = fromEnv.replace(/\/$/, '');
        if (/^https?:\/\//i.test(withoutTrailingSlash)) return withoutTrailingSlash;
        return `https://${withoutTrailingSlash}`;
    }

    return new URL(req.url).origin;
}

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = await req.json();
        const { planId, market: clientMarket } = body;

        if (!planId || !Object.values(PLANS).includes(planId)) {
            return new NextResponse('Invalid plan ID', { status: 400 });
        }

        // Determine market from multiple sources with priority
        // 1. Request body (explicit market from client)
        // 2. Referer header (extract from path like /es/billing)
        // 3. Cookie
        // 4. Default to 'us'
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

        console.log('[STRIPE CHECKOUT] Market detected:', market, 'for plan:', planId);

        // Get market-specific price ID
        const priceId = getPriceId(market, planId as PlanId);
        if (!priceId) {
            console.error('[STRIPE CHECKOUT] No price ID configured for market:', market, 'plan:', planId);
            return new NextResponse('Price not configured for this market and plan', { status: 500 });
        }

        // Get user's Stripe Customer ID
        const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .single();

        let stripeCustomerId = subscription?.stripe_customer_id;

        // If no customer ID, create one
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    userId: user.id,
                },
            });
            stripeCustomerId = customer.id;

            // Update DB
            await supabase
                .from('user_subscriptions')
                .update({ stripe_customer_id: stripeCustomerId })
                .eq('user_id', user.id);
        }

        const appUrl = resolveAppUrl(req);

        // Create Checkout Session with market-specific price
        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${appUrl}/${market}/app/billing?success=true`,
            cancel_url: `${appUrl}/${market}/app/billing?canceled=true`,
            metadata: {
                userId: user.id,
                planId: planId,
                market: market, // Store market for webhook processing
            },
            subscription_data: {
                metadata: {
                    userId: user.id,
                    planId: planId,
                    market: market,
                }
            }
        });

        console.log('[STRIPE CHECKOUT] Session created:', checkoutSession.id, 'for market:', market);

        return NextResponse.json({ url: checkoutSession.url });
    } catch (error: any) {
        console.error('[STRIPE CHECKOUT ERROR]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
