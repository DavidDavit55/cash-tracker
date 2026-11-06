# NETWORTH private staging

Separate Railway project and `staging` environment. No production variables, database copies, DNS changes or GitHub auto-deploy. Owner key protects the entire site; synthetic admin/client accounts have separate identities. Production entrypoint does not import this server.

Required: APP_ENV=staging, RAILWAY_ENVIRONMENT_NAME=staging, private DATABASE_URL, unique JWT_SECRET and STAGING_ACCESS_KEY (32+ characters), ADMIN_EMAIL=staging-admin@example.invalid.

Build frontend with VITE_APP_ENV=staging, VITE_API_URL=/api and matching VITE_ADMIN_EMAIL. Deploy only the allowlisted release artifact. Never upload .env files, downloads, local storage, browser profiles, backups, source customer reports or upload directories.

CRM persistence is an admin-owned versioned JSON snapshot in separate Postgres, not yet a normalized integration with registered-client records. Existing admin, client portal and budget routes reuse the app against that same staging database. No automatic CRM-to-registered-client merge. SMS2010 remains external; emails, WhatsApp, verification and public registration are blocked. Only public fund catalogue queries are allowed.

Do not use real customer data until data retention, backups, private documents, normalized CRM linking and authorization tests are complete. Imported files embedded in the CRM snapshot persist in Postgres; filesystem uploads are not yet a durable document store.

Production promotion is a separate reviewed release, never an environment or database swap. Do not deploy the staging login or entrypoint into production.

Provisioned resource IDs, access instructions and verified checks: `../docs/staging-2026-09-29.md`. Deploy from the allowlisted `.staging-release` directory with `railway up . --path-as-root --no-gitignore` and explicit staging project/environment/service IDs. Never use `--no-gitignore` against the workspace root.
