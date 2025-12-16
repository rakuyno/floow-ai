import { SupabaseClient } from '@supabase/supabase-js'

export const TOKENS_PER_SCENE = 10

/**
 * Get user's active plan ID. Returns 'free' if no active subscription found.
 */
export async function getUserPlan(supabase: SupabaseClient, userId: string): Promise<string> {
    const { data: sub, error } = await supabase
        .from('user_subscriptions')
        .select('plan_id, status, current_period_end')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    const normalize = (plan: string | null | undefined) => plan ? plan.trim().toLowerCase() : null
    const now = new Date()

    if (sub) {
        const normalizedPlan = normalize(sub.plan_id)
        const activeStatuses = ['active', 'trialing', 'past_due']
        const withinPeriod = sub.current_period_end ? new Date(sub.current_period_end) > now : true

        if (normalizedPlan && activeStatuses.includes((sub.status || '').toLowerCase()) && withinPeriod) {
            return normalizedPlan
        }

        if (normalizedPlan) {
            // Even if status is unexpected, respect the recorded plan to avoid accidental downgrades
            return normalizedPlan
        }
    }

    // Fallback to legacy profiles table
    const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('user_id', userId)
        .maybeSingle()

    const profilePlan = normalize(profile?.plan)
    if (profilePlan) return profilePlan

    return 'free'
}

/**
 * Check if user has enough tokens.
 */
export async function checkTokenBalance(supabase: SupabaseClient, userId: string, requiredTokens: number): Promise<boolean> {
    const { data: balance, error } = await supabase
        .from('user_token_balances')
        .select('balance')
        .eq('user_id', userId)
        .single()

    if (error || !balance) return false

    return (balance.balance || 0) >= requiredTokens
}

/**
 * Deduct tokens and log to ledger using atomic RPC.
 */
export async function deductTokens(
    supabase: SupabaseClient,
    userId: string,
    amount: number,
    jobId: string,
    reason: string = 'video_generation'
): Promise<void> {
    const { data, error } = await supabase.rpc('deduct_tokens', {
        p_user_id: userId,
        p_amount: amount,
        p_reason: reason,
        p_metadata: { job_id: jobId, type: 'deduction' }
    })

    if (error) {
        console.error('[Billing] deduct_tokens RPC error:', error)
        throw new Error(`Failed to deduct tokens: ${error.message}`)
    }

    if (data && !data.success) {
        throw new Error(`Failed to deduct tokens: ${data.error}`)
    }

    console.log(`[Billing] Deducted ${amount} tokens from user ${userId}. New balance: ${data?.new_balance}`)
}

/**
 * Refund tokens (e.g., if job failed) using atomic RPC.
 */
export async function refundTokens(
    supabase: SupabaseClient,
    userId: string,
    amount: number,
    jobId: string,
    reason: string = 'refund_failed_job'
): Promise<void> {
    console.log(`[Billing] Refunding ${amount} tokens to user ${userId} for job ${jobId}`)

    const { data, error } = await supabase.rpc('refund_tokens', {
        p_user_id: userId,
        p_amount: amount,
        p_reason: reason,
        p_metadata: { job_id: jobId, type: 'refund' }
    })

    if (error) {
        console.error('[Billing] refund_tokens RPC error:', error)
        throw new Error(`Failed to refund tokens: ${error.message}`)
    }

    if (data && !data.success) {
        throw new Error(`Failed to refund tokens: ${data.error}`)
    }

    console.log(`[Billing] Refunded ${amount} tokens to user ${userId}. New balance: ${data?.new_balance}`)
}
