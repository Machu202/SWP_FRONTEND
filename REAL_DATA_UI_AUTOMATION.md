# Real-data React UI automation

This test drives the actual React application in Chrome, Edge, or Chromium and calls the real Spring backend, Supabase database, and Cloudinary upload service. It does not mock `fetch` or replace backend responses.

## What it automates

1. Logs in as the real Mangaka, Assistant, Tantou Editor, Editorial Board, and Admin accounts.
2. Creates a uniquely named manga series through the React wizard.
3. Creates a chapter and uploads a real PNG to Cloudinary.
4. Draws a hitbox with browser pointer events.
5. Creates a task and assigns the real Assistant account.
6. Logs in as Assistant, moves the task to Doing, uploads work, and submits it.
7. Logs in as Mangaka and approves the submission.
8. Logs in as Tantou and creates feedback on the persisted hitbox.
9. Logs in as Mangaka and resolves the feedback.
10. Sends the series to review, casts a Board approval vote, and performs the Admin decision.
11. Reads the final database state and checks every observed JSON response for `passwordHash` or BCrypt values.

## Run the complete approval flow

Open PowerShell in `SWP_FRONTEND` and run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\tests\run-real-e2e.ps1 -FinalDecision approve
```

The test starts the packaged backend JAR automatically when it is not already running. It also starts Vite on port 5173. Cloudflare Tunnel is not needed because the browser, frontend, and backend run on the same computer.

Approval mode intentionally leaves one series named `UI_E2E_<timestamp>` in the database with status `APPROVED`, because the backend correctly prevents deleting an approved series.

## Run a repeatable cleanup flow

```powershell
.\tests\run-real-e2e.ps1 -FinalDecision reject
```

Reject mode follows the same browser workflow but performs an Admin rejection and then attempts to remove the temporary hitbox, page, chapter, and draft series through the real API.

## Watch the browser

```powershell
.\tests\run-real-e2e.ps1 -FinalDecision approve -Headed
```

## Direct npm commands

```powershell
npm run e2e:real
npm run e2e:real:cleanup
npm run e2e:real:headed
```

## Output

Each run creates:

```text
e2e-results/<timestamp>/
  report.json
  report.csv
  state.json
  trace.zip
  screenshots/
```

Open a Playwright trace with an installed Playwright CLI, or keep the ZIP as diagnostic evidence. Screenshots are automatically captured after each major successful stage and at the exact point of failure.

## Configuration

The included `.env.e2e.local` contains the temporary staging accounts supplied for this test. Delete it after the accounts are removed, and never publish it to a public repository. `.gitignore` excludes it.

Set `E2E_BROWSER_PATH` only when Chrome/Edge cannot be found automatically.
