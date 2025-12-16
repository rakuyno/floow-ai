import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing. Please set it in your environment variables.');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16', // Use latest or matching version
    typescript: true,
});

export const PLANS = {
    FREE: 'free',
    STARTER: 'starter',
    GROWTH: 'growth',
    AGENCY: 'agency',
} as const;

export const STRIPE_PRICES = {
    [PLANS.FREE]: process.env.STRIPE_PRICE_FREE,
    [PLANS.STARTER]: process.env.STRIPE_PRICE_STARTER,
    [PLANS.GROWTH]: process.env.STRIPE_PRICE_GROWTH,
    [PLANS.AGENCY]: process.env.STRIPE_PRICE_AGENCY,
};

export function getPlanFromPriceId(priceId: string): string | null {
    for (const [plan, price] of Object.entries(STRIPE_PRICES)) {
        if (price === priceId) return plan;
    }
    return null;
}
