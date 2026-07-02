# Editorial Board Schedule Everywhere Fix

## Problem

The Editorial Board Schedule link could still appear dashboard-only because the Board pages used separate static sidebar HTML. The profile sidebar also did not include Schedule for the Board role.

## Fixed

The Editorial Board sidebar is now normalized across:

- `board-dashboard.html`
- `board-submissions.html`
- `board-voting.html`
- `board-result.html`
- `editorial-board.html`

Every Board screen now has:

- Dashboard
- Review Queue
- Schedule
- Voting
- Decision History

The Schedule link opens:

`board-dashboard.html#schedule`

## Also added

A direct redirect alias:

- `src/board-schedule.html` → `board-dashboard.html#schedule`

The Board profile sidebar now also includes Schedule.

## Permission

Editorial Board schedule remains read-only:

- can view Publishing Calendar
- can view Deadline Monitor
- cannot create/edit/delete schedules or deadlines

## Changed files

- `src/board-dashboard.html`
- `src/board-submissions.html`
- `src/board-voting.html`
- `src/board-result.html`
- `src/editorial-board.html`
- `src/board-schedule.html`
- `src/assets/js/profile.js`
- `src/role-integration.js`
- `src/style-workspace.css`
- `src/assets/css/style-workspace.css`
