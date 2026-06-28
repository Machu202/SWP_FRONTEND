# Frontend compatibility patch for `SWP_BACKEND-main`

This patch does **not** fully integrate every mock screen with real database data. It only makes the frontend compatible with the backend API contracts so the team can integrate page-by-page later.

## What was fixed

1. **API base URL fixed**
   - `src/api.js` now points to `http://localhost:8080/api/v1`.
   - You can override it in the browser console if needed:
     ```js
     localStorage.setItem("apiBaseUrl", "http://localhost:8080/api/v1")
     ```

2. **Reusable API layer added**
   - Global helpers are available through:
     ```js
     window.MangaApi
     window.apiFetch
     ```
   - `apiFetch()` now automatically:
     - adds `Authorization: Bearer <accessToken>` when logged in;
     - JSON-stringifies normal JS objects;
     - supports `FormData` upload without forcing `Content-Type`;
     - reports backend error messages more clearly.

3. **Backend-compatible login flow added**
   - Backend `/auth/login` sends OTP and returns only `MessageResponse`.
   - Frontend now does this correctly:
     1. `POST /auth/login` with `{ username, password }`
     2. asks for OTP
     3. `POST /auth/verify-otp` with `{ email, otpCode }`
     4. saves `data.token` into `localStorage.accessToken`
     5. redirects by backend role.

4. **JWT naming mismatch fixed**
   - Backend returns `token`.
   - Frontend stores it as:
     ```js
     localStorage.setItem("accessToken", data.token)
     ```

5. **Role mapping fixed**
   - UI roles are mapped to backend seed roles:
     - `mangaka` -> `Mangaka`
     - `assistant` -> `Assistant`
     - `tantou` -> `Tantou Editor`
     - `editorial` -> `Editorial Board`
     - `admin` -> `Admin`

6. **Register call made compatible**
   - Register now calls `POST /auth/register` with:
     ```json
     {
       "username": "...",
       "email": "...",
       "password": "...",
       "role": "Mangaka"
     }
     ```
   - The current UI only has one email/name field, so the frontend infers username from the email prefix if a separate username is not provided.

7. **WebSocket compatibility helper added**
   - New file: `src/realtime.js`
   - It can connect to backend `/ws` and subscribe to:
     ```txt
     /topic/notifications/{userId}
     ```
   - It auto-connects only after a successful login.

8. **Script crash fixed**
   - `script.js` no longer crashes on dashboard/workspace pages that do not contain login tabs.

9. **All HTML pages can access API helpers**
   - Missing pages now include:
     ```html
     <script src="api.js"></script>
     <script src="realtime.js"></script>
     ```

## How to run with backend CORS

Backend CORS allows only:

```txt
http://localhost:5173
```

So do **not** open HTML by double-clicking. Do **not** use VS Code Live Server on port `5500` unless backend CORS is changed.

Run frontend with Vite:

```bash
npm install
npm run dev
```

Then open:

```txt
http://localhost:5173
```

Run backend on:

```txt
http://localhost:8080
```

## Important limitation

Most dashboards, kanban cards, profile fields, votes, and statistics are still mock HTML. They are now **ready to call API**, but they are not fully connected yet.

Example for later integration:

```js
const profile = await MangaApi.apiFetch("/users/profile");
```

or:

```js
const tasks = await MangaApi.apiFetch("/tasks/my-tasks");
```
