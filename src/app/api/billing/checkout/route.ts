import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, STRIPE_PRICES, PLANS } from '@/lib/stripe';

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = await req.json();
        const { planId } = body;

        if (!planId || !Object.values(PLANS).includes(planId)) {
            return new NextResponse('Invalid plan ID', { status: 400 });
        }

        const priceId = STRIPE_PRICES[planId as keyof typeof STRIPE_PRICES];
        if (!priceId) {
            return new NextResponse('Price not configured for this plan', { status: 500 });
        }

        // Get user's Stripe Customer ID
        const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .single();

        let stripeCustomerId = subscription?.stripe_customer_id;

        // If no customer ID, create one
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    userId: user.id,
                },
            });
            stripeCustomerId = customer.id;

            // Update DB
            await supabase
                .from('user_subscriptions')
                .update({ stripe_customer_id: stripeCustomerId })
                .eq('user_id', user.id);
        }

        // Create Checkout Session
        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=true`,
            metadata: {
                userId: user.id,
                planId: planId,
            },
            subscription_data: {
                metadata: {
                    userId: user.id,
                    planId: planId
                }
            }
        });

        return NextResponse.json({ url: checkoutSession.url });
    } catch (error: any) {
        console.error('[STRIPE CHECKOUT ERROR]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
