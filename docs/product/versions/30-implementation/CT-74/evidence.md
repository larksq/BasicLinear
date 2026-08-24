# CT-74 Workflow Status Reorder Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Workflow status management now supports one atomic, team-scoped, complete-set reorder with revision checks, advisory serialization, normalized positions, mutation evidence, pointer direct manipulation, and named keyboard parity. Complete automated, current-source PostgreSQL, typecheck, fixture syntax, production build, release-audit regression, and stateful HTTP checks pass. Rendered desktop, tablet, and mobile interaction, focus, accessibility, and geometry verification remains open.

## Implemented Contract

- `POST /api/v1/workspaces/:workspaceId/teams/:teamId/statuses/reorder` requires every status in the team exactly once with a positive expected revision.
- `status:manage` authorization, exact workspace/team lookup, and a team-order advisory transaction lock precede mutation.
- Missing, duplicate, extra, cross-team, cross-workspace, malformed, stale, and semantic no-op requests fail closed before any row changes.
- Accepted requests normalize positions to 100-point increments and advance only rows whose position changes.
- Each changed row receives revision-bearing activity and outbox evidence inside the same transaction; the response is the authoritative sorted team order.
- Reorder requests retain the complete opening baseline. Background refetches cannot silently rebase an active pointer or keyboard operation.
- The interface does not optimistically reorder. It re-reads authoritative status state after accepted and rejected writes and serializes create, edit, and reorder work.
- Pointer handles support mouse, touch, and pen capture with a six-pixel threshold, before/after targeting, cancellation, and capture-loss cleanup.
- Named Move up and Move down controls provide keyboard parity, disable at boundaries, announce position changes, and restore focus.
- Owner/admin controls remain enabled by capability; member/guest projections remain read-only.

## Automated Verification

| Check | Result |
|---|---|
| Focused reorder and capability tests | 2 files, 20 tests passed |
| Complete unit regression | 52 files, 363 tests passed; 0 failures |
| Current-source PostgreSQL integration | 7 files, 17 tests passed; includes valid reorder, normalized persistence, no-op, stale, incomplete, cross-team, cross-workspace, authorization, and transaction evidence assertions |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Production build | 1,945 modules; CSS 98,485 bytes; saved views 10,177 bytes; projects 69,682 bytes; issues 165,129 bytes; index 303,597 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; 1,051,564 total bytes; no chunk warning |
| Release-audit regression | 1 file, 2 tests passed |
| Stateful fixture host checks | Clean final run: 45 of 45 passed; valid/persistent/normalized reorder, revision movement, no-op/stale/current revision, incomplete/duplicate/invalid/cross-scope rejection, second reorder, concurrent edit conflict, no partial state, recovery reorder, secondary-team isolation, unique IDs, and shell delivery |
| Rendered browser captures | 0; deferred under the active browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-002 | Configurable team workflow statuses can now be created, edited, and atomically reordered from the Workflow surface. |
| R-007 | Direct manipulation has explicit pointer thresholds, targets, cancellation, and named keyboard alternatives. |
| R-010 | Stable controls, boundary disabling, live order announcements, serialized interactions, and deterministic focus return preserve keyboard reachability. |
| R-102 | Complete opening revisions, advisory serialization, all-before-any validation, conflict readback, and no automatic replay preserve optimistic concurrency. |
| R-104 | Semantic ordered lists, named icon controls, status/alert regions, disabled states, and focus restoration preserve the accessibility contract. |
| R-105 | Fixed action tracks, non-shifting drop indicators, and responsive bounded rows preserve compact manager geometry for the pending screenshot matrix. |
| R-110 | Empty, duplicate, incomplete, extra, malformed, stale, cross-team, cross-workspace, missing-team, no-op, and concurrent requests fail closed without partial mutation. |

## Review Corrections

1. Reusing sequential single-status PATCH calls was rejected because a multi-row reorder must not partially commit.
2. Checking only moved rows was rejected because an omitted or extra status would make the team order ambiguous; the transaction validates the complete locked set.
3. Advancing every revision was rejected because rows already at their normalized position did not change.
4. Using the latest render-time collection was rejected because background refetches could silently rebase an active drag; the complete opening baseline remains authoritative for the attempt.
5. Optimistic list movement was rejected because the visible order must stay confirmed until the atomic service response and readback succeed.
6. Making the drag handle keyboard-focusable was rejected because named Move up and Move down controls provide clearer keyboard semantics without duplicate focus stops.
7. A duplicate synthetic UUID across teams was found during evidence review, corrected, and guarded by initial/final unique-ID host assertions.
8. Treating HTTP checks as rendered acceptance was rejected. No pixel, pointer geometry, focus-ring, accessibility-tree, responsive containment, or console claim is made without the approved browser surface.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify owner/admin/member/guest projection; mouse, touch, and pen pickup thresholds; before/after targets; first/middle/last moves; adjacent no-op and boundary disabling; cancellation and capture loss; stale, malformed, unavailable-record, and unavailable-readback recovery; serialization with create/edit; keyboard parity; focus restoration; accessible names and announcements; scrolling and long-name containment; and zero overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source, deterministic synthetic fixture data, and the existing governed local PostgreSQL verification stack. Database credentials were read into process memory, passed over process stdin, redacted from output, never persisted, and never included in evidence. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was used. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-74, complete CT-12, pass rendered P-T04/P-T11/P-T13/P-T16/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-004.
