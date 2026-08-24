# CT-70 Inline Comment Editing Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Existing comments now edit in their chronology row through one normalized expected-revision patch. The draft remains tied to its opening baseline, rejected writes re-read authoritative archived-inclusive state, and recovery requires an explicit retry or server-value decision. Automated, typecheck, fixture syntax, production build, release-audit regression, and stateful HTTP contracts pass. Rendered desktop, tablet, and mobile interaction, focus, accessibility, and geometry verification remains open.

## Implemented Contract

- Comment creation remains in context. Existing comment editing no longer opens a dialog or removes the author, timestamp, archive state, and surrounding chronology from view.
- Each edit stores its opening comment as a baseline and emits one normalized `bodyDocument` with that baseline's `expectedRevision`.
- Semantic no-ops, empty or invalid documents, archived records, and invalid revisions fail closed before submission.
- Comment creation, editing, archive/restore, and issue archive share one interaction lock while a comment revision workflow is open or pending.
- Update failure re-reads the archived-inclusive comment collection, replaces the authoritative query cache, and keeps the submitted draft. Confirmed failures suppress duplicate generic errors.
- Recovery rebases only through explicit `Retry draft` or `Use server values`. There is no automatic retry.
- Successful saves publish the confirmed revision and restore focus to the row edit control. Escape cancels without mutation and restores the same focus target.
- Owner/admin and author controls are projected when the current user is available; guest and non-author member controls remain read-only while the service remains authoritative.
- Pending and confirmed feedback occupies a stable row. Recovery content stays within the comment track with mobile-specific placement.
- Comment order, author identity, created timestamp, archive state, issue context, and activity invalidation remain intact.

## Automated Verification

| Check | Result |
|---|---|
| Focused comment-edit and capability tests | 2 files, 10 tests passed |
| Complete unit regression | 48 files, 330 tests passed; 0 failures |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Integration runner | 7 files / 17 tests discovered and skipped because no test PostgreSQL URL is configured; CT-70 changes no contract, API, repository, schema, migration, RLS, persistence, or recovery path, so no database pass is claimed |
| Production build | 1,941 modules; CSS 93,731 bytes; saved views 10,177 bytes; projects 69,710 bytes; issues 154,950 bytes; index 288,822 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Release-audit regression | 1 file, 2 tests passed |
| Stateful fixture host checks | 42 of 42 passed after sandbox bind/connect results were rejected: active/archive projection, chronology, author identity, exact revision conflicts, authoritative readback, no-op/empty/malformed/missing rejection, archive/restore progression, and final state convergence |
| Rendered browser captures | 0; deferred under the active browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | Comment author, chronology, rich text, archive state, and issue identity remain represented in one issue workflow. |
| R-007 | Comment edits and archive transitions continue through the existing transactional service and activity invalidation paths. |
| R-010 | In-row editing, native form submission, Escape cancellation, explicit recovery, and focus return remove the detached edit dialog. |
| R-102 | Opening revisions, serialized writes, exact conflicts, authoritative archived-inclusive readback, retained drafts, and no automatic retry preserve concurrency semantics. |
| R-104 | Named editors and controls, form semantics, live status/error regions, Escape behavior, capability gates, and focus restoration preserve the accessibility source contract. |
| R-105 | A stable feedback row, bounded editor, compact recovery grid, and explicit mobile placement preserve source geometry. |
| R-110 | Invalid, empty, archived, missing, malformed, no-op, and stale writes fail closed without advancing accepted state. |

## Review Corrections

1. Extending the comment dialog was rejected because routine editing remained detached from chronology and issue context.
2. Building the request from the latest query row was rejected because background readback could silently rebase a stale draft. The opening baseline remains authoritative until explicit recovery.
3. Automatically retrying after a conflict was rejected because it could replace confirmed server values without user intent.
4. Leaving archive/restore enabled during editing was rejected because both paths advance the same comment revision and can remove the active row from the projection.
5. Fetching only active comments after failure was rejected because a remotely archived comment would disappear together with the retained draft. Recovery reads the archived-inclusive list.
6. Treating HTTP checks as rendered acceptance was rejected. No pixel, focus-ring, accessibility-tree, responsive containment, or console claim is made without the approved browser surface.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify owner/admin/author editing, non-author member and guest read-only state, old-dialog absence, compact chronology geometry, rich-text changes, pending and confirmed-revision feedback, stale and validation readback, retained-draft retry and server-value recovery, remotely archived recovery, Escape and button cancellation, submit and recovery focus, create/archive/issue-archive locking, accessible names and live announcements, and zero overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was used. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-70, complete CT-12, pass rendered P-T08/P-T09/P-T11/P-T12/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-003.
