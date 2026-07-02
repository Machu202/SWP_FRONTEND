# Assistant Schedule Everywhere Fix

## Problem

The Assistant Schedule tab could still look dashboard-only because not every Assistant surface used the same sidebar/navigation source.

## Fixed

The Schedule link is now guaranteed on Assistant role surfaces:

- `src/pages/assistant/assistant-dashboard.html`
- `src/pages/assistant/assistant-assignments.html`
- `src/pages/assistant/resource-library.html`
- `src/pages/assistant/task-detail.html`
- Assistant Profile sidebar via `src/assets/js/profile.js`

Also added a direct redirect alias:

- `src/assistant-schedule.html` → `src/pages/assistant/assistant-dashboard.html#schedule`

## Behavior

Assistant Schedule is still read-only:

- can view Publishing Calendar
- can view Deadline Monitor
- cannot create/delete/edit schedule items

## Changed files

- `src/pages/assistant/assistant-dashboard.html`
- `src/pages/assistant/assistant-assignments.html`
- `src/pages/assistant/resource-library.html`
- `src/pages/assistant/task-detail.html`
- `src/assistant-schedule.html`
- `src/assets/js/assistant-dashboard-flow.js`
- `src/assets/js/profile.js`
- `src/style-workspace.css`
- `src/assets/css/style-workspace.css`
