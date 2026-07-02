# Schedule Tab Everywhere Fix

## Problem

The Schedule tab was only visible on the dashboard because each role page has its own static sidebar HTML. The previous patch added the Schedule link only to the dashboard file, not to the other role pages like Tantou Editorial Report, Chapter Review, Annotation & Feedback, Revision Tracking, etc.

## Fixed

Schedule link is now added to every sidebar page for:

- Tantou Editor
- Editorial Board
- Admin
- Assistant

The Schedule link still opens the dashboard inline read-only schedule panel:

- Tantou: `tantou-dashboard.html#schedule`
- Board: `board-dashboard.html#schedule`
- Admin: `admin-dashboard.html#schedule`
- Assistant: `assistant-dashboard.html#schedule`

## Also fixed

The Tantou schedule panel no longer depends only on the Tantou review-approved filter. It loads schedule-visible series first, then falls back safely if the backend blocks a list endpoint.

## Changed files

- `src/tantou-dashboard.html`
- `src/tantou-review.html`
- `src/tantou-feedback.html`
- `src/tantou-revision.html`
- `src/tantou-report.html`
- `src/board-dashboard.html`
- `src/board-submissions.html`
- `src/board-voting.html`
- `src/board-result.html`
- `src/editorial-board.html`
- `src/admin-dashboard.html`
- `src/admin-users.html`
- `src/admin-settings.html`
- `src/admin-calendar.html`
- `src/admin-deadlines.html`
- `src/admin-final-approval.html`
- `src/pages/assistant/assistant-dashboard.html`
- `src/pages/assistant/assistant-assignments.html`
- `src/pages/assistant/resource-library.html`
- `src/pages/assistant/task-detail.html`
- `src/role-integration.js`
- `src/style-workspace.css`
- `src/assets/css/style-workspace.css`
