# Payroll mail pilot — 2026-09-29

David authorized connecting payroll mail to real sending in staging, retaining the fixed test recipient davidsdreams55@gmail.com. Intended payroll address is metadata only; no CC/BCC or delivery to it. Sender uses the existing verified business Gmail connection.

The payroll step sends annex and cubes attachments (two required files, each <=700KB, PDF/PNG/JPEG/TXT; synthetic documents remain explicitly marked). Client and decision are resolved in the owner's saved CRM state; stale revision, wrong stage, missing files and unsupported files are rejected. Real send date is server-generated, not user-entered. Only confirmed Gmail acceptance advances the browser workflow to deposit monitoring. Failed/ambiguous sending leaves the step open. Persisted intent/content identity prevents a retry of the same mail from sending twice.

New outgoing summary and payroll messages retain exact submitted MIME for EML download, shared through the Mails and Documents views. Read/download endpoints are owner/admin scoped behind staging access. Older messages have no retained MIME and are not falsely reconstructed. Gmail acceptance is not a delivery or read receipt. No inbound company-mail integration or SMS2010 sending is implied.

Validated locally with synthetic payloads, mock Gmail and real SQL: fixed recipient, two MIME attachments, identity in body/last four in payroll subject, missing attachments, invalid decision, stale summary, duplicate prevention, ambiguous send protection and stored EML. Real payroll delivery requires the user's click; no real payroll mail sent by tests.
