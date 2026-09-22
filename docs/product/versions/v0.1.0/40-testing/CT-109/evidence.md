# CT-109 Evidence

| Check | Before | After |
| --- | ---: | ---: |
| P-T22 PASS | 7 | 8 |
| P-T22 FAIL | 3 | 0 |
| P-T22 BLOCKED | 4 | 6 |
| Asset records | stale | 97 technically complete, all pending review |
| Copy records | 3 stale | 46 technically complete, all pending review |
| P-T21 row | BLOCKED | PASS |
| Qualified CT-3 request | stale | valid; acceptance absent |
| Accountable CT-13 request | stale | valid; acceptance absent |
| Release-audit regression | not rerun | 10 / 10 passed |

Private raw audit records are `.control-tower/evidence/CT-109/audit-after-provenance.json` and `.control-tower/evidence/CT-109/audit-final.json`. The authoritative current audit is `docs/product/versions/v0.1.0/50-outcome-review/CT-13/result.json`.

Exact current qualified and accountable request hashes are authoritative in `CT-3/qualified-review-request.json`, `ops/release/review-request.json`, the CT-13 audit result, and project-local task readback. This evidence record intentionally avoids embedding those mutable request hashes into the source set they bind.

The six remaining BLOCKED rows are the intended protected decisions: qualified public identity, working-name disposition, accountable third-party notices, accountable asset provenance, accountable copy provenance, and accountable CT-13 release acceptance.
