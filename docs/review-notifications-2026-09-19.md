# Client-ready notifications

- Financial-data uploads never send client-ready WhatsApp messages, including requests from older clients containing `notify: true`.
- Only a successful review publication triggers a notification. Draft saves and stale-version publication failures do not.
- Recipient name and phone are loaded from the target client's database record, not the logged-in administrator or submitted request fields.
- The configured admin account is excluded from client-ready notifications. Existing new-lead admin notifications remain unchanged.
- Import results identify the updated clients; the review screen identifies the notification recipient before publication.
- Regression tests mock messaging: upload with notify=true, draft, failed publication, valid publication to another client, and admin-target publication. No real messages or reviews were submitted as tests.
- Frontend build and targeted lint passed.
- WhatsApp link template HX47f28cd76339cbb3192aef836540ba1b was verified approved.
- Backend deployment: 94b24e8b-a8dc-4483-bfa4-f37c12e74071.
- Frontend deployment: 0eef0fa7-f12b-45d5-9fff-e5cddd0de00e.
