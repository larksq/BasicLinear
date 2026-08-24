# CT-54 Recursive Route Validation Evidence

## Verdict

`IMPLEMENTED_AND_DATABASE_VERIFIED_AWAITING_BROWSER_ACCEPTANCE`. Fastify now validates JSON bodies without stripping fields, injecting defaults, or coercing union values. Query, parameter, and header coercion remains available. Focused validation, complete regression, PostgreSQL integration/recovery, typecheck, production build, and deterministic owner/guest fixture responses pass. Rendered interaction verification remains open.

## Implemented Contract

- JSON request bodies use an Ajv instance with `coerceTypes: false`, `useDefaults: false`, `removeAdditional: false`, `addUsedSchema: false`, and `allErrors: false`.
- URL-facing inputs use a separate Ajv instance with Fastify-compatible array coercion and defaults, while unknown properties are rejected instead of silently removed.
- Both compilers install the same standard format validation used by the prior Fastify compiler.
- Rich project and issue documents retain heading attributes, list children, marks, nullable values, and nested content across validation.
- Recursive issue-filter group nodes retain operator, children, condition fields, and a `null` value without conversion to an empty string.
- Unknown body fields still fail closed with the existing generic public error and bounded redacted validation logging.

## Automated Verification

| Check | Result |
|---|---|
| Focused route-validation and rich-text contracts | 2 files, 4 tests passed |
| Complete unit regression | 35 files, 213 tests passed |
| PostgreSQL integration | 7 files, 17 tests passed on PostgreSQL 16.10 |
| Migration recovery | Migrations 007, 008, 009, and 010 each require a verified backup on populated data and apply successfully with current canonical readback |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,930 modules; no chunk warning |
| Deterministic fixture host checks | 6 of 6 owner/guest shell, session, and milestone catalogue checks passed at port 4181 |
| Rendered browser captures | 0; deferred after the existing browser-policy denial |

The integration result uses current source synchronized by exact hashes into an ephemeral harness on the existing Docker-internal network. The existing PostgreSQL bootstrap migrator credential was passed only in process memory and was neither printed nor persisted. Test databases, the temporary role, and the harness were removed after the coherent 17-test pass.

## Failure And Correction Trace

1. A deliberately least-privilege migration-owner probe returned `403` during setup because a non-superuser owner of security-definer functions cannot bypass forced RLS. It did not match the supported Compose migrator contract and produced no product finding.
2. The supported migrator run returned `400 VALIDATION_ERROR` for a valid project heading. Redacted validation paths showed that `removeAdditional` deleted `attrs` and `content` while Ajv evaluated the text-node branch.
3. Disabling property stripping made the heading pass, but the new focused regression proved global coercion changed a filter value from `null` to `""`.
4. Separate body and URL-facing compilers removed both mutations without weakening additional-property checks. The original project/milestone test then passed.
5. The full integration run found stale migration counts in the recovery test. Counts were corrected for migration 010, and an explicit pre-010 backup-gated upgrade scenario was added before the coherent 17-test pass.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-003 / R-005 | Project overview and issue rich-text variants pass real Fastify body validation and PostgreSQL persistence without field loss. |
| R-008 | Recursive group/condition filters and milestone view state survive body validation unchanged and persist through the views integration path. |
| R-013 / R-107 | Canonical export/import, backup/restore, and populated migrations 007 through 010 pass with digest and backup gates. |
| R-102 / R-106 | Strict validation remains fail-closed, conflict/security integration remains green, and public errors expose no body or credential. |

## Pending Browser Matrix

Exercise rich project overview create/update and grouped issue filters through the owner and guest fixtures at accepted desktop, tablet, and mobile viewports. Prove headings, lists, marks, milestone grouping, nullable filters, save/reload, and conflict recovery remain visible and unchanged, while unknown or malformed input fails without state loss. This matrix remains required for P-T18/P-T19 and is not inferred from API integration.

## Privacy And Authority

All checks use repository source, synthetic records, and the isolated local verification stack. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence closes the prior database skip for migrations 007 through 010 and their canonical recovery paths. It does not close CT-54, complete CT-12, pass the clean-host portion of P-T21, approve CT-13, pass rendered P-T18/P-T19, select a license or public identity, authorize release, or validate O-001 through O-005.
