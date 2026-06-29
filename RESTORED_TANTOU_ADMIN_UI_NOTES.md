# Restored Tantou / Editorial Board / Admin UI

The previous Mangaka + Assistant RAR integration accidentally used a package base that had the older Tantou/Admin layout and older `src/style-workspace.css`.

This fix restores the newer UI reskin for:
- Tantou Editor
- Editorial Board
- Admin

while keeping the newly integrated Mangaka and Assistant screens from `frontend.rar`.

## Restored files
- `src/style-workspace.css`
- Tantou screens: `tantou-dashboard`, `tantou-review`, `tantou-feedback`, `tantou-revision`, `tantou-report`
- Editorial Board screens: `board-dashboard`, `editorial-board`, `board-submissions`, `board-voting`, `board-result`
- Admin screens: `admin-dashboard`, `admin-users`, `admin-settings`, `admin-calendar`, `admin-deadlines`, `admin-final-approval`

## Not changed
- Mangaka RAR screens in `src/pages/mangaka/`
- Assistant RAR screens in `src/pages/assistant/`
- Login page
- Backend files
