# Registration hotfix

Production logs showed `value too long for type character varying(50)` at profile/signature submission. The risk-tolerance questionnaire includes complete answer labels longer than 50 characters. Schema now widens the five questionnaire response columns to TEXT without modifying existing answers.

Login/registration phone, ID and OTP controls use string inputs with numeric keyboards and validation patterns. Typing, pasted separators, Arabic/Persian digits and leading zeroes are handled. OTP autofill is enabled. Restored registration progress normalizes numeric fields at initial state creation.

The two login lookups compare normalized stored and supplied phone numbers. OTP verification remains mandatory. Ambiguous normalized phone matches are rejected rather than choosing an account. No notification was sent in tests.

Checks: two regression tests for numeric inputs and actual questionnaire labels; backend authentication regression with mocked Twilio confirms invalid OTP rejection and ambiguous-account rejection; targeted frontend lint clean; production build passed with pre-existing large-bundle warning.

Backend deployment: 36280e1e-652f-4710-b516-fb1157e11b40.
Frontend deployment: 68dfdd29-fb17-4723-a934-8f5d26fc4658.
Rollback baseline: backend 25f67f49-9630-42ca-a836-4065b19560cb; frontend c15da545-c93c-4850-baaa-8c520c44cd0e. Keep widened TEXT columns if rolling code back.
