Patch: Mangaka assistant review hitbox + metadata fix

Problem:
- Mangaka Review / Assistant Submissions displayed submitted/reference images but did not show the Mangaka-created hitbox.
- It also showed Chapter/Page/Assistant as blank or Unassigned because the screen did not normalize backend task metadata.
- Hitbox sometimes appeared only after repeated refresh because this review screen did not fetch/backfill the hitbox list when the task payload was incomplete.

Fixed:
- Assistant submissions are normalized with series/chapter/page/assistant metadata.
- If task payload has no embedded hitbox, the screen fetches workspace hitboxes by pageId and matches hitboxId.
- Reference image now renders the hitbox overlay.
- Chapter/Page/Assistant display now reads camelCase, snake_case, nested assistant/page/chapter fields.
- Backend was not changed.

Changed file:
- src/pages/MangakaAssistantReviewPage.jsx
