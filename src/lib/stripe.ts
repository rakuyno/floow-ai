import Stripe from 'stripe';
import { Market } from './market';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing. Please set it in your environment variables.');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
    typescript: true,
});

export const PLANS = {
    FREE: 'free',
    STARTER: 'starter',
    GROWTH: 'growth',
    AGENCY: 'agency',
} as const;

export type PlanId = typeof PLANS[keyof typeof PLANS];
export type BillingInterval = 'monthly' | 'annual';

/**
 * Stripe Price IDs organized by Market, Plan, and Billing Interval
 * 
 * IMPORTANT: Set these in your .env file and in Vercel/Railway environment:
 * 
 * Format: STRIPE_PRICE_{PLAN}_{MARKET}_{INTERVAL}
 * Example: STRIPE_PRICE_STARTER_US_MONTHLY=price_xxx...
 */
export const STRIPE_PRICE_IDS: Record<Market, Record<PlanId, Record<BillingInterval, string | undefined>>> = {
    us: {
        free: {
            monthly: undefined,
            annual: undefined,
        },
        starter: {
            monthly: process.env.STRIPE_PRICE_STARTER_US_MONTHLY,
            annual: process.env.STRIPE_PRICE_STARTER_US_ANNUAL,
        },
        growth: {
            monthly: process.env.STRIPE_PRICE_GROWTH_US_MONTHLY,
            annual: process.env.STRIPE_PRICE_GROWTH_US_ANNUAL,
        },
        agency: {
            monthly: process.env.STRIPE_PRICE_AGENCY_US_MONTHLY,
            annual: process.env.STRIPE_PRICE_AGENCY_US_ANNUAL,
        },
    },
    es: {
        free: {
            monthly: undefined,
            annual: undefined,
        },
        starter: {
            monthly: process.env.STRIPE_PRICE_STARTER_ES_MONTHLY,
            annual: process.env.STRIPE_PRICE_STARTER_ES_ANNUAL,
        },
        growth: {
            monthly: process.env.STRIPE_PRICE_GROWTH_ES_MONTHLY,
            annual: process.env.STRIPE_PRICE_GROWTH_ES_ANNUAL,
        },
        agency: {
            monthly: process.env.STRIPE_PRICE_AGENCY_ES_MONTHLY,
            annual: process.env.STRIPE_PRICE_AGENCY_ES_ANNUAL,
        },
    },
    mx: {
        free: {
            monthly: undefined,
            annual: undefined,
        },
        starter: {
            monthly: process.env.STRIPE_PRICE_STARTER_MX_MONTHLY,
            annual: process.env.STRIPE_PRICE_STARTER_MX_ANNUAL,
        },
        growth: {
            monthly: process.env.STRIPE_PRICE_GROWTH_MX_MONTHLY,
            annual: process.env.STRIPE_PRICE_GROWTH_MX_ANNUAL,
        },
        agency: {
            monthly: process.env.STRIPE_PRICE_AGENCY_MX_MONTHLY,
            annual: process.env.STRIPE_PRICE_AGENCY_MX_ANNUAL,
        },
    },
};

/**
 * Token package Price IDs by Market
 */
export const TOKEN_PRICE_IDS: Record<Market, Record<string, string | undefined>> = {
    us: {
        '100': process.env.STRIPE_PRICE_100TK_US,
        '300': process.env.STRIPE_PRICE_300TK_US,
        '600': process.env.STRIPE_PRICE_600TK_US,
        '1200': process.env.STRIPE_PRICE_1200TK_US,
        '3000': process.env.STRIPE_PRICE_3000TK_US,
        '6000': process.env.STRIPE_PRICE_6000TK_US,
    },
    es: {
        '100': process.env.STRIPE_PRICE_100TK_ES,
        '300': process.env.STRIPE_PRICE_300TK_ES,
        '600': process.env.STRIPE_PRICE_600TK_ES,
        '1200': process.env.STRIPE_PRICE_1200TK_ES,
        '3000': process.env.STRIPE_PRICE_3000TK_ES,
        '6000': process.env.STRIPE_PRICE_6000TK_ES,
    },
    mx: {
        '100': process.env.STRIPE_PRICE_100TK_MX,
        '300': process.env.STRIPE_PRICE_300TK_MX,
        '600': process.env.STRIPE_PRICE_600TK_MX,
        '1200': process.env.STRIPE_PRICE_1200TK_MX,
        '3000': process.env.STRIPE_PRICE_3000TK_MX,
        '6000': process.env.STRIPE_PRICE_6000TK_MX,
    },
};

/**
 * BACKWARD COMPATIBILITY: Legacy price IDs
 */
const LEGACY_PRICES = {
    free: undefined,
    starter: process.env.STRIPE_PRICE_STARTER,
    growth: process.env.STRIPE_PRICE_GROWTH,
    agency: process.env.STRIPE_PRICE_AGENCY,
};

const LEGACY_TOKEN_PRICES: Record<string, string | undefined> = {
    '100': process.env.STRIPE_PRICE_100TK,
    '300': process.env.STRIPE_PRICE_300TK,
    '600': process.env.STRIPE_PRICE_600TK,
    '1200': process.env.STRIPE_PRICE_1200TK,
    '3000': process.env.STRIPE_PRICE_3000TK,
    '6000': process.env.STRIPE_PRICE_6000TK,
};

/**
 * Gets the Stripe Price ID for a specific market, plan, and billing interval
 */
export function getPriceId(
    market: Market, 
    plan: PlanId, 
    interval: BillingInterval = 'monthly'
): string | undefined {
    const priceId = STRIPE_PRICE_IDS[market]?.[plan]?.[interval];
    
    if (!priceId) {
        // Fallback to legacy prices (monthly only)
        if (interval === 'monthly') {
            console.warn(
                `[Stripe] Missing price ID for market=${market}, plan=${plan}, interval=${interval}. ` +
                `Falling back to legacy price. Please set STRIPE_PRICE_${plan.toUpperCase()}_${market.toUpperCase()}_${interval.toUpperCase()} in environment.`
            );
            return LEGACY_PRICES[plan];
        }
        
        console.error(
            `[Stripe] Missing price ID for market=${market}, plan=${plan}, interval=${interval}. ` +
            `Please set STRIPE_PRICE_${plan.toUpperCase()}_${market.toUpperCase()}_${interval.toUpperCase()} in environment.`
        );
        return undefined;
    }
    
    return priceId;
}

/**
 * Gets the Stripe Price ID for token packages
 */
export function getTokenPriceId(market: Market, tokenAmount: number): string | undefined {
    const priceId = TOKEN_PRICE_IDS[market]?.[String(tokenAmount)];
    
    if (!priceId) {
        console.warn(
            `[Stripe] Missing token price ID for market=${market}, amount=${tokenAmount}. ` +
            `Falling back to legacy price. Please set STRIPE_PRICE_${tokenAmount}TK_${market.toUpperCase()} in environment.`
        );
        return LEGACY_TOKEN_PRICES[String(tokenAmount)];
    }
    
    return priceId;
}

/**
 * Gets the plan ID from a Stripe Price ID
 */
export function getPlanFromPriceId(priceId: string): PlanId | null {
    // Search in market-specific prices
    for (const market of Object.keys(STRIPE_PRICE_IDS) as Market[]) {
        for (const [plan, intervals] of Object.entries(STRIPE_PRICE_IDS[market])) {
            for (const price of Object.values(intervals)) {
                if (price === priceId) {
                    return plan as PlanId;
                }
            }
        }
    }
    
    // Fallback to legacy prices
    for (const [plan, price] of Object.entries(LEGACY_PRICES)) {
        if (price === priceId) {
            return plan as PlanId;
        }
    }
    
    return null;
}

/**
 * Gets the market from a Stripe Price ID
 */
export function getMarketFromPriceId(priceId: string): Market | null {
    for (const market of Object.keys(STRIPE_PRICE_IDS) as Market[]) {
        for (const intervals of Object.values(STRIPE_PRICE_IDS[market])) {
            for (const price of Object.values(intervals)) {
                if (price === priceId) {
                    return market;
                }
            }
        }
    }
    return null;
}

/**
 * Validates that all required Stripe Price IDs are configured
 */
export function validateStripePriceConfig(): void {
    const markets: Market[] = ['us', 'es', 'mx'];
    const plans: PlanId[] = ['starter', 'growth', 'agency']; // Skip 'free'
    const intervals: BillingInterval[] = ['monthly', 'annual'];
    
    let hasIssues = false;
    
    console.log('[Stripe Config] Validating subscription price IDs...');
    for (const market of markets) {
        for (const plan of plans) {
            for (const interval of intervals) {
                if (!STRIPE_PRICE_IDS[market][plan][interval]) {
                    console.warn(
                        `[Stripe Config] Missing: STRIPE_PRICE_${plan.toUpperCase()}_${market.toUpperCase()}_${interval.toUpperCase()}`
                    );
                    hasIssues = true;
                }
            }
        }
    }
    
    console.log('[Stripe Config] Validating token price IDs...');
    const tokenAmounts = ['100', '300', '600', '1200', '3000', '6000'];
    for (const market of markets) {
        for (const amount of tokenAmounts) {
            if (!TOKEN_PRICE_IDS[market][amount]) {
                console.warn(
                    `[Stripe Config] Missing: STRIPE_PRICE_${amount}TK_${market.toUpperCase()}`
                );
                hasIssues = true;
            }
        }
    }
    
    if (hasIssues) {
        console.warn(
            '[Stripe Config] Some price IDs are missing. The app will use legacy prices as fallback. ' +
            'Please configure all market-specific prices in your environment variables.'
        );
    } else {
        console.log('[Stripe Config] All price IDs configured ✓');
    }
}
