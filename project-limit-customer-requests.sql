-- BuildPilot: project limit + customer requests + upgrade requests
-- Run once in Supabase SQL Editor. Existing project/user data is preserved.

alter table public.profiles alter column project_limit set default 2;
update public.profiles set project_limit = 2 where project_limit is null;

alter table public.upgrade_requests
  add column if not exists full_name text,
  add column if not exists mobile_number text,
  add column if not exists email text,
  add column if not exists requested_limit integer,
  add column if not exists approved_limit integer;

update public.upgrade_requests set requested_limit = 5 where requested_limit is null;
create index if not exists upgrade_requests_user_status_idx on public.upgrade_requests(user_id,status);
create index if not exists upgrade_requests_created_idx on public.upgrade_requests(created_at desc);

create table if not exists public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  customer_name text not null,
  mobile_number text,
  email text,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_requests enable row level security;
drop policy if exists "customer_requests_public_insert" on public.customer_requests;
create policy "customer_requests_public_insert" on public.customer_requests
for insert to anon,authenticated
with check (length(trim(customer_name)) > 0 and length(trim(message)) > 0);

drop policy if exists "customer_requests_owner_select" on public.customer_requests;
create policy "customer_requests_owner_select" on public.customer_requests
for select to authenticated
using (exists(select 1 from public.projects p where p.id=customer_requests.project_id and p.user_id=(select auth.uid())));

drop policy if exists "customer_requests_owner_update" on public.customer_requests;
create policy "customer_requests_owner_update" on public.customer_requests
for update to authenticated
using (exists(select 1 from public.projects p where p.id=customer_requests.project_id and p.user_id=(select auth.uid())))
with check (exists(select 1 from public.projects p where p.id=customer_requests.project_id and p.user_id=(select auth.uid())));

create index if not exists customer_requests_project_created_idx on public.customer_requests(project_id,created_at desc);
