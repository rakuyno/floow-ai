-- Avatar Filter Debug Queries
-- Run these in Supabase SQL Editor to diagnose filter issues

-- 1. Check that gender and age_style columns exist in avatars table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'avatars'
ORDER BY ordinal_position;

-- 2. Check actual avatar data with filter values
SELECT id, name, gender, age_style, is_active 
FROM public.avatars 
WHERE is_active = true 
LIMIT 20;

-- 3. Count avatars by gender (to see if data exists)
SELECT gender, COUNT(*) as count
FROM public.avatars
WHERE is_active = true
GROUP BY gender;

-- 4. Count avatars by age_style (to see if data exists)
SELECT age_style, COUNT(*) as count
FROM public.avatars
WHERE is_active = true
GROUP BY age_style;

-- 5. Check if any avatars have NULL filter values
SELECT 
  COUNT(*) FILTER (WHERE gender IS NULL) as null_gender,
  COUNT(*) FILTER (WHERE age_style IS NULL) as null_age_style,
  COUNT(*) as total_active
FROM public.avatars
WHERE is_active = true;
