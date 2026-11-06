# Gmail triage correction — 2026-09-27

User requested fixing irrelevant retail/marketing mail appearing in the client inbox.

- Backend `7602c5a2-fb7b-47f3-878a-5a18772d2dd6`: SUCCESS.
- Frontend `b0236094-447a-4aa3-b2d3-5bb720d98a2f`: SUCCESS.
- Previous releases: backend `a8efb5e8-9019-4258-b11e-bab47cb78cfd`, frontend `2b407241-bb17-4501-b542-0e24b56de622`.
- Staging `.release/20260927-gmail-filter` copied from the previous Gmail release; delta only service, route, additive SQL column, AdminMail UI. Secrets and account connections unchanged.

Default work view excludes suspected marketing. Hidden messages remain accessible and can be restored. Existing imported headers are filtered without another Google import. Unknown mail stays in review; service keywords override marketing heuristics. Suggestions exclude own addresses and admin row; subject national-ID matches require manual confirmation. No automatic customer link and no policy matching.

Five isolated test groups passed, including legacy headers, Carrefour promotion, operational employer mail, own-address exclusion, subject ID zero-padding, 65 hidden messages with correct filtered pagination, unauthorized override rejection and manual restore. Browser mock test passed restore flow, manual linking, no errors and no mobile overflow. Production-configured build passed (existing bundle warning).

No real messages were inspected, deleted or modified in Gmail for testing. Live public smoke test checks health, unauthorized message access and deployed UI; authenticated production classification still needs owner verification. Classification uses headers only and may be wrong; UI exposes hidden/all views and manual recovery. Override is stored per message but has no separate revision audit yet.
