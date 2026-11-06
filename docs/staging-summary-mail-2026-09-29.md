# Meeting summary pilot — 2026-09-29

Approved by David: staging emails go only to davidsdreams55@gmail.com. The client's actual clearinghouse email is displayed alongside but never used as a recipient or CC/BCC. Sender remains david@davit-fin.co.il, verified through separate business-account OAuth with gmail.send, using the existing registered callback. Calendar/Tasks personal tokens are untouched.

Implemented: dedicated staging summary endpoint reads the saved summary and verifies revision/content; ignores all caller recipient inputs. Persistent intent and content key prevent concurrent/duplicate sends. Ambiguous outcomes stop retries pending operator investigation. A confirmed Gmail response is not a delivery/read receipt. CRM UI marks sent only after confirmed response; old demo flags are not treated as mail receipts. No automatic mail on save.

Clearinghouse email comes only from E-MAIL directly under identity-validated YeshutLakoach. Employer/provider emails excluded. Candidate addresses retained with source report. Re-upload enriches old matching reports without adding duplicate products/history; raw source files are not stored, so old imports need re-upload. Conflicting addresses are shown, not guessed.

Meeting date defaults from the sole scheduled recommendations meeting. An explicitly saved date wins; multiple meetings require a date choice instead of guessing.

Tests use real local SQL with mocked Google, and isolated Chromium checks identity-matched customer email extraction excluding employer email. Live sending remains unverified until the owner grants business-mail permission and clicks send. Enable Gmail API in the networth-crm Google Cloud project if required. Sandbox only; no production deployment.
