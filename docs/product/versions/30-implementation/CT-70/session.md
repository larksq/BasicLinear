# CT-70 Implementation Session

- Issue: `CT-70`, stable ID `1f275915-fd36-425f-9d7f-a61cb1e59abd`, starting revision `2`, intended checkpoint revision `3`.
- Session: `CT70-IMPL-20260820T230104Z`.
- Actor: `codex-comment-inline-edit`.
- Mode: code-mutating implementation checkpoint.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, or UI used.

## Scope

Replace the comment edit dialog with a compact chronology-row editor that submits one normalized rich-text document against the revision captured when editing began. Serialize comment editing with comment archive/restore and retain rejected drafts for explicit recovery after authoritative archived-inclusive readback.

## Execution

1. Added a pure request builder for rich-text normalization, invalid or empty document rejection, archived-state and revision validation, isolated draft copying, and semantic no-op suppression.
2. Replaced the edit dialog with one controlled form inside the existing comment chronology row. Native form submission saves; Escape cancels; labeled controls retain keyboard parity and restore focus.
3. Stored the complete opening comment with each draft. Background query refreshes therefore cannot silently rebase a draft and overwrite a concurrent change.
4. Shared one interaction lock across comment create, edit, archive/restore, and issue archive controls while a comment write is open or pending.
5. Re-read the archived-inclusive authoritative comment list after every rejected edit, replaced the cache with confirmed records, retained the submitted draft, and required `Retry draft` or `Use server values` before recovery.
6. Projected owner/admin/author edit and archive capability when the current user is known while keeping the service authoritative for embedded surfaces.
7. Added stable pending, error, and confirmed-revision feedback, responsive recovery geometry, focused helper/source tests, and a stateful synthetic fixture with active and archived comments.

## Verification

- Focused tests: 2 files / 10 tests passed.
- Complete regression: 48 files / 330 tests passed.
- Typecheck: all 8 workspaces passed.
- Fixture syntax: passed.
- Production build: 1,941 modules, no chunk warning.
- Release-audit regression: 1 file / 2 tests passed.
- Integration runner: 7 files / 17 tests discovered and skipped without a configured test PostgreSQL URL; no database-sensitive path changed and no new database pass is claimed.
- Stateful HTTP fixture: 42 of 42 named assertions passed at port 4196 after sandbox bind and connection results were rejected as environment evidence.
- Rendered browser captures and assertions: 0.

## Environment Retry Record

The normal fixture launch on port 4196 failed with sandbox `listen EPERM`. The managed production fixture then launched on the same port. A sandbox-local request could not connect, while the approved host-network matrix passed all 42 assertions. These were environment retries, not product-code corrections.

## Browser Boundary

The active security policy denies the approved browser surface. No alternate browser surface was used. Desktop, tablet, and mobile rendered row editing, stale recovery, focus, keyboard, accessibility, pending geometry, containment, overflow, and console claims remain explicitly unaccepted.

## Handoff

CT-70 remains In Progress at intended revision `3`. CT-12 must ingest this checkpoint while retaining its browser blocker; CT-13 must refresh its deterministic release preflight against the reconciled candidate. No outcome or release claim is made.
