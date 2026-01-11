import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, getTokenPriceId } from '@/lib/stripe';
import { normalizeMarket, type Market, marketFromPath, MARKET_COOKIE_NAME } from '@/lib/market';

// Token packages configuration (amounts only, prices come from env)
const VALID_TOKEN_AMOUNTS = [100, 300, 600, 1200, 3000, 6000];

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { tokenAmount, market: clientMarket } = body;

        // Determine market
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

        console.log('[BUY-TOKENS] Purchase request:', { userId: user.id, tokenAmount, market });

        // Validate token amount
        if (!VALID_TOKEN_AMOUNTS.includes(tokenAmount)) {
            return NextResponse.json({ ok: false, error: 'Invalid token amount' }, { status: 400 });
        }

        // Get market-specific price ID
        const priceId = getTokenPriceId(market, tokenAmount);
        
        if (!priceId) {
            console.error('[BUY-TOKENS] Missing price ID for market:', market, 'amount:', tokenAmount);
            return NextResponse.json({ ok: false, error: 'Price not configured for this market' }, { status: 500 });
        }

        // Get user's customer ID (if exists)
        const { data: userSub } = await supabase
            .from('user_subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .maybeSingle();

        // Determine app URL
        const forwardedHost = req.headers.get('x-forwarded-host');
        const forwardedProto = req.headers.get('x-forwarded-proto');
        
        let appUrl: string;
        if (forwardedHost) {
            appUrl = `${forwardedProto || 'https'}://${forwardedHost}`;
        } else {
            appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        }

        console.log('[BUY-TOKENS] Creating checkout session for:', tokenAmount, 'tokens, market:', market);

        // Create one-time payment checkout session
        const session = await stripe.checkout.sessions.create({
            customer: userSub?.stripe_customer_id || undefined,
            customer_email: userSub?.stripe_customer_id ? undefined : user.email,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'payment', // ONE-TIME payment, not subscription
            success_url: `${appUrl}/${market}/app/billing?token_purchase=success`,
            cancel_url: `${appUrl}/${market}/app/billing?token_purchase=canceled`,
            metadata: {
                userId: user.id,
                tokenAmount: String(tokenAmount),
                purchaseType: 'token_package',
                market: market,
            },
        });

        console.log('[BUY-TOKENS] Checkout session created:', session.id, 'for market:', market);
        
        return NextResponse.json({
            ok: true,
            checkoutUrl: session.url
        });

    } catch (error: any) {
        console.error('[BUY-TOKENS] Error:', error);
        return NextResponse.json({ 
            ok: false, 
            error: error.message || 'Internal Error' 
        }, { status: 500 });
    }
}
