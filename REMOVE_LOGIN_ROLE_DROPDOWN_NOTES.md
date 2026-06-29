# Login Role Dropdown Removed

This patch removes the visible **Login Role** selector from all login pages.

## Why
The backend login response already returns the authenticated user's role, so the frontend should not ask the user to choose a role manually.

## Changed login pages
- `src/mangaka-login.html`
- `src/assistant-login.html`
- `src/tantou-login.html`
- `src/board-login.html`
- `src/admin-login.html`

## Also adjusted
- `src/script.js`

The frontend now redirects using the backend-returned role only.
