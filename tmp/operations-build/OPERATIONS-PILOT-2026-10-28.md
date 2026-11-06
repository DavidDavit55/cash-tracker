# Personal operations pilot — 2026-10-28

## Scope and authority

David approved building a one-hour first version around three workflows: production, claim, change. This checkpoint is local implementation, not staging or production verification. No real customers were changed, no WhatsApp/Google/email writes were made and no external delivery worker was enabled.

Production: new → sent → reject and resend OR produced → single verification checklist → prior-policy cancellation / transfer when relevant → customer updated → done. Claim/change: new → sent → rejection and resend OR verified handled → customer updated → done.

## Current implementation

- `/operations` inside the existing authenticated app; existing office client storage and revisions. No parallel customer table or automatic historical migration.
- A stable internal `simple:<process-id>` task per process; date/time updates mutate the same task. Closed/stopped processes close that task.
- Existing product link is accepted by the server, but product selection and recruitment-to-new-model integration are not yet implemented in the UI. Existing recruitment workflows remain unchanged.
- Explicit initial new draft can be created via `פתח הפקה ל[exact full client name]`, `פתח תביעה ל...`, `פתח שינוי ל...`. Missing company/product/mode must be completed before sent. Customer selection must be unambiguous. Existing same-kind open process is returned instead of creating a second via bot; intentional additional processes can be created via dashboard.
- Bot `סיכום` reads open processes. `#short-process-id נשלח`, `עדיין ממתין`, `הופק` use the same transition service. Claim/change send/wait requires appended YYYY-MM-DD date. Result verification and closing remain explicit dashboard actions. Free-text / forwarded-message extraction is NOT implemented.
- `/api/operations/whatsapp/inbound`: disabled by default; requires Twilio signature, exact AccountSid/To and owner From allowlist, stable MessageSid retry handling. No outbound worker.
- `operations_reminders.plan`: local durable outbox only. Daily summary at/after 19:00 Asia/Jerusalem; no morning summary. Timed reminders require explicitly chosen date/time. Date-only Tasks are not claimed as device alarms. No worker/sending/scheduling is enabled.

## Browser and test evidence

Local browser URL: http://127.0.0.1:4198/operations
Preview runner uses a dedicated `operations-demo.sqlite` under this chat's `tmp/operations-build`, binds 127.0.0.1 only, checks Host/POST Origin, disables WhatsApp and starts no workers. It does not use the real DB. Demo data only.

Browser: production replacement passed new/send/wait/reject/resend/produced/partial-checklist-block/full-checklist/cancellation/updated/done; reload kept completed status. Claim passed new/send/verified-result/updated/done. Change opened from bot text, details completed, sent/reject/resend/verified-result/updated/done. Provider send not tested.

Automated: 59 tests passed across new process/bot/API/reminder tests plus office lifecycle, treatment, health join and recruitment draft regression. Date/time tests use isolated clocks, not days of elapsed live delivery. Frontend TypeScript/Vite build passed. Existing large chunk and dependency-deprecation warnings remain.

## Verified external configuration (read-only)

Twilio WhatsApp sender +972533041312 is Online, quality High. Incoming-message webhook and status callback fields were empty; no Messaging Service configured. No sender settings modified. User confirmed owner/recipient +972532556099. Expected Google account david@davit-fin.co.il; actual permissions/sync for these new processes are not verified or activated.

## Remaining before live use

1. Approve and deploy protected staging; do not enable auth bypass or use demo preview runner as deployed app.
2. Configure server secrets securely (never commit tokens), owner allowlist and public webhook URL; verify signed live dummy messages before enabling Twilio endpoint. Do not overwrite another service's webhook without checking current state.
3. Build outbound delivery adapter, provider delivery-status handling and scheduler. Resolve ambiguous provider send outcomes before retrying. Review approved WhatsApp template requirements for proactive reminders/19:00 summary.
4. Connect Google Tasks/Calendar to the approved account with separate permissions, stable external IDs, safe retries and closure; test with clearly named dummy items only. Existing legacy health-join Tasks code does not synchronize this new model.
5. Integrate recruitment/product entry points, preserve existing data; add reviewed message interpretation and email only after basic pilot works.

Initial changed-file backups: `backups/operations-code-20261028-170502`; subsequent local updates also backed up. This folder is not a Git repository. Do not reset, delete databases or replace existing customer data.
