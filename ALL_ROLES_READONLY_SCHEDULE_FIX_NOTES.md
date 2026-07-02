# All Roles Read-only Schedule Fix

## Request

Every role should have access to a Schedule tab, but only Mangaka should be able to edit schedules/deadlines.

## Implemented

### Mangaka
Already has editable schedule inside:

- `pages/mangaka/dashboard.html#schedule`

Mangaka can:

- create schedules
- create deadlines
- delete schedules/deadlines

### Assistant
Added read-only Schedule tab inside:

- `pages/assistant/assistant-dashboard.html#schedule`

Assistant can only view:

- Publishing Calendar
- Deadline Monitor

### Tantou Editor
Added read-only Schedule tab inside:

- `tantou-dashboard.html#schedule`

Tantou can only view:

- Publishing Calendar
- Deadline Monitor

### Editorial Board
Added read-only Schedule tab inside:

- `board-dashboard.html#schedule`

Board can only view:

- Publishing Calendar
- Deadline Monitor

### Admin
Added read-only Schedule tab inside:

- `admin-dashboard.html#schedule`

Also changed direct Admin schedule/deadline pages to read-only:

- `admin-calendar.html`
- `admin-deadlines.html`

Admin can view schedule/deadline data but cannot add/delete from these screens.

## Permission rule

Only Mangaka gets edit controls.

All other roles show:

- View-only notice
- no Add Schedule form
- no Add Deadline form
- no Delete buttons

## Changed frontend files

- `src/pages/assistant/assistant-dashboard.html`
- `src/assets/js/assistant-dashboard-flow.js`
- `src/tantou-dashboard.html`
- `src/board-dashboard.html`
- `src/admin-dashboard.html`
- `src/role-integration.js`
- `src/style-workspace.css`
- `src/assets/css/style-workspace.css`

## Backend

No backend changes were required.
