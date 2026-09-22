# CT-13 Accountable Review Contract Session

## Scope

- Control Tower issue: `CT-13`, stable ID `7ac28514-97fb-43e3-aabc-7c12c01129f7`, `Todo`, milestone `S5 - Outcome Review`; exact revision is read from the project-local task store.
- Actor/session: `codex-release-review-contract` / `CT13-REVIEW-CONTRACT-20260822T055325Z`.
- Test: P-T22 against the supported one-owner, one-process SQLite candidate.
- Authority: project-local Control Tower v0.8 only. Provider projection is disabled and no Linear API, MCP, UI, or task authority was used.

## Change

The former final-review check accepted any JSON with `status: accepted` and a non-empty reviewer string while describing that decision as hash-bound. This session replaces that permissive check with two explicit artifacts:

- `ops/release/review-request.json` is generated from a clean candidate and binds the candidate source digest plus the exact decision, testing, policy, license, package, lockfile, dependency, build, notice, asset, and copy evidence.
- `ops/release/review-acceptance.json` can only be authored by the accountable reviewer. It must identify the reviewer, role, qualification, UTC review time, jurisdictions, exact request hash, and complete required scope set.

The generator never creates acceptance. Missing acceptance remains `BLOCKED`; a missing, stale, malformed, anonymous, partially scoped, or hash-mismatched request or acceptance is `FAIL`. The focused regression covers accepted, pending, underspecified, and stale states.

## Current Evidence

The exact product revision is `5a33d28be383b7651a4b0d6156534aa12cc423fa` with tree `d106d3bb40a84184e7ee26c919134b01e4748679`. Its implementation-owned CT-82 P-T21 rehearsal passes the strict 21-check contract, but independent qualification for that exact revision remains pending. The technical release audit has no machine-detectable failure once the generated requests match the sealed candidate. Asset, copy, and notice inventories are technically complete but remain pending accountable approval.

CT-3 remains open because AGPL-3.0-only and BasicLinear record the maintainer's choices but do not clear the requested BasicLinear final-product name or the qualified clean-room boundary. CT-12 remains open on residual P-T18 coverage, a fresh third-party P-T19 accessibility-engine run, fresh exact-revision P-T20 pixels/performance, the authorized live two-direction P-T20 System check, distinct CT-117 through CT-124 application reviews, and fresh independent P-T21 qualification. CT-13 acceptance does not override those dependencies.

Exact final source, manifest, request, test, build, and audit hashes are recorded in `ops/release/review-request.json` and `result.json` after the contract candidate is sealed.

## Decision Boundary

This session implements validation controls only. It does not approve a license, identity, trade dress, screenshot, reference method, asset, copy, dependency notice, contribution policy, release, or outcome. No reviewer identity or decision was inferred.

## 2026-08-23 Evidence Refresh

- CT-13 task remains `Todo`; exact revision is read from the project-local task store.
- Exact audited revision, file count, source digest, and request hashes are recorded in `result.json` and the two generated request files, avoiding circular self-binding in this session record.
- Public-release audit: `NOT_READY`, 7 PASS / 0 FAIL / 7 BLOCKED.
- Qualified CT-3 request: valid; acceptance absent.
- CT-13 request: valid; acceptance absent.
- CT-12: residual P-T18, fresh third-party P-T19, fresh exact-revision P-T20 pixels/performance, authorized live two-direction P-T20 System verification, distinct CT-117 through CT-124 review, and fresh independent P-T21 qualification remain open.

## Current Candidate Refresh

- Current audit identity: the exact revision, file count, and source-set SHA-256 are recorded only in generated `result.json` so this source document does not create a self-staling duplicate.
- Provenance: 256 asset records and 50 public-copy records are technically complete, hash-bound, and pending accountable review; all 252 dependency records remain classified.
- Review requests: CT-3 qualified request and CT-13 accountable request are valid for the audited candidate; both acceptance records are absent.
- Audit boundary: seven protected rows remain blocked, with zero failed rows. No reviewer identity, acceptance, release, publication, identity clearance, or outcome was created or inferred.

No release, publication, identity clearance, or outcome is claimed by this refresh.

## 2026-08-23 Final Technical Refresh

- CT-12 Testing, CT-82 P-T21, and CT-117 through CT-124 now read back `Done` in local Control Tower. P-T21 is bound to the independent exact-5a33d28 receipt.
- The qualified CT-3 request and accountable CT-13 request were regenerated after the current evidence refresh; both are valid requests and both acceptance artifacts remain absent.
- P-T22 is `NOT_READY` at 8 PASS / 0 FAIL / 6 BLOCKED. The remaining blockers are identity/clean-room qualification, working-name clearance, accountable notices, asset provenance, public-copy provenance, and accountable release acceptance.
- This session records technical readiness only. It does not create reviewer identity, legal/brand clearance, provenance approval, release acceptance, publication, or outcome validation.
