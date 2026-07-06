# SWP391 Manga Studio Frontend

React + Vite frontend for the SWP391 Manga Studio workflow system.

This version is prepared for Git/GitHub publishing. It does not include `node_modules`, `dist`, `.env`, or backend secrets.

## Main features

- JWT login/logout using the Spring Boot backend
- Role-aware navigation for Mangaka, Assistant, Tantou Editor, Editorial Board, and Admin
- Manga series creation with cover image upload
- Chapter, script, page, and workspace management
- Canvas hitbox creation
- Task creation and assignment to assistants
- Assistant task submission upload
- Mangaka review of assistant submissions
- Tantou Editor review screen
- Editorial Board voting screen
- Admin final review screen
- Resource library
- Schedule/deadline page
- Profile page
- Admin user/system management screens

## Tech stack

- React
- Vite
- Plain CSS
- Browser `fetch` API
- Backend expected at `/api/v1`

## Requirements

- Node.js 18.18+ recommended
- npm 9+
- Backend running locally at `http://localhost:8080`
- Backend CORS allowing `http://localhost:5173`

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:5173
```

## Environment variables

The app reads API URLs from Vite environment variables:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_WS_BASE_URL=http://localhost:8080/ws
```

Use `.env.example` as the template. Do not commit `.env`.

## Build check

```bash
npm run build
```

Preview the built app:

```bash
npm run preview
```

## Git publish commands

```bash
git init
git add .
git commit -m "Initial React frontend"
git branch -M main
git remote add origin <your-github-repository-url>
git push -u origin main
```

## Important Git rules

Commit:

```text
src/
public/
index.html
package.json
package-lock.json
vite.config.js
.env.example
README.md
.gitignore
.editorconfig
.gitattributes
.nvmrc
docs/
```

Do not commit:

```text
node_modules/
dist/
.env
*.log
local IDE/cache files
```

## Backend endpoints used

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/register
GET    /api/v1/users/profile
PUT    /api/v1/users/profile
GET    /api/v1/users/all
GET    /api/v1/users?role=Assistant
PATCH  /api/v1/users/{id}/lock?isActive=true|false
PATCH  /api/v1/users/{id}/role?roleName=...

GET    /api/v1/manga-series
GET    /api/v1/manga-series/my-series
POST   /api/v1/manga-series
GET    /api/v1/manga-series/{id}
PUT    /api/v1/manga-series/{id}
PATCH  /api/v1/manga-series/{id}/status?newStatus=...
PATCH  /api/v1/manga-series/{id}/admin-decision?isApproved=true|false&tantouId=...

GET    /api/v1/chapters/series/{seriesId}
POST   /api/v1/chapters
PATCH  /api/v1/chapters/{id}/status?newStatus=...

GET    /api/v1/pages/chapter/{chapterId}
POST   /api/v1/pages/chapter/{chapterId}
PUT    /api/v1/pages/{id}/image

GET    /api/v1/workspace/pages/{pageId}/canvas-init
POST   /api/v1/workspace/pages/{pageId}/hitboxes
DELETE /api/v1/workspace/hitboxes/{hitboxId}
POST   /api/v1/workspace/hitboxes/{hitboxId}/task

GET    /api/v1/tasks/my-tasks
GET    /api/v1/tasks/series/{seriesId}
PATCH  /api/v1/tasks/{taskId}/assign?assistantId=...
PATCH  /api/v1/tasks/{taskId}/status?newStatus=...
PATCH  /api/v1/tasks/{taskId}/submit?imageUrl=...

GET    /api/v1/resources
POST   /api/v1/resources/upload
DELETE /api/v1/resources/{id}

GET    /api/v1/votes/series/{seriesId}/summary
POST   /api/v1/votes/series/{seriesId}?isApproved=true|false
```

## Role-separated review routes

```text
Mangaka          /assistant-review  Review assistant task submissions
Tantou Editor    /tantou-review     Review assigned series chapters/pages
Editorial Board  /board-review      Vote approve/reject using board_vote
Admin            /admin-review      Final approval/rejection and optional Tantou assignment
```

The legacy `/review` route redirects to the correct role-specific review route.

## Troubleshooting

If login works but pages return `403`, check the logged-in user's role in the database.

If uploads succeed but images do not preview, inspect the backend response and confirm it returns one of these URL fields:

```text
fileUrl
file_url
imageUrl
image_url
url
secure_url
```

If the browser blocks requests, update backend CORS to include the frontend URL.
