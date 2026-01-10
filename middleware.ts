import { NextRequest, NextResponse } from 'next/server';
import {
    detectCountry,
    isBot,
    isExcludedPath,
    marketFromCountry,
    marketFromPath,
    normalizeMarket,
    MARKET_COOKIE_NAME,
    MARKET_COOKIE_MAX_AGE,
    DEFAULT_MARKET,
    type Market,
} from './src/lib/market';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    // Skip middleware for excluded paths (API, static assets, etc.)
    if (isExcludedPath(pathname)) {
        return NextResponse.next();
    }
    
    // Get current market from path
    const pathMarket = marketFromPath(pathname);
    
    // If user is already on a market route, allow it and ensure cookie is set
    if (pathMarket) {
        const response = NextResponse.next();
        
        // Sync cookie with current path market
        const currentCookie = request.cookies.get(MARKET_COOKIE_NAME)?.value;
        if (currentCookie !== pathMarket) {
            response.cookies.set(MARKET_COOKIE_NAME, pathMarket, {
                maxAge: MARKET_COOKIE_MAX_AGE,
                path: '/',
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
            });
        }
        
        return response;
    }
    
    // Only handle root path "/" for geo-redirect
    if (pathname !== '/') {
        return NextResponse.next();
    }
    
    // Check if user agent is a bot - bots should not be redirected
    const userAgent = request.headers.get('user-agent');
    if (isBot(userAgent)) {
        // Let bots access the root page directly for SEO indexing
        return NextResponse.next();
    }
    
    // Determine target market for redirect
    let targetMarket: Market;
    
    // 1. Check cookie first (returning user)
    const marketCookie = request.cookies.get(MARKET_COOKIE_NAME)?.value;
    if (marketCookie) {
        targetMarket = normalizeMarket(marketCookie);
    } else {
        // 2. Detect country from headers (new user)
        const country = detectCountry(request.headers);
        targetMarket = country ? marketFromCountry(country) : DEFAULT_MARKET;
    }
    
    // Redirect to market-specific route
    const url = request.nextUrl.clone();
    url.pathname = `/${targetMarket}`;
    
    const response = NextResponse.redirect(url, 302); // 302 = temporary redirect
    
    // Set market cookie
    response.cookies.set(MARKET_COOKIE_NAME, targetMarket, {
        maxAge: MARKET_COOKIE_MAX_AGE,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    
    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};

