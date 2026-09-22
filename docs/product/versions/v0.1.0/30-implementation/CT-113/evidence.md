# CT-113 Restart Recovery Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_REVIEW_PENDING`. The automatic local-owner session now renews before protected active reads after a loopback process restart, and the cached page recovers without reload. A distinct application review is pending.

## Verification

| Check | Result |
| --- | --- |
| Focused regression | 3 files / 14 tests passed |
| Complete regression | 71 files / 469 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,950 modules / 109 dist files / 1,915,948 bytes; no warning |
| Release-audit regression | 10 / 10 passed |
| Connected process-restart cycles | 2 / 2 recovered without reload |
| Cached outage state | 1 alert; 5 / 5 Workflow statuses retained |
| Post-recovery client routes | 5 / 5 entity-ID sets matched; 0 alerts; 0 overflow |
| Database preservation | Exact file and canonical-state SHA-256 match |
| Recovery banner semantics | Progress, success, and failure component tests passed; live success status not sampled |
| Independent application review | PENDING |

## Source Bindings

| Path at `670a9f9` | SHA-256 |
| --- | --- |
| `apps/web/src/App.tsx` | `a9dcfd81d530a56aaca8946becf59a0019552c8127e6ef185c7d1f12a805df33` |
| `apps/web/src/components.tsx` | `0a294b5b7905c44ca4eb11fae2e83b62c744cb91edc7d62133fd734f83dd9b4c` |
| `apps/web/src/local-service-recovery.ts` | `ec2b4572e4a923ae71f1f9584192fd5bd9cc5a51adb9854bd5574d8b921f8f27` |
| `apps/web/tests/local-service-recovery.test.ts` | `5e1fe39aa523809cff2fb4a87f6a4bcd71b0305514ea56da4a2483d3955fc1d9` |
| `apps/web/tests/local-service-session-recovery.test.ts` | `11ea383ee0ca25a3687762edd9ffaca6223e765d0c46d4a3a5bdea10a4a19922` |

The private raw process evidence is `.control-tower/evidence/CT-113/process-restart-670a9f9-raw.json`, 17,477 bytes, SHA-256 `5141db9b8983bdb21b5d45642ab1755312b7d2a7a7c604655bbed684e7425e26`.

This evidence establishes bounded implementation output only. It does not provide independent review, current CT-12 acceptance, fresh P-T21 qualification, or release authority.
