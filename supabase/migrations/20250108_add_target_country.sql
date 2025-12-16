-- Add target_country column to ad_questionnaire table
-- This allows users to select target market (España or México) which affects TTS voice accent

ALTER TABLE public.ad_questionnaire
ADD COLUMN IF NOT EXISTS target_country TEXT NOT NULL DEFAULT 'ES' CHECK (target_country IN ('ES', 'MX'));

COMMENT ON COLUMN public.ad_questionnaire.target_country IS 'Target country/market for the ad: ES (España) or MX(México). Affects TTS voice accent selection.';
