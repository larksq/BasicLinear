# CT-67 Inline Issue Property Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Issue detail now saves title, rich description, and resources as content while status, priority, assignee, due date, project, milestone, and labels commit inline as minimal expected-revision patches. Content state survives property success and authoritative recovery. Automated, typecheck, fixture syntax, production build, release-audit regression, and stateful HTTP contracts pass. Rendered desktop, tablet, and mobile interaction, focus, accessibility, and geometry verification remains open.

## Implemented Contract

- The content form owns only title, description document, and resources. Its explicit `Save content` command retains the existing confirmed-state and retained-draft conflict flow.
- Each property change emits only `expectedRevision` and that property. Project changes additionally carry `milestoneId: null`, which clears dependent state atomically.
- Content, inline-property, and archive writes share one issue-revision mutation gate. No second property change can race an in-flight revision mutation.
- Successful property writes publish their confirmed revision. Conflict and validation failures re-read the issue, restore authoritative property values, invalidate list state, and expose an explicit notice without automatic retry.
- The content form key advances only after content success or explicit content-recovery transitions. Property revision changes therefore preserve dirty title, rich-description, and resource state.
- Statuses, memberships, projects, milestones, and labels fail closed on wrong workspace, wrong team or project, missing identity, duplicate identity, archived-new assignment, invalid date, or no-op input.
- The current archived project and milestone remain labeled in the controls. Moving away removes them from eligible options; they cannot be newly selected. Milestone queries explicitly include archived current context and remain disabled while loading or unavailable.
- Labels preserve stable current order, including archived assignments, when an active label is added. A current archived label can be removed but cannot be re-added.

## Automated Verification

| Check | Result |
|---|---|
| Focused inline-property, conflict, resource, and layout tests | 4 files, 42 tests passed |
| Complete unit regression | 45 files, 311 tests passed after correcting one stale capability source-contract literal; 0 final failures |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Integration runner | 7 files / 17 tests discovered and skipped because no test PostgreSQL URL is configured; CT-67 changes no contract, API, repository, schema, migration, RLS, persistence, or recovery path, so no database pass is claimed |
| Production build | 1,938 modules; CSS 86,614 bytes; saved views 10,177 bytes; projects 50,980 bytes; issues 148,741 bytes; index 285,158 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Release-audit regression | 1 file, 2 tests passed |
| Stateful fixture host checks | 32 of 32 passed after the sandbox bind result was rejected: archived-current options, minimal property patches, project/milestone clearing and pairing, label preservation/removal, conflict metadata, invalid shape/date/assignment/no-op rejection, unchanged content, and final detail/list/query convergence |
| Rendered browser captures | 0; deferred under the active browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | Every issue property remains editable, but each change now has an independent revision-confirmed commit and deterministic dependent state. |
| R-010 | Stable pending and revision feedback replaces the distant shared save command without changing the content draft or responsive two-column structure. |
| R-102 | Expected revisions, serialized writes, authoritative readback, explicit conflict recovery, and no automatic retry preserve concurrency semantics. |
| R-104 | Native labeled controls, live status/error semantics, stable tab order, and capability gating preserve the accessibility source contract. |
| R-105 | A fixed-height feedback row, bounded controls, wrapping labels, and existing one-column responsive fallbacks preserve source geometry. |
| R-110 | Cross-scope, archived-new, duplicate, invalid date, stale revision, no-op, and project/milestone mismatch paths fail closed. |

## Review Corrections

1. Reusing the existing all-field form was rejected because it couples property confirmation to title, description, and resource drafts.
2. Remounting the content form on every issue revision was rejected because an inline property success would erase unfinished content.
3. Optimistically retaining a failed property was rejected because the accepted flow requires confirmed server values after conflict or validation failure.
4. Allowing concurrent content, property, or archive requests was rejected because all three advance one issue revision.
5. Filtering every archived project and milestone was rejected because it makes a valid current assignment disappear. Permitting archived options as new assignments was also rejected.
6. The first complete-suite run exposed one stale capability source contract. It now requires the shared revision-mutation gate, and the full 45-file / 311-test suite passes.
7. The integration command's documented no-database skips remain skips. This web-only slice does not represent them as a database pass.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify owner/member inline editing and guest read-only state; dirty title, description, and resources across property success, conflict, validation, and unavailable readback; stable pending and confirmed-revision geometry; archived current project/milestone visibility; project change and milestone loading; active and archived label behavior; keyboard order; focus retention; live announcements; accessible names and state; and zero overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was used. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-67, complete CT-12, pass rendered P-T08/P-T09/P-T11/P-T12/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-003.
