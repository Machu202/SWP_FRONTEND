# MANGAPROJ Frontend Merge Notes

## Request

Merge the frontend from `MANGAPROJ(1).rar` into `SWP_FRONTEND(9).zip`, but only replace the Mangaka and Assistant parts. Do not touch Admin, Tantou Editor, or Editorial Board.

## Done

Copied only the Mangaka/Assistant whitelist from the RAR frontend:

- `src/pages/mangaka/**`
- `src/pages/assistant/**`
- root Mangaka aliases such as `src/mangaka-*.html`
- root Assistant aliases such as `src/assistant-*.html`
- root Mangaka/Assistant shortcut pages such as `dashboard.html`, `series.html`, `manuscripts.html`, `review.html`, `resource-library.html`, and `task-detail.html`

## Protected

The following role areas were intentionally not overwritten:

- Admin screens
- Tantou Editor screens
- Editorial Board screens
- `src/role-integration.js`
- `src/style-workspace.css`
- `src/assets/css/style-workspace.css`
- `src/profile.html`
- `src/assets/js/profile.js`

## Verification

Protected files changed: `[]`

If this list is empty, Admin/Tantou/Board remained untouched by the merge.

## Note

The RAR Mangaka/Assistant page files were already the same as the uploaded frontend zip, so this merge preserves the newer dashboard/API fixes already present in `SWP_FRONTEND(9).zip` instead of reverting them with older RAR helper code.
