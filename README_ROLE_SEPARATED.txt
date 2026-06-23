ROLE-SEPARATED STATIC FRONTEND PATCH

This version separates the workspaces by role. Users no longer need to use one shared dashboard menu to switch roles.

Login redirects:
- Mangaka -> dashboard.html
- Assistant -> assistant-dashboard.html
- Tantou Editor -> tantou-dashboard.html
- Editorial Board -> board-dashboard.html
- Admin -> admin-dashboard.html

Role menus:
- Mangaka pages show only Mangaka Workspace menu.
- Assistant pages show only Assistant Workspace menu.
- Tantou pages show only Tantou Editor menu.
- Editorial Board pages show only Editorial Board menu.
- Admin pages show only Admin Workspace menu.

How to use:
1. Copy the src folder into your SWP_FRONTEND project and replace the old src folder.
2. Copy package.json and vite.config.js into the project root.
3. Run:
   npm install
   npm run dev
4. Open:
   http://localhost:5173/
