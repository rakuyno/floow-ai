-- Migration: Add pending plan columns for scheduled changes
-- Purpose: Track scheduled downgrades (cancel current + create new with trial)

ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS pending_plan_id TEXT REFERENCES public.subscription_plans(id),
ADD COLUMN IF NOT EXISTS pending_effective_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pending_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_pending 
  ON public.user_subscriptions(user_id, pending_plan_id) 
  WHERE pending_plan_id IS NOT NULL;

COMMENT ON COLUMN public.user_subscriptions.pending_plan_id IS
  'Plan ID for scheduled downgrade (new subscription will activate at renewal)';

COMMENT ON COLUMN public.user_subscriptions.pending_effective_date IS
  'Date when pending plan change will take effect (usually current_period_end)';

COMMENT ON COLUMN public.user_subscriptions.pending_subscription_id IS
  'Stripe subscription ID for the pending downgrade subscription (in trial until current period ends)';
