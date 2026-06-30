# Assistant Reference Image Fix

## Problem

When Mangaka assigned a task to Assistant, the Assistant task detail did not show the manga page image.

## Frontend fix

Updated:

- `src/pages/assistant/assistant.js`
- `src/assets/css/style-workspace.css`
- `src/style-workspace.css`

Assistant now looks for the reference image in:

- `task.referenceImageUrl`
- `task.pageImageUrl`
- `task.imageUrl`
- `task.hitbox.page.imageUrl`
- `task.hitbox.pageImageUrl`

If backend provides `pageId`, it also tries:

- `GET /api/v1/workspace/pages/{pageId}/canvas-init`

and uses `canvas.imageUrl`.

## Backend requirement

The backend must return `referenceImageUrl` or `pageId` in the task response.
Use the included backend patch if the image still does not appear.
