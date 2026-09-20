# BuildPilot AI

AI-powered website/app project builder MVP.

## What it does
- Collects a plain-language project idea
- Lets the user select Next.js/React/HTML and Supabase/Firebase/GitHub-only
- Uses a server-side AI route to create a structured project blueprint
- Generates a downloadable ZIP with README, setup guide, environment template and project plan

## Run
```bash
npm install
cp .env.example .env.local
# add OPENAI_API_KEY to .env.local
npm run dev
```

Open http://localhost:3000.

## Security
Never put OPENAI_API_KEY, Supabase service-role keys, Firebase private keys, or GitHub tokens into client-side code. Use server-side environment variables and least-privilege credentials.

## Roadmap
GitHub OAuth/push, Supabase automation, Firebase automation, live code editor, preview sandbox, Vercel deployment and project history.
