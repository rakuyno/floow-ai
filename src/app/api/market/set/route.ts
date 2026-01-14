import { NextRequest, NextResponse } from 'next/server';
import { normalizeMarket, MARKET_COOKIE_NAME, MARKET_COOKIE_MAX_AGE } from '@/lib/market';

/**
 * API endpoint to set market cookie
 * Allows changing market without navigation
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { market } = body;

        if (!market) {
            return NextResponse.json({ ok: false, error: 'Market is required' }, { status: 400 });
        }

        const normalizedMarket = normalizeMarket(market);
        
        console.log('[MARKET API] Setting market cookie:', normalizedMarket);

        const response = NextResponse.json({ ok: true, market: normalizedMarket });

        // Set market cookie
        response.cookies.set(MARKET_COOKIE_NAME, normalizedMarket, {
            maxAge: MARKET_COOKIE_MAX_AGE,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        });

        return response;

    } catch (error: any) {
        console.error('[MARKET API] Error:', error);
        return NextResponse.json({ 
            ok: false, 
            error: error.message || 'Internal Error' 
        }, { status: 500 });
    }
}
