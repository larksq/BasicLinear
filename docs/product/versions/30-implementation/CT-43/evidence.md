# CT-43 Issue Edit Conflict Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Stale issue edits now restore an authorized confirmed readback, expose an explicit revision-conflict state, and retain the attempted draft behind deliberate Reapply or Discard actions. Rendered desktop, tablet, and mobile acceptance remains open.

## Correction

- Only an API `CONFLICT` carrying a positive current revision can enter recovery, and only after a fresh authorized issue GET confirms a revision at or beyond that signal.
- The confirmed issue replaces the detail query cache before recovery renders, so the form remounts with server title, rich description, properties, project, milestone, and labels instead of leaving rejected values visible.
- The visible alert names the confirmed revision and states that server values are shown while the attempted draft remains in transient client state.
- Reapply draft changes only the draft's expected revision, remounts every retained field for review, and never calls the mutation automatically. A second explicit Save remains mandatory.
- Discard draft and Use server values remove the transient draft and focus the restored title editor; an issue concurrently archived falls back to its Archive/Restore action as the recoverable focus target.
- If an authorized event refetch advances the issue again while the conflict alert is open, the displayed server revision advances with it. Once a draft is explicitly reapplied, its revision key remains pinned so background readback cannot silently remount or rewrite it.
- Non-conflict errors continue through the existing visible ErrorNotice path. Issue archive/restore, purge, relations, comments, activity, routes, panel behavior, and server mutation contracts remain unchanged.

## Automated Verification

| Check | Result |
|---|---|
| Focused conflict, route, and state contract | 3 files, 19 tests passed |
| Combined CT-32 through CT-43 semantic regression | 13 files, 91 tests passed |
| Complete unit regression | 24 files, 147 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,924 modules; CSS 70,935 bytes; projects 37,297 bytes; index 279,252 bytes; issues 497,047 bytes |

The first implementation passed 11 focused conflict tests and web typecheck. Source review then found that an authorized SSE refetch could advance the issue while recovery was open and that discarding after a concurrent archive needed a non-disabled focus target. The final pass derives the conflict-phase revision from the latest confirmed query value, pins a reapplied draft to its explicit rebase revision, and falls back to the Archive/Restore action for focus. Focused, semantic, complete, all-workspace, and production checks were rerun after those corrections.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | The complete attempted issue edit remains recoverable, while only a new explicit Save can persist a rebased draft. |
| R-010 | Conflict recovery exposes named Reapply, Discard, and Use server values commands and returns focus to a valid issue-detail control. |
| R-102 | A stale mutation is never retried or merged automatically; an authorized GET establishes confirmed state, and reapply rebases only expected revision before a separate save. |
| R-104 | The conflict is an atomic alert, the reapplied state is a polite status, controls have literal accessible names, and focus recovery is deterministic. Rendered assistive-technology verification remains required. |
| R-110 | The alert uses bounded stable tracks, wraps long copy, and collapses its actions below 768px without hiding either recovery path. Rendered reachability, fit, and overflow inspection remains required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. At `1440x900`, `1024x768`, and `390x844`, the follow-up must inject a stale issue edit and verify one conflict alert; confirmed server title, description, and every property; announced revision; Reapply without network mutation; retained full draft; explicit second-save success; Discard and Use server values behavior; an additional event refetch; concurrent archive focus fallback; generic validation-error behavior; route and panel layouts; keyboard reachability; zero overlap, uncontained overflow, duplicate IDs, hidden focus, console warnings, or console errors.

## Privacy And Authority

The automated checks use repository source and synthetic values only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-43, complete CT-12, pass P-T19 or P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
