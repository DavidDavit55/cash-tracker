# Collective insurance and client notification

- The supplied February Har Bituach export parses as two car policies and one collective health policy with four coverage rows and a reported monthly premium of zero. The health policy was already present in the production admin view; this was not a parser omission.
- Preserve all explicit group classifications, not only HMO group policies. Display קולקטיב in the client card, insurance detail, legacy protection view and admin imported-data list.
- Refresh the authenticated client's financial snapshot when returning to the tab. Remount the client view only when financial data changes.
- Import can suppress WhatsApp notifications for corrective reimports (existing default remains enabled).
- New Twilio template: HX47f28cd76339cbb3192aef836540ba1b, client_new_recommendations_link_20260918. Same second-message text, followed by the client application link https://networth.davit-fin.co.il/.
- TWILIO_CONTENT_SID_RECOMMENDATIONS_WITH_LINK selects the new candidate. On notification, verify Meta approval before using it; pending/rejected/unavailable approval retains the previously configured template. No test messages were sent.
- Frontend deployment: 369ce2c4-22f9-4c70-81aa-3c77f4807b05.
- Backend deployment: b1afc914-067e-4bf9-9001-9652a255f72e.
- Validation: 29 frontend regression tests; successful production build; lint on changed JS/JSX; mocked Twilio test for pending, rejected, approved and unavailable approval.
