import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

function resolveAppUrl(req: Request) {
    const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (fromEnv) {
        const withoutTrailingSlash = fromEnv.replace(/\/$/, '');
        if (/^https?:\/\//i.test(withoutTrailingSlash)) return withoutTrailingSlash;
        return `https://${withoutTrailingSlash}`;
    }

    return new URL(req.url).origin;
}

export async function POST(req: Request) {
    try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const { priceId } = await req.json()

        if (!priceId) {
            return new NextResponse('Price ID is required', { status: 400 })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .single()

        let stripeCustomerId = profile?.stripe_customer_id

        // Create Stripe Customer if not exists
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    userId: user.id,
                },
            })
            stripeCustomerId = customer.id

            await supabase
                .from('profiles')
                .update({ stripe_customer_id: stripeCustomerId })
                .eq('user_id', user.id)
        }

        const appUrl = resolveAppUrl(req);

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${appUrl}/app/billing?success=true`,
            cancel_url: `${appUrl}/app/billing?canceled=true`,
            metadata: {
                userId: user.id,
            },
        })

        return NextResponse.json({ url: session.url })
    } catch (error: any) {
        console.error('[STRIPE_CHECKOUT]', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
}
