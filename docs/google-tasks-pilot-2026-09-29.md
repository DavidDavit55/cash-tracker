# Google Tasks staging pilot — 2026-09-29

Approved: operational CRM work is mirrored as Google Tasks, never Calendar events, in a dedicated `NETWORTH — תפעול` list for the existing personal test account. Calendar connection is preserved; Tasks has separate encrypted credentials and explicit OAuth purpose/scope.

Implemented: server projects operational work from the canonical homeTasks model, persists remote mappings and creation intents, serializes per owner, recovers lost create responses by marker, and avoids altering unrelated tasks. Completion is authoritative in CRM. A Google checkbox does not complete protected business steps and reopens on the next sync while CRM work remains open. This is a one-way pilot, NOT the eventual bidirectional requirement.

Sync runs while the CRM is open, on load and after successful save, with manual retry. No background worker or guaranteed closed-browser synchronization. Dates are day-only (Tasks API limitation); tasks defaulting to today's date follow the CRM home model. Only titles, client names and generic CRM links are sent; no documents, account numbers or detailed notes.

Activation: enable Google Tasks API in the OAuth Google Cloud project, approve Tasks access with the personal test account using the compact Tasks button, create the dedicated list, then sync. Display Tasks in Google Calendar. Do not claim live authorization or list creation before this succeeds.

Local tests: mocked Google + real PGlite SQL cover OAuth isolation, list/task idempotence, completion, protected CRM state, foreign task preservation, ambiguous creation recovery and modified-marker rejection. Existing calendar tests also pass. Live Google Tasks writes await owner consent.

Reference: https://developers.google.com/workspace/tasks/reference/rest/v1/tasks
