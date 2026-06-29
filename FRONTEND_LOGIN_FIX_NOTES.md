# Frontend Login Fix

This patch fixes the login flow to match the backend `POST /api/v1/auth/login`.

## Backend expectation

The backend login endpoint accepts:

```json
{
  "username": "username-or-email",
  "password": "plain-password"
}
```

The backend login response returns a JWT token and role:

```json
{
  "token": "...",
  "role": "...",
  "username": "...",
  "email": "...",
  "message": "Đăng nhập thành công!"
}
```

## Changed files

- `src/api.js`
- `src/script.js`
- `src/style.css`
- `src/mangaka-login.html`
- `src/assistant-login.html`
- `src/tantou-login.html`
- `src/board-login.html`
- `src/admin-login.html`

## What was fixed

- Sends login request to `/api/v1/auth/login`.
- Sends fields exactly as `username` and `password`.
- Allows username or email in the frontend input.
- Saves backend `token` into `localStorage.accessToken`.
- Saves role/username/email into localStorage.
- Redirects by backend role instead of only selected role.
- Shows visible login errors instead of failing silently.
- Supports Enter key login.
