Fixed all role-separated static frontend screens.

Install:
1. Stop Vite.
2. Replace your project src folder with this src folder.
3. Replace root package.json and vite.config.js with these files.
4. Run npm install && npm run dev.

Role entry points:
- index.html login
- dashboard.html Mangaka
- assistant-dashboard.html Assistant
- tantou-dashboard.html Tantou Editor
- board-dashboard.html Editorial Board
- admin-dashboard.html Admin

Tantou flow:
tantou-dashboard.html -> tantou-review.html -> tantou-feedback.html -> tantou-revision.html -> tantou-report.html -> board-submissions.html

Board flow:
board-dashboard.html -> board-submissions.html -> board-voting.html -> board-result.html
