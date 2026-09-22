# CT-109 Release-Audit Reconciliation Session

- Issue: `CT-109`, stable ID `eafa6bf7-86dd-411b-8670-9ce6315bfdce`, completed at revision `2`; request-reference metadata was normalized at revision `3`.
- Session: `CT109-RECONCILE-20260822T103237Z`.
- Actor: `codex-release-engineering`.
- Authority: project-local Control Tower v0.8; provider projection disabled and `not_synced`; no Linear API, MCP, UI, external account, or remote operation.

## Finding

The first clean P-T22 rerun after CT-105 through CT-108 returned 7 PASS / 3 FAIL / 4 BLOCKED. Media renames made asset-provenance paths stale, three product files had new copy hashes, CT-12 used a descriptive P-T21 token outside the audit contract, and both generated review requests were stale.

## Resolution

1. Restored the canonical P-T21 `passed` token while retaining exact qualification identity in CT-12 and CT-82 evidence.
2. Deterministically regenerated asset and copy provenance. Every entry remains pending accountable review.
3. Regenerated the qualified CT-3 request and accountable CT-13 request only. No acceptance file or reviewer metadata was created.
4. Reran P-T22 and its 10-test regression suite.

## Boundary

CT-109 repairs technical metadata only. It does not clear BasicLinear, approve BasicLinear, accept AGPL compatibility, approve any asset/copy/notice right, authorize release, or claim an outcome.
