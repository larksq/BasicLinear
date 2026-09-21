# CT-142 Nonsecurity Testing Evidence

Status before independent acceptance: awaiting review. Overall ceiling: yellow.

The provider-free integrated journey passed from owner bootstrap through invitation, assignment, comment, monthly paid activation, and Free fallback. The selected positive-path suites passed 19 files and 46 tests; all 11 workspace typechecks and the production build passed. Desktop and mobile hosted-entry observations showed the required Google-only entry, exact 30-day/$2/$12 copy, local/hosted authority separation, named controls, and no horizontal overflow.

This evidence is deliberately narrower than P-T210. It does not qualify R-204's integrated tenant-security validation or R-219, does not replace the omitted security matrix, and does not establish full regression or integrated release acceptance. The security check is a required skip under the structured sponsor exception in `sponsor-security-skip.json`.

Evidence references:

- `implementation-inputs.json`
- `automated-receipt.json`
- `manual-observation.json`
- `sponsor-security-skip.json`
- `packages/hosted/tests/ct142-nonsecurity-journey.test.ts`
- `scripts/tests/ct142-nonsecurity-gates.mjs`
