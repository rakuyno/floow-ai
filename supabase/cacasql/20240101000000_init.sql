-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES
create table public.profiles (
  user_id uuid references auth.users not null primary key,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  credits_balance int not null default 0,
  free_preview_used boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  credits_reset_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = user_id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = user_id);

-- AD SESSIONS
create table public.ad_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  reference_tiktok_url text,
  reference_title text,
  reference_thumb_url text,
  language text default 'ES',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ad_sessions enable row level security;

create policy "Users can view own sessions" on public.ad_sessions
  for select using (auth.uid() = user_id);

create policy "Users can insert own sessions" on public.ad_sessions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own sessions" on public.ad_sessions
  for update using (auth.uid() = user_id);

-- AD ASSETS
create table public.ad_assets (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.ad_sessions not null,
  user_id uuid references auth.users not null,
  type text not null default 'image',
  storage_path text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ad_assets enable row level security;

create policy "Users can view own assets" on public.ad_assets
  for select using (auth.uid() = user_id);

create policy "Users can insert own assets" on public.ad_assets
  for insert with check (auth.uid() = user_id);

-- AD QUESTIONNAIRE
create table public.ad_questionnaire (
  session_id uuid references public.ad_sessions not null primary key,
  product_name text,
  target_users text,
  selling_points jsonb, -- array of strings
  country text default 'Estados Unidos',
  offer text,
  cta text,
  style_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ad_questionnaire enable row level security;

create policy "Users can view own questionnaire" on public.ad_questionnaire
  for select using (exists (select 1 from public.ad_sessions where id = session_id and user_id = auth.uid()));

create policy "Users can insert own questionnaire" on public.ad_questionnaire
  for insert with check (exists (select 1 from public.ad_sessions where id = session_id and user_id = auth.uid()));

create policy "Users can update own questionnaire" on public.ad_questionnaire
  for update using (exists (select 1 from public.ad_sessions where id = session_id and user_id = auth.uid()));

-- STORYBOARDS
create table public.storyboards (
  session_id uuid references public.ad_sessions not null primary key,
  summary text,
  brief text,
  storyboard jsonb, -- array of shots
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.storyboards enable row level security;

create policy "Users can view own storyboard" on public.storyboards
  for select using (exists (select 1 from public.ad_sessions where id = session_id and user_id = auth.uid()));

create policy "Users can insert own storyboard" on public.storyboards
  for insert with check (exists (select 1 from public.ad_sessions where id = session_id and user_id = auth.uid()));

-- RENDER JOBS
create table public.render_jobs (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.ad_sessions not null,
  user_id uuid references auth.users not null,
  kind text not null check (kind in ('preview', 'hd')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  provider_job_id text,
  output_storage_path text,
  output_url text,
  error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.render_jobs enable row level security;

create policy "Users can view own jobs" on public.render_jobs
  for select using (auth.uid() = user_id);

create policy "Users can insert own jobs" on public.render_jobs
  for insert with check (auth.uid() = user_id);

-- STORAGE BUCKETS
insert into storage.buckets (id, name, public) values ('assets', 'assets', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('renders', 'renders', false) on conflict do nothing;

create policy "Assets Access" on storage.objects for select using (bucket_id = 'assets' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Assets Upload" on storage.objects for insert with check (bucket_id = 'assets' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Renders Access" on storage.objects for select using (bucket_id = 'renders' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Renders Upload" on storage.objects for insert with check (bucket_id = 'renders'); -- Worker needs access, but for now we allow insert if authenticated (or service role)

-- TRIGGER FOR NEW USER PROFILE
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
