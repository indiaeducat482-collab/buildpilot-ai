# BuildPilot AI

Describe it. Build it. Deploy it.

## Hosting architecture
- Frontend: GitHub Pages
- Auth/Database: Supabase
- AI generation: Supabase Edge Function + OpenAI Responses API
- Vercel: not used

## Free limits
- 5 projects
- 2 generated project files
- Users can request a limit upgrade; Admin approves or rejects it.

## Admin
Type `admin login` in the chat to open Admin Login. The Admin Dashboard can view users/projects, block/reactivate users, and review upgrade requests.

## Setup
1. Run `supabase/migrations/001_buildpilot_limits.sql` in Supabase SQL Editor.
2. Create your Admin account through the app.
3. Set that account to admin using the commented SQL at the bottom of the migration.
4. In Supabase Edge Function Secrets keep `OPENAI_API_KEY` private.
5. Deploy `supabase/functions/buildpilot-generate/index.ts`.
6. Deploy the static files to GitHub Pages.

Never put OpenAI API keys, Supabase secret keys, Firebase private keys, or GitHub tokens in `config.js`.
