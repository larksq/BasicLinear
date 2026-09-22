# CT-68 Inline Project Editing Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Project overview content now edits in place under one explicit save, while status, priority, lead, start date, and target date commit immediately as minimal expected-revision patches. Unsaved content survives property success and authoritative recovery. Automated, typecheck, fixture syntax, production build, release-audit regression, and stateful HTTP contracts pass. Rendered desktop, tablet, and mobile interaction, focus, accessibility, and geometry verification remains open.

## Implemented Contract

- The in-page content form owns name, summary, icon, color, rich overview, and resources. It emits a normalized sparse request only through `Save project content`.
- Each mutable property emits only `expectedRevision` and that property. No shared property save command remains.
- Content, inline-property, and archive writes share one project-revision mutation gate. Archive is unavailable while a content draft is open.
- Successful property writes publish their confirmed revision. Conflict and validation failures re-read the authoritative project, restore property values, invalidate collection state, and preserve the content draft.
- Content conflict recovery retains the submitted draft and requires an explicit `Retry draft` or `Use server values` decision. There is no automatic retry.
- The rich-editor identity advances only after content success or explicit server-value recovery. Property revision changes therefore do not erase unfinished overview or resource work.
- Statuses, priorities, lead identities, dates, content fields, resources, archived state, and no-op requests fail closed before submission. Resources accept only credential-free HTTP or HTTPS URLs.
- Project team ownership remains visible and read-only after creation. This avoids an unsafe cross-team reassignment of issues bound by workspace, team, and project identity.
- Feedback occupies a stable row, and the project hero keeps its prior total vertical footprint after that row was introduced.

## Automated Verification

| Check | Result |
|---|---|
| Focused inline-project and capability tests | 2 files, 13 tests passed |
| Complete unit regression | 46 files, 319 tests passed after correcting one stale capability source-contract literal; 0 final failures |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Integration runner | 7 files / 17 tests discovered and skipped because no test PostgreSQL URL is configured; CT-68 changes no contract, API, repository, schema, migration, RLS, persistence, or recovery path, so no database pass is claimed |
| Production build | 1,939 modules; CSS 90,870 bytes; saved views 10,177 bytes; projects 63,438 bytes; issues 148,757 bytes; index 285,158 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Release-audit regression | 1 file, 2 tests passed |
| Stateful fixture host checks | 20 of 20 passed after the sandbox bind result was rejected: initial convergence, sparse property and content patches, exact conflict metadata, unchanged-state assertions, invalid date/lead/shape/team/no-op/resource rejection, revision progression, and final list/detail convergence |
| Rendered browser captures | 0; deferred under the active browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-003 | Project overview content and the expected project-management properties are now editable without leaving the overview route. |
| R-007 | Status, priority, lead, start date, target date, rich overview, and resources remain represented in one project workflow with explicit team ownership. |
| R-010 | Immediate property confirmation and a stable feedback row replace the distant modal workflow while preserving the existing page hierarchy. |
| R-102 | Expected revisions, serialized writes, authoritative readback, retained drafts, explicit conflict recovery, and no automatic retry preserve concurrency semantics. |
| R-104 | Native labeled controls, form association, live status/error semantics, stable tab order, and capability gating preserve the accessibility source contract. |
| R-105 | Bounded controls, a fixed feedback row, the preserved hero footprint, and existing responsive fallbacks preserve source geometry. |
| R-110 | Cross-workspace leads, duplicate identities, reversed or invalid dates, team reassignment, stale revisions, archived edits, no-ops, and unsafe resource URLs fail closed. |

## Review Corrections

1. Extending the existing edit dialog was rejected because it hides the project overview during editing and couples content and properties into one revision request.
2. Remounting the rich editor on every project revision was rejected because an immediate property success would erase unfinished content.
3. Optimistically retaining a failed property was rejected because the accepted flow requires confirmed server values after conflict or validation failure.
4. Allowing concurrent content, property, or archive requests was rejected because all three advance one project revision.
5. Project team reassignment was rejected because existing issues are constrained by workspace, team, and project identity; a safe move requires a separate bounded migration workflow.
6. Archive remained available in the first implementation while an unsaved content draft was open. Source review closed that draft-loss path before final verification.
7. The first complete-suite run exposed one stale workspace-capability source contract. It now requires the inline revision/capability gates, and the full 46-file / 319-test suite passes.
8. The integration command's documented no-database skips remain skips. This web-only slice does not represent them as a database pass.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify owner/member editing and guest read-only state; absence of the old edit modal; in-page content save; dirty name, summary, overview, and resources across property success, validation failure, conflict, and unavailable readback; content conflict retry and server-value recovery; stable pending and confirmed-revision geometry; read-only team ownership; date-order behavior; keyboard order; focus retention; live announcements; accessible names and state; and zero overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was used. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-68, complete CT-12, pass rendered P-T07/P-T09/P-T11/P-T12/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-003.
