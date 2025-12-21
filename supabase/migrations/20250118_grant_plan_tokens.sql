-- Migration: Add grant_plan_tokens RPC for accumulating plan tokens
-- This RPC grants tokens based on plan's monthly_tokens (accumulates, not resets)

CREATE OR REPLACE FUNCTION public.grant_plan_tokens(
    p_user_id UUID,
    p_plan_id TEXT,
    p_reason TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance INTEGER;
    v_monthly_tokens INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Get monthly_tokens from subscription_plans
    SELECT monthly_tokens INTO v_monthly_tokens
    FROM public.subscription_plans
    WHERE id = p_plan_id;
    
    IF v_monthly_tokens IS NULL THEN
        RAISE EXCEPTION 'Plan not found: %', p_plan_id;
    END IF;
    
    -- Get current balance (lock for update)
    SELECT balance INTO v_current_balance
    FROM public.user_token_balances
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        -- Initialize if not exists
        INSERT INTO public.user_token_balances (user_id, balance, last_updated)
        VALUES (p_user_id, 0, NOW());
        v_current_balance := 0;
    END IF;
    
    -- Accumulate tokens
    v_new_balance := v_current_balance + v_monthly_tokens;
    
    -- Update balance
    UPDATE public.user_token_balances
    SET balance = v_new_balance, last_updated = NOW()
    WHERE user_id = p_user_id;
    
    -- Insert ledger entry
    INSERT INTO public.user_token_ledger (user_id, change, reason, metadata, created_at)
    VALUES (p_user_id, v_monthly_tokens, p_reason, p_metadata, NOW());
    
    RETURN v_new_balance;
END;
$$;

COMMENT ON FUNCTION public.grant_plan_tokens IS 
'Grants (accumulates) monthly_tokens from a plan to user balance. Use for plan changes/upgrades.';
