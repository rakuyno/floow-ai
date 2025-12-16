import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

function resolveAppUrl(req: Request) {
    const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (fromEnv) {
        const withoutTrailingSlash = fromEnv.replace(/\/$/, '');
        if (/^https?:\/\//i.test(withoutTrailingSlash)) return withoutTrailingSlash;
        return `https://${withoutTrailingSlash}`;
    }

    return new URL(req.url).origin;
}

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Get user's Stripe Customer ID
        const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .single();

        if (!subscription?.stripe_customer_id) {
            return new NextResponse('No Stripe customer found', { status: 404 });
        }

        const appUrl = resolveAppUrl(req);

        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripe_customer_id,
            return_url: `${appUrl}/dashboard/billing`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('[STRIPE PORTAL ERROR]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
