BUILD PILOT V2 — Airo-inspired project workspace (without Airo branding)

Files:
- app.js: updated frontend. Keeps existing project generation, adds 2-project limit gate, upgrade request flow, customer requests and a builder layout inspired by the supplied screenshot.
- project-limit-customer-requests.sql: run once in Supabase SQL Editor.
- admin.html: standalone admin page for receiving, approving and rejecting project-limit upgrade requests.

IMPORTANT:
1. Do not delete the existing repository files. Replace only app.js if you want the new frontend.
2. Run the SQL before testing Customer Requests and Upgrade Requests.
3. Keep config.js publishable key only. Never put a service-role/secret key in frontend files.
4. The public website preview is kept separate; internal builder UI is not inserted into the client's published page.
5. Default project_limit is 2 for new profiles; users already above 2 are not reduced.
