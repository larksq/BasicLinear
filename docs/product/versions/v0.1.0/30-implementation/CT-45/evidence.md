# CT-45 Issue Hierarchy Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Issue detail now presents parent and sub-issue relationships in a dedicated hierarchy section before peer relations and comments, with an explicit existing-issue sub-issue action. Rendered desktop, tablet, and mobile acceptance remains open.

## Correction

- A pure stable partition separates `parent` and `sub_issue` directions from dependency, duplicate, and related directions without changing server order or relation identity.
- The dedicated `Sub-issues` section appears before generic `Relations` and comments, retains a distinct count and loading state, and uses explicit `Parent` and `Sub-issue` row labels.
- `Add sub-issue` uses the existing server-authoritative `parent` relation mutation from the current issue to the selected existing issue. Existing self-relation, one-parent, archived-target, cycle, revision, and workspace checks remain authoritative.
- The generic relation form is limited to related, blocks, and duplicate commands, removing the ambiguous hierarchy option from a peer-relation menu.
- Hierarchy and peer rows share the established identifier, title, navigation, removal, archive, pending, error, query, and activity contracts.
- No issue schema, database migration, endpoint, CSS rule, detail geometry, panel behavior, or route context was changed.

## Automated Verification

| Check | Result |
|---|---|
| Focused hierarchy, navigation, conflict, and route contract | 4 files, 34 tests passed |
| Combined CT-32 through CT-45 semantic regression | 15 files, 95 tests passed |
| Complete unit regression | 26 files, 166 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,926 modules; CSS 70,935 bytes; projects 37,297 bytes; index 279,252 bytes; issues 499,991 bytes; no chunk warning |

The initial hierarchy implementation passed the focused checks. The complete regression then exposed two source-contract assumptions around the relations loading skeleton and count. The first compatibility adjustment restored those literals but increased the issue chunk to 500,200 bytes and reintroduced Vite's chunk warning. The final pass retained the shared production component, updated the source-level count contract to the component-owned loading prop, reduced the chunk to 499,991 bytes, and reran the complete regression, typecheck, focused suites, and build. No failed result was discarded.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | Hierarchy remains an issue-detail workflow using the existing project, milestone, status, assignee, label, and archive context rather than a parallel record model. |
| R-006 | Parent and sub-issue directions receive a dedicated, counted section and explicit add and remove controls backed by the existing relation API and database invariants. |
| R-010 | Each hierarchy row retains a named navigation target and removal command; archived issue state removes creation controls and disables relation removal consistently. |
| R-104 | The hierarchy section uses a unique accessible heading, explicit form and select labels, icon button labels and titles, and the established keyboard-focusable controls. Rendered focus verification remains required. |
| R-110 | No CSS or geometry changed; hierarchy reuses the existing secondary-section grid across panel, route, tablet, and mobile presentations. Rendered overflow and reachability inspection remains required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. At `1440x900`, `1024x768`, and `390x844`, the follow-up must exercise zero, one, and many hierarchy rows; parent and sub-issue direction labels and counts; hierarchy-before-relations ordering; add-existing-sub-issue success; self, existing-parent, cycle, and archived-target errors; removal from both related issue views; activity updates; archive guards; route and panel navigation; keyboard focus; responsive reachability; and zero overlap, uncontained overflow, duplicate IDs, hidden focus, console warnings, or console errors.

## Privacy And Authority

The automated checks use repository source and synthetic values only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-45, complete CT-12, pass P-T19 or P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
