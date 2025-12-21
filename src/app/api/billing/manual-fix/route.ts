import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, STRIPE_PRICES } from '@/lib/stripe';

/**
 * TEMPORAL - Manual subscription fix
 * Use this to manually process subscriptions that were paid but not processed by webhook
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[MANUAL FIX] Processing subscriptions for user:', user.id);

        // Get user's current data
        const { data: userSub } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (!userSub?.stripe_customer_id) {
            return NextResponse.json({ ok: false, error: 'No Stripe customer found' });
        }

        // Get ALL subscriptions from Stripe for this customer
        const subscriptions = await stripe.subscriptions.list({
            customer: userSub.stripe_customer_id,
            status: 'active',
            limit: 10
        });

        console.log('[MANUAL FIX] Found', subscriptions.data.length, 'active subscriptions');

        if (subscriptions.data.length === 0) {
            return NextResponse.json({ 
                ok: false, 
                error: 'No active subscriptions found in Stripe' 
            });
        }

        // Get the MOST RECENT subscription (last one created)
        const latestSub = subscriptions.data.sort((a, b) => b.created - a.created)[0];
        
        // Map price to plan
        const priceId = latestSub.items.data[0].price.id;
        let planId: string | null = null;
        
        for (const [planKey, planPriceId] of Object.entries(STRIPE_PRICES)) {
            if (planPriceId === priceId) {
                planId = planKey;
                break;
            }
        }

        if (!planId) {
            return NextResponse.json({ 
                ok: false, 
                error: `Price ${priceId} not mapped to any plan` 
            });
        }

        console.log('[MANUAL FIX] Latest subscription:', latestSub.id, 'Plan:', planId);

        // Cancel ALL OTHER subscriptions (keep only the latest)
        const subsToCancel = subscriptions.data.filter(sub => sub.id !== latestSub.id);
        
        for (const oldSub of subsToCancel) {
            console.log('[MANUAL FIX] Canceling old subscription:', oldSub.id);
            try {
                await stripe.subscriptions.cancel(oldSub.id);
            } catch (err) {
                console.warn('[MANUAL FIX] Failed to cancel', oldSub.id, err);
            }
        }

        // Update Supabase with the latest subscription
        await supabase
            .from('user_subscriptions')
            .update({
                stripe_subscription_id: latestSub.id,
                plan_id: planId,
                status: 'active',
                current_period_start: new Date(latestSub.current_period_start * 1000),
                current_period_end: new Date(latestSub.current_period_end * 1000),
                pending_plan_id: null,
                pending_effective_date: null,
                pending_subscription_id: null
            })
            .eq('user_id', user.id);

        console.log('[MANUAL FIX] Updated DB to plan:', planId);

        // Get plan tokens
        const { data: planData } = await supabase
            .from('subscription_plans')
            .select('monthly_tokens')
            .eq('id', planId)
            .single();

        const tokensToAdd = planData?.monthly_tokens || 0;

        // Check current balance
        const { data: balanceData } = await supabase
            .from('user_token_balances')
            .select('balance')
            .eq('user_id', user.id)
            .single();

        const currentBalance = balanceData?.balance || 0;

        console.log('[MANUAL FIX] Current balance:', currentBalance, 'Will add:', tokensToAdd);

        return NextResponse.json({
            ok: true,
            message: 'Subscriptions fixed manually',
            details: {
                activeSubscription: latestSub.id,
                planId,
                canceledSubscriptions: subsToCancel.length,
                currentBalance,
                tokensAvailable: tokensToAdd,
                note: 'Tokens were NOT added automatically. Contact support if you need them credited.'
            }
        });

    } catch (error: any) {
        console.error('[MANUAL FIX] Error:', error);
        return NextResponse.json({ 
            ok: false, 
            error: error.message 
        }, { status: 500 });
    }
}
