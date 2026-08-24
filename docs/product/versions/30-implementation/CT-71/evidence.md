# CT-71 Directed Issue Relation Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Issue detail now expresses every supported hierarchy and peer direction relative to the current issue, maps inverse choices to the existing canonical API contract, includes valid cross-team workspace candidates, serializes create/remove writes, and recovers authoritative state without discarding a rejected selection. Automated, typecheck, fixture syntax, production build, release-audit regression, and stateful HTTP contracts pass. Rendered desktop, tablet, and mobile interaction, focus, accessibility, and geometry verification remains open.

## Implemented Contract

- Hierarchy creation exposes Parent issue and Sub-issue; peer creation exposes Related to, Blocks, Blocked by, Duplicate of, and Duplicates.
- Current-relative inverse directions are translated into canonical endpoints: Blocked by reverses a `blocks` edge, Duplicates reverses a `duplicate` edge, and Parent issue reverses a `parent` edge.
- Candidate selection is workspace-scoped and active-only. Cross-team issues remain eligible while self, missing, archived, cross-workspace, and duplicate identities fail closed before submission.
- Hierarchy and peer composers keep independent controlled state. Success resets only the initiating composer; rejected selections remain available for correction or retry.
- Create and remove operations share one interaction lock. Issue archive is unavailable during a relation write, and relation controls are unavailable during an issue revision write.
- Accepted creation invalidates relation and activity projections for both endpoints. Accepted and rejected mutations re-read authoritative current-issue relations before feedback settles.
- Rejected writes do not auto-retry. Stable pending, success, and error feedback identifies the operation, and focus returns to the initiating control.
- The existing service remains authoritative for authorization, scope, archive, self-edge, duplicate-edge, idempotency, graph-cycle, activity, outbox, and revision constraints.

## Automated Verification

| Check | Result |
|---|---|
| Focused relation-command, relation-group, and capability tests | 3 files, 18 tests passed |
| Complete unit regression | 49 files, 335 tests passed; 0 failures |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Integration runner | 7 files / 17 tests discovered and skipped because no test PostgreSQL URL is configured; CT-71 changes no contract, API, repository, schema, migration, RLS, persistence, or graph path, so no new database pass is claimed |
| Production build | 1,942 modules; CSS 94,163 bytes; saved views 10,177 bytes; projects 69,710 bytes; issues 158,303 bytes; index 288,822 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; 1,025,669 total bytes; no chunk warning |
| Release-audit regression | 1 file, 2 tests passed |
| Stateful fixture host checks | 39 of 39 passed after sandbox bind/connect and one host-harness parsing result were rejected: workspace and cross-team candidates, all forward/inverse directions, idempotency, graph and validation rejection, exact-revision removal, authoritative preservation, and final convergence |
| Rendered browser captures | 0; deferred under the active browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-006 | Every accepted relation direction is directly expressible from the current issue and maps to the canonical edge model with derived inverse readback. |
| R-007 | Existing accepted relation mutation and endpoint activity invalidation paths remain in use; rejected writes are authoritatively re-read. |
| R-010 | Compact, separate hierarchy and peer composers keep relation work inside issue context with explicit labels and focus return. |
| R-102 | Serialized create/remove controls, exact-revision removal, authoritative readback, retained selections, and no automatic retry preserve concurrency semantics. |
| R-104 | Native forms, labeled direction/candidate controls, status and alert regions, disabled states, and focus restoration preserve the source accessibility contract. |
| R-105 | Stable feedback height and existing compact relation groups preserve source containment and responsive geometry contracts. |
| R-110 | Self, missing, archived, cross-workspace, duplicate, ambiguous, unsupported, stale, and cyclic inputs fail closed without erasing user context. |

## Review Corrections

1. Adding inverse labels without endpoint translation was rejected because it would store the opposite semantic edge.
2. Keeping team-scoped candidates was rejected because accepted relation scope is the workspace, not the current team.
3. One shared successful-form reset was rejected because a hierarchy mutation could erase an unsubmitted peer selection, or vice versa. Reset epochs are section-specific.
4. Independent create and remove pending states were rejected because overlapping writes make authoritative readback and focus recovery ambiguous.
5. Generic mutation errors alone were rejected because the relation projection could remain stale after a cycle, revision, archive, or remote-state rejection.
6. Treating HTTP checks as rendered acceptance was rejected. No pixel, focus-ring, accessibility-tree, responsive containment, or console claim is made without the approved browser surface.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify owner/member/guest direction controls; current-team and cross-team candidates; parent/sub-issue, blocks/blocked-by, and duplicate direction semantics; independent composer state; pending and confirmed feedback; retained selection after cycle, duplicate, archive, and unavailable-readback failures; serialized create/remove and issue-archive behavior; keyboard and focus order; accessible names and live announcements; and zero overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was used. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-71, complete CT-12, pass rendered P-T08/P-T09/P-T11/P-T12/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-004.
