# CT-49 Workspace Capability Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Mutation affordances now derive from the same workspace-role capability contract enforced by the server. Source-level contracts, complete regression, typecheck, production build, and deterministic owner/guest fixture responses pass. Rendered desktop, tablet, and mobile interaction verification remains open.

## Implemented Contract

- `hasCapability(role, capability)` is the non-throwing presentation predicate for the existing domain capability table. `assertCapability` delegates to it, keeping UI visibility and service authorization attached to one role matrix.
- Owners receive every capability. Admins receive every capability except irreversible issue purge. Members may read the workspace and mutate projects, milestones, and issues. Guests may read only.
- Workspace team, membership, and status management surfaces require their exact manager capabilities. An unavailable action is removed or disabled before it can open a dialog.
- Project and milestone create, edit, archive, reorder, context-menu, selection, and bulk controls require `project:write`. Read-only project tables do not advertise multiselect semantics.
- Issue title, rich description, properties, labels, comments, relations, resources, saved views, archive, selection, and bulk controls require `issue:write`; permanent purge separately requires `issue:purge`.
- Read-only issue titles use native read-only semantics so guests can focus, select, and copy text. Rich descriptions render through the static viewer rather than a disabled editor.
- The global `C` shortcut and command-palette create command require `issue:write`. Guest keyboard traversal skips the disabled create option, and unauthorized create signals are consumed without later replay.
- Workspace or role changes close capability-sensitive dialogs and discard stale mutation drafts, resource state, comment text, and purge confirmation state.
- The deterministic fixture preserves the default owner session and adds an explicit `?fixture=guest-readonly` session and membership response for the read-only matrix.

## Automated Verification

| Check | Result |
|---|---|
| Focused domain and web contract tests | 6 files, 33 tests passed |
| Complete unit regression | 31 files, 187 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,926 modules; CSS 72,887 bytes; projects 37,379 bytes; issues 108,779 bytes; index 276,041 bytes; editor 402,713 bytes; runtime 589 bytes; HTML 663 bytes; no chunk warning |
| PostgreSQL integration runner | 7 files and 17 tests skipped because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent |
| Deterministic fixture host checks | Owner shell/session and guest session/membership returned HTTP 200 at port 4181 |
| Rendered browser captures | 0; deferred after the existing browser-policy denial |

The skipped integration result is not a pass. CT-49 changes no database schema or server authorization contract; database-backed authorization remains covered by the existing pending canonical test matrix rather than being claimed here.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-002 | Team, membership, and status mutation affordances now require the corresponding manager capabilities. |
| R-003 | Project create, edit, archive, reorder, context-menu, selection, and bulk surfaces require `project:write`. |
| R-004 | Milestone create, edit, archive, reorder, and project-assignment surfaces inherit `project:write`. |
| R-005 | Issue title, description, properties, relations, resources, comments, archive, and purge affordances use `issue:write` or `issue:purge` as appropriate. |
| R-008 | Label, saved-view, selection, and bulk mutation surfaces are unavailable in read-only workspaces. |
| R-012 | Archive operations require the matching write capability and irreversible issue purge remains owner-only. |
| R-101 | UI gating is defense in depth only; existing service assertions remain authoritative and now share the same domain predicate. |
| R-104 | Guest content remains focusable, selectable, and readable while disabled command options are skipped by keyboard navigation. |
| R-110 | The fixture exposes deterministic owner and guest contracts. Rendered breakpoint and geometry verification remains pending. |

## Review Corrections

1. A shared non-throwing domain predicate replaced client role-name checks so presentation behavior cannot silently drift from `assertCapability`.
2. The guest command palette starts on the first enabled command and keyboard traversal skips the disabled issue-create option.
3. The global create signal is consumed exactly once. Read-only workspaces discard it so a later role or workspace transition cannot replay an unauthorized action.
4. Capability-sensitive dialogs, drafts, resource state, comments, and purge confirmation close or clear when the active workspace or role changes.
5. Guest issue titles remain read-only rather than disabled for selection and accessibility, while rich descriptions render through the static viewer.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, compare owner and guest fixtures across projects, milestones, active and archived issues, workspace administration, command palette, saved views, context menus, and bulk selection. Prove that owner controls remain operable, guest mutation controls are absent or disabled, guest copy and navigation remain available, disabled commands are skipped, stale dialogs do not survive a role/workspace switch, focus is visible, and there is zero overlap, uncontained overflow, duplicate IDs, hidden focus, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-49, complete CT-12, approve CT-13, pass rendered P-T04/P-T06/P-T07/P-T09/P-T11/P-T13/P-T16/P-T18/P-T19, select a license or public identity, authorize release, or validate O-001 through O-005.
