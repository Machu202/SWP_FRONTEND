# Index Login Role Dropdown Removed

This update removes the **Login Role** dropdown from `index.html` login screens too.

Changed files:
- `index.html` if present
- `src/index.html` if present
- `src/script.js` if role-selection fallback logic was present

Login now depends on the backend-returned `role` after authentication.
