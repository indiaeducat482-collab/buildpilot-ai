# BuildPilot AI — Final Fixed Package

## GitHub Pages
Upload the **contents of this package** to the root of the `buildpilot-ai` repository.

Required root files include `index.html`, `app.js`, `config.js`, `styles.css`, `favicon.ico`, `favicon.svg`, `.nojekyll`, and `404.html`.

## Supabase Edge Function
Deploy `supabase/functions/buildpilot-generate/index.ts` as the function named `buildpilot-generate`.

In Supabase Edge Function Secrets, keep `OPENAI_API_KEY` server-side. Do not place it in `config.js` or any browser file.

The function uses Supabase's `withSupabase({ auth: "user" })` authentication flow and expects the logged-in user's bearer token.

## Database
Run `supabase/migrations/001_buildpilot_limits.sql` in Supabase SQL Editor if the migration has not already been applied.

## Important
This package preserves the existing static BuildPilot UI from the project package and fixes the GitHub Pages favicon/404 packaging issues. It does not replace the UI with a placeholder page.
