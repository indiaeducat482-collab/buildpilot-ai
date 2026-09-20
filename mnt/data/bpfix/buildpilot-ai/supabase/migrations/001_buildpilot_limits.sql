-- BuildPilot AI: admin, account status, plan limits and upgrade requests.
-- Run this SQL in Supabase SQL Editor after the base BuildPilot tables exist.

alter table public.profiles
  add column if not exists role text not null default 'user',
  add column if not exists status text not null default 'active',
  add column if not exists plan text not null default 'free',
  add column if not exists project_limit integer not null default 5,
  add column if not exists github_file_limit integer not null default 2;

-- Keep existing rows valid and enforce allowed values.
update public.profiles
set role = 'user' where role is null or role not in ('user','admin');
update public.profiles
set status = 'active' where status is null or status not in ('active','blocked');
update public.profiles
set plan = 'free' where plan is null or plan not in ('free','premium');
update public.profiles
set project_limit = 5 where project_limit is null or project_limit < 1;
update public.profiles
set github_file_limit = 2 where github_file_limit is null or github_file_limit < 1;

do $$ begin
  alter table public.profiles add constraint profiles_role_check check (role in ('user','admin'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_status_check check (status in ('active','blocked'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_plan_check check (plan in ('free','premium'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_project_limit_check check (project_limit > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_github_file_limit_check check (github_file_limit > 0);
exception when duplicate_object then null; end $$;

create table if not exists public.upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_project_limit integer not null check (requested_project_limit > 0),
  requested_github_file_limit integer not null check (requested_github_file_limit > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  approved_project_limit integer,
  approved_github_file_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_files
  add column if not exists generated_by uuid references auth.users(id);

-- Admin check must not recursively evaluate the profiles RLS policy.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and status = 'active'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.upgrade_requests enable row level security;

-- Profiles: users see/update themselves; admins can manage all users.
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins view all profiles" on public.profiles;
drop policy if exists "Admins update profiles" on public.profiles;

create policy "Users can view own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or public.is_admin());

create policy "Users can insert own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id or public.is_admin())
with check ((select auth.uid()) = id or public.is_admin());

-- Upgrade requests: user creates/views own; admin reviews all.
drop policy if exists "Users view own upgrade requests" on public.upgrade_requests;
drop policy if exists "Users create own upgrade requests" on public.upgrade_requests;
drop policy if exists "Admins view upgrade requests" on public.upgrade_requests;
drop policy if exists "Admins update upgrade requests" on public.upgrade_requests;

create policy "Users view own upgrade requests"
on public.upgrade_requests for select to authenticated
using ((select auth.uid()) = user_id or public.is_admin());

create policy "Users create own upgrade requests"
on public.upgrade_requests for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Admins update upgrade requests"
on public.upgrade_requests for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Projects and generations: preserve own access and add admin read access.
drop policy if exists "Admins view all projects" on public.projects;
drop policy if exists "Admins view all generations" on public.generations;

create policy "Admins view all projects"
on public.projects for select to authenticated
using ((select auth.uid()) = user_id or public.is_admin());

create policy "Admins view all generations"
on public.generations for select to authenticated
using ((select auth.uid()) = user_id or public.is_admin());

-- Project files: owner and admins can read. Owners can write through existing policies.
drop policy if exists "Admins view all project files" on public.project_files;
create policy "Admins view all project files"
on public.project_files for select to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_files.project_id
      and (p.user_id = (select auth.uid()) or public.is_admin())
  )
);

create or replace function public.update_upgrade_request_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists upgrade_requests_updated_at on public.upgrade_requests;
create trigger upgrade_requests_updated_at
before update on public.upgrade_requests
for each row execute function public.update_upgrade_request_updated_at();

create index if not exists upgrade_requests_user_id_idx on public.upgrade_requests(user_id);
create index if not exists upgrade_requests_status_idx on public.upgrade_requests(status);
create index if not exists project_files_generated_by_idx on public.project_files(generated_by);
