# Client workspace design agreement

Approved direction: preserve the local NETWORTH CRM reference at http://127.0.0.1:8765/networth-demo-browser.html?v=2. Do not replace its card-led client journey with a table-led dashboard without asking David.

- Main view: company logos, readable product cards, source versus destination. Table is secondary.
- Company identity: show the readable logo only, with the company name as image alt text. Show a visible name only when the logo is unavailable; never duplicate the name alongside a loaded logo. Applies to product and transition cards.
- Insurance appearing in both selected sources is one product, matched by company and policy number (never number alone). Display the newer dated record once, identify the second source, keep original reports intact, and never mix premiums or amounts across dates. Do not apply this matching to pension accounts.
- Show as-of dates only, not ingestion or issuance dates in the client workspace.
- Coverage expands into separate readable rows below its product, never squeezed inside a table cell. Preserve keyboard controls and visible focus.
- Display reported liens/pledges visibly and qualify by report date; do not imply present legal status.
- Avi: pension Harel to Phoenix and health Harel to Menora confirmed by David. Distinguish this statement from document-verified transfer completion. Never invent target amounts, dates or terms; avoid duplicate savings totals or assuming other policies cancelled.
- Use February Har Bituach; exclude June report. Ignore commissions pending separate review.
- No decision to hide zero-balance products was approved. Missing balance is not zero; insurance is not savings.
- Local preview is isolated; publishing or changing live client data needs approval. Do not present simulated ingestion times as real.
- Before delivery: check actual browser render, logos, coverage expansion, filtering, keyboard use and narrow layout. Report what was changed and provide the local link.

This records the decisions for this client-design work, not a claim that all CRM workflows have been implemented.

## Consolidated local review, 2026-09-27
- Interactive demo entry now uses client-workspace.jsx: compact cards and native modal side drawer, working product/transfer/follow-up/document sections, search and category/warning filters. Treatment notes/status/due date persist in this browser's localStorage only. They do not update policy status or verify transfers. Source downloads are confined to documents/history. Production integration is not implemented by this demo.
- Latest user refinement: cards only in the local client workspace; remove the detailed-table option and view switcher.
- Latest user refinement: show all products together. No source tabs, source downloads, source date selectors or dedup explanations in the main workspace. Keep each product's as-of date and retain source evidence inside product management only.
- Unified inventory is the default. Source filters mean "reported in this source", not separate inventories; each product exposes original dated snapshots without blending values.
- Management preview supports treatment status and a note in component memory only. It is explicitly disposable, not a live policy-status update or transfer completion.
- Harel 515583371 is personal accident, excluded from the health transfer. Phoenix 3034593081 is critical illness.
- Target IDs checked against the supplied Commissions CSV: Phoenix pension 3480300080 and Menora health 372874297. Display-only local mapping, not an automated CSV integration; commission amounts excluded. No receipt or coverage-start dates inferred from recruitment dates.
- Local registry and management are not yet integrated with production persistence. Additional report-date options require actual reports, not fabricated snapshots.
