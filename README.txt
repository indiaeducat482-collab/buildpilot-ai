BUILD PILOT AI V7

1) Replace only GitHub app.js with this app.js.
2) Run project-limit-v7.sql once in Supabase SQL Editor.
3) Keep existing config.js, index.html, styles.css and other files.
4) Admin page remains admin.html. Admin can Approve/Reject project-limit requests.

FEATURES
- Every new/free user has a default project limit of 2 (Supabase default).
- When a user reaches 2 projects, creating another project opens a compact Limit Request form.
- User sends requested limit to Admin.
- Admin can approve or reject from admin.html.
- Approving updates that user's project_limit.
- Search bar added to Projects page; filters name, description, status, frontend and backend.
- Public project link remains supported with ?public=<public_id>.
- Customer request public form no longer shows the old "Request could not be sent." message; successful requests show success, actual failures show a generic retry message.
- Existing files/config are preserved; do not delete repo files.
