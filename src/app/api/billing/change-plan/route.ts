import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, STRIPE_PRICES } from '@/lib/stripe';

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
            .select('plan_id, stripe_subscription_id, stripe_customer_id')
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
            
            // Cancel immediately in Stripe
            await stripe.subscriptions.cancel(userSub.stripe_subscription_id);

            // Update DB immediately (don't wait for webhook)
            await supabase
                .from('user_subscriptions')
                .update({
                    plan_id: 'free',
                    status: 'active',
                    stripe_subscription_id: null,
                    pending_plan_id: null,
                    pending_effective_date: null,
                    pending_subscription_id: null
                })
                .eq('user_id', user.id);

            console.log('[BILLING] Subscription canceled and DB updated to free');

            return NextResponse.json({ ok: true, action: 'canceled' });
        }

        // ============================================================
        // CASE 2: Any paid plan → Create Checkout Session
        // ============================================================
        
        const targetPriceId = STRIPE_PRICES[targetPlanId as keyof typeof STRIPE_PRICES];
        if (!targetPriceId) {
            return NextResponse.json({ ok: false, error: 'Price not configured' }, { status: 500 });
        }

        // Determine app URL
        const forwardedHost = req.headers.get('x-forwarded-host');
        const forwardedProto = req.headers.get('x-forwarded-proto');
        
        let appUrl: string;
        if (forwardedHost) {
            appUrl = `${forwardedProto || 'https'}://${forwardedHost}`;
        } else {
            appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        }

        console.log('[BILLING] Creating checkout for:', targetPlanId, 'customer:', userSub?.stripe_customer_id);

        // Create checkout session directly
        const session = await stripe.checkout.sessions.create({
            customer: userSub?.stripe_customer_id || undefined,
            customer_email: userSub?.stripe_customer_id ? undefined : user.email,
            line_items: [
                {
                    price: targetPriceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${appUrl}/app/billing?success=true`,
            cancel_url: `${appUrl}/app/billing?canceled=true`,
            metadata: {
                userId: user.id,
                planId: targetPlanId,
            },
        });

        console.log('[BILLING] Checkout session created:', session.id);
        
        return NextResponse.json({
            ok: true,
            needsCheckout: true,
            checkoutUrl: session.url
        });

    } catch (error: any) {
        console.error('[BILLING] Change plan error:', error);
        return NextResponse.json({ 
            ok: false, 
            error: error.message || 'Internal Error' 
        }, { status: 500 });
    }
}
