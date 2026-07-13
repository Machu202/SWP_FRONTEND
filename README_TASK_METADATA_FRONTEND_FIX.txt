Patch: Frontend task metadata display fix

Problem:
- Kanban/Assignments showed fallback text: No series, Page ?, Assistant: Unassigned.
- Frontend only checked a few flat fields and did not normalize nested/snake_case task metadata.

Fixed:
- TasksPage now normalizes task records after load/status/assign/submit.
- Reads assistantId/assistantName from flat or nested assistant fields.
- Reads series title, chapter label, page number, and page image from flat, snake_case, or nested fields.
- Works with the backend task metadata response fix.

Changed files:
- src/pages/TasksPage.jsx
