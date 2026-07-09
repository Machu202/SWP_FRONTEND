Patch: Canvas Workspace initial page image load fix

Fixed:
- Opening Canvas Workspace directly from Series / Chapters & Pages no longer gets stuck at "Loading page image...".
- Page image is not hidden while waiting for the load event.
- Cached images are detected and marked as loaded automatically.
- Canvas image URL now falls back to the selected backend page image after pages finish loading.
- Route query values for seriesId/chapterId/pageId are synced into the Canvas Workspace state.

Changed files:
- src/pages/CanvasWorkspacePage.jsx
- src/styles.css
