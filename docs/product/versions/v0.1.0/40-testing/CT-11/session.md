# CT-11 Independent Test Session

## Scope

- Control Tower issue: `CT-11`, stable ID `e041caff-6446-4324-8d43-06fe99421058`, starting revision `1`, status `Todo`, milestone `S4 Testing`.
- Completed dependencies: `CT-6`, `CT-8`, and `CT-9`, all status `Done` at revision `3`.
- Planning package: `d161247c9c523e004a14d6e31ebcf9d12aab9764015b312383e13a0bb851f834`.
- Requirements: `R-001`, `R-002`, `R-005`, `R-008`, `R-009`, `R-101`, `R-102`, `R-106`.
- Planned tests: `P-T16`, `P-T17`.
- Outcomes protected as pending guardrails: `O-001`, `O-004`.

## Independence

Test actor `codex-testing-ct11` and session `CT11-TEST-20260819T213417Z` operate from a fresh adversarial fixture and do not reuse implementation assertions as acceptance. The fixture provisions synthetic accounts and workspaces, invokes the public HTTP boundary, exercises the restricted application database role directly, and uses an isolated disposable database. Implementation handoffs and their tests are inputs for coverage analysis only.

No sub-agent, Linear API, Linear MCP, or Linear UI is used. The project-local Control Tower v0.8 store is the sole issue and milestone authority; provider projection remains disabled. Private reference screenshots and real Google or Linear credentials are excluded from fixtures, logs, exports, and evidence.

## Required surfaces

1. `authorization`: two-workspace direct-ID, list, search, filter, saved-view, activity, outbox, relation, comment, project, milestone, and export checks.
2. `concurrency`: overlapping revision writes and concurrent idempotent creates with database-side cardinality assertions.
3. `rich-text-security`: hostile link schemes, unsupported structure, plain-text HTML payloads, safe external-link attributes, and rendering behavior.
4. `session-security`: setup/login/logout/password rotation, revoked cookies, origin checks, and credential-table privilege boundaries.
5. `platform-security`: API and web CSP, restricted role enforcement, failure response shape, structured logs, and secret/redaction probes.
6. `regression`: complete unit, integration, typecheck, build, runtime readiness, and authenticated browser smoke coverage.

## Failure policy

A confirmed defect receives a project-local Control Tower defect or blocker before any production mutation. The fix is performed through an implementation return loop, followed by focused and affected regression reruns. CT-11 cannot pass with an unresolved disclosure, privilege bypass, XSS vector, secret leak, stale-writer overwrite, duplicate retry effect, required skip, or uncovered acceptance reference.

## Environment boundary

The current Docker Desktop host can build and export images but has previously deadlocked newly created container starts. When necessary, exact image filesystems are reconstructed under an isolated path inside the already-running internal-network API container and executed as the image owner against uniquely named disposable PostgreSQL databases. This workaround may prove the CT-11 code artifact; it does not satisfy CT-12's clean-host Compose rehearsal.

## Finding and return history

1. `CT-16` recorded the missing workspace event endpoint before event-feed code changed. The returned implementation added scoped SSE, cursor resume, minimal revision hints, client invalidation, and proxy streaming policy.
2. `CT-17` recorded stale conflict revision readback before concurrency code changed. The returned implementation serializes revision checks at the entity row and covers seven entity types.
3. `CT-18` recorded the missing immutable `.env.example` fixture before the Dockerfile changed. The rebuilt test image executes its complete foundation suite without copying secret environment files.

All three issues now read back Done at revision 3. Focused reruns and the complete immutable regression pass.

## Final acceptance

- `npm run typecheck`: 8 workspaces passed.
- `npm test`: 5 files / 20 tests passed.
- `npm run test:integration`: 6 files / 16 tests passed.
- `npm run build`: passed; largest JavaScript chunk 481.43 kB.
- Immutable image `b073182b066e` passed the same typecheck, unit, and integration gates.
- The live authenticated Chrome board received and restored a synthetic issue title through the SSE invalidation path; browser warning/error logs were empty.

CT-11 is accepted without skips or blockers. O-001 and O-004 remain pending; CT-12 retains integrated accessibility, fidelity, performance, and recovery acceptance.
