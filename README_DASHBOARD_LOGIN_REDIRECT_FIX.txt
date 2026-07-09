Patch: Login redirects to Dashboard

Changed:
- After login, all roles now land on /dashboard first.
- Removed the previous behavior where Mangaka logged in directly to /series.
- Existing sidebar role navigation is unchanged.

Changed file:
- src/api/client.js
