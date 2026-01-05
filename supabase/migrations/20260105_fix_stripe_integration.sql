-- Migration: Fix Stripe Integration Issues
-- Purpose: Ensure all columns exist and RPCs are corrected

-- 1. Ensure pending columns exist in user_subscriptions
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS pending_plan_id TEXT REFERENCES public.subscription_plans(id),
ADD COLUMN IF NOT EXISTS pending_effective_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pending_subscription_id TEXT;

-- 2. Create index if not exists
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_pending 
  ON public.user_subscriptions(user_id, pending_plan_id) 
  WHERE pending_plan_id IS NOT NULL;

-- 3. Fix grant_plan_tokens RPC (use updated_at instead of last_updated)
-- Drop existing function first to avoid parameter mismatch errors
DROP FUNCTION IF EXISTS public.grant_plan_tokens(uuid, text, text, jsonb);

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
        INSERT INTO public.user_token_balances (user_id, balance, updated_at)
        VALUES (p_user_id, 0, NOW());
        v_current_balance := 0;
    END IF;
    
    -- Accumulate tokens
    v_new_balance := v_current_balance + v_monthly_tokens;
    
    -- Update balance
    UPDATE public.user_token_balances
    SET balance = v_new_balance, updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Insert ledger entry
    INSERT INTO public.user_token_ledger (user_id, change, reason, metadata, created_at)
    VALUES (p_user_id, v_monthly_tokens, p_reason, p_metadata, NOW());
    
    RETURN v_new_balance;
END;
$$;

-- 4. Fix set_user_tokens RPC (use updated_at instead of last_updated)
-- Drop existing function first to avoid parameter mismatch errors
DROP FUNCTION IF EXISTS public.set_user_tokens(uuid, integer, text, jsonb);

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
    INSERT INTO public.user_token_balances (user_id, balance, updated_at)
    VALUES (p_user_id, v_new_balance, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        balance = v_new_balance,
        updated_at = NOW();
    
    -- Record in ledger (only if there's a change)
    IF v_delta != 0 THEN
        INSERT INTO public.user_token_ledger (user_id, change, reason, metadata, created_at)
        VALUES (p_user_id, v_delta, p_reason, p_metadata, NOW());
    END IF;
    
    RETURN v_new_balance;
END;
$$;

COMMENT ON FUNCTION public.grant_plan_tokens IS 
'Grants (accumulates) monthly_tokens from a plan to user balance. Use for plan changes/upgrades. FIXED: uses updated_at column.';

COMMENT ON FUNCTION public.set_user_tokens IS 
'Sets user token balance to exact amount (for subscription resets). Does not validate minimum balance. FIXED: uses updated_at column.';

