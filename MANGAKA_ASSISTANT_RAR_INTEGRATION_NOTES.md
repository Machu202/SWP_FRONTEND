# Mangaka + Assistant replacement from frontend.rar

This package replaces only the Mangaka and Assistant role screens using the uploaded `frontend.rar`.

## Replaced Mangaka screens
- src/pages/mangaka/dashboard.html
- src/pages/mangaka/series.html
- src/pages/mangaka/manuscripts.html
- src/pages/mangaka/assignments.html
- src/pages/mangaka/review.html
- src/pages/mangaka/analytics.html
- src/pages/mangaka/create-series.html
- src/pages/mangaka/create-chapter.html
- src/pages/mangaka/editor-feedback.html
- src/pages/mangaka/page-editor.html

## Replaced Assistant screens
- src/pages/assistant/assistant-dashboard.html
- src/pages/assistant/assistant-assignments.html
- src/pages/assistant/resource-library.html
- src/pages/assistant/task-detail.html

## Compatibility updates made
- Adjusted relative CSS/JS paths because the RAR screens were originally at project root.
- Kept the existing login and role routing.
- Kept Admin, Tantou Editor, and Editorial Board screens untouched.
- Preserved root redirect files so old URLs still forward to the new role folders.
- Patched role-local assets:
  - `src/assets/js/api.js` now stringifies JSON request bodies.
  - `src/assets/js/manuscripts.js` now calls `/chapters/series/{seriesId}`.
  - `src/assets/js/script-workspace.js` now calls `/tasks/my-tasks`, `/notifications/unread`, and `/users/profile`.
  - `src/assets/js/mangaka.js` sends JSON for `/manga-series` creation.

## Not changed
- Admin screens
- Tantou Editor screens
- Editorial Board screens
- Top-level login page behavior
- Backend files
