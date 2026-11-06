# Gmail body ID suggestions — 2026-09-27

## Scope

- Read-only manual MIME text scanning on import, plus a per-mailbox button to scan previously imported messages (25 per click).
- Checksum-valid ID extraction from subject/plain text/HTML. Repeated IDs are deduplicated; explicitly labeled shorter IDs are zero-padded.
- Exact client matches remain proposals requiring manual confirmation. Multiple IDs, multiple possible clients or partial scans route to review. Previously confirmed links are preserved.
- Body text is transient and never stored; extracted IDs and scan status are encrypted in the existing message envelope. API responses expose only scan status/count and client proposals, not extracted IDs.
- No attachment fetching/scanning, background sync, email writes, AI calls, task creation or automatic assignment.

## Verification

- `node backend/gmail.test.mjs`: six tests passed using isolated PGlite and fake Google responses. Includes full-format requests, text/HTML extraction, attachment exclusion, checksum validation, deduplication, multi-ID review, limits, encryption, no body/ID disclosure in response, backfill preserving link/override/cursor, auth and mailbox isolation.
- Frontend production build passed with explicit admin/API settings; existing large-chunk warning remains.
- Isolated browser test passed: manual backfill button, scan result, manual link, hide/restore, no runtime errors or mobile horizontal overflow.
- No real inbox contents read and no scan started during deployment verification.

## Release

- Source staging: `.release/20260927-gmail-body`, based on the previous filter release. Exactly four changed production files: Gmail SQL, service, routes and AdminMail page. No secret/config changes or unrelated workspace edits shipped.
- Backend deployment: `0a338e66-382c-4786-867d-e7b8ee0a5a8d`.
- Frontend deployment: `b17b2a0e-2f2f-4395-8bef-c1427740cdf7`.
- Both deployments confirmed SUCCESS. Public smoke checks passed: health 200, protected Gmail routes 401, missing authorization ticket 400, missing callback state redirects to fixed failure page. Live frontend asset `/assets/index-BpdUDrB3.js` contains the body-scan UI and correct API origin.
- Previous backend/frontend deployments: `7602c5a2-fb7b-47f3-878a-5a18772d2dd6` / `b0236094-447a-4aa3-b2d3-5bb720d98a2f`. Additive scan-version column can remain if reverting application code.

## Limits

- No claim that body matching proves identity; checksum-valid numbers may be unrelated identifiers. Confirmation is always manual.
- Images/PDFs/attachments and external MIME body parts requiring separate download are not scanned. Unsupported charset, decoding failures or exceeded limits are reported as partial.
- Header-only records remain pending until explicitly scanned; 404 messages are marked unavailable and retained. No silent assumption that unscanned/no-text messages contain no IDs.
- Real PostgreSQL concurrency and actual Google mail variants were not exercised by the isolated tests. OAuth Testing seven-day grant limitations remain unchanged.
