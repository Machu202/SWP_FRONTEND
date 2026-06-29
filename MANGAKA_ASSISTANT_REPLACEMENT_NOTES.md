# Mangaka + Assistant Screen Replacement Patch

This package keeps the existing backend-connected Admin, Tantou Editor, and Editorial Board screens, then replaces the current Mangaka and Assistant screens with the screens from `SWP_FRONTEND-fe-core2(3)(1).zip`.

## New screen locations

### Mangaka
- `src/pages/mangaka/dashboard.html`
- `src/pages/mangaka/series.html`
- `src/pages/mangaka/create-series.html`
- `src/pages/mangaka/manuscripts.html`
- `src/pages/mangaka/create-chapter.html`
- `src/pages/mangaka/page-editor.html`
- `src/pages/mangaka/assignments.html`
- `src/pages/mangaka/review.html`
- `src/pages/mangaka/editor-feedback.html`
- `src/pages/mangaka/analytics.html`

### Assistant
- `src/pages/assistant/assistant-dashboard.html`
- `src/pages/assistant/assistant-assignments.html`
- `src/pages/assistant/resource-library.html`
- `src/pages/assistant/task-detail.html`

## Compatibility aliases

The old flat URLs still work. They now redirect to the new nested screens.

Examples:
- `src/mangaka-dashboard.html` -> `src/pages/mangaka/dashboard.html`
- `src/assistant-dashboard.html` -> `src/pages/assistant/assistant-dashboard.html`
- `src/manuscripts.html` -> `src/pages/mangaka/manuscripts.html`
- `src/task-detail.html` -> `src/pages/assistant/task-detail.html`

## Shared assets copied

- `src/assets/css/style-workspace.css`
- `src/assets/css/style.css`
- `src/assets/js/api.js` compatibility bridge
- `src/assets/js/mangaka.js`
- `src/assets/js/manuscripts.js`
- `src/assets/js/canvas-editor.js`
- `src/assets/js/script-workspace.js`
- `src/assets/js/script.js`

## Backend integration notes

The new Mangaka screens call these backend APIs through `window.MangaApi.apiFetch()`:

- `POST /api/v1/manga-series`
- `GET /api/v1/manga-series/my-series`
- `GET /api/v1/chapters?seriesId=...` or compatible chapter endpoint
- `POST /api/v1/chapters`
- `POST /api/v1/tasks` from the canvas editor task modal

The Assistant screens are mostly UI-driven and can be connected to:

- `GET /api/v1/tasks/my-tasks`
- `PATCH /api/v1/tasks/{taskId}/status?newStatus=...`
- `GET /api/v1/resources`
- upload/submission endpoint if your backend exposes one.

## How to use

Copy the `SWP_FRONTEND` folder over your current frontend project, or copy only these folders/files:

- `src/pages/mangaka/`
- `src/pages/assistant/`
- `src/assets/`
- the redirect HTML files in `src/`
- patched `src/api.js`

Then run:

```powershell
cd C:\Users\admin\Documents\GitHub\SWP_FRONTEND
npm install
npm run dev
```

Open:

- `http://localhost:5173/src/pages/mangaka/dashboard.html`
- `http://localhost:5173/src/pages/assistant/assistant-dashboard.html`
