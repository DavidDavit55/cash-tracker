# Claim document scanner — 2026-09-30

User authorization: implement document scanning, staging only; no redesign, no real claim submission. External AI consent was not specific, so processing is browser-local with same-origin hosted Tesseract language/core files. No medical document is transmitted for recognition.

Agreed workflow: company > user-selected annex > coverage > one service provider > invoices. A different provider means a separate claim workflow. Do not infer the applicable annex from the currently marketed policy.

This increment adds a scanner under product management / operational tasks. It reads PDF (up to 12 pages, 15 MB) and PNG/JPEG, proposes text candidates, and requires explicit page selection and confirmation of invoice data, client and provider. Rotated 180-degree OCR is attempted on low confidence pages. Handwriting, other orientations and ambiguous layouts still need manual review. One invoice per selected page is supported; multiple invoices on the same page require separate files. No automatic medical-summary matching, coverage verification, reimbursement calculation or autonomous grouping is claimed.

On confirmation, only reviewed invoice metadata is added to an open CRM operational task. Raw extracted medical text and original file are not persisted. Content hash/page or same-provider invoice number detects duplicate submissions in that client. This is not a submitted insurer claim and does not create an insurer claim number. Existing CRM save-status and conflict handling remain authoritative.

Tests: synthetic local OCR and absence of external OCR traffic passed; real scanned receipt locally processed, manually reviewed synthetic fields saved in an isolated component test; five-page PDF passed, with all pages initially unselected and unverified; final staging build passed. No client data changed in testing.

Staging release requested: 279d7a27-7cd7-41b4-9e2c-f7a0d865be20. Expected bundle: StagingCrm-WYX-8UjX.js. Railway repeatedly reports INITIALIZING and no associated build yet; publication is NOT verified. Existing live bundle remains StagingCrm-Bplq-9yb.js. Resume with deployment status, then `node staging/batch-release-check.mjs StagingCrm-WYX-8UjX.js` and `node staging/claim-scan-live-check.mjs`. Production untouched.

Dependencies installed: tesseract.js, pdfjs-dist and locally hosted Hebrew/English traineddata. npm reported six dependency advisories (one moderate, five high); no broad audit fix performed. This feature is not a security approval for production medical-data processing.
