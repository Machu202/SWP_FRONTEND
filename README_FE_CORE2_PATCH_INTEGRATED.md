# FE Core2 Patch Integrated

This build merges `SWP_FRONTEND-fe-core2(2).zip` into the backend-compatible frontend.

## What was integrated

- New FE Core2 visual pages were copied into `src/`.
- `api.js` and `realtime.js` were preserved and injected into HTML pages.
- The old mock-only `script.js` from the patch was not used because it overwrote backend login with fake redirects.
- The patch `script-workspace.js` contained duplicated/nested `DOMContentLoaded` code, so the clean backend-compatible workspace script was kept and the useful dropzone UI behavior was added.
- Assistant links were normalized to `assistant-task-detail.html` and `assistant-resources.html`.
- Alias pages `task-detail.html` and `resource-library.html` are still included for compatibility.
- Mangaka login route now goes to `dashboard.html`, matching the FE Core2 page set.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Do not open HTML files directly because backend CORS expects the Vite origin.

## Integration status

This is still compatibility-level integration, not full data binding. Pages can call the backend through `window.MangaApi.apiFetch(...)`, but most dashboard/cards/statistics remain static until endpoint-specific rendering code is added.
