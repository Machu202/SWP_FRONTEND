# Frontend compatibility patch for SWP_BACKEND-main(3)

This patch adjusts the current frontend to match the uploaded backend patch `SWP_BACKEND-main(3).zip`.

## Main fixes
- Keeps the existing single login flow and stores backend JWT token from `/api/v1/auth/login`.
- Makes both root `src/api.js` and nested `src/assets/js/api.js` stringify JSON bodies correctly.
- Adds helper API methods for backend endpoints:
  - `usersByRole(role)` -> `GET /api/v1/users?role=...`
  - `createPage(chapterId, pageNumber, file)` -> `POST /api/v1/pages/chapter/{chapterId}`
  - `createHitbox(pageId, box)` -> `POST /api/v1/workspace/pages/{pageId}/hitboxes`
  - `assignTaskToHitbox(hitboxId, description)` -> `POST /api/v1/workspace/hitboxes/{hitboxId}/task`
  - `assignTask(taskId, assistantId)` -> `PATCH /api/v1/tasks/{taskId}/assign`
  - `submitTask(taskId, imageUrl)` -> `PATCH /api/v1/tasks/{taskId}/submit`
  - `updateProfile(payload)` -> `PUT /api/v1/users/profile`
  - `telemetry(seriesId)` -> `GET /api/v1/telemetry/series/{seriesId}`
- Handles Spring paginated response from `GET /api/v1/manga-series` via `unwrapPage()`.
- Maps frontend task status values to backend state machine values:
  - `IN_PROGRESS` -> `DOING`
  - `REVIEW` / `DONE` -> `REVIEWING`
  - `APPROVED` stays `APPROVED`
- Adds missing `src/pages/assistant/assistant.js` and rewires it to existing backend APIs.
- Updates Assistant dashboard/task detail/resource screens to use:
  - `GET /tasks/my-tasks`
  - `GET /resources`
  - `POST /resources/upload`
  - `PATCH /tasks/{taskId}/submit?imageUrl=...`
- Updates Mangaka page editor/canvas to:
  - Load Assistants using `GET /users?role=Assistant`
  - Upload pages using `POST /pages/chapter/{chapterId}`
  - Load canvas data using `GET /workspace/pages/{pageId}/canvas-init`
  - Create hitboxes using `POST /workspace/pages/{pageId}/hitboxes`
  - Create tasks from hitboxes using `POST /workspace/hitboxes/{hitboxId}/task`
  - Optionally assign assistants using `PATCH /tasks/{taskId}/assign`
- Updates profile save to send JSON fields expected by backend:
  - `fullName`
  - `profileData`

## Kept unchanged
- Tantou Editor UI reskin
- Editorial Board UI reskin
- Admin UI reskin
- Login page role dropdown removal
- Mangaka and Assistant UI from the RAR repatch
- Backend files

## Notes
Some backend endpoints still depend on data existing in the database and Cloudinary configuration. For example, page upload and resource upload require the backend Cloudinary settings to be valid.
