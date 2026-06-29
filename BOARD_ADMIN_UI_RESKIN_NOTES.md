# Editorial Board + Admin UI Reskin Patch

This patch updates only the **visual presentation** of the Editorial Board and Admin screens.

## Updated Editorial Board screens
- `src/board-dashboard.html`
- `src/editorial-board.html`
- `src/board-submissions.html`
- `src/board-voting.html`
- `src/board-result.html`

## Updated Admin screens
- `src/admin-dashboard.html`
- `src/admin-users.html`
- `src/admin-settings.html`
- `src/admin-calendar.html`
- `src/admin-deadlines.html`
- `src/admin-final-approval.html`

## Shared styling updated
- `src/style-workspace.css`

## What changed
- Reworked sidebar / topbar / card styling to match the provided visual references.
- Preserved current route structure and existing backend integration behavior.
- Did not change `role-integration.js`, API calls, auth, or current working logic.

## Important
This is a **UI-only patch**. Functionality should remain the same as before.
