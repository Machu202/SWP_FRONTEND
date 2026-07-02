# Mangaka Dashboard Inline Schedule Fix

## Request

Move the Mangaka schedule/deadline page into the Mangaka dashboard and remove the Profile / Notifications / Logout account controls from that schedule-style screen.

## Fixed

### Integrated schedule into Mangaka dashboard

The Mangaka dashboard now has an inline `Schedule` panel, just like:

- Chapters & Pages
- Canvas Workspace
- Kanban Board

You can open it from:

- Sidebar: `Schedule`
- Topbar: `Schedule`
- Quick Actions: `Schedule`

All point to:

`pages/mangaka/dashboard.html#schedule`

### Removed old standalone schedule screen

`src/schedule.html` now redirects to:

`pages/mangaka/dashboard.html#schedule`

So users no longer see the old standalone schedule page with a separate sidebar.

### Removed profile/notifications/logout controls from the dashboard topbar

The Mangaka dashboard topbar no longer shows:

- Notification dropdown
- Profile dropdown
- Logout dropdown

It now only shows:

- Search
- Plain logged-in user avatar/initials

### Schedule panel features

The integrated Schedule panel contains:

- Publishing Calendar tab
- Deadline Monitor tab
- Owned-series selector
- Search schedules/deadlines
- Add Schedule
- Add Deadline
- Delete schedule/deadline
- Backend API save/load with localStorage fallback if backend blocks the request

## Protected

No Admin, Tantou, or Editorial Board files were intentionally changed.

## Changed frontend files

- `src/pages/mangaka/dashboard.html`
- `src/schedule.html`
- `src/assets/js/mangaka-dashboard-flow.js`
- `src/style-workspace.css`
- `src/assets/css/style-workspace.css`
