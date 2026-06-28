API SCRIPT ADDED PATCH

I added src/api.js and inserted this line into every HTML file in src:

<script src="api.js"></script>

It is placed before script.js or script-workspace.js so apiFetch() is available before page scripts run.

API base URL:
const API_BASE_URL = "http://localhost:8080/api/v1";

Install:
1. Delete your old src folder.
2. Copy this patch's src folder into your project.
3. Replace package.json and vite.config.js if needed.
4. Run npm install and npm run dev.
