# CT-123 Implementation Evidence

Commit `e1299af1bd06f7438f5010c6f6c030760c5a1dfb` consumes explicit null issue-route signals, rehydrates the canonical list URL and view state, clears pushed-entry bookkeeping, and preserves the mounted per-issue draft registry.

In exact Chrome, clicking Primary navigation > Issues from contextual OL-12 removed the issue parameter and closed detail. The same action from a direct board/search OL-12 URL restored the canonical default list, removed both the issue and query parameters, and closed detail. Reopening OL-12 displayed `Unsaved draft retained` with the exact draft value. The title was restored to `P18 contextual milestone issue`, the draft banner cleared, and the detail was closed.

Focused regression passes 3 files / 23 tests; complete regression passes 73 files / 481 tests; all eight workspaces typecheck; release-audit regression passes 10/10; and the warning-free build transforms 1,953 modules. Raw evidence is mode 0600 at `.control-tower/evidence/CT-118-123/implementation-e1299af.json`, SHA-256 `3e2a81e8c0c03ad756af56591d5dedf10c772a47696de7ba5235693db38082a9`.

CT-123 remains In Progress pending distinct application review. Browser Back, API, SQLite, schema, owner scope, transfer, identity, collaboration, release, and outcomes remain outside this acceptance claim.
