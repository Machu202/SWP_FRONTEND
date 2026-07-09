Patch: Google login and OTP login

Frontend changes:
- Google Sign-In now uses Google Identity Services.
- Google ID token is sent to POST /api/v1/auth/google.
- Returned JWT session is saved and role redirect works.
- OTP tab now has a real flow:
  1. Email + password -> POST /api/v1/auth/request-otp
  2. OTP code -> POST /api/v1/auth/verify-otp
  3. Returned JWT session is saved and role redirect works.
- Added VITE_GOOGLE_CLIENT_ID to .env.example.

Important:
- Google login requires VITE_GOOGLE_CLIENT_ID in frontend .env.
- Backend application.yml must use the same Google client id in manga.app.googleClientId.
- OTP login requires the backend /api/v1/auth/request-otp endpoint included in the backend changed-files patch.
