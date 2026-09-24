BuildPilot AI V8 – UI + Limit Fix

FIXES:
- Restores the Airo-style Create a new project modal styling.
- Adds New Website / Rebuild Site / Other tabs to the create modal.
- Keeps the Search projects bar on My Projects.
- Keeps default 2-project limit and upgrade request flow.
- Keeps Admin Approve / Reject flow.
- Makes Request more projects modal compact.
- Keeps customer request receiving.
- Removes Authorization Bearer header from public customer request POST.
- Public customer request shows success after successful insert.

INSTALL:
1. Replace only app.js in GitHub.
2. Keep existing config.js, index.html and styles.css.
3. Run project-limit-v8.sql in Supabase SQL Editor.
4. Keep admin.html or replace it with this version if needed.
5. Hard refresh the site with Ctrl+F5.

Do not delete the existing repository files.
