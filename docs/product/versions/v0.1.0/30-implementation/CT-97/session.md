# CT-97 Implementation Session

- Issue: `CT-97`, stable ID `ed817f4a-5730-4ddf-8c12-4d4a7672f8a0`, created at revision `1`, scoped at revision `2`, initially completed at revision `3`, with final announcement-integrity evidence expected at revision `4`.
- Session: `CT97-IMPLEMENT-20260822T022932Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Docker, PostgreSQL server, remote service, external identity, or Google account was used.

## Finding

OpenLinear already kept archived records recoverable in Archive and returned a revisioned record from each archive request. Individual archive actions did not expose immediate visible Undo, despite the product definition requiring undoable routine destructive work. Issue row actions announced only to assistive technology, while project and milestone actions refreshed without a named result.

## Implementation

1. Added one reusable full-width archive-action status band with named Undo and dismiss controls, busy state, and distinct restore-failure alert semantics.
2. Stored the exact server-returned archived issue, project, or milestone in the notice state and passed it unchanged into the existing revisioned restore request.
3. Wired individual issue detail, issue list/board, project detail/list, and milestone row archive paths without changing bulk archive or other record types.
4. Cleared old feedback when a newer direct action starts so only the latest successful archive remains undoable.
5. Moved focus to Undo after records leave the current collection and restored focus to the active record or detail action after restore.
6. On failed Undo, removed the stale retry target, refreshed authoritative reads, used error semantics, and retained an explicit Archive recovery path.
7. Preserved existing dependent-query and activity invalidation after every archive and restore.
8. Added responsive geometry and one focused source-contract regression covering semantics, exact-returned-revision wiring, focus, failure, activity refresh, and bulk-path separation.
9. Suppressed the legacy screen-reader archive announcement and raw Undo error banner when the new band is authoritative, preventing duplicate success and failure announcements.

## Verification

- Focused archive-Undo regression: 1 file, 5 tests passed.
- Complete regression: 64 files, 433 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,948 modules, 109 output files, and 1,909,264 output bytes, without warnings.
- Release-audit regression: 6 of 6 tests passed.
- Isolated production process: `ready` at port 4277, serving the rebuilt HTML, `index-BUssPdd9.js`, `issues-LuOFvO4C.js`, `projects-BaNxg1vc.js`, and `index-1-OhQ1dB.css` from a temporary local data directory while the existing ports 4275 and 4276 remained untouched.
- Live API workflow retry history: the first synthetic write omitted the required same-origin header and was correctly rejected with HTTP 403; the corrected same-origin workflow then archived and restored a project, milestone, and issue at revisions `1 -> 2 -> 3` each.
- Rendered browser captures: 0.

## Acceptance Boundary

Repository, source, automated regression, typecheck, build, and loopback evidence establish only the bounded implementation. Chrome extension transport remains unavailable after ten cumulative attempts and no current page was opened. No visible notice, focus, responsive, contrast, or pixel-fidelity claim is produced from non-rendered evidence. CT-12 owns rendered acceptance; CT-82 owns independent clean-revision runtime acceptance; CT-3 owns public identity, final-brand, license, and clean-room review; CT-13 owns accountable release acceptance.
