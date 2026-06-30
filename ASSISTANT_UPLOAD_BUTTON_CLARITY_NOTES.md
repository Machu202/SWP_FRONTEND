# Assistant Upload Button Clarity Patch

This patch makes the Assistant work submission flow clearer.

## What changed

### Assignments Board
Task cards now show a clear button:

- `Open Upload`

Clicking the button opens `task-detail.html` and stores the selected task ID.

### Assistant Dashboard
Active task rows now show:

- `Open Upload`

### Task Detail
The submit area is now visually emphasized:

- Topbar button: `Submit Work`
- Large button: `Choose Finished File`
- Clear dropzone text: `Drop finished file here`
- Selected file display
- Confirmation checkbox is highlighted
- Final button text changes based on state:
  - `Choose a file first`
  - `Tick confirmation to submit`
  - `Submit to Mangaka Now`

## Backend behavior unchanged

The actual backend flow is still:

1. `POST /api/v1/resources/upload`
2. `PATCH /api/v1/tasks/{taskId}/submit?imageUrl=...`
3. Task moves to `REVIEWING`

## Changed files

- `src/pages/assistant/task-detail.html`
- `src/pages/assistant/assistant.js`
- `src/assets/js/script-workspace.js`
- `src/assets/css/style-workspace.css`
- `src/style-workspace.css`
