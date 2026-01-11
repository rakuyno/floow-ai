import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * CRON JOB: Monthly Token Reset for Annual Plans
 * 
 * Purpose: Annual subscriptions are billed once per year, but users should receive
 * their monthly token allocation every month, not all at once.
 * 
 * This endpoint should be called daily by a cron job (Vercel Cron, Cloudflare Workers, etc.)
 * 
 * Logic:
 * 1. Find all users with billing_interval='annual' AND status='active'
 * 2. Check if last_token_reset_at was more than 30 days ago
 * 3. Reset their tokens to plan's monthly_tokens
 * 4. Apply pending downgrades if effective_date has passed
 * 5. Update last_token_reset_at timestamp
 * 
 * Authentication: Verify secret token to prevent abuse
 */

// Create admin client (uses service_role key for full access)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function GET(req: NextRequest) {
    try {
        // Authentication check: Verify cron secret
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET || 'dev_secret_change_in_prod';
        
        if (authHeader !== `Bearer ${cronSecret}`) {
            console.error('[CRON] Unauthorized access attempt');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[CRON] Starting monthly token reset for annual plans...');

        // PROPER SOLUTION: Query by next_token_reset_at (no drift, no heuristics)
        // This uses a real timestamp instead of "X days ago" which causes drift
        const now = new Date();

        const { data: subscriptionsToReset, error: fetchError } = await supabaseAdmin
            .from('user_subscriptions')
            .select(`
                user_id,
                plan_id,
                pending_plan_id,
                pending_effective_date,
                pending_subscription_id,
                last_token_reset_at,
                next_token_reset_at,
                last_reset_invoice_id,
                stripe_subscription_id,
                current_period_start,
                current_period_end
            `)
            .eq('billing_interval', 'annual')
            .eq('status', 'active')
            .not('next_token_reset_at', 'is', null)
            .lte('next_token_reset_at', now.toISOString());

        if (fetchError) {
            console.error('[CRON] Error fetching subscriptions:', fetchError);
            throw fetchError;
        }

        console.log(`[CRON] Found ${subscriptionsToReset?.length || 0} subscriptions to reset`);

        let successCount = 0;
        let errorCount = 0;
        const errors: any[] = [];

        // Process each subscription
        for (const sub of subscriptionsToReset || []) {
            try {
                console.log(`[CRON] Processing user ${sub.user_id}, plan: ${sub.plan_id}, next_reset: ${sub.next_token_reset_at}`);

                // Check if there's a pending downgrade to apply
                let effectivePlanId = sub.plan_id;
                let downgradeMeta: Record<string, any> = {};
                
                if (sub.pending_plan_id && sub.pending_effective_date) {
                    const effectiveDate = new Date(sub.pending_effective_date);
                    const now = new Date();
                    
                    if (now >= effectiveDate) {
                        console.log(`[CRON] ⬇️ Applying pending downgrade for user ${sub.user_id}:`, {
                            from: sub.plan_id,
                            to: sub.pending_plan_id,
                            effectiveDate: effectiveDate.toISOString()
                        });
                        
                        effectivePlanId = sub.pending_plan_id;
                        downgradeMeta = {
                            downgradedFrom: sub.plan_id,
                            downgradedTo: sub.pending_plan_id,
                            source: 'cron_annual_reset'
                        };
                        
                        // Update plan_id and clear pending fields
                        await supabaseAdmin
                            .from('user_subscriptions')
                            .update({
                                plan_id: effectivePlanId,
                                pending_plan_id: null,
                                pending_effective_date: null,
                                pending_subscription_id: null
                            })
                            .eq('user_id', sub.user_id);
                            
                        console.log(`[CRON] ✅ Downgrade applied for user ${sub.user_id}`);
                    }
                }

                // ATOMIC TOKEN RESET with PostgreSQL interval (no JS drift)
                // This RPC includes:
                // 1. Claim check (prevents concurrent resets)
                // 2. Token reset
                // 3. Advance next_token_reset_at using PostgreSQL interval '1 month'
                const { data, error: resetError } = await supabaseAdmin
                    .rpc('reset_tokens_with_next_schedule', {
                        p_user_id: sub.user_id,
                        p_plan_id: effectivePlanId,
                        p_reason: downgradeMeta['downgradedFrom'] ? 'annual_monthly_reset_with_downgrade' : 'annual_monthly_reset',
                        p_metadata: {
                            subscriptionId: sub.stripe_subscription_id,
                            source: 'cron_job',
                            ...downgradeMeta
                        },
                        p_claim_check: true // Enable atomic claim
                    });

                if (resetError) {
                    console.error(`[CRON] ❌ reset_tokens_with_next_schedule error for user ${sub.user_id}:`, resetError);
                    throw resetError;
                }

                const resetResult = (data as any[])?.[0];
                
                if (!resetResult) {
                    console.error(`[CRON] ❌ No result from reset_tokens_with_next_schedule for user ${sub.user_id}`);
                    errorCount++;
                    continue;
                }

                if (resetResult.already_claimed) {
                    console.log(`[CRON] ⏭️ Skipping user ${sub.user_id}: already claimed by another cron execution`);
                    continue;
                }

                if (!resetResult.success) {
                    console.error(`[CRON] ❌ Reset failed for user ${sub.user_id}`);
                    errorCount++;
                    errors.push({
                        userId: sub.user_id,
                        error: 'Reset returned success=false'
                    });
                    continue;
                }

                console.log(`[CRON] ✅ User ${sub.user_id} tokens reset to: ${resetResult.new_balance}, next_reset: ${resetResult.next_reset}`);
                successCount++;

            } catch (error: any) {
                console.error(`[CRON] ❌ Error processing user ${sub.user_id}:`, error);
                errorCount++;
                errors.push({
                    userId: sub.user_id,
                    error: error.message
                });
            }
        }

        const result = {
            success: true,
            processed: subscriptionsToReset?.length || 0,
            succeeded: successCount,
            failed: errorCount,
            errors: errors.length > 0 ? errors : undefined,
            timestamp: new Date().toISOString()
        };

        console.log('[CRON] Completed monthly token reset:', result);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[CRON] Fatal error:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}

// Also support POST for manual triggers
export async function POST(req: NextRequest) {
    return GET(req);
}

