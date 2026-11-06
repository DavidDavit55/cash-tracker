# CRM local server sandbox — 2026-09-28

## Start

From the repository: `powershell -File .local-preview/start-crm-sandbox.ps1`.
Node 24 with built-in `node:sqlite` is required (tested 24.14.1; Node emits an experimental SQLite warning).
Open http://127.0.0.1:5209/crm-sandbox. The old browser-only demo on 5208 is not migrated or deleted.

## Data and boundaries

- SQLite: `%LOCALAPPDATA%\NETWORTH\crm-sandbox\crm.sqlite` (outside OneDrive/repository). WAL and FULL synchronous commits enabled.
- This first stage stores the existing CRM state as versioned JSON snapshots in SQLite. It is not yet the normalized PostgreSQL CRM, separate document storage, or an authenticated hosted service.
- Latest ten revisions retained for technical recovery; these are not independent disaster-recovery backups. UI JSON download remains available. Copying a SQLite backup requires stopping the server and preserving its WAL sidecars, or using a SQLite-aware backup.
- Same WorkflowDemo UI uses a server persistence adapter. Successful writes display their revision in the top bar. Pending/failed writes lock further edits and retain the in-memory draft; download/retry available. Stale revisions return 409 and cannot overwrite newer data. Reload after conflict explicitly discards the pending draft after confirmation.
- HTTP bound to 127.0.0.1 only. Host, Origin, custom header and per-process token checked; no CORS permission. This is same-machine isolation, not per-user authentication. Do not expose this Vite service on a network or public tunnel.
- `/api/` remains blocked. No production environment/database credentials are loaded by the local store. No SMS 2010, email or WhatsApp sending. Public fund catalogue remains read-only.
- Local storage data remains untouched. Import is explicit JSON-backup selection into an empty server database; no automatic merging between origins. Browser-only fixed pension walkthrough is not used as a server workflow.
- Embedded files currently remain in the snapshot with a 32 MiB total limit. Larger document storage and production-grade upload validation remain subsequent work.

## Verification

`node .local-preview/local-crm-store-check.mjs`: persistence/reopen, revision conflict, validation, Host/Origin/token and method rejection.
Browser: created synthetic lead, confirmed revision 2, stopped/restarted server, reloaded and observed lead and its next-action task. `/crm-sandbox` 200, production `/api/health` 403; JSX modules compiled.
No production writes, deployments, outbound messages or customer migration performed.
