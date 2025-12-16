import { createClient } from '@supabase/supabase-js';

// NOTE: This helper is intended for server-side use where we have service role access
// or authenticated user context.

export async function getUserTokenBalance(supabase: any, userId: string): Promise<number> {
    const { data, error } = await supabase
        .from('user_token_balances')
        .select('balance')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error('Error fetching token balance:', error);
        return 0; // Default to 0 on error
    }

    return data?.balance || 0;
}

export async function adjustUserTokens(
    supabase: any,
    userId: string,
    amount: number,
    reason: string,
    metadata: any = {}
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    // 1. Check balance if deducting
    if (amount < 0) {
        const currentBalance = await getUserTokenBalance(supabase, userId);
        if (currentBalance + amount < 0) {
            return { success: false, error: 'Insufficient tokens' };
        }
    }

    // 2. Perform atomic update using RPC or direct update if RLS allows
    // Since we want to update ledger AND balance, we should ideally use a transaction or RPC.
    // For simplicity in this MVP, we'll do sequential updates but check errors.
    // A better approach is a Postgres function `add_tokens(user_id, amount, reason, metadata)`

    // Let's try to use a direct update first.

    const { data: balanceData, error: balanceError } = await supabase
        .rpc('adjust_tokens', { // We will create this RPC function
            p_user_id: userId,
            p_amount: amount,
            p_reason: reason,
            p_metadata: metadata
        });

    if (balanceError) {
        console.error('Error adjusting tokens:', balanceError);
        // Fallback: Try manual update if RPC doesn't exist yet (during migration phase)
        // But really we should rely on the RPC for atomicity.
        return { success: false, error: balanceError.message };
    }

    return { success: true, newBalance: balanceData };
}
