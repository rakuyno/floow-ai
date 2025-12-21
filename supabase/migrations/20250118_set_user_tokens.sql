-- Migration: Add set_user_tokens RPC for absolute token setting (no validation)
-- This is needed for resetting tokens to exact plan amounts during subscription changes

CREATE OR REPLACE FUNCTION public.set_user_tokens(
    p_user_id UUID,
    p_target_amount INTEGER,
    p_reason TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance INTEGER;
    v_delta INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Get current balance (or 0 if not exists)
    SELECT balance INTO v_current_balance
    FROM public.user_token_balances
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        v_current_balance := 0;
    END IF;
    
    v_delta := p_target_amount - v_current_balance;
    v_new_balance := p_target_amount;
    
    -- Upsert balance
    INSERT INTO public.user_token_balances (user_id, balance, last_updated)
    VALUES (p_user_id, v_new_balance, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        balance = v_new_balance,
        last_updated = NOW();
    
    -- Record in ledger (only if there's a change)
    IF v_delta != 0 THEN
        INSERT INTO public.user_token_ledger (user_id, change, reason, metadata, created_at)
        VALUES (p_user_id, v_delta, p_reason, p_metadata, NOW());
    END IF;
    
    RETURN v_new_balance;
END;
$$;

COMMENT ON FUNCTION public.set_user_tokens IS 
'Sets user token balance to exact amount (for subscription resets). Does not validate minimum balance.';
