# CT-57 Implementation Session

- Issue: `CT-57`, stable ID `d14f5128-4c15-43e9-96a0-8b34f2e12204`, implementation revision `1`.
- Implementation session: `codex-workspace-navigation` / `CT57-IMPL-20260820T152802Z`.
- Scope: make the selected accessible workspace URL-authoritative and prevent issue, project, milestone, saved-view, filter, grouping, selection, or contextual-history state from crossing a workspace boundary.
- Allowlist boundary: `workspaceIdFromSearch` accepts only IDs already present in the authenticated session. A missing parameter uses the first accessible workspace for legacy-link compatibility. An inaccessible parameter falls back without probing any provider or disclosing membership data.
- URL boundary: canonical workspace selection preserves the current destination and unrelated fixture or OIDC markers. A real or invalid workspace change clears every workspace-local surface parameter before the new workspace renders.
- History boundary: selector changes push one clean history entry. Back and Forward restore both workspace and surface state. Invalid workspace entries are replaced with a clean fallback entry and contextual issue/project history markers are discarded.
- Component boundary: Projects, Issues/My work, and Views remount on an authenticated workspace change. Their request signals, dialogs, command state, recents, and transient open targets reset at the same boundary.
- Identity boundary: an optional OIDC account-link return now includes the active workspace, while first login remains provider-independent and selects from the returned authenticated session.
- Automated result: two focused files and 20 tests pass, all 37 files and 232 complete tests pass, all eight workspaces typecheck, fixture syntax passes, and the 1,932-module production build passes without a chunk warning.
- Database boundary: CT-57 changes only web navigation, tests, and the synthetic fixture. Production API, repository, schema, migration, authorization, and RLS paths are unchanged; no new database pass is claimed.
- Fixture boundary: the first detached port-4182 launch did not survive its shell and six connection checks failed. A managed retry started the exact production build; HTML, a two-workspace session, the secondary team, the empty secondary project list, and the primary project returned their expected responses, while the primary project through the secondary workspace returned HTTP 404.
- Browser boundary: no screenshot or rendered interaction assertion is claimed because the approved local browser surface remains unavailable under the active security policy.
- Authority boundary: project-local Control Tower v0.8 is the sole issue and milestone authority. No Linear API, Linear MCP, or Linear UI was used for tracking.
- Status boundary: CT-57 remains In Progress pending independent browser/UAT evidence. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-005 remain pending.
