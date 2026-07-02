# Mangaka Schedule Admin-Port Fix

## Request

Remove the old standalone Mangaka publishing schedule screen and replace it with the Admin-style schedule/deadline UI ported to Mangaka.

## Fixed

`src/schedule.html` is no longer the standalone "Mangaka-owned Publishing Schedule" page.

It now uses the Mangaka workspace shell and contains two Admin-style panels:

- Publishing Calendar
- Deadline Monitor

## Data rules

The page loads only Mangaka-owned series using:

`GET /manga-series/my-series`

If that endpoint is unavailable, it falls back to `/manga-series` filtered by the current user ID.

## Actions

Mangaka can:

- select one of their own series
- create/delete publishing schedules
- create/delete deadline warnings

Backend endpoints used:

- `GET /schedules/series/{seriesId}`
- `POST /schedules`
- `DELETE /schedules/{id}`
- `GET /deadlines/series/{seriesId}`
- `POST /deadlines/series/{seriesId}`
- `DELETE /deadlines/{id}`

If backend create fails during frontend testing, the item is saved locally so the UI still works.

## Protected

Admin schedule/deadline pages were not changed.

## Changed files

- `src/schedule.html`
- `src/assets/js/schedule.js`
- `src/style-workspace.css`
- `src/assets/css/style-workspace.css`
