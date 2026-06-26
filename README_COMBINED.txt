# Combined Frontend Patch

This package combines your current `SWP_FRONTEND` screens with the role-separated screens.

## Main change

The login now supports separate routing for:

- Mangaka → `dashboard.html`
- Assistant → `assistant-dashboard.html`
- Tantou Editor → `tantou-dashboard.html`
- Editorial Board → `board-dashboard.html`
- Admin → `admin-dashboard.html`

There are also direct role login pages:

- `mangaka-login.html`
- `assistant-login.html`
- `tantou-login.html`
- `board-login.html`
- `admin-login.html`

## Install

1. Copy the `src` folder into your project root and replace the old `src`.
2. Copy `package.json` and `vite.config.js` into your project root.
3. Run:

```powershell
npm install
npm run dev
```

4. Open:

```text
http://localhost:5173/
```

## Demo accounts

- Mangaka: `mangaka_oda` / `123456`
- Assistant: `assistant_huy` / `123456`
- Tantou Editor: `tantou_linh` / `123456`
- Editorial Board: `board_sora` / `123456`
- Admin: `admin_vip` / `123456`
