# Repatch from frontend (1).rar

This repeats the same process as before using the uploaded `frontend (1).rar`.

## What was done
- Replaced Mangaka screens from the new RAR into `src/pages/mangaka/`.
- Replaced Assistant screens from the new RAR into `src/pages/assistant/`.
- Kept the single-login setup and role redirect behavior.
- Kept the Login Role dropdown removed from `src/index.html`.
- Restored the newer Tantou Editor, Editorial Board, and Admin UI after patching.
- Kept Admin/Tantou/Board logic and backend files untouched.
- Kept old root URLs as redirects.

## Checks
- Login Role dropdown in index: not present
- Tantou reskin class restored: True
- Admin reskin class restored: True
- Reskin CSS restored: True
- JS syntax:
  - api.js: OK
  - script-workspace.js: OK
  - mangaka.js: OK
  - manuscripts.js: OK
  - canvas-editor.js: OK

## Replaced Mangaka files
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

## Replaced Assistant files
- src/pages/assistant/assistant-dashboard.html
- src/pages/assistant/assistant-assignments.html
- src/pages/assistant/resource-library.html
- src/pages/assistant/task-detail.html
