Patch: Remove leftover Canvas loading text

Fixed:
- Removed the visible "Loading page image..." text overlay from Canvas Workspace.
- If the image is already visible/cached, frontend now marks it as loaded more reliably.
- Drawing hitboxes no longer depends on the stale loading text state.
- Keeps the earlier dashboard/role/breaking fixes intact.

Changed files:
- src/pages/CanvasWorkspacePage.jsx
- src/styles.css
