# CT-73 Workflow Status Inline Edit Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Workflow status management now exposes the existing revision-checked update contract through a baseline-bound inline row editor, serializes creation and editing, re-reads authoritative state, retains rejected drafts, and provides explicit retry/server-value recovery. Automated, typecheck, fixture syntax, production build, release-audit regression, and stateful HTTP contracts pass. Rendered desktop, tablet, and mobile interaction, focus, accessibility, and geometry verification remains open.

## Implemented Contract

- Existing statuses expose a compact inline name, category, and color editor inside their team row; the detached edit dialog is removed.
- Drafts retain the complete opening status and expected revision. Background query changes cannot silently rebase a pending edit.
- The pure request builder normalizes name and color, emits only changed fields, and rejects semantic no-ops, invalid values, invalid revisions, and cross-workspace/team sources.
- Status creation and editing share one mutation lock. Only one editor may be active.
- New-status position is derived only from finite, non-negative positions in the selected workspace/team.
- Accepted and rejected writes re-read the authoritative status collection. Accepted responses remain visible if collection readback fails; rejected drafts remain in memory without automatic retry.
- After a rejected edit, confirmed server state becomes the explicit recovery baseline. Retry uses that revision; Use server values discards only the draft.
- Stable live feedback identifies pending, accepted, rejected, and unconfirmed-readback states. Focus returns to the initiating editor, row action, or create control.
- The existing service remains authoritative for capability, workspace/team scope, uniqueness, revision, activity, and outbox constraints.

## Automated Verification

| Check | Result |
|---|---|
| Focused workflow-status and capability tests | 2 files, 12 tests passed |
| Complete unit regression | 51 files, 348 tests passed; 0 failures |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Integration runner | 7 files / 17 tests discovered and skipped because no test PostgreSQL URL is configured; CT-73 changes no contract, API, repository, schema, migration, RLS, persistence, or recovery path, so no new database pass is claimed |
| Production build | 1,944 modules; CSS 97,472 bytes; saved views 10,177 bytes; projects 69,674 bytes; issues 165,632 bytes; index 296,180 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; 1,043,629 total bytes; no chunk warning |
| Release-audit regression | 1 file, 2 tests passed |
| Stateful fixture host checks | 54 of 54 passed after sandbox bind/connect results were rejected: two-team reads, scoped creation/idempotency, same-team uniqueness, sparse edit, stale/no-op/unsupported/invalid rejection, missing/cross-workspace failure, final authoritative convergence, and shell delivery |
| Rendered browser captures | 0; deferred under the active browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-002 | Existing configurable team workflow statuses can now be created and edited from the Workflow surface through the existing service contract. |
| R-010 | Compact named controls, one active editor, explicit recovery, and deterministic focus return preserve keyboard reachability. |
| R-102 | Opening revisions, serialized writes, conflict readback, retained drafts, explicit retry, and no automatic replay preserve optimistic concurrency. |
| R-104 | Native forms, named icon controls, status/alert regions, disabled states, and focus restoration preserve the accessibility contract. |
| R-105 | Stable feedback height and bounded responsive grid tracks preserve compact manager geometry for the pending screenshot matrix. |
| R-110 | Long/invalid names, malformed colors, invalid categories or positions, missing records, cross-scope paths, name collisions, no-ops, and stale writes fail closed without erasing the draft. |

## Review Corrections

1. Editing against the latest render-time status was rejected because a background refetch could silently rebase a stale draft. The complete opening status is retained until an explicit rejection readback.
2. Independent create and edit pending states were rejected because writes could overlap in the same ordering and revision domain.
3. Workspace-wide status count was rejected for new positions because unrelated teams must not change the selected team's deterministic ordering.
4. Invalid or unchanged form submission was rejected locally instead of relying on a round trip that would discard interaction context.
5. Generic mutation errors alone were rejected because stale, unavailable-record, and unavailable-readback recovery require different user actions.
6. Treating HTTP checks as rendered acceptance was rejected. No pixel, focus-ring, accessibility-tree, responsive containment, or console claim is made without the approved browser surface.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify owner/admin/member/guest creation and read-only projection, inline name/category/color editing, opening-baseline retention across background revisions, team-scoped creation order, pending and confirmed feedback, stale/validation/unavailable-record/unavailable-readback recovery, explicit retry and server values, serialized controls, keyboard and focus order, accessible names and live announcements, long-name containment, and zero overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was used. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-73, complete CT-12, pass rendered P-T04/P-T11/P-T13/P-T16/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-004.
