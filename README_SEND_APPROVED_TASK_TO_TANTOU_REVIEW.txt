Patch: Explicit Mangaka chapter handoff to Tantou

Problem:
- APPROVED tasks still displayed an Approve button, causing APPROVED -> APPROVED errors.
- Task approval and chapter review submission were mixed together.
- Unassigned series had no usable route to a Tantou review queue.

Fixed:
- Task approval only changes the task status.
- APPROVED task cards are read-only and no longer show invalid approval/revision controls.
- A new Chapter handoff section groups tasks by chapter.
- The chapter can be sent only when all chapter tasks are APPROVED.
- If the series is unassigned, the owning Mangaka selects a Tantou Editor and the frontend assigns the series before sending.
- The dedicated handoff changes chapter status from DRAFT/REVISION to REVIEWING.
- Backend validates Tantou assignment, role, ownership, and approved-task readiness.

Changed frontend files:
- src/pages/MangakaAssistantReviewPage.jsx
- src/pages/TasksPage.jsx
- src/api/client.js
- src/styles.css
- tests/real-data-e2e.mjs
- tests/smoke.mjs

Changed backend files:
- MangaSeriesController
- MangaSeriesService / MangaSeriesServiceImpl
- MangaSeriesResponse
- ChapterServiceImpl
- TaskRepository
