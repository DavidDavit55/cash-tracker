# Budget PDF export - staging only

Scope: the budget import area now includes an inclusive date range and income/expense/all selection, producing a printable A4 PDF with totals, checkboxes and handwritten notes space. Both budget workspace entry buttons are labelled `ייבוא וייצוא נתונים`.

Data access uses the existing authenticated, owner-scoped monthly budget overview. All required months are collected before PDF creation; an error never generates a partial report. Separate bank movements are not added again to the income/expense ledger. No data mutations or external PDF services are used. PDFs are rasterized for reliable Hebrew printing, not searchable text PDFs.

Changed source:
- frontend/src/components/BudgetImport.jsx
- frontend/src/components/BudgetExport.jsx
- frontend/src/lib/budgetExport.js
- frontend/src/pages/BudgetWorkspace.jsx
- frontend/src/pages/PreviewBudgetWorkspace.jsx
- frontend/budget-export.test.mjs

Verification: local assertions cover date validation, cross-year months, inclusive boundaries, type filtering, duplicate IDs, refunds, totals, empty ranges and request failures. A 48-row Hebrew/English PDF was rendered and inspected over four A4 pages, including pagination. Frontend staging builds passed. Browser check confirmed the export form beneath import and the no-transactions message for the empty October staging budget.

Pre-release private backup: .staging-private/backups/2026-10-12T15-51-17-744Z, CRM revision 935, 16 source files. Previous staging package is preserved at .release/staging-tasks-fix-20261012. No production deployment authorized or performed. Backend and staging server were copied unchanged from that verified package.

Final candidate: .release/staging-budget-export-ui-20261012
Deployment: 030d3f2d-1a95-4885-a137-716435f71c7c. Authenticated release check passed against StagingCrm-C5qpx5h8.js; CRM revision remained 935 and private gateway/client-forbidden/file access checks passed. Browser verified the final renamed button and export panel in the admin budget. October staging budget has no transactions; populated PDF output was tested locally with fixtures, not by adding test transactions to staging.
