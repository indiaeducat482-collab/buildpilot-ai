BuildPilot AI – Airo-style Projects + 2-project limit + Customer Requests

Files:
- app.js: updated frontend. Replace the existing app.js only after making a backup.
- customer_requests_and_limits.sql: run in Supabase SQL Editor.

Features:
1. Airo-style Projects page and Create New Project modal.
2. Default project limit shown from profiles.project_limit (fallback 2).
3. Project 3 is blocked when the account limit is reached.
4. Upgrade request form sends full_name, mobile, email, requested_limit and message to upgrade_requests.
5. Customer Request button is injected into the public project and requests are visible to the project owner.
6. Customer request RLS permits public insert and owner-only read/update.

Important:
- Do not expose Supabase secret/service_role keys in the frontend.
- Keep your existing config.js.
- Back up the current app.js before replacing it.
