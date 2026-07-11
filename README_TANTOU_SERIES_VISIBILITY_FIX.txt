Patch: Tantou assigned/approved series visibility fix

Problem:
- Tantou "Approved Series" page showed 0 series even when Mangaka-approved work existed.
- The frontend was filtering by manga_series.status and hiding DRAFT.
- In this backend/database flow, manga_series.status can stay DRAFT while chapters/pages are already ready for Tantou review.
- Therefore the frontend incorrectly hid valid Tantou work.

Fixed:
- Tantou Series page now allows DRAFT series unless ARCHIVED/CANCELLED.
- Tantou Review page now loads chapters from assigned series even if the series itself is DRAFT.
- Tantou sidebar label changed from "Approved Series" to "Assigned Series" to avoid the wrong meaning.
- Status dropdown now includes DRAFT for Tantou.
- Backend was not changed.

Changed files:
- src/pages/SeriesPage.jsx
- src/pages/TantouReviewPage.jsx
- src/components/Layout.jsx
