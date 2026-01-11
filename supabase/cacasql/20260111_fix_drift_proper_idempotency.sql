-- Migration: Proper monthly token reset without drift
-- This fixes the "30 days" drift problem by using next_token_reset_at
-- and proper idempotency tracking by invoice_id

-- Add next_token_reset_at for drift-free resets
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS next_token_reset_at TIMESTAMPTZ;

-- Add last_reset_invoice_id for proper webhook idempotency
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS last_reset_invoice_id TEXT;

-- Initialize next_token_reset_at for existing annual subscriptions
-- Set it to 1 month from last reset (or now if null)
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

COMMENT ON COLUMN user_subscriptions.next_token_reset_at IS 
'Exact date/time when next token reset should occur. Prevents drift by using +1 month instead of +30 days.';

COMMENT ON COLUMN user_subscriptions.last_reset_invoice_id IS 
'Invoice ID of last token reset. Used for idempotency to prevent double-resets from duplicate webhooks.';

