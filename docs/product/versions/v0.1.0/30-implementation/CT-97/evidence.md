# CT-97 Core Archive-Undo Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_ACCEPTANCE_PENDING`. Successful single-record issue, project, and milestone archives now expose one visible, accessible Undo band. Undo restores only from the exact archived record returned by the server; no guessed or pre-archive revision is accepted by the UI path.

## Behavior

| Contract | Implemented behavior |
| --- | --- |
| Shared feedback | One full-width `ArchiveActionNotice` names the completed action, exposes Undo and dismiss controls, reports restore pending state, and distinguishes success status from restore-failure alert semantics. |
| Exact revision | Each archive success stores the returned issue, project, or milestone object. Undo passes that object unchanged to the existing restore request, which submits its returned revision. |
| Scope | Only individual issue detail, issue row/board action, project detail/row action, and milestone row archive paths gain Undo. Bulk archive, labels, saved views, comments, purge, API, SQLite, schema, and canonical transfer remain unchanged. |
| Latest action | A new direct archive or restore clears the prior notice before mutation and replaces it with only the latest result. Purge also clears stale archive feedback. |
| Focus | When an archive removes a record from its current collection, focus moves to Undo. Successful restore returns focus to the issue/project record or detail archive action; milestone restore returns to its archive action. |
| Failure | A failed Undo removes the stale retry target, refreshes authoritative data, uses alert semantics, keeps the record archived, and names Archive as the stable recovery path. |
| Announcement integrity | The actionable archive band suppresses the legacy issue-only announcement and raw restore-error banner for Undo, so each result has one authoritative live-region announcement. |
| Data refresh | Existing issue/project/milestone, dependent project, and activity query invalidations run after archive and restore. |
| Responsive geometry | The band has stable full-width geometry, wrapping copy, fixed-size controls, and a single-column mobile layout. |

## Verification

| Check | Result |
| --- | --- |
| Focused archive-Undo regression | 1 file / 5 tests passed |
| Complete regression | 64 files / 433 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,948 modules / 109 files / 1,909,264 bytes; no warning |
| Release-audit regression | 6 / 6 passed |
| Isolated loopback readiness | `ready` on port 4277 using a temporary local data directory |
| Served candidate | `index-BUssPdd9.js`, `issues-LuOFvO4C.js`, `projects-BaNxg1vc.js`, and `index-1-OhQ1dB.css` returned by the rebuilt process |
| Same-origin guard rehearsal | First synthetic write without Origin was rejected with HTTP 403; the corrected same-origin workflow passed |
| Live archive/restore rehearsal | Project, milestone, and issue each advanced from revision 1 to archived revision 2 to restored revision 3 |
| Rendered Chrome evidence | 0 captures; required Chrome transport remains unavailable before page open |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `apps/web/src/components.tsx` | `ac3a2a2a05eb4753fd77a3c8e8c3f61c210cf52b24c9845987c4672387f3a61b` |
| `apps/web/src/issues.tsx` | `3742d6cf4cc8c7317bfa625057e7ad46701f290a5941fe8a00ceb3534e6420f7` |
| `apps/web/src/projects.tsx` | `dc02cfd135961dd6c4898d3e23d8648fdbfce96a78ff9c34ebbeb367853b9936` |
| `apps/web/src/styles.css` | `0ac71968e96b5db64ea9160d0ae523aaefcf66226f3d95ba70d5c431c2ed38fc` |
| `apps/web/tests/archive-action-undo.test.ts` | `4268fe3103ca4233966b3d32eca28cd665584fa0598afa89f901b74652177a23` |

## Protected Gates

Source inspection, automated regression, typecheck, build, and loopback API evidence do not establish rendered behavior. CT-12 must still verify visible names and roles, focus transfer and recovery, pending and failure states, latest-action replacement, long names, responsive geometry, pinned Light/Dark contrast, activity readback, and exact-revision conflict behavior in Chrome. CT-82, CT-3, source-revision, provenance, and accountable-review gates remain open.
