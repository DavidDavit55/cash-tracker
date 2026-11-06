# Gmail two-mailbox pilot release — 2026-09-27

User authorized continuing the existing Gmail integration and deployment. Both accounts remain unconnected until the owner completes Google consent.

## Deployment

- Backend MONEY/cash-tracker backend: `a8efb5e8-9019-4258-b11e-bab47cb78cfd`, SUCCESS.
- Frontend NETWORTH: `2b407241-bb17-4501-b542-0e24b56de622`, SUCCESS.
- Prior backend: `f0c5e3fe-ecdd-43be-abad-82ea0d15059b`.
- Prior frontend: `c965b042-727d-417e-a572-99b6f21a2ec0`.
- Isolated staging `.release/20260927-gmail` copied from the previous release, with only the Gmail source delta. No Git push, credential JSON, local scripts, environment files or customer snapshots uploaded.
- Credentials and a new persistent 32-byte encryption key were stored directly as Railway server variables through stdin, without logging values. No existing key was overwritten. Keep this key for future deployments and establish a separate secure recovery backup.
- Additive `gmail_v2_*` tables; existing customer tables and prototype Gmail tables are not rewritten or deleted.

## Verification

- Four isolated test groups passed, including two-account authorization, wrong-account rejection, replay prevention, same message ID in two mailboxes, distinct manual customer links, and disconnect isolation. Google was mocked; PostgreSQL advisory locks were stubbed in PGlite.
- Browser check with fake API data passed: manual link, no page errors, no mobile overflow.
- Production-configured frontend build passed; existing large bundle warning remains.
- Live health 200; unauthenticated status/messages 401; invalid launch 400; missing callback state redirects to fixed frontend failure page.
- Live frontend bundle contains the two-mailbox UI and correct backend URL.
- No production inbox messages were read or sent. No production JWT was generated. Owner consent and signed-in end-to-end verification remain outstanding.

## Owner next step

Open https://networth.davit-fin.co.il/admin/mail while logged in as the business admin. Authorize `david@davit-fin.co.il` first, then `daviddavit55@gmail.com`. Each has its own button and grant. Import runs only when explicitly clicked, reads header metadata for 30 days, and does not read bodies/attachments or create tasks.

Google is currently External/Testing: grants expire after seven days. This is a pilot, not unattended permanent synchronization. Review production publishing and applicable verification before long-term operation.
