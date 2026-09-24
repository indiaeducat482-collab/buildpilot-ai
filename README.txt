BUILD PILOT — CUSTOMER REQUEST + LIMIT REQUEST FIX

Included:
1. app.js
   - Customer Requests now load correctly inside the project workspace Requests tab.
   - Customer requests can be refreshed and marked as read.
   - Public website Customer Request form saves into customer_requests.
   - Project-limit request popup is smaller/compact and desktop/mobile friendly.
   - Duplicate pending project-limit requests are prevented.
   - No internal builder branding is inserted into the public project HTML.

2. admin.html
   - Compact Project Limit Requests section.
   - Approve / Reject requests.
   - Customer Requests section for all received public-site requests.
   - Mark customer requests as read.

3. project-limit-customer-requests.sql
   - Creates/updates customer_requests.
   - Owner policies for receiving customer requests.
   - Admin policies so admin can receive/manage customer requests.
   - Project limit defaults to 2 for new profiles.
   - Existing users with a non-null higher limit are preserved.

IMPORTANT:
- Run the SQL in Supabase SQL Editor before testing.
- Replace only app.js and admin.html in your existing repository.
- Keep your existing config.js.
- Use only the Supabase publishable key in frontend files; never add a service-role key.
- Do not delete the existing repository files.
