# BuildPilot AI

GitHub Pages + Supabase Edge Functions MVP. No Vercel.

## Features

- User email/password sign up and login
- Chat-style BuildPilot AI interface
- Typing `admin login` in the chat opens Admin Login
- Supabase Edge Function calls OpenAI securely on the server
- Project history stored in Supabase
- Free account limits: 5 projects and 2 generated files
- Upgrade request workflow for higher limits
- Admin dashboard: user count, active/blocked users, projects, block/reactivate, approve/reject upgrade requests
- Supabase RLS policies for user/admin access

## Supabase setup

1. Run the base BuildPilot schema first.
2. Run `supabase/migrations/001_buildpilot_limits.sql` in Supabase SQL Editor.
3. Create/deploy an Edge Function named `buildpilot-generate` using `supabase/functions/buildpilot-generate/index.ts`.
4. In Edge Function Secrets add:
   - `OPENAI_API_KEY` = your OpenAI API key
   - `OPENAI_MODEL` is optional; defaults to `gpt-5.6-luna`
5. Keep Edge Function JWT verification enabled.

## Important API billing note

ChatGPT subscriptions and the OpenAI API platform use separate billing. A ChatGPT subscription does not automatically provide API credits. If the Edge Function reports an OpenAI billing/credit error, add API billing/credits in the OpenAI API platform.

## Create the first admin

1. Create a normal BuildPilot account.
2. Confirm the email if email confirmation is enabled.
3. Login once so the `profiles` row is created.
4. In Supabase SQL Editor run:

```sql
update public.profiles
set role = 'admin', status = 'active'
where id = (
  select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
);
```

Then open BuildPilot and type `admin login` in the chat.

## GitHub Pages

Upload the contents of this `buildpilot-ai` folder to the `buildpilot-ai` repository. The app is static and uses Supabase directly from the browser.

Do not put OpenAI keys, Supabase service-role keys, Firebase private keys, or GitHub tokens in `config.js` or other browser files.
