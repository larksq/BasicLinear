# CT-66 Title-first Issue Creation Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Issue creation now opens as a title-first quick-create form, shows the exact default properties that Enter will submit, and places the complete property, label, description, and resource editor behind one native Details disclosure. Project and milestone state is controlled and fails closed when a team, project, asynchronous option set, archive state, or duplicate identity makes the selection invalid. Automated, typecheck, fixture syntax, production build, release-audit regression, and stateful HTTP contracts pass. Rendered desktop, tablet, and mobile interaction, focus, accessibility, and geometry verification remains open.

## Implemented Contract

- The title remains the first enabled dialog input, so the shared dialog focus contract still targets it.
- The collapsed form exposes named Team, Status, Priority, Assignee, Project, and Milestone values. These values share the same controlled state as the expanded form and submission payload.
- One native Details disclosure contains every existing team, status, priority, assignee, project, milestone, due-date, label, rich-description, and resource control.
- The only submit command remains outside the disclosure. Native form submission from the required title uses current controlled defaults whether Details is open or closed.
- Team changes reset status to that team's unstarted or first available status and clear project and milestone state.
- Project changes clear milestone state immediately. Asynchronous milestone options are filtered to unique, active records owned by the selected project.
- Missing, archived, cross-project, duplicate, and stale milestone identities reconcile to no milestone. An active contextual milestone is retained when its project options become available.
- My work assignee context remains the initial controlled assignee when that user is a current member. Invalid assignee context fails closed to Unassigned.
- The synthetic fixture accepts a compact default payload and a complete paired project/milestone payload, rejects an invalid cross-project pair, and exposes list-query and detail readback.

## Automated Verification

| Check | Result |
|---|---|
| Focused creation, scope, capability, and layout tests | 4 files, 43 tests passed |
| Complete unit regression | 44 files, 299 tests passed after correcting one stale source-contract literal; 0 final failures |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Integration runner | 7 files / 17 tests discovered and skipped because no test PostgreSQL URL is configured; CT-66 changes no contract, API, repository, schema, migration, RLS, persistence, or recovery path, so no database pass is claimed |
| Production build | 1,937 modules; CSS 86,247 bytes; saved views 10,177 bytes; projects 50,980 bytes; issues 143,076 bytes; index 285,158 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Release-audit regression | 1 file, 2 tests passed |
| Stateful fixture host checks | 50 of 50 passed after the sandbox bind result was rejected: production HTML/session, two active same-team projects, paired milestone ownership, default creation, expanded rich creation, query/detail persistence, invalid-pair rejection, and unchanged final readback |
| Rendered browser captures | 0; deferred under the active browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | Quick and expanded creation preserve the complete issue field payload while invalid project/milestone pairs fail closed. |
| R-010 | Title-first focus, one disclosure, exact default-value projection, and one submit command preserve predictable creation semantics. |
| R-104 | Native labeled inputs, a native summary/details control, semantic default descriptions, and the shared named dialog preserve the accessibility contract. |
| R-105 | Stable 27px default rows, bounded text, wrapping, and a single-column mobile field fallback preserve responsive geometry in source. |
| R-110 | Missing, archived, cross-project, duplicate, stale, asynchronous, and context-invalid values are cleared before submission. |

## Review Corrections

1. Leaving every rich control visible was rejected because it violated the accepted title-first creation contract.
2. Hiding all defaults was rejected because quick submission must make its submitted context inspectable.
3. Keeping the milestone select uncontrolled was rejected because a project change or delayed query could retain an invalid pair.
4. Trusting the project endpoint alone was rejected. Client reconciliation also verifies active lifecycle, owning project, and unique identity.
5. Applying a contextual milestone on every render was rejected because it would overwrite an explicit user choice. Context is applied once when it becomes valid; later user changes are authoritative.
6. The first complete-suite run exposed one stale source-contract literal after the undefined milestone source became explicit. The expectation was corrected and the full 44-file / 299-test suite reran cleanly.
7. The integration command's documented no-database skips are retained as skips. This client-only slice does not represent them as a database pass.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify owner/member compact and expanded forms plus guest omission; exact title autofocus; Enter submission from title; default Team, Status, Priority, Assignee, Project, and Milestone projection; global, team, project, milestone, and My work context; team/project changes while milestone options are pending; disclosure pointer and keyboard operation; complete rich fields; successful, validation, unavailable, pending, offline, and retry states; close and post-create focus behavior; logical keyboard order; visible focus; accessible names and state; and zero overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was used. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-66, complete CT-12, pass rendered P-T08/P-T10/P-T11/P-T12/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-003.
