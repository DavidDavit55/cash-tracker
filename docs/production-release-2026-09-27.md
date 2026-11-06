# NETWORTH budget release — 2026-09-27

Explicitly authorized by David to deploy the current local work.

- Frontend Railway deployment: `c965b042-727d-417e-a572-99b6f21a2ec0` (SUCCESS).
- Backend Railway deployment: `f0c5e3fe-ecdd-43be-abad-82ea0d15059b` (SUCCESS).
- Previous frontend: `068e8426-37a6-49d1-8cf6-72e261ef430f`.
- Previous backend: `52cc7e7c-c0d7-4926-8cbc-c6482fe708dc`.
- Production URL: https://networth.davit-fin.co.il/budget
- Staged explicit source/branding allowlist: `.release/20260927`. No environment files, customer snapshots, local HTML entrypoints or scratch scripts deployed.

## Data preservation

Private backups: `.release/20260927-private/live-before.json`, `local.json`, `pre-sync.json`, `sync-result.json`.
Transactional merge into David's existing admin account; category IDs mapped by name and original backup used for conflict checks. No deletions and no changes to other accounts.
Added 26 expenses, 5 incomes, 8 budgets, 26 bank source records and 5 import-history records. Final totals: 392 expenses, 60 incomes, 28 budgets. Existing merchant mappings and categories retained.

## Verification

- Five budget/import integration tests passed, including supplied bank/card files, duplicate protection, isolation and undo.
- Production frontend build passed locally (native config loader).
- Both Railway deployments report SUCCESS; backend `/api/health` reports ok.
- Live `/budget` serves new budget bundle, points to production API, contains no local preview API address.
- Receipt scanning API key is configured on production; no paid OCR test performed.
- Signed-in API verification not completed: local JWT configuration did not authenticate; automatic approval review rejected using the production signing secret to create a test session. No attempt was made to bypass the rejection.

The MONEY frontend was not redeployed. It shares the backend, which received additive budget routes/schema.
