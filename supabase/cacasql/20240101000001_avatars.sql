-- Create avatars table
create table public.avatars (
  id uuid default uuid_generate_v4() primary key,
  owner_user_id uuid references auth.users, -- null means system avatar
  name text not null,
  image_url text not null,
  is_default boolean default false,
  is_active boolean default true,
  default_voice_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.avatars enable row level security;

-- Policies for avatars
create policy "Users can view system avatars and own avatars" on public.avatars
  for select using (
    (owner_user_id is null and is_active = true) or 
    (auth.uid() = owner_user_id)
  );

create policy "Users can insert own avatars" on public.avatars
  for insert with check (auth.uid() = owner_user_id);

create policy "Users can update own avatars" on public.avatars
  for update using (auth.uid() = owner_user_id);

-- Add columns to ad_questionnaire
alter table public.ad_questionnaire 
add column if not exists avatar_id uuid references public.avatars(id),
add column if not exists video_mode text default 'veo_style';

-- Add storage bucket for avatars if it doesn't exist (handled via dashboard usually, but good to document)
-- insert into storage.buckets (id, name) values ('avatars', 'avatars') on conflict do nothing;
-- create policy "Avatar images are publicly accessible" on storage.objects for select using ( bucket_id = 'avatars' );
-- create policy "Users can upload avatar images" on storage.objects for insert with check ( bucket_id = 'avatars' and auth.uid() = owner );
