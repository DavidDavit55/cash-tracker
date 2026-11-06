# NETWORTH production release — 2026-09-18

Deployed directly from isolated `.release/20260918` source staging via Railway CLI. No Git push was performed. Working-tree changes are preserved.

## Active releases
- Frontend project NETWORTH, service ecaa359d-ebbc-499b-a4ce-7fe676970e23: c15da545-c93c-4850-baaa-8c520c44cd0e (SUCCESS).
- Backend project MONEY, service cef79ba4-7f7b-497a-8df9-7d3609a63e15: 25f67f49-9630-42ca-a836-4065b19560cb (Docker build and healthcheck passed).
- Public URL: https://networth.davit-fin.co.il
- Admin URL: https://networth.davit-fin.co.il/admin/clients

## Scope
The new client portal loads the authenticated user's production financial data and profile. No local client-preview files or SMS bypass are used. Published agent reviews are separate from drafts. Admin publication requires the current data_version; financial uploads invalidate earlier reviews. The existing production registration and OTP endpoints remain in use; the local sandbox registration service was not deployed.

Public assets use an explicit release allowlist. Demonstration HTML, customer ZIP/XLSX files, `.env`, logs and `.sandbox-state` are absent from the release upload. Source-file hashes are in the staging manifest.

## Verification
- 25 existing sandbox tests passed.
- New production route test passed: unauthenticated rejection, non-admin rejection, invalid input, draft isolation, publication, upload invalidation, stale-version rejection. Database and notifications were not exercised against live client records.
- Targeted frontend lint and production build passed (large JS bundle warning remains).
- Local visual check used synthetic data; savings expansion and pending-review state worked.
- Live frontend displays the new login logo and green branding and redirects anonymous root requests to /login.
- Live API /health returned 200; unauthenticated financial-data, admin clients and review-publication endpoints returned 401.
- Full production login and signed-in end-to-end flow were not tested: an owner-provided SMS code is required.
- Backend initially used Nixpacks and failed to launch Chromium. Corrected to the existing Dockerfile runtime with npm ci; latest deployment starts successfully and generates the WhatsApp QR as the preceding version did. No messages were sent by deployment verification.

## Rollback references
- Previous frontend deployment: 409a4a6c-5ca1-482f-bd5f-798712bfbdb1.
- Previous backend deployment: b19120d8-d5a6-4bf8-8a8a-8b52fe49b4a6.
- Additive schema columns: review JSONB, review_draft JSONB, data_version UUID. Leave these in place if rolling application code back.

Before a future Git-based deployment, ensure the new tracked and untracked release source is included; Railway's Git source still points to the prior repository commit.
