-- ==============================================================================
-- BIASLENS PRODUCTION DATABASE SCHEMA & ROW-LEVEL SECURITY (SUPABASE POSTGRES)
-- ==============================================================================
-- Execute this entire script in your Supabase SQL Editor:
-- (Supabase Dashboard -> Project -> SQL Editor -> New Query -> Run)

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. PROFILES TABLE (Extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  name text not null,
  role text default 'Candidate',
  avatar_url text,
  headline text default 'Bias-Free Career Professional',
  organization text default '',
  two_factor_enabled boolean default false,
  auto_save boolean default true,
  telemetry_enabled boolean default true,
  data_retention text default 'local',
  default_export_format text default 'pdf',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. RESUMES TABLE (Master document records)
create table if not exists public.resumes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null default 'Untitled Resume',
  file_name text not null default 'resume.pdf',
  raw_text text not null default '',
  neutrality_score int not null default 100,
  active_version int not null default 1,
  target_job jsonb default null, -- Target Job context (title, company, description)
  ats_match jsonb default null,  -- ATS simulation scores, keyword matches & gap matrix
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. RESUME_PAGES TABLE (Canvas dimensions & geometry)
create table if not exists public.resume_pages (
  id uuid default gen_random_uuid() primary key,
  resume_id uuid references public.resumes(id) on delete cascade not null,
  page_number int not null,
  width int not null default 595,
  height int not null default 842,
  created_at timestamptz default now()
);

-- 5. CANVAS_BLOCKS TABLE (Figma-style vector text blocks & layout)
create table if not exists public.canvas_blocks (
  id text not null, -- e.g. "blk_001"
  resume_id uuid references public.resumes(id) on delete cascade not null,
  page_index int not null default 0,
  text text not null default '',
  x numeric not null,
  y numeric not null,
  width numeric not null,
  height numeric not null,
  font_size numeric not null default 10,
  font_family text not null default 'Inter, sans-serif',
  bold boolean default false,
  italic boolean default false,
  underline boolean default false,
  color text default '#111827',
  align text default 'left',
  line_height numeric default 1.3,
  is_title boolean default false,
  primary key (resume_id, id)
);

-- 6. BIAS_AUDITS TABLE (Taxonomy flags, spans, rewrite suggestions)
create table if not exists public.bias_audits (
  id uuid default gen_random_uuid() primary key,
  resume_id uuid references public.resumes(id) on delete cascade not null,
  spans jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  fairness_metrics jsonb,
  created_at timestamptz default now()
);

-- 7. RESUME_VERSIONS TABLE (Cloud Version History for diffing & rollback)
create table if not exists public.resume_versions (
  id uuid default gen_random_uuid() primary key,
  resume_id uuid references public.resumes(id) on delete cascade not null,
  version_number int not null,
  version_name text not null, -- e.g. "Software Engineer v1"
  neutrality_score int not null,
  ats_score int default null, -- Optional ATS match score at time of snapshot
  snapshot jsonb not null, -- Full snapshot of blocks, pages, and audit
  created_at timestamptz default now()
);

-- Backward compatibility / idempotency additions for existing databases:
alter table public.resumes add column if not exists target_job jsonb default null;
alter table public.resumes add column if not exists ats_match jsonb default null;
alter table public.resume_versions add column if not exists ats_score int default null;

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
create index if not exists idx_resumes_user_id on public.resumes(user_id);
create index if not exists idx_resume_pages_resume_id on public.resume_pages(resume_id);
create index if not exists idx_canvas_blocks_resume_id on public.canvas_blocks(resume_id);
create index if not exists idx_bias_audits_resume_id on public.bias_audits(resume_id);
create index if not exists idx_resume_versions_resume_id on public.resume_versions(resume_id);
create index if not exists idx_resume_versions_ats_score on public.resume_versions(ats_score);

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.resume_pages enable row level security;
alter table public.canvas_blocks enable row level security;
alter table public.bias_audits enable row level security;
alter table public.resume_versions enable row level security;

-- PROFILES RLS
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- RESUMES RLS
drop policy if exists "Users can view their own resumes" on public.resumes;
create policy "Users can view their own resumes"
  on public.resumes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own resumes" on public.resumes;
create policy "Users can insert their own resumes"
  on public.resumes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own resumes" on public.resumes;
create policy "Users can update their own resumes"
  on public.resumes for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own resumes" on public.resumes;
create policy "Users can delete their own resumes"
  on public.resumes for delete
  using (auth.uid() = user_id);

-- RESUME_PAGES RLS (Scoped via resume's user_id)
drop policy if exists "Users can manage pages of their own resumes" on public.resume_pages;
create policy "Users can manage pages of their own resumes"
  on public.resume_pages for all
  using (
    exists (
      select 1 from public.resumes
      where public.resumes.id = public.resume_pages.resume_id
      and public.resumes.user_id = auth.uid()
    )
  );

-- CANVAS_BLOCKS RLS (Scoped via resume's user_id)
drop policy if exists "Users can manage canvas blocks of their own resumes" on public.canvas_blocks;
create policy "Users can manage canvas blocks of their own resumes"
  on public.canvas_blocks for all
  using (
    exists (
      select 1 from public.resumes
      where public.resumes.id = public.canvas_blocks.resume_id
      and public.resumes.user_id = auth.uid()
    )
  );

-- BIAS_AUDITS RLS (Scoped via resume's user_id)
drop policy if exists "Users can manage audits of their own resumes" on public.bias_audits;
create policy "Users can manage audits of their own resumes"
  on public.bias_audits for all
  using (
    exists (
      select 1 from public.resumes
      where public.resumes.id = public.bias_audits.resume_id
      and public.resumes.user_id = auth.uid()
    )
  );

-- RESUME_VERSIONS RLS (Scoped via resume's user_id)
drop policy if exists "Users can manage versions of their own resumes" on public.resume_versions;
create policy "Users can manage versions of their own resumes"
  on public.resume_versions for all
  using (
    exists (
      select 1 from public.resumes
      where public.resumes.id = public.resume_versions.resume_id
      and public.resumes.user_id = auth.uid()
    )
  );

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON AUTH.USERS INSERT
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  raw_name text;
begin
  raw_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (
    id,
    email,
    name,
    avatar_url
  )
  values (
    new.id,
    new.email,
    raw_name,
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(excluded.name, profiles.name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
