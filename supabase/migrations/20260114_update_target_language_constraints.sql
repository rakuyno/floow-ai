-- Migration: Update target_language to support accent variants
-- Date: 2026-01-14
-- Description: Updates target_language field to support 'en-US', 'es-ES', 'es-MX' instead of just 'en', 'es'

-- IMPORTANT: Order matters! We must update data BEFORE adding the new constraint

-- 1. Drop the old constraint on ad_questionnaire.target_language
alter table public.ad_questionnaire
  drop constraint if exists ad_questionnaire_target_language_check;

-- 2. Update existing data FIRST: map 'en' -> 'en-US' and 'es' -> 'es-MX'
-- This must happen BEFORE we add the new constraint
update public.ad_questionnaire
set target_language = case
  when target_language = 'en' then 'en-US'
  when target_language = 'es' then 'es-MX'
  else target_language
end
where target_language in ('en', 'es');

-- 3. NOW add new constraint with the three language variants (after data is updated)
alter table public.ad_questionnaire
  add constraint ad_questionnaire_target_language_check
  check (target_language in ('en-US', 'es-ES', 'es-MX'));

-- 4. Update default value for new rows
alter table public.ad_questionnaire
  alter column target_language set default 'es-MX';

-- 5. Update storyboards brief field if it exists (OPTIONAL - skip if errors occur)
-- Note: This updates the JSON brief stored in storyboards to use new language codes
-- We wrap this in a DO block to handle errors gracefully
DO $$
BEGIN
  -- Only update if brief is valid JSON and contains target_language
  update public.storyboards
  set brief = jsonb_set(
    brief::jsonb,
    '{target_language}',
    case
      when brief::jsonb->>'target_language' = 'en' then '"en-US"'::jsonb
      when brief::jsonb->>'target_language' = 'es' then '"es-MX"'::jsonb
      else brief::jsonb->'target_language'
    end
  )
  where brief is not null
    and brief ~ '^\s*\{.*\}\s*$'  -- Rough check if it looks like JSON
    and brief::jsonb ? 'target_language'
    and brief::jsonb->>'target_language' in ('en', 'es');
EXCEPTION
  WHEN OTHERS THEN
    -- If this fails, it's okay - the important data is in ad_questionnaire
    RAISE NOTICE 'Skipping storyboards.brief update (not critical): %', SQLERRM;
END $$;

-- Optional: Update avatar_voice_profiles constraint (for future compatibility)
-- Note: The worker uses getBaseLanguage() to convert to 'en'/'es' when querying this table,
-- so this is not strictly necessary, but good for consistency
alter table public.avatar_voice_profiles
  drop constraint if exists avatar_voice_profiles_language_code_check;

alter table public.avatar_voice_profiles
  add constraint avatar_voice_profiles_language_code_check
  check (language_code in ('en', 'es', 'en-US', 'es-ES', 'es-MX'));

-- Add comment for documentation
comment on column public.ad_questionnaire.target_language is 
  'Target language with accent variant: en-US (American English), es-ES (Spanish from Spain), es-MX (Mexican Spanish)';
