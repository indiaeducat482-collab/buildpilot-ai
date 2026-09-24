BUILD PILOT v4 FIX

1. Replace ONLY app.js with buildpilot-app-v4.js. Keep config.js and all other files.
2. Run buildpilot-project-limit-customer-requests-v4.sql in Supabase SQL Editor. This adds explicit Data API grants + RLS for customer requests.
3. Replace admin.html with buildpilot-admin-v4.html.

FIXES
- Customer Request popup redesigned and compact.
- Customer request POST no longer sends an invalid Bearer header with a publishable key.
- Success message appears only after Supabase confirms the row was saved.
- No “Request could not be sent.” message is used.
- Customer requests continue to appear in the project Requests area and Admin dashboard.
- Project-limit request UI/admin cards made smaller and cleaner.
- 2-project default limit and existing upgrade approval flow preserved.
- Do not delete/overwrite other repository files.

IMPORTANT
The SQL must be run for the public customer form to have the required Data API privileges/RLS. GitHub deployment was not performed by this package.
