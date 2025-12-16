-- Add auto_subtitles flag to ad_questionnaire to persist UI preference
alter table public.ad_questionnaire
  add column if not exists auto_subtitles boolean default false;

comment on column public.ad_questionnaire.auto_subtitles is 'User opted-in automatic subtitles (TTS-only feature).';

