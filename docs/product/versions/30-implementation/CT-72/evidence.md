# CT-72 Label Lifecycle Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. The label manager now exposes the existing revision-checked rename and recolor contract, binds edits to an opening baseline, serializes the full label lifecycle, re-reads authoritative archived-inclusive state, retains rejected drafts, and provides explicit retry/server-value recovery. Automated, typecheck, fixture syntax, production build, release-audit regression, and stateful HTTP contracts pass. Rendered desktop, tablet, and mobile interaction, focus, accessibility, and geometry verification remains open.

## Implemented Contract

- Active labels expose a compact inline name/color editor; archived labels remain immutable until restored.
- Drafts retain the complete opening label and expected revision. Background query changes cannot silently rebase a pending edit.
- The pure request builder normalizes name and color, emits only changed fields, and rejects semantic no-ops, invalid values, archived records, and invalid revisions.
- Create, edit, archive, and restore operations share one mutation lock. Only one editor may be active, eliminating overlapping revision writes and ambiguous focus recovery.
- Accepted and rejected writes re-read the archived-inclusive label collection. Accepted responses remain visible if collection readback fails; rejected drafts remain in memory without automatic retry.
- After a rejected edit, confirmed server state becomes the explicit recovery baseline. Retry uses that revision; Use server values discards only the draft and explains remotely archived state.
- Stable live feedback identifies pending, accepted, rejected, and unconfirmed-readback states. Focus returns to the initiating editor, row action, or create field.
- The existing service remains authoritative for capability, workspace scope, active-name uniqueness, revision, archive/restore, activity, and outbox constraints.

## Automated Verification

| Check | Result |
|---|---|
| Focused label-edit and capability tests | 2 files, 11 tests passed |
| Complete unit regression | 50 files, 341 tests passed; 0 failures |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Integration runner | 7 files / 17 tests discovered and skipped because no test PostgreSQL URL is configured; CT-72 changes no contract, API, repository, schema, migration, RLS, persistence, or recovery path, so no new database pass is claimed |
| Production build | 1,943 modules; CSS 95,381 bytes; saved views 10,177 bytes; projects 69,710 bytes; issues 165,826 bytes; index 288,822 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; 1,034,410 total bytes; no chunk warning |
| Release-audit regression | 1 file, 2 tests passed |
| Stateful fixture host checks | 48 of 48 passed after sandbox bind/connect results were rejected: archived-inclusive reads, scoped creation/idempotency, active-name uniqueness, sparse edit, stale/no-op/unsupported rejection, archive/restore, restore collision, final authoritative convergence, and shell delivery |
| Rendered browser captures | 0; deferred under the active browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | Issue labels can now be created, renamed, recolored, archived, restored, selected, and persisted through the existing issue workflow. |
| R-010 | Compact named controls, one active editor, explicit recovery, Escape-compatible dialog containment, and focus return preserve keyboard reachability. |
| R-102 | Opening revisions, serialized writes, conflict readback, retained drafts, explicit retry, and no automatic replay preserve optimistic concurrency. |
| R-104 | Native forms, named icon controls, status/alert regions, disabled states, and focus restoration preserve the accessibility contract. |
| R-105 | Stable feedback height and bounded grid tracks preserve the existing compact manager geometry for the pending screenshot matrix. |
| R-110 | Long/invalid names, malformed colors, archived records, missing records, cross-workspace paths, name collisions, no-ops, and stale writes fail closed without erasing the draft. |

## Review Corrections

1. Editing against the latest render-time label was rejected because a background refetch could silently rebase a stale draft. The complete opening label is retained until an explicit rejection readback.
2. Independent mutation pending states were rejected because create, edit, archive, and restore could overlap against the same uniqueness and revision domain.
3. Invalid or unchanged form submission was rejected locally instead of relying on a round trip that would discard interaction context.
4. Generic mutation errors alone were rejected because stale, remotely archived, and unavailable-record recovery require different user actions.
5. Treating all archived names as globally reserved in the fixture was corrected to match the database's active-name uniqueness boundary; restore collisions still fail.
6. Treating HTTP checks as rendered acceptance was rejected. No pixel, focus-ring, accessibility-tree, responsive containment, or console claim is made without the approved browser surface.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify owner/member/guest creation, inline name and color editing, archive/restore, opening-baseline retention across background revisions, pending and confirmed feedback, stale/validation/remotely archived/unavailable readback recovery, explicit retry and server values, serialized controls, keyboard and focus order, accessible names and live announcements, long-label containment, and zero overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was used. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-72, complete CT-12, pass rendered P-T08/P-T09/P-T11/P-T12/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-004.
