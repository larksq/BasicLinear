# CT-62 Milestone Drag Reorder Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Active project milestones now support direct mouse, touch, and pen drag reordering through an explicit handle, while the existing named keyboard controls remain available. Focused and complete regression, all-workspace typecheck, fixture syntax, production build, and the stateful HTTP contract pass. Rendered desktop, tablet, and mobile pointer, focus, announcement, and geometry verification remains open.

## Implemented Contract

- Every active milestone row exposes a pointer-only grip with a stable row drop identity. Archived milestones do not expose reordering.
- Only a primary-button mouse gesture or a touch/pen gesture can start. Pointer capture binds the interaction to one pointer ID, and a six-pixel movement threshold prevents click jitter from becoming a reorder.
- The row under the current pointer is resolved at release from document geometry. Its vertical midpoint produces an explicit before/after edge.
- The pure reorder helper validates unique source IDs, source presence, target presence, edge validity, and actual order change. It returns a new array and preserves the source array.
- Drops onto the source row, adjacent equivalent edges, missing rows, malformed data, cancellation, and capture loss perform no mutation.
- A valid drop reuses the existing full-order API payload with every milestone's current `expectedRevision`; revision conflicts keep the last committed order and report failure.
- Pickup, current target, cancellation, committed one-based position, and failure are announced through the existing polite atomic status. Focus returns to the moved milestone after settlement.
- The accessible keyboard alternative remains the existing named Move Up and Move Down buttons, including boundary disabling and revision-safe commit behavior.
- Drop indicators use fixed two-pixel before/after lines without changing row dimensions. The existing desktop and mobile milestone grids retain stable tracks.
- The deterministic `milestone-drag` fixture provides three active milestones and persists one valid reorder in memory. A stale replay returns `409 REVISION_CONFLICT`.

## Automated Verification

| Check | Result |
|---|---|
| Focused milestone interaction and layout contract tests | 2 files, 28 tests passed |
| Complete unit regression | 40 files, 265 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Production build | 1,934 modules; CSS 82,146 bytes; saved views 10,177 bytes; projects 50,980 bytes; issues 124,908 bytes; index 285,158 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Stateful fixture host checks | 8 of 8 passed after the sandbox bind result was rejected as product evidence: HTML 200; session 200; project 200; initial A/B/C order; C/A/B reorder accepted; positions normalized to 100/200/300; reordered state persisted; stale revisions rejected with 409 |
| Database integration | Not rerun for this web-only slice; production API, repository, schema, authorization, RLS, migration, and recovery paths are unchanged |
| Rendered browser captures | 0; deferred under the existing browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-004 | Direct reordering produces one deterministic complete order and uses the existing revision-bearing persistence contract. |
| R-010 | Pointer direct manipulation complements the existing keyboard alternative; cancellation, conflict, announcement, and post-settlement focus paths are explicit. |
| R-104 | The pointer-only grip does not create a redundant accessibility stop; named keyboard controls and a polite atomic status remain authoritative. |
| R-105 | Stable row dimensions and fixed drop indicators preserve dense interaction geometry without layout shift. |
| R-110 | Invalid IDs, duplicate source data, no-op edges, capture loss, and stale revisions fail closed without changing the committed order. |

## Review Corrections

1. Native HTML drag events were not introduced because the established pointer model needs touch/pen parity, explicit capture, and deterministic cancellation. One Pointer Events path owns all supported pointer types.
2. Starting mutation on pointer down was rejected because click jitter and accidental taps must not reorder work. Pickup requires the six-pixel threshold.
3. Using the event target at release was rejected because pointer capture keeps events on the handle. The current document hit target and bounded row geometry determine the drop.
4. In-place array mutation was rejected because optimistic UI and query state share record identities. The pure helper returns a new ordered array.
5. Accepting partial or duplicate milestone sets was rejected because the API contract replaces the complete order. Both helper and fixture fail closed.
6. A separate keyboard-operable drag handle was rejected because it would duplicate the already accepted Move Up and Move Down workflow. The visual grip is pointer-only and hidden from assistive technology.
7. Silent pickup and cancellation were rejected. The existing status now distinguishes pickup, target, cancel, commit, and failure.
8. Capture loss originally risked leaving a visual drag state. Explicit pointer-cancel and lost-capture paths now clear state without mutation.
9. The sandbox bind denial was rejected as a product failure or pass. Only the managed-host eight-check matrix is claimed.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify mouse, touch, and pen emulation; primary/non-primary mouse buttons; sub-threshold movement; before/after targets; first, middle, and last positions; adjacent no-op drops; pointer cancellation and capture loss; scroll interaction; a stale revision; keyboard Move Up and Move Down parity; pickup, target, cancel, commit, and failure announcements; focus restoration; archived-mode exclusion; progress, date, issue-count, edit, archive, and restore controls; responsive containment; drop-line placement; zero layout shift, overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-62, complete CT-12, pass rendered P-T11/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-003.
