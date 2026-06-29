# Tantou / Admin / Editorial Board Frontend Export

This package contains only the screens and support files needed for these role areas:

- Tantou Editor screens
- Admin screens
- Editorial Board screens
- Shared files required by those screens: API adapter, workspace script, role integration script, styles, notification/profile helpers, and assets.

## Folder layout

```text
tantou_admin_board_export/
  index.html
  package.json
  vite.config.js
  public/
    favicon.svg
    icons.svg
  src/
    admin-*.html
    board-*.html
    editorial-board.html
    tantou-*.html
    api.js
    role-integration.js
    script.js
    script-workspace.js
    style.css
    style-workspace.css
    profile.html
    notifications.html
    feature-map.html
    cover.png
```

## How to integrate into another frontend

Copy the files inside `src/` into the target frontend's page/static directory. Keep these files in the same folder unless you also update the relative paths inside the HTML files:

```html
<link rel="stylesheet" href="style-workspace.css">
<script src="api.js"></script>
<script src="script.js"></script>
<script src="script-workspace.js"></script>
<script src="role-integration.js"></script>
```

The role pages expect the backend API base URL to be:

```js
http://localhost:8080/api/v1
```

You can override it before loading `api.js`:

```html
<script>
  window.MANGA_API_BASE_URL = "https://your-backend.example.com/api/v1";
  window.MANGA_WS_BASE_URL = "https://your-backend.example.com/ws";
</script>
<script src="api.js"></script>
```

## Required backend endpoints used by these screens

The shared `api.js` calls these main endpoints:

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/register
GET    /api/v1/users/profile
GET    /api/v1/users/all
PATCH  /api/v1/users/{id}/lock
PATCH  /api/v1/users/{id}/role
GET    /api/v1/system-parameters
POST   /api/v1/system-parameters
PUT    /api/v1/system-parameters/{key}
DELETE /api/v1/system-parameters/{key}
GET    /api/v1/manga-series
GET    /api/v1/manga-series/{id}
PATCH  /api/v1/manga-series/{id}/status
PATCH  /api/v1/manga-series/{id}/admin-decision
GET    /api/v1/chapters/series/{seriesId}
GET    /api/v1/pages/chapter/{chapterId}
GET    /api/v1/tasks/my-tasks
PATCH  /api/v1/tasks/{taskId}/status
GET    /api/v1/tantou-feedbacks/pages/{pageId}
POST   /api/v1/tantou-feedbacks/pages/{pageId}
PATCH  /api/v1/tantou-feedbacks/{feedbackId}/resolve
GET    /api/v1/votes/series/{seriesId}/summary
POST   /api/v1/votes/series/{seriesId}
GET    /api/v1/schedules/series/{seriesId}
POST   /api/v1/schedules
PUT    /api/v1/schedules/{id}
DELETE /api/v1/schedules/{id}
GET    /api/v1/deadlines/series/{seriesId}
POST   /api/v1/deadlines/series/{seriesId}
DELETE /api/v1/deadlines/{eventId}
GET    /api/v1/resources
POST   /api/v1/resources/upload
GET    /api/v1/notifications/unread
PATCH  /api/v1/notifications/{id}/read
WS     /ws -> /topic/notifications/{userId}
```

## Local run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173/src/tantou-dashboard.html
http://localhost:5173/src/board-dashboard.html
http://localhost:5173/src/admin-dashboard.html
```

## Notes

- I removed the previous Tantou shortcut that navigated directly into the Editorial Board pages. Tantou submission now only updates backend status and returns to the Tantou dashboard.
- These pages still require valid JWT login data in localStorage. Login through `tantou-login.html`, `board-login.html`, or `admin-login.html`, or provide `accessToken`, `userId`, `username`, and `role` manually for testing.
- External CDNs are still used for Font Awesome, Google Sign-In, SockJS, and STOMP. If the target system must be fully offline, replace those with local copies.
