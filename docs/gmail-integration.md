# Gmail read-only integration — implementation and activation

## Implemented

- Admin-only `/admin/mail`, plus a client-card link to manually linked mail.
- Default work view hides suspected marketing. Separate relevant/review/hidden/all views, with per-message hide/restore overrides. No Gmail writes or removals. Classification is recalculated for old imported metadata as well as new imports, before pagination.
- Own mailbox addresses and the admin user are excluded from client suggestions. Checksum-valid Israeli IDs in subject and body (including zero-padding explicitly labeled IDs), and external customer email matches, create suggestions only. Multiple distinct IDs across subject/body or multiple matching clients require review even when only one ID matches a client. Existing manual links are retained. No automatic linking or policy-number matching is implemented.
- Customer matches, existing manual links, and service keywords take priority over marketing signals. Unknown messages remain in review. Bulk headers and Gmail promotions labels are collected on subsequent manual imports; older messages still use subject/sender heuristics. Hidden mail remains recoverable; header-only classification is not guaranteed accurate.
- Explicit business/private mailbox allowlist, OAuth state bound to the selected mailbox (one-use, 10-minute expiry), browser-bound HttpOnly cookie, PKCE, offline refresh grant.
- Separate credentials, import cursor and disconnect for each mailbox. Unified message list includes source mailbox. Message identity, encryption context and link audit include mailbox; identical Google IDs across accounts do not collide.
- AES-256-GCM encryption for refresh tokens, OAuth verifiers, and imported subject/address headers. Associated data binds ciphertext to owner/message.
- Explicit manual import: one batch of up to 25 messages from a fixed 30-day snapshot per click. Continue until `has_more` is false; completed timestamp is set only after the final batch. Subsequent full scans reconcile the recent window without duplicate messages or losing manual links.
- Manual imports request full MIME content and scan text/plain and text/html transiently, without executing HTML or fetching resources. Raw body/snippet is never stored. Only extracted IDs and scan status are retained inside encrypted metadata; browser responses contain status/count, not extracted IDs. Attachments, named files and forwarded message/rfc822 attachments are not scanned. MIME traversal is bounded (100 parts, depth 15, 1 MB text); missing external body data, unsupported charset, decoding errors or limits produce partial status and manual review.
- A separate manual button scans up to 25 previously imported header-only records per mailbox, without changing the normal import cursor, existing manual links or hide overrides. Missing Google messages are marked unavailable; old records remain. No background sync, AI analysis, sending, Tasks or Calendar writes.
- Email-address suggestions are not identity proof. User explicitly selects and confirms a customer. Relinks and unlinking retain an audit row. No process registry exists yet, so process linking is not implemented.
- Disconnect deletes the stored credentials and pending starts, retaining imported records. Google account permission revocation is separate and stated in the UI.

## Activation

1. Keep `GMAIL_ENABLED=false` until server configuration is complete. Never place keys in frontend variables or commit credential JSON.
2. Configure `GMAIL_CREDENTIALS_FILE` to an external server-side JSON file, or set `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` using server secrets. The local Downloads file is not available to a deployed server.
3. Generate `GMAIL_ENCRYPTION_KEY` as 32 cryptographically random bytes encoded in base64. Store in a secret manager, separately from encrypted DB backups. Preserve it on restarts; rotating requires explicit re-encryption.
4. Configure `GMAIL_ALLOWED_EMAILS=david@davit-fin.co.il,daviddavit55@gmail.com`, `ADMIN_EMAIL`, and frontend `VITE_ADMIN_EMAIL`. Both the JWT and current DB user must match the admin. Authorizing the private mailbox does not make that address an application admin.
5. `GMAIL_REDIRECT_URI` must end in `/api/admin/gmail/callback`. Use the actual backend HTTPS origin in production, not the temporary localhost check on port 43821. Register this exact URI in Google. Set `GMAIL_FRONTEND_URL` to the exact frontend origin, also permitted in `FRONTEND_URL` CORS configuration.
6. Cross-site frontend/backend domains use a two-minute, one-use encrypted launch ticket. The authenticated start returns a backend URL; top-level navigation sets the HttpOnly SameSite=Lax browser-binding cookie before redirecting to Google. No third-party cookie or credentialed XHR is required. Production requires HTTPS.
7. Server startup applies additive `gmail_v2_*` tables from `gmail.sql`. No existing customer tables are altered. These are separate from the unshipped single-mailbox prototype tables; any prototype data remains untouched and is not imported. Reauthorization is required.
8. Enable the feature, log in as the admin, and authorize the persistent grant in Google. The prior temporary local test retained no refresh token and cannot be reused.
9. Inspect the account identity in the UI before explicitly importing headers. Test a batch and a manual customer link before enabling broader ingestion.

## Limits and operational checks

- No claim that all historical mail was imported: only a 30-day rolling window, excluding spam/trash/drafts. Import is manual and can be partial; UI reports remaining batches and sync errors.
- Google page tokens can expire: re-connect alone does not reset a scan cursor; a controlled cursor reset may be needed after an invalid-page-token failure. No automatic retries that might hide errors.
- Mail storage retention/erasure and encrypted backup/key recovery policy require decisions before real client rollout. Message headers themselves can contain sensitive personal data.
- Google External/Testing is temporary: Gmail refresh grants expire after seven days. Do not treat this as unattended permanent synchronization. Production publishing/verification requirements must be reviewed before leaving pilot mode.
- Google credentials grant is readonly only. Additional scopes are rejected at initial authorization. Tokens never enter browser JSON, source, response error details, or application logs.
- Disable proxy access-log query strings for OAuth callback paths: authorization codes must not be recorded by upstream logging.
- DB advisory locks serialize callback persistence, synchronization and disconnect per owner. Google calls have a 20-second timeout. No production load test has been performed.
- Isolated tests use PGlite from the existing local test runtime, fake users and mocked Google responses; advisory locks are stubbed there, so real PostgreSQL concurrency needs staging validation.

Official references: https://developers.google.com/identity/protocols/oauth2/web-server and https://developers.google.com/workspace/gmail/api/auth/scopes
