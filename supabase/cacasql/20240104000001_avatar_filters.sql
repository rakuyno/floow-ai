-- Add filter fields to avatars table for advanced filtering
-- Run this in Supabase SQL Editor

-- Add new columns for filtering
alter table public.avatars 
add column if not exists gender text check (gender in ('masculino', 'femenino', 'neutral', 'otro')),
add column if not exists age_style text check (age_style in ('20s', '30s', '40s', '50s', '60+')),
add column if not exists style_tags text[] default '{}',
add column if not exists voice_language text default 'es-ES';

-- Add indexes for better query performance
create index if not exists idx_avatars_gender on public.avatars(gender);
create index if not exists idx_avatars_age_style on public.avatars(age_style);
create index if not exists idx_avatars_voice_language on public.avatars(voice_language);
create index if not exists idx_avatars_style_tags on public.avatars using gin(style_tags);

-- Update existing avatars with default values (optional, can be updated manually later)
update public.avatars 
set 
  gender = 'neutral',
  age_style = '30s',
  style_tags = ARRAY['profesional'],
  voice_language = 'es-ES'
where gender is null;
