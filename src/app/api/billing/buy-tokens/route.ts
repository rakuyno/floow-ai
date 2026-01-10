import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { normalizeMarket, type Market, marketFromPath, MARKET_COOKIE_NAME } from '@/lib/market';

// Token packages configuration
// TODO: Consider market-specific token prices if needed
// For now, using single EUR-based prices (can be extended to per-market pricing)
const TOKEN_PACKAGES = {
    '100': { tokens: 100, priceId: process.env.STRIPE_PRICE_100TK, price: 15 },
    '300': { tokens: 300, priceId: process.env.STRIPE_PRICE_300TK, price: 39 },
    '600': { tokens: 600, priceId: process.env.STRIPE_PRICE_600TK, price: 69 },
    '1200': { tokens: 1200, priceId: process.env.STRIPE_PRICE_1200TK, price: 129 },
    '3000': { tokens: 3000, priceId: process.env.STRIPE_PRICE_3000TK, price: 299 },
    '6000': { tokens: 6000, priceId: process.env.STRIPE_PRICE_6000TK, price: 549 },
} as const;

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
        const packageKey = String(tokenAmount) as keyof typeof TOKEN_PACKAGES;
        const tokenPackage = TOKEN_PACKAGES[packageKey];

        if (!tokenPackage) {
            return NextResponse.json({ ok: false, error: 'Invalid token amount' }, { status: 400 });
        }

        if (!tokenPackage.priceId) {
            console.error('[BUY-TOKENS] Missing price ID for package:', tokenAmount);
            return NextResponse.json({ ok: false, error: 'Price not configured' }, { status: 500 });
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
                    price: tokenPackage.priceId,
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
