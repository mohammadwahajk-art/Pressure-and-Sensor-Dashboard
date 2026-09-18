# Pressure Sensor Dashboard — Vercel shared-data version

This project keeps the existing dashboard design and Excel parser, but changes persistence from browser-only IndexedDB to a shared Vercel Blob dataset.

## Result

- Upload an Excel file from one authorized browser.
- The workbook is split into ~3 MB chunks so every request stays below the Vercel Function request-body limit.
- Chunks are stored in a **Private Vercel Blob** store.
- A small `latest-manifest.json` points to the newest workbook.
- Every browser loads the newest workbook when the dashboard opens.
- Open dashboards check for a newer version every 60 seconds and refresh the dashboard data automatically.
- Local IndexedDB remains as a fallback if cloud data is temporarily unavailable.

## Vercel setup

1. Deploy/import this entire folder as one Vercel project. GitHub import is the easiest way for a project with API files.
2. In the project, open **Storage** -> **Create Database** -> **Blob**.
3. Create a **Private** Blob store and connect it to this project.
4. In **Project Settings -> Environment Variables**, add:
   - `DASHBOARD_UPLOAD_KEY` = choose a strong password/key that only authorized uploaders know.
5. Redeploy after the Blob store/environment variable is connected if Vercel requests it.
6. Open the production URL and click **Upload / Update Excel**.
7. Enter the `DASHBOARD_UPLOAD_KEY` when prompted.

## Security

- The Blob read/write credential stays on Vercel server functions and is never placed in `index.html`.
- Only someone with `DASHBOARD_UPLOAD_KEY` can replace the shared dataset.
- Dashboard viewers do not need the upload key to view the latest dashboard data.

## Files

- `index.html` — your dashboard with cloud sync added.
- `api/upload-part.js` — stores one small Excel chunk.
- `api/complete-upload.js` — publishes the new workbook manifest and cleans the previous chunks.
- `api/latest.js` — reassembles/streams the current workbook to browsers.
- `api/status.js` — lightweight update check used every 60 seconds.
