/**
 * Multi-Market System - Core Library
 * 
 * Manages market detection, resolution, and configuration for:
 * - US (USD, English)
 * - ES (EUR, Spanish-Spain)
 * - MX (MXN, Spanish-Mexico)
 */

export type Market = 'us' | 'es' | 'mx';
export type Currency = 'USD' | 'EUR' | 'MXN';
export type Locale = 'en' | 'es-ES' | 'es-MX';

export interface MarketConfig {
    locale: Locale;
    currency: Currency;
    countryCode: string; // ISO 3166-1 alpha-2
    name: string;
}

/**
 * Market configuration mapping
 */
export const MARKET_CONFIG: Record<Market, MarketConfig> = {
    us: {
        locale: 'en',
        currency: 'USD',
        countryCode: 'US',
        name: 'United States',
    },
    es: {
        locale: 'es-ES',
        currency: 'EUR',
        countryCode: 'ES',
        name: 'España',
    },
    mx: {
        locale: 'es-MX',
        currency: 'MXN',
        countryCode: 'MX',
        name: 'México',
    },
};

/**
 * Default market when country cannot be determined or is not supported
 */
export const DEFAULT_MARKET: Market = 'us';

/**
 * Valid market values for validation
 */
export const VALID_MARKETS: Market[] = ['us', 'es', 'mx'];

/**
 * Normalizes a string input to a valid Market or returns the default
 */
export function normalizeMarket(input: string | null | undefined): Market {
    if (!input) return DEFAULT_MARKET;
    
    const normalized = input.toLowerCase().trim();
    
    if (VALID_MARKETS.includes(normalized as Market)) {
        return normalized as Market;
    }
    
    return DEFAULT_MARKET;
}

/**
 * Extracts market from a pathname (e.g., "/es/dashboard" => "es")
 * Returns null if no market found in path
 */
export function marketFromPath(pathname: string): Market | null {
    if (!pathname) return null;
    
    // Remove leading slash and get first segment
    const segments = pathname.replace(/^\//, '').split('/');
    const firstSegment = segments[0]?.toLowerCase();
    
    if (firstSegment && VALID_MARKETS.includes(firstSegment as Market)) {
        return firstSegment as Market;
    }
    
    return null;
}

/**
 * Maps country code to appropriate market
 * Countries not explicitly supported default to US market
 */
export function marketFromCountry(countryCode: string | null | undefined): Market {
    if (!countryCode) return DEFAULT_MARKET;
    
    const country = countryCode.toUpperCase().trim();
    
    switch (country) {
        case 'ES':
            return 'es';
        case 'MX':
            return 'mx';
        case 'US':
            return 'us';
        default:
            // Any other country defaults to US market
            return DEFAULT_MARKET;
    }
}

/**
 * Detects country from request headers
 * Checks multiple header sources (Vercel, Cloudflare, etc.)
 */
export function detectCountry(headers: Headers): string | null {
    // Priority order of headers to check
    const headerNames = [
        'x-vercel-ip-country',     // Vercel
        'cf-ipcountry',            // Cloudflare
        'x-country',               // Generic
        'x-geo-country',           // Some CDNs
    ];
    
    for (const headerName of headerNames) {
        const value = headers.get(headerName);
        if (value && value !== 'unknown' && value !== 'XX') {
            return value.toUpperCase();
        }
    }
    
    return null;
}

/**
 * Checks if a User-Agent string appears to be a bot/crawler
 */
export function isBot(userAgent: string | null): boolean {
    if (!userAgent) return false;
    
    const botPatterns = [
        'bot',
        'spider',
        'crawl',
        'slurp',
        'facebookexternalhit',
        'twitterbot',
        'googlebot',
        'bingbot',
        'linkedinbot',
        'whatsapp',
        'slack',
        'telegram',
        'discord',
        'prerender',
    ];
    
    const ua = userAgent.toLowerCase();
    return botPatterns.some(pattern => ua.includes(pattern));
}

/**
 * Resolves the market from multiple sources with priority:
 * 1. Pathname (if user is already on a market route)
 * 2. Cookie (if previously set)
 * 3. Geo-detection from headers
 * 4. Default (US)
 */
interface ResolveMarketOptions {
    pathname: string;
    cookies?: Record<string, string>;
    headers?: Headers;
}

export function resolveMarket(options: ResolveMarketOptions): Market {
    const { pathname, cookies, headers } = options;
    
    // 1. Check pathname first (highest priority)
    const pathMarket = marketFromPath(pathname);
    if (pathMarket) {
        return pathMarket;
    }
    
    // 2. Check cookie
    if (cookies?.market) {
        const cookieMarket = normalizeMarket(cookies.market);
        if (cookieMarket !== DEFAULT_MARKET || cookies.market === DEFAULT_MARKET) {
            return cookieMarket;
        }
    }
    
    // 3. Geo-detect from headers
    if (headers) {
        const country = detectCountry(headers);
        if (country) {
            return marketFromCountry(country);
        }
    }
    
    // 4. Default
    return DEFAULT_MARKET;
}

/**
 * Generates the market path prefix (e.g., "/es", "/mx", "/us")
 */
export function getMarketPath(market: Market): string {
    return `/${market}`;
}

/**
 * Checks if a pathname should be excluded from market routing
 * (e.g., API routes, static assets, Next.js internals)
 */
export function isExcludedPath(pathname: string): boolean {
    const excludedPatterns = [
        /^\/_next\//,          // Next.js internals
        /^\/api\//,            // API routes
        /^\/favicon\.ico$/,    // Favicon
        /^\/robots\.txt$/,     // Robots
        /^\/sitemap\.xml$/,    // Sitemap
        /^\/_vercel\//,        // Vercel internals
        /^\/(.*)\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|json)$/i, // Static assets
    ];
    
    return excludedPatterns.some(pattern => pattern.test(pathname));
}

/**
 * Cookie configuration for market persistence
 */
export const MARKET_COOKIE_NAME = 'market';
export const MARKET_COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90 days in seconds

