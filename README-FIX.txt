BUILD PILOT AI - FULL FIX

FILES:
1. supabase/functions/buildpilot-generate/index.ts
   Complete Edge Function with authentication, OpenAI, project plan,
   project/module/database saving and detailed errors.

2. frontend/generate-fixed.js
   Complete fixed generate() function.
   Uses the current Supabase session JWT and apikey.

3. frontend/config.js
   BuildPilot Supabase configuration.

IMPORTANT:
- Keep the Edge Function Legacy JWT secret verification setting OFF.
- OPENAI_API_KEY must be set in Supabase Edge Function Secrets.
- Do not put OPENAI_API_KEY in frontend files.
- index.html should load config.js, Supabase JS, then app.js.
- Replace your existing generate() with frontend/generate-fixed.js contents.
- Deploy the Edge Function after replacing index.ts.
- Logout/login again before testing.
