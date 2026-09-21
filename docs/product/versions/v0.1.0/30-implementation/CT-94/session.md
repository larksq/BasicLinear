# CT-94 Implementation Session

- Issue: `CT-94`, stable ID `a21ebb3f-ba73-4a9e-8d45-c3e3a08a3ca5`, created at revision `1`, scoped at revision `2`, intended completion revision `3`.
- Session: `CT94-IMPLEMENT-20260821T115821Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Docker, PostgreSQL server, remote service, external identity, or Google account was used.

## Finding

The accepted context-retention contract requires unsaved issue content to survive detail navigation. The title and description draft lived below the remount boundary and was discarded on close or issue change; resource edits were reset on issue ID. New-comment state had the opposite failure: it lived in an unkeyed detail component, was not reset for a new issue, and could be submitted under the wrong issue. Route and panel detail instances were also not identity-keyed, allowing transient feedback to cross issue context.

## Implementation

1. Added a pure in-memory registry for per-issue content and new-comment drafts with server-equivalent and empty-state pruning.
2. Bound the registry to the active workspace so a prior-workspace record is unreachable during a workspace change.
3. Converted issue title, description, and resources to one controlled content draft above the detail remount boundary.
4. Bound new-comment rendering and submission to the selected issue's draft and blocked empty submissions.
5. Keyed route and panel detail instances plus comment editors by workspace and issue identity.
6. Preserved matching drafts across close/reopen, relation navigation, browser Back, responsive remount, and CT-93 cached-workspace interruption behavior.
7. Cleared only the matching content, comment, or whole-issue record after save, explicit discard, or purge.
8. Preserved confirmed-revision conflict recovery and locked editors while a mutation or conflict state is active.
9. Made resource cancel restore server resources without discarding unrelated title or description changes.
10. Added one compact retained-draft status with explicit content/comment discard actions and stable desktop/mobile layout.

## Verification

- Focused draft registry and binding regression: 1 file, 6 tests passed.
- Related conflict, navigation, comment, and service regression: 4 files, 33 tests passed.
- Complete regression: 61 files, 416 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,948 modules, 105 output files, and 1,860,412 output bytes, without warnings.
- Release-audit regression: 6 of 6 tests passed.
- Loopback readiness: `{"status":"ready"}` at port 4275; the served page references `index-BpZUTt6k.js` and `index-Bg1fPRCx.css`.
- Rendered browser captures: 0.

## Acceptance Boundary

Source, unit, typecheck, build, and loopback evidence establish only the bounded implementation. Chrome extension transport remained unavailable on the eighth cumulative connection attempt, before any page opened. No navigation restoration, cross-issue isolation, discard focus, responsive geometry, contrast, or visual-fidelity claim was produced. CT-12 owns rendered acceptance; CT-82 owns independent clean-revision runtime acceptance; CT-3 owns public identity, final-brand, license, and clean-room review; CT-13 owns accountable release acceptance.
