-- Migration: Proper monthly token reset without drift + atomic operations
-- This fixes:
-- 1. JavaScript Date.setMonth() drift → Use PostgreSQL interval '1 month'
-- 2. Concurrent cron/webhook race conditions → Atomic operations
-- 3. Annual vs monthly confusion → Separate logic

-- ============================================================================
-- PART 1: Schema changes
-- ============================================================================

-- Add next_token_reset_at for drift-free resets
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS next_token_reset_at TIMESTAMPTZ;

-- Add last_reset_invoice_id for webhook idempotency
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS last_reset_invoice_id TEXT;

-- Create table for invoice dedupe (atomic idempotency)
CREATE TABLE IF NOT EXISTS processed_invoices (
    invoice_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_processed_invoices_user_id 
ON processed_invoices(user_id, processed_at DESC);

COMMENT ON TABLE processed_invoices IS 
'Tracks processed invoice.paid events to prevent double token resets. Provides atomic idempotency.';

-- Initialize next_token_reset_at for existing annual subscriptions
-- Set it to 1 month from last reset (or now if null)
-- Uses PostgreSQL interval '1 month' for proper date arithmetic
UPDATE user_subscriptions 
SET next_token_reset_at = COALESCE(
    last_token_reset_at + INTERVAL '1 month',
    NOW() + INTERVAL '1 month'
)
WHERE billing_interval = 'annual' 
  AND next_token_reset_at IS NULL
  AND status = 'active';

-- Create index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_next_reset 
ON user_subscriptions(billing_interval, next_token_reset_at)
WHERE billing_interval = 'annual' AND status = 'active' AND next_token_reset_at IS NOT NULL;

-- ============================================================================
-- PART 2: RPC for atomic token reset with next_token_reset_at advancement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_tokens_with_next_schedule(
    p_user_id UUID,
    p_plan_id TEXT,
    p_reason TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_claim_check BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    success BOOLEAN,
    new_balance INTEGER,
    next_reset TIMESTAMPTZ,
    already_claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_monthly_tokens INTEGER;
    v_new_balance INTEGER;
    v_next_reset TIMESTAMPTZ;
    v_current_next_reset TIMESTAMPTZ;
BEGIN
    -- Get monthly_tokens from subscription_plans
    SELECT monthly_tokens INTO v_monthly_tokens
    FROM public.subscription_plans
    WHERE id = p_plan_id;
    
    IF v_monthly_tokens IS NULL THEN
        RAISE EXCEPTION 'Plan not found: %', p_plan_id;
    END IF;
    
    -- Get current next_token_reset_at (with FOR UPDATE to lock row)
    SELECT next_token_reset_at INTO v_current_next_reset
    FROM public.user_subscriptions
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    -- CLAIM CHECK: If next_reset is in the future, someone already processed this
    IF p_claim_check AND v_current_next_reset IS NOT NULL AND v_current_next_reset > NOW() THEN
        RETURN QUERY SELECT FALSE, 0, v_current_next_reset, TRUE;
        RETURN;
    END IF;
    
    -- Calculate next reset using PostgreSQL interval (no drift)
    -- Start from current next_reset_at or now
    v_next_reset := COALESCE(v_current_next_reset, NOW());
    
    -- Advance by 1 month intervals until in the future (catch-up logic)
    -- Limit to 12 iterations (1 year max catch-up)
    FOR i IN 1..12 LOOP
        EXIT WHEN v_next_reset > NOW();
        v_next_reset := v_next_reset + INTERVAL '1 month';
    END LOOP;
    
    -- Set tokens to plan's monthly_tokens
    PERFORM public.set_user_tokens(
        p_user_id,
        v_monthly_tokens,
        p_reason,
        p_metadata
    );
    
    v_new_balance := v_monthly_tokens;
    
    -- Update subscription with new next_token_reset_at
    UPDATE public.user_subscriptions
    SET 
        last_token_reset_at = NOW(),
        next_token_reset_at = v_next_reset
    WHERE user_id = p_user_id;
    
    RETURN QUERY SELECT TRUE, v_new_balance, v_next_reset, FALSE;
END;
$$;

COMMENT ON FUNCTION public.reset_tokens_with_next_schedule IS 
'Atomically resets tokens and advances next_token_reset_at using PostgreSQL interval (no JS drift).
Includes claim check to prevent concurrent resets.';

-- ============================================================================
-- PART 3: RPC for atomic invoice dedupe + token reset
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_invoice_token_reset(
    p_user_id UUID,
    p_invoice_id TEXT,
    p_plan_id TEXT,
    p_reason TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    success BOOLEAN,
    new_balance INTEGER,
    already_processed BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_monthly_tokens INTEGER;
    v_new_balance INTEGER;
    v_invoice_exists BOOLEAN;
BEGIN
    -- Check if invoice was already processed (atomic dedupe)
    SELECT EXISTS(
        SELECT 1 FROM public.processed_invoices 
        WHERE invoice_id = p_invoice_id
    ) INTO v_invoice_exists;
    
    IF v_invoice_exists THEN
        -- Already processed, return early
        RETURN QUERY SELECT FALSE, 0, TRUE, 'Invoice already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Insert into processed_invoices (atomic dedupe via PRIMARY KEY)
    -- If another process inserted first, this will fail with unique violation
    BEGIN
        INSERT INTO public.processed_invoices (invoice_id, user_id, reason, metadata)
        VALUES (p_invoice_id, p_user_id, p_reason, p_metadata);
    EXCEPTION WHEN unique_violation THEN
        -- Another process got here first
        RETURN QUERY SELECT FALSE, 0, TRUE, 'Invoice processed by concurrent request'::TEXT;
        RETURN;
    END;
    
    -- Get monthly_tokens from subscription_plans
    SELECT monthly_tokens INTO v_monthly_tokens
    FROM public.subscription_plans
    WHERE id = p_plan_id;
    
    IF v_monthly_tokens IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, FALSE, 'Plan not found'::TEXT;
        RETURN;
    END IF;
    
    -- Reset tokens using existing RPC
    PERFORM public.set_user_tokens(
        p_user_id,
        v_monthly_tokens,
        p_reason,
        p_metadata
    );
    
    v_new_balance := v_monthly_tokens;
    
    -- Update last_token_reset_at (but NOT next_token_reset_at, that's for cron)
    UPDATE public.user_subscriptions
    SET 
        last_token_reset_at = NOW(),
        last_reset_invoice_id = p_invoice_id
    WHERE user_id = p_user_id;
    
    RETURN QUERY SELECT TRUE, v_new_balance, FALSE, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION public.process_invoice_token_reset IS 
'Atomically processes invoice.paid token reset with dedupe via processed_invoices table.
Prevents concurrent webhook deliveries from resetting tokens twice.';

-- ============================================================================
-- PART 4: Enable RLS on new table
-- ============================================================================

ALTER TABLE public.processed_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own processed invoices" 
ON public.processed_invoices 
FOR SELECT 
USING (auth.uid() = user_id);

-- Service role can do everything (for webhooks/cron)
-- This is handled by SECURITY DEFINER on RPCs

-- ============================================================================
-- PART 5: Cleanup function (optional, for maintenance)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_processed_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete processed_invoices older than 90 days
    DELETE FROM public.processed_invoices
    WHERE processed_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_processed_invoices IS 
'Maintenance function to cleanup old processed_invoices (keeps last 90 days).
Can be called manually or via a scheduled job.';

