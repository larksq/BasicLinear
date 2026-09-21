# CT-65 Non-destructive Bulk Label Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Selected issues can add or remove active workspace labels without replacing heterogeneous label sets. Focused and complete regression, all-workspace typecheck, fixture syntax, production build, current-source PostgreSQL integration, and a stateful HTTP contract pass. Rendered desktop, tablet, and mobile interaction, keyboard, focus, accessibility, and geometry verification remains open.

## Implemented Contract

- The bulk mutation schema expresses label intent as `add` or `remove`; it no longer accepts a destructive shared `labelIds` replacement.
- Requests require a non-empty, unique list of at most 50 label IDs. Every requested label must be active and belong to the current workspace.
- Add preserves each issue's existing label order and appends only missing requested labels. Remove preserves the order of every unrelated label.
- A final issue label set cannot exceed 50. Invalid, duplicate, archived, cross-workspace, empty, and over-limit inputs fail closed.
- Each selected issue contributes its stable ID and `expectedRevision`. Stale revisions conflict before idempotency is considered.
- Repeating an already-satisfied add or remove returns the current issue without a revision increment or activity entry.
- Bulk execution retains the existing per-item result contract. Updated rows leave selection; conflicted and failed rows remain selected with current revisions for review and retry.
- The Labels menu exposes explicit Add and Remove modes, active-label checkboxes with color swatches, and a single Apply labels command. It reconciles stale choices and is absent in read-only sessions.
- The menu has bounded width and height, a fixed mode control, and a scrollable label list so dynamic content cannot resize the surrounding toolbar.

## Automated Verification

| Check | Result |
|---|---|
| Focused contract, helper, capability, and layout tests | 4 files, 32 tests passed |
| Complete unit regression | 43 files, 286 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Current-source PostgreSQL integration | 7 files, 17 tests passed; 0 failed and 0 skipped; labels add/remove, stable order, idempotent revision and activity count, unrelated-label preservation, stale conflicts, and destructive replacement rejection covered |
| Production build | 1,936 modules; CSS 85,370 bytes; saved views 10,177 bytes; projects 50,980 bytes; issues 140,048 bytes; index 285,158 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Stateful fixture host checks | 37 of 37 passed after environment-only launch retries: HTML/session, three active labels, heterogeneous initial sets, add, idempotent add, remove, idempotent remove, unrelated-label preservation, partial stale conflict with current revision, unavailable mutation failure, destructive replacement rejection, and final persisted readback |
| Rendered browser captures | 0; deferred under the active browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | Label changes persist through the revision-safe issue mutation path without erasing unrelated labels. |
| R-008 | The shared list/board selection model now supports explicit bulk label add and remove actions. |
| R-010 | Named native controls, explicit operation modes, pending gates, aggregate results, and retry retention make the workflow predictable. |
| R-104 | Active-label checkboxes, color swatches, one result region, and read-only capability gating preserve accessible semantics. |
| R-105 | Fixed control dimensions and a bounded scrolling menu preserve toolbar geometry with many labels. |
| R-110 | Workspace, lifecycle, cardinality, duplicate, stale-revision, no-op, partial-result, and replacement paths fail closed or remain recoverable. |

## Review Corrections

1. Shared array replacement was rejected because it would erase labels that were not common to every selected issue.
2. Implicit toggle semantics were rejected because the same action would add on one issue and remove on another. Add and Remove are explicit modes.
3. Treating a no-op as an update was rejected. Idempotent mutations leave both revision and activity history unchanged.
4. Checking idempotency before revision safety was rejected. A stale writer still receives a conflict even when its requested label state currently appears satisfied.
5. Sorting final labels was rejected. Existing and unrelated label order is stable; only new labels append in request order.
6. Accepting archived or cross-workspace labels was rejected. Requested labels must resolve as active records in the current workspace.
7. Clearing failed rows from selection was rejected. Only successful rows leave selection; conflicts and failures retain retry context.
8. Leaving the menu available in read-only mode was rejected. The mutation surface is omitted when the session cannot update issues.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify list and board selection; Labels menu open, close, and focus return; Add and Remove mode changes; multiple checkbox selection; labels already present or absent on heterogeneous issues; active versus archived label visibility; 50-label bounds; successful, idempotent, partial-conflict, retry, unavailable, pending, offline, archived-issue, and read-only states; one aggregate announcement; logical keyboard order; visible focus; menu containment and internal scrolling; toolbar wrapping; zero overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source, deterministic synthetic data, and an isolated PostgreSQL test harness. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was used. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-65, complete CT-12, pass rendered P-T08/P-T10/P-T11/P-T12/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-003.
