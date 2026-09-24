BuildPilot AI index.ts V9 fix

Fixes:
- Uses current Gemini model order: configured model, gemini-3.8-flash, gemini-3.5-flash-lite, gemini-2.5-flash-lite.
- Tries the next model on 400/401/403/404 model-access/config errors.
- Retries transient 408/429/5xx errors.
- Default project limit is 2 when profiles.project_limit is null.
- Default generation model recorded is gemini-3.8-flash.
- Returns detailed provider error information instead of a generic failure.
- Keeps existing Supabase auth, project limit, file limit, generation saving, and project modification logic.

Important:
1. Replace only the deployed Edge Function index.ts for buildpilot-generate.
2. Keep your existing Supabase secrets.
3. Make sure GEMINI_API_KEY is set.
4. If GEMINI_MODEL is set, it will be tried first.
5. After deployment, test Generate again.
