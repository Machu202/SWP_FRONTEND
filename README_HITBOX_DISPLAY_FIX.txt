Patch: Show Mangaka hitbox on Assistant assignment page

What changed:
- The assistant Assignments task detail now tries to display the exact hitbox area created by Mangaka.
- If the task payload already contains hitbox coordinates, they are used directly.
- If the task only contains pageId / hitboxId, the frontend loads hitboxes for that page and matches the correct hitbox.
- The Reference image panel now overlays the hitbox visually so the assistant can see the marked task area.
- If the backend does not return hitbox information yet, the UI shows a clear fallback note instead of failing.

Changed files:
- src/pages/TasksPage.jsx
- src/styles.css
