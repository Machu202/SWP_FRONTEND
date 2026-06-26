COMBINED FROM FE-CORE2 PATCH

This patch uses the uploaded FE-core2 frontend as the base for Mangaka and Assistant.

Important:
- Old unprefixed Mangaka/Assistant pages are NOT kept.
- Uploaded FE-core2 pages are renamed into mangaka-* pages.
- Assistant pages use the same uploaded visual style and workspace classes.
- Tantou Editor, Editorial Board, and Admin are included as separate role workspaces.

Login routes:
- Mangaka -> mangaka-dashboard.html
- Assistant -> assistant-dashboard.html
- Tantou Editor -> tantou-dashboard.html
- Editorial Board -> board-dashboard.html
- Admin -> admin-dashboard.html

Install:
1. Stop Vite with Ctrl + C.
2. Delete old src:
   Remove-Item -Recurse -Force .\src
3. Copy this patch's src folder into your SWP_FRONTEND project.
4. Replace package.json and vite.config.js with the included ones.
5. Run:
   npm install
   npm run dev
6. Open:
   http://localhost:5173/
