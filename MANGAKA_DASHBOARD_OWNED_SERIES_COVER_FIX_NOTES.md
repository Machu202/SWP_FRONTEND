# Mangaka Dashboard Owned Series + Cover Fix

## Fixed

- Mangaka Dashboard now only shows series owned by the logged-in Mangaka.
- The full/all series catalog remains visible in the `Series` tab.
- Chapters/Canvas selectors on the Mangaka dashboard also use the owned list, so Mangaka does not work on another Mangaka's series.
- Cover rendering is more robust and reads cover URLs from many backend field names/objects.

## Real cover data

The backend now stores and returns series cover fields so a cover uploaded by one user can appear for other users too:

- `coverImageUrl`
- `coverUrl`
- `imageUrl`
- `thumbnailUrl`

The backend response also includes Mangaka owner identifiers so the frontend can filter correctly:

- `mangakaId`
- `mangakaUsername`
- `mangakaEmail`
- `mangakaName`

## Changed frontend files

- `src/assets/js/mangaka-dashboard-flow.js`
- `src/assets/js/mangaka.js`
- `src/assets/css/style-workspace.css`
- `src/style-workspace.css`
