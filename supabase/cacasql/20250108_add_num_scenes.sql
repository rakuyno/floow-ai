-- Migration: Add num_scenes column to ad_questionnaire table
-- This fixes the schema bug where num_scenes was used in code but didn't exist in DB
-- Run this in Supabase SQL Editor

ALTER TABLE public.ad_questionnaire
ADD COLUMN IF NOT EXISTS num_scenes INT NOT NULL DEFAULT 4;

COMMENT ON COLUMN public.ad_questionnaire.num_scenes IS 'Number of scenes for the storyboard (1-10)';
