-- BuildPilot AI: customer requests + project-limit support
-- Run this in Supabase SQL Editor. Existing data is preserved.

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
create policy "customer_requests_public_insert"
on public.customer_requests for insert to anon, authenticated
with check (length(trim(customer_name)) > 0 and length(trim(message)) > 0);

drop policy if exists "customer_requests_owner_select" on public.customer_requests;
create policy "customer_requests_owner_select"
on public.customer_requests for select to authenticated
using (exists (select 1 from public.projects p where p.id = customer_requests.project_id and p.user_id = (select auth.uid())));

drop policy if exists "customer_requests_owner_update" on public.customer_requests;
create policy "customer_requests_owner_update"
on public.customer_requests for update to authenticated
using (exists (select 1 from public.projects p where p.id = customer_requests.project_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.projects p where p.id = customer_requests.project_id and p.user_id = (select auth.uid())));

create index if not exists customer_requests_project_created_idx on public.customer_requests(project_id, created_at desc);

-- Default limit for new users. Existing users above 2 are not reduced by this statement.
alter table public.profiles alter column project_limit set default 2;
