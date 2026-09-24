BUILD PILOT AI - V6 UI/PUBLIC FIX

1. Replace ONLY GitHub app.js with the included app.js.
2. Run buildpilot-public-link-fix.sql in Supabase SQL Editor.
3. Do not delete config.js, index.html, styles.css, or other existing files.

V6 changes:
- Added compact top project search bar.
- Search filters projects instantly.
- Added Public button on published project cards.
- Public URL route remains /?public=<public_id> and loads only the customer website.
- Included public RLS policies for published projects and project_files.
- Made Request more projects modal smaller and cleaner.
- Kept project limit, customer requests, admin approval flow.
