90-percent frontend completion patch

Based on latest frontend fixes and adds:
- Login redirect remains /dashboard.
- Notification bell now loads unread notifications and marks them read.
- Canvas Workspace includes page version list, preview, image replacement, and restore UI.
- Schedule page now has a calendar-style grouped view with deadline warning colors.
- Existing canvas loading-text fix, role routing, delete modal, Google/OTP frontend flow, and hitbox fixes remain included.

Build check:
- npm install
- node node_modules/vite/bin/vite.js build
- Passed.

Changed files:
- src/api/client.js
- src/components/Layout.jsx
- src/pages/CanvasWorkspacePage.jsx
- src/pages/SchedulePage.jsx
- src/styles.css
