import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { STRIPE_PRICES } from '@/lib/stripe';

/**
 * Simple plan change: Always redirect to Stripe Checkout
 * No upgrades, no downgrades, no schedules, no prorations
 * Just: cancel old sub + create new checkout
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { targetPlanId } = body;

        console.log('[BILLING] Change plan request:', { userId: user.id, targetPlanId });

        // Get current subscription
        const { data: userSub } = await supabase
            .from('user_subscriptions')
            .select('plan_id, stripe_subscription_id')
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

            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            
            // Cancel immediately
            await stripe.subscriptions.cancel(userSub.stripe_subscription_id);

            console.log('[BILLING] Subscription canceled immediately');

            return NextResponse.json({ ok: true, action: 'canceled' });
        }

        // ============================================================
        // CASE 2: Any paid plan → Redirect to Checkout
        // ============================================================
        
        const targetPriceId = STRIPE_PRICES[targetPlanId as keyof typeof STRIPE_PRICES];
        if (!targetPriceId) {
            return NextResponse.json({ ok: false, error: 'Price not configured' }, { status: 500 });
        }

        // Call checkout endpoint to get URL
        const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const checkoutUrl = new URL('/api/billing/checkout', appUrl);
        
        const checkoutResponse = await fetch(checkoutUrl.toString(), {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Cookie': req.headers.get('Cookie') || ''
            },
            body: JSON.stringify({ planId: targetPlanId })
        });

        if (!checkoutResponse.ok) {
            console.error('[BILLING] Checkout failed:', await checkoutResponse.text());
            return NextResponse.json({ ok: false, error: 'Failed to create checkout' }, { status: 500 });
        }

        const { url } = await checkoutResponse.json();
        
        return NextResponse.json({
            ok: true,
            needsCheckout: true,
            checkoutUrl: url
        });

    } catch (error: any) {
        console.error('[BILLING] Change plan error:', error);
        return NextResponse.json({ 
            ok: false, 
            error: error.message || 'Internal Error' 
        }, { status: 500 });
    }
}
