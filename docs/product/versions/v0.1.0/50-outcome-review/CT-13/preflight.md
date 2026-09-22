# CT-13 Public Release Audit

Status: `NOT_READY`; accountable review required

## Scope

P-T22 is a deterministic audit of the public v0.1 source candidate. The supported product surface is one automatic local owner, one implicit workspace/team, one loopback Node 24 process, one embedded SQLite file, and local backup/transfer tooling. Docker, PostgreSQL servers, OIDC, remote access, collaboration administration, paid services, and Linear task authority are outside v0.1.

The audit verifies:

- a revision-bound source digest and exact review-request contract;
- the CT-3 license, public-identity, and clean-room decision state;
- root and workspace license declarations, dependency metadata, and notices;
- private-path controls, high-confidence secret indicators, and symlinks;
- exact asset and public-copy inventory coverage;
- contribution and private vulnerability-reporting policies;
- pinned one-process SQLite build inputs;
- independently accepted clean-host P-T21 evidence; and
- accountable CT-13 acceptance of the exact current review request.

## Commands

```sh
npm run test:release-audit
npm run prepare:release-provenance
node scripts/prepare-release-review.mjs
npm run audit:release -- --write docs/product/versions/v0.1.0/50-outcome-review/CT-13/result.json
```

`prepare-release-review.mjs` requires a clean Git worktree, writes only `ops/release/review-request.json`, and never creates approval. The final audit intentionally exits nonzero until every mandatory row passes; it still writes the complete JSON report when `--write` is used.

## Interpretation

`PASS` means current evidence proves that row. `FAIL` means a required technical artifact is absent, stale, malformed, incomplete, or contradicted. `BLOCKED` means a protected decision or accountable acceptance has not been supplied.

The generated request binds the source digest and exact CT-3, CT-12, policy, license, package, lockfile, dependency, build, notice, asset, and copy hashes. The request and human acceptance are excluded from the digest to prevent a circular hash, but remain in the source walk and private-artifact scan. Any candidate or evidence change makes the request stale; any request change makes acceptance stale.

## Current Gate

The current post-contract audit remains `NOT_READY` at 7 PASS, 0 FAIL, and 7 BLOCKED. `result.json` records the exact audited source revision, file count, source-set digest, and request hashes. P-T21 has a passing implementation-owned rehearsal for exact product revision `5a33d28`, but a distinct independent qualification has not accepted that revision. The remaining rows are:

- qualified CT-3 public-identity and clean-room disposition;
- removal or qualified acceptance of the working BasicLinear final-product identity;
- accountable third-party-notice review;
- accountable asset-provenance review;
- accountable public-copy review;
- independent clean-host P-T21 qualification for exact product revision `5a33d28`; and
- accountable CT-13 acceptance.

CT-12 residual P-T18 coverage, a fresh third-party P-T19 accessibility-engine run, fresh exact-revision P-T20 pixels/performance plus an authorized live two-direction System verification, and distinct application reviews for CT-117 through CT-124 remain separate dependencies even though they are not collapsed into the P-T21 row. No public release, tag, push, announcement, comparative claim, or O-005 validation is authorized.

## Current Refresh: 2026-08-23

The exact current product/testing candidate is `5a33d28be383b7651a4b0d6156534aa12cc423fa`; CT-12, CT-82, and CT-117 through CT-124 now read back `Done` in the local v0.8 store. P-T21 is independently passed for this exact revision.

After regenerating the provenance and review requests, P-T22 remains `NOT_READY` at 8 PASS / 0 FAIL / 6 BLOCKED. The blocked rows are qualified CT-3 identity/clean-room review, working-name removal or qualified acceptance, accountable third-party notices, accountable asset provenance, accountable public-copy provenance, and accountable CT-13 acceptance. No release, publication, tag, push, announcement, comparative claim, or outcome is authorized.
