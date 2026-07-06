# Deployment notes

This project is a Vite single-page React app.

## Build

```bash
npm install
npm run build
```

The production files are generated in `dist/`.

## Environment variables

Set these variables in your hosting provider when deploying:

```env
VITE_API_BASE_URL=https://your-backend-domain/api/v1
VITE_WS_BASE_URL=https://your-backend-domain/ws
```

For local development, copy `.env.example` to `.env` and edit the values.

## Backend CORS

The backend must allow the deployed frontend origin. For local development, it should allow:

```text
http://localhost:5173
```

For production, add the deployed frontend URL, for example:

```text
https://your-frontend-domain.vercel.app
```
