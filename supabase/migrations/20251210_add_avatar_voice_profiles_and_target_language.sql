-- Avatar voice profiles per language (en/es) for ElevenLabs
create table if not exists public.avatar_voice_profiles (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references public.avatars(id) on delete cascade,
  language_code text not null check (language_code in ('en','es')),
  voice_id text not null,
  voice_settings jsonb,
  created_at timestamptz not null default now(),
  unique (avatar_id, language_code)
);

create index if not exists avatar_voice_profiles_avatar_idx
  on public.avatar_voice_profiles (avatar_id);

-- Persist selected target language on questionnaire (defaults to Spanish)
alter table public.ad_questionnaire
  add column if not exists target_language text default 'es'
  check (target_language in ('en','es'));

