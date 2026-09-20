# BuildPilot AI

Describe it. Build it. Deploy it.

Static GitHub Pages frontend + Supabase Auth/Database + Supabase Edge Function + OpenAI.

## Included

- User sign up / login / logout
- Chat-style BuildPilot interface
- Typing `admin login` opens the Admin Login page
- Admin dashboard
- User block / reactivate
- Project count and limits
- Free plan: 5 projects
- Free plan: 2 GitHub-file generation actions
- Upgrade request workflow
- Admin approve/reject upgrade requests
- Supabase project history
- Secure OpenAI call through Edge Function
- No Vercel

## GitHub Pages

1. Upload all files to `indiaeducat482-collab/buildpilot-ai`.
2. Enable GitHub Pages from the repository's Settings > Pages.
3. The frontend uses the Supabase publishable key in `config.js`. A publishable key is designed for browser use when RLS is enabled.
4. Never put an OpenAI key, Supabase secret key, service-role key, Firebase private key, or GitHub token in this repository.

## Supabase setup

The `supabase/migrations/001_buildpilot_limits.sql` file adds:
- profiles role/status/plan/limits
- upgrade_requests
- admin/user RLS policies
- helper functions

The `supabase/functions/buildpilot-generate/index.ts` file is the updated AI function. It enforces the project and GitHub-file quotas before calling OpenAI.

The already-deployed function must be updated/redeployed with that file. The dashboard editor can be used.

## First admin

Create your normal account in BuildPilot AI first. Then in Supabase SQL Editor run:

```sql
update public.profiles
set role = 'admin',
    status = 'active'
where id = (
  select id from auth.users
  where email = 'YOUR_ADMIN_EMAIL'
);
```

Replace `YOUR_ADMIN_EMAIL` with the admin account email.

## Upgrade flow

User reaches a quota -> clicks Request Upgrade -> submits a request.

Admin Dashboard -> Upgrade Requests -> Verify -> Approve or Reject.

On approval, the admin can set the new project/file limits.

## Important

The frontend is only the UI. Real authorization is enforced by Supabase RLS and the Edge Function. Do not rely on hiding admin links.
