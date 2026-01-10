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

/**
 * Stripe Price IDs organized by Market and Plan
 * 
 * IMPORTANT: Set these in your .env file and in Vercel/Railway environment:
 * 
 * US (USD):
 *   STRIPE_PRICE_FREE_US
 *   STRIPE_PRICE_STARTER_US
 *   STRIPE_PRICE_GROWTH_US
 *   STRIPE_PRICE_AGENCY_US
 * 
 * ES (EUR):
 *   STRIPE_PRICE_FREE_ES
 *   STRIPE_PRICE_STARTER_ES
 *   STRIPE_PRICE_GROWTH_ES
 *   STRIPE_PRICE_AGENCY_ES
 * 
 * MX (MXN):
 *   STRIPE_PRICE_FREE_MX
 *   STRIPE_PRICE_STARTER_MX
 *   STRIPE_PRICE_GROWTH_MX
 *   STRIPE_PRICE_AGENCY_MX
 */
export const STRIPE_PRICE_IDS: Record<Market, Record<PlanId, string | undefined>> = {
    us: {
        free: process.env.STRIPE_PRICE_FREE_US,
        starter: process.env.STRIPE_PRICE_STARTER_US,
        growth: process.env.STRIPE_PRICE_GROWTH_US,
        agency: process.env.STRIPE_PRICE_AGENCY_US,
    },
    es: {
        free: process.env.STRIPE_PRICE_FREE_ES,
        starter: process.env.STRIPE_PRICE_STARTER_ES,
        growth: process.env.STRIPE_PRICE_GROWTH_ES,
        agency: process.env.STRIPE_PRICE_AGENCY_ES,
    },
    mx: {
        free: process.env.STRIPE_PRICE_FREE_MX,
        starter: process.env.STRIPE_PRICE_STARTER_MX,
        growth: process.env.STRIPE_PRICE_GROWTH_MX,
        agency: process.env.STRIPE_PRICE_AGENCY_MX,
    },
};

/**
 * BACKWARD COMPATIBILITY: Legacy price IDs (EUR-based)
 * These fallback to ES market if new variables are not set
 * TODO: Remove after migration complete
 */
const LEGACY_PRICES = {
    free: process.env.STRIPE_PRICE_FREE,
    starter: process.env.STRIPE_PRICE_STARTER,
    growth: process.env.STRIPE_PRICE_GROWTH,
    agency: process.env.STRIPE_PRICE_AGENCY,
};

/**
 * Gets the Stripe Price ID for a specific market and plan
 * Falls back to legacy EUR prices if market-specific ones are not set
 */
export function getPriceId(market: Market, plan: PlanId): string | undefined {
    const priceId = STRIPE_PRICE_IDS[market][plan];
    
    if (!priceId) {
        // Fallback to legacy prices (assumed EUR/ES market)
        console.warn(
            `[Stripe] Missing price ID for market=${market}, plan=${plan}. ` +
            `Falling back to legacy price. Please set STRIPE_PRICE_${plan.toUpperCase()}_${market.toUpperCase()} in environment.`
        );
        return LEGACY_PRICES[plan];
    }
    
    return priceId;
}

/**
 * Gets the plan ID from a Stripe Price ID
 * Works across all markets
 */
export function getPlanFromPriceId(priceId: string): PlanId | null {
    // Search in market-specific prices
    for (const market of Object.keys(STRIPE_PRICE_IDS) as Market[]) {
        for (const [plan, price] of Object.entries(STRIPE_PRICE_IDS[market])) {
            if (price === priceId) {
                return plan as PlanId;
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
 * Returns null if not found
 */
export function getMarketFromPriceId(priceId: string): Market | null {
    for (const market of Object.keys(STRIPE_PRICE_IDS) as Market[]) {
        for (const price of Object.values(STRIPE_PRICE_IDS[market])) {
            if (price === priceId) {
                return market;
            }
        }
    }
    return null;
}

/**
 * Validates that all required Stripe Price IDs are configured
 * Logs warnings for missing configurations
 */
export function validateStripePriceConfig(): void {
    const markets: Market[] = ['us', 'es', 'mx'];
    const plans: PlanId[] = ['free', 'starter', 'growth', 'agency'];
    
    let hasIssues = false;
    
    for (const market of markets) {
        for (const plan of plans) {
            if (!STRIPE_PRICE_IDS[market][plan]) {
                console.warn(
                    `[Stripe Config] Missing: STRIPE_PRICE_${plan.toUpperCase()}_${market.toUpperCase()}`
                );
                hasIssues = true;
            }
        }
    }
    
    if (hasIssues) {
        console.warn(
            '[Stripe Config] Some price IDs are missing. The app will use legacy EUR prices as fallback. ' +
            'Please configure all market-specific prices in your environment variables.'
        );
    } else {
        console.log('[Stripe Config] All market-specific price IDs configured ✓');
    }
}
