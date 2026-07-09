Patch: Important breaking bug fixes from review video

Included fixes:
- Login landing route stays on /dashboard through roleHome().
- Dashboard loading is now protected with safe API fallbacks/timeouts so it does not stay stuck forever if one role-specific API fails or hangs.
- Tantou / editorial dashboards no longer use DRAFT series as the review queue fallback.
- Tantou Series page hides DRAFT series by default and opens Tantou Review instead of Mangaka chapter upload/create UI.
- Direct /series/:id route now redirects by role, so non-Mangaka roles do not land inside the Mangaka workflow.
- Chapters & Pages is read-only for non-Mangaka roles; create chapter/upload/delete controls remain Mangaka-only.
- Duplicate route header is removed for pages that already have their own static HTML-style header.
- Clipped Delete button layout is improved.
- Accidental blue text selection is reduced on dashboard/static UI labels.

Main changed files:
- src/App.jsx
- src/components/Layout.jsx
- src/pages/DashboardPage.jsx
- src/pages/SeriesPage.jsx
- src/pages/ChaptersPagesPage.jsx
- src/pages/TantouReviewPage.jsx
- src/styles.css
- src/api/client.js included in changed-files patch to preserve dashboard login redirect.
