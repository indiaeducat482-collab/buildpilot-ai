# BuildPilot AI - Full Fixed Package

## GitHub Pages
The package root contains:
- index.html
- favicon.ico

The favicon is included to prevent:
GET /favicon.ico 404

## Supabase Edge Function
- supabase/functions/buildpilot-generate/index.ts
- supabase/functions/buildpilot-generate/README.md

Required Supabase Edge Function secret:
- OPENAI_API_KEY

Optional:
- OPENAI_MODEL

Never commit OpenAI keys, Supabase service-role keys, Firebase private keys, or GitHub tokens.

IMPORTANT:
The existing BuildPilot AI frontend should remain your actual application entry point.
If your GitHub repository already has its own index.html, keep that application index.html and copy only favicon.ico to the repository root. The sample index.html in this package is only a self-contained fallback.
