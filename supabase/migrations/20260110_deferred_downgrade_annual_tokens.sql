-- Migration: Add fields for downgrade deferral and annual billing token resets
-- This enables:
-- 1) Storing billing interval (monthly vs annual)
-- 2) Tracking last token reset for annual plans
-- 3) Applying pending downgrades at the right time

-- Add billing_interval to track if subscription is monthly or annual
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly'
CHECK (billing_interval IN ('monthly', 'annual'));

-- Add last_token_reset_at to track when tokens were last reset (for annual plans)
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS last_token_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for efficient cron job queries (annual plans needing reset)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_token_reset 
ON user_subscriptions(billing_interval, last_token_reset_at)
WHERE billing_interval = 'annual' AND status = 'active';

COMMENT ON COLUMN user_subscriptions.billing_interval IS 
'Tracks whether subscription is billed monthly or annually. Annual plans receive tokens monthly but are billed once per year.';

COMMENT ON COLUMN user_subscriptions.last_token_reset_at IS 
'Timestamp of last token reset. Used for annual plans to trigger monthly token grants via cron job.';

