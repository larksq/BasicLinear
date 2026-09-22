# CT-42 Milestone Interaction Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Project milestones now use an inline final-geometry creation editor, real-record ordered-list semantics, and committed-position announcements for keyboard reordering. Rendered desktop, tablet, and mobile acceptance remains open.

## Correction

- Add milestone now opens inside the milestone surface instead of a modal and focuses the Name field.
- Enter submits through the existing idempotent create API. Escape and the familiar Cancel control close without mutation and restore focus to Add milestone.
- Name, description, target date, issue count placeholder, and submit/cancel actions occupy the established six milestone tracks. The current mobile row rules collapse the same editor to the existing two-row geometry.
- Only persisted milestone rows are children of the named ordered list; the temporary editor shares the visual list shell without changing list size or position semantics.
- Move Up and Move Down still use the revision-checked reorder API, but the next order is now derived by a duplicate-safe pure helper and the committed one-based position is announced in a polite atomic status.
- After reorder, focus returns to the invoked move control when it remains enabled, or to the moved row at a list boundary. Failed reorders announce that the previous order is unchanged.
- Project detail tabs, milestone edit/archive/restore, progress, target date, issue drill-down, active/archive queries, activity invalidation, and project-level geometry remain unchanged.

## Automated Verification

| Check | Result |
|---|---|
| Focused milestone, project-row, and layout contract | 3 files, 19 tests passed |
| Combined CT-32 through CT-42 semantic regression | 12 files, 68 tests passed |
| Complete unit regression | 23 files, 136 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,923 modules; CSS 69,805 bytes; projects 37,301 bytes; index 279,244 bytes; issues 493,929 bytes |

The first implementation passed focused tests and web typecheck. Source review then found that nesting the temporary editor inside the ordered list would incorrectly count it as a milestone, and final interaction audit found that Escape could close the editor after a create request had started. The editor was moved into the same visual shell but outside the real-record `<ol>`, and pending submission now disables both Cancel and Escape cancellation. Focused, combined, complete, all-workspace, and production checks were rerun after the final correction.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-004 | Creation, ordered active milestones, revision-checked reorder, progress, target date, issue count, archive visibility, and project scope remain connected to the existing milestone APIs. |
| R-010 | The inline Name field receives focus; Enter submits; Escape and Cancel close and restore focus; move controls retain a deterministic post-mutation focus target. |
| R-104 | Real milestones have ordered-list semantics, committed positions use an atomic polite live status, controls retain complete accessible names, and failure remains visibly reported. Rendered assistive-technology verification remains required. |
| R-110 | The editor reuses the established desktop and mobile milestone tracks, does not replace the list with a modal, and disables the archive-view switch while input is active. Rendered reachability, text fit, and overflow inspection remain required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. At `1440x900`, `1024x768`, and `390x844`, the follow-up must verify Add milestone placement and focus; Enter success; Escape and Cancel no-mutation recovery; create-error retention; real-record list size and positions; Move Up and Move Down success, boundary states, committed announcements, post-refresh focus, and stale-revision failure; archive-view behavior; progress, date, issue count, edit, archive, and restore reachability; desktop and mobile row geometry; zero overlap, uncontained overflow, duplicate IDs, hidden focus, console warnings, or console errors.

## Privacy And Authority

The automated checks use repository source and synthetic values only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-42, complete CT-12, pass P-T19 or P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
