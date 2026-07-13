Patch: Real image persistence/display fix

Main cause:
- Frontend could display cover_image_url/image_url/file_url only if backend returned them.
- Current backend series response did not include coverImageUrl at all, so series cards fell back to initials even after uploading covers.
- This frontend patch sends both camelCase and snake_case cover URL aliases after cover upload.

Changed frontend files:
- src/api/client.js
- src/pages/SeriesPage.jsx

Backend companion patch is required for series covers because the old backend ignored coverImageUrl in MangaSeriesCreateRequest.
