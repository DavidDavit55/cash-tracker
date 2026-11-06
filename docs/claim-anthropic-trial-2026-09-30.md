# Anthropic receipt trial

User authorized only receipt pages 2 and 5, excluding medical visit summaries. The staging API key was retrieved into process memory and not logged or stored. Two direct Messages API calls used claude-sonnet-4-5-20250929; no Files API uploads. Only already rendered receipt images were sent. No CRM writes, emails, or insurer submissions.

First pass (upside down): incorrect invoice, amounts and provider; failed acceptance. Second pass (180-degree rotation in memory): invoice numbers 3590 and 3959 recognized; second amount 500 recognized; first amount and both dates unresolved; provider transcription unreliable. API usage: 6458 input and 317 output tokens total. No raw response or patient document persisted by test script.

Decision: do not connect to automatic CRM extraction yet. API authentication works, but accuracy gate failed. Need better receipt crop/resolution and field-level benchmarks before rollout. Existing local scanner is unchanged. No staging deployment made for this trial.

Follow-up authorized crop trial: rotated only the same receipt images, cropped manually inspected receipt bounds and resized to 1560px height in memory. One additional call (3217 input / 171 output tokens). Both invoice numbers and totals now match the inspected reference: 3590 / 600 ILS and 3959 / 500 ILS. First date missing; second returned 7.02.26, requiring source verification (not accepted as correct). Provider transcription remains unreliable. Model uncertainty flags failed to flag all questionable fields. This manual crop trial is not a general automatic cropping implementation. Keep dates and providers under explicit human review; no CRM integration or deployment performed.
