# BuildPilot AI - Final Edge Function Setup

1. Supabase -> Edge Functions -> Functions -> `buildpilot-generate`.
2. Replace `index.ts` with the supplied `supabase/functions/buildpilot-generate/index.ts`.
3. Deploy the function.
4. Keep `OPENAI_API_KEY` in Edge Function Secrets.
5. `supabase/config.toml` keeps `verify_jwt = true` because the function is a signed-in-user endpoint. The current Supabase `@supabase/server` SDK validates the user JWT and provides an RLS-scoped client.

If your Dashboard asks for function configuration, use the same setting: Verify JWT = ON.

## Important
The OpenAI API key must never be placed in GitHub Pages or `config.js`.
