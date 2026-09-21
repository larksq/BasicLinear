# CT-38 Local Keyboard Safety Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Issue-view and record commands now require exact eligible key events, allowing global Search plus browser and assistive-technology reserved chords to retain precedence, but rendered browser acceptance remains open.

## Correction

- A pure resolver is now the single eligibility boundary for issue-view and record key actions.
- `/`, `F`, and `B` are accepted only when unmodified, non-repeating, non-composing, not already prevented, and outside editable or dialog content.
- Enter, Space, `J`, `K`, and arrow record actions reject modifiers, composition, already-prevented events, and nested interactive content.
- Repeated Enter and Space cannot open or toggle repeatedly; repeated row navigation remains available.
- Project rows declare that selection is unavailable, so Space remains unclaimed there.
- A modified record key returns no local action and is not prevented, allowing Cmd/Ctrl+K to reach global Search.
- Existing unmodified actions, stable issue identity, virtualization, pointer behavior, labels, CSS, dimensions, and visible copy remain unchanged.

## Automated Verification

| Check | Result |
|---|---|
| Focused local-key policy | 1 file, 6 tests passed |
| Focused local-key policy and board integration | 2 files, 10 tests passed |
| Combined CT-32 through CT-38 semantic regression | 7 files, 32 tests passed |
| Complete unit regression | 19 files, 105 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,920 modules; CSS 63,366 bytes; projects 28,964 bytes; index 278,211 bytes; issues 493,311 bytes |

The broad verification review caught one capability edge before evidence packaging: a shared record resolver initially accepted Space for project rows even though they do not expose selection. The resolver now requires an explicit selection capability, and the clean focused, combined, complete, typecheck, and build reruns include that correction.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-010 | Exact local key dispatch preserves every accepted unmodified action while allowing Cmd/Ctrl+K to reach the global Search action from a focused record. |
| R-104 | Modified, composing, claimed, repeated activation, editable, dialog, and nested-control events no longer receive conflicting local keyboard behavior. |
| R-110 guard | No CSS, dimensions, responsive rule, or visible copy changed; rendered geometry inspection remains required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. At 1440x900 and 390x844, the follow-up must confirm that Cmd/Ctrl+K from focused issue rows, board cards, and project rows opens exactly one Search dialog without moving the record; Cmd/Ctrl+F retains browser behavior without opening issue filters; modified `B` does not change layout; exact `/`, `F`, and `B` retain their issue-view actions outside editable content; exact Enter, Space, `J`, `K`, and arrows retain record behavior; repeat navigates but does not repeatedly open or toggle; project Space remains unclaimed; and composition, already-prevented events, dialogs, and nested controls remain isolated. The run must also inspect focus return, responsive geometry, reachable content, unique IDs, and console diagnostics.

## Privacy And Authority

The automated checks use repository source and synthetic values only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-38, complete CT-12, pass P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
