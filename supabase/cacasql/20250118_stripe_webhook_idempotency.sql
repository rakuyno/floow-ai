-- Migration: Stripe Webhook Idempotency
-- Purpose: Prevent duplicate processing of Stripe webhook events

-- Create webhook events tracking table
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id TEXT PRIMARY KEY,                    -- Stripe event ID (evt_xxx)
  type TEXT NOT NULL,                     -- Event type (e.g., 'checkout.session.completed')
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB,                             -- Optional: store event payload for debugging
  status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed')),
  error TEXT                              -- Optional: error message if processing failed
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type 
  ON public.stripe_webhook_events(type);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at 
  ON public.stripe_webhook_events(processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status 
  ON public.stripe_webhook_events(status);

-- No RLS needed - only accessed by service role in webhooks
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Optional: Add cleanup function to remove old events (older than 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.stripe_webhook_events
  WHERE processed_at < now() - interval '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.stripe_webhook_events IS 
  'Tracks processed Stripe webhook events to ensure idempotency';

COMMENT ON COLUMN public.stripe_webhook_events.id IS 
  'Stripe event ID from event.id (e.g., evt_1234567890)';

COMMENT ON COLUMN public.stripe_webhook_events.status IS 
  'Processing status: processed (success) or failed (error occurred)';
