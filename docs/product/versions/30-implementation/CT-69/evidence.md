# CT-69 Inline Milestone Editing Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Existing milestones now edit in their ordered project row through normalized sparse expected-revision patches. The draft remains tied to its opening baseline, conflicting or invalid writes re-read authoritative state, and recovery requires an explicit retry or server-value decision. Automated, typecheck, fixture syntax, production build, release-audit regression, and stateful HTTP contracts pass. Rendered desktop, tablet, and mobile interaction, focus, accessibility, and geometry verification remains open.

## Implemented Contract

- Milestone creation remains inline. Existing milestone editing no longer opens a dialog or submits unchanged name, description, and target date together.
- Each edit stores its opening milestone as a baseline and emits only changed normalized fields with that baseline's `expectedRevision`.
- Semantic no-ops, blank or overlong names, overlong descriptions, invalid dates, archived records, and invalid revisions fail closed before submission.
- Creation, editing, archive/restore, keyboard reorder, and pointer reorder share one interaction lock. A draft cannot be discarded or raced by another milestone mutation.
- Update failure re-reads the archived-inclusive milestone collection, updates both query projections, and keeps the submitted draft. Conflicts suppress duplicate generic errors while validation errors retain their precise server message.
- Recovery rebases only through explicit `Retry draft` or `Use server values`. There is no automatic retry.
- Successful saves publish the confirmed revision and restore focus to the row edit control. Escape cancels without mutation and restores the same focus target.
- Pending and confirmed feedback occupies a stable row. Recovery and validation content stays on bounded milestone tracks with mobile-specific placement.
- Project context, progress, issue counts, issue drill-down, milestone order, and issue-assignment identity remain intact.

## Automated Verification

| Check | Result |
|---|---|
| Focused milestone-edit, interaction, and capability tests | 3 files, 25 tests passed |
| Complete unit regression | 47 files, 325 tests passed; 0 failures |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Integration runner | 7 files / 17 tests discovered and skipped because no test PostgreSQL URL is configured; CT-69 changes no contract, API, repository, schema, migration, RLS, persistence, or recovery path, so no database pass is claimed |
| Production build | 1,940 modules; CSS 92,477 bytes; saved views 10,177 bytes; projects 69,710 bytes; issues 148,757 bytes; index 285,158 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Release-audit regression | 1 file, 2 tests passed |
| Stateful fixture host checks | 31 of 31 passed after sandbox bind/connect results were rejected: active/archive projection, sparse preservation, normalization, exact revision conflicts, no-op/shape/date/name/archive/identity rejection, nullable dates, revision progression, and final project/workspace convergence |
| Rendered browser captures | 0; deferred under the active browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-004 | Existing milestone name, description, target date, progress, issue count, order, archive state, and project identity remain represented in one ordered workflow. |
| R-007 | Milestone edits preserve project context, issue drill-down, and derived progress while the mutation is recorded through the existing service transaction. |
| R-010 | In-row editing, native form submission, Escape cancellation, explicit recovery, and focus return remove the distant all-field modal workflow. |
| R-102 | Baseline revisions, serialized writes, exact conflicts, authoritative archived-inclusive readback, retained drafts, and no automatic retry preserve concurrency semantics. |
| R-104 | Native labeled inputs, named controls, form semantics, live status/error regions, Escape behavior, capability gates, and focus restoration preserve the accessibility source contract. |
| R-105 | Stable milestone tracks, a fixed feedback row, bounded recovery layout, and explicit mobile placement preserve source geometry. |
| R-110 | Invalid values, unsupported fields, archived edits, missing and cross-project identities, no-ops, and stale revisions fail closed. |

## Review Corrections

1. Extending the milestone dialog was rejected because routine edits remained detached from their ordered project context and continued to submit unrelated fields.
2. Building the request from the latest query object was rejected because a background refresh could silently rebase a stale draft and overwrite a concurrent edit. The opening baseline now remains authoritative until explicit recovery.
3. Automatically retrying after a conflict was rejected because it would replace confirmed server values without user intent.
4. Allowing archive or reorder while editing was rejected because every path advances milestone revisions or can remove the draft's row.
5. Fetching only active milestones after failure was rejected because a remotely archived record would disappear together with the retained draft. Recovery reads the archived-inclusive collection and opens the archived projection when necessary.
6. Treating HTTP checks as rendered acceptance was rejected. No pixel, focus-ring, accessibility-tree, responsive containment, or console claim is made without the approved browser surface.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify owner/member editing and guest read-only state; old-modal absence; compact row geometry; name, description, and date changes; pending and confirmed-revision feedback; stale conflict and validation readback; retained-draft retry and server-value recovery; remotely archived recovery; Escape and button cancellation; submit and recovery focus; drag and keyboard control locking; issue drill-down preservation; accessible names, states, live announcements, and focus order; and zero overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was used. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-69, complete CT-12, pass rendered P-T06/P-T07/P-T09/P-T11/P-T12/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-003.
