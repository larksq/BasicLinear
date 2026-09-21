# CT-126 Evidence

## Scope

The mobile breakpoint previously hid every `.milestone-date`, including the target-date input inside the inline milestone create and edit forms. CT-126 keeps ordinary milestone rows compact while restoring the date control to the mobile create/edit grid.

## Implementation

- Product commit: `9d556212e607108744c6b4a3819cd6bb5c2ba323` (`fix(web): keep mobile milestone target dates editable`).
- Changed files are limited to `apps/web/src/styles.css` and `apps/web/tests/milestone-interactions.test.ts`.
- Mobile inline rows use three content rows: name/description, target date, and issue count. Recovery/error content begins on the following row; action buttons span the editor rows.
- Read-only milestone rows retain the compact two-row mobile layout.

## Verification

- Focused milestone interaction contract: 14/14 tests passed.
- Full suite: 73 files / 481 tests passed.
- Workspace typechecks: 8/8 passed.
- Release-audit regression: 10/10 passed.
- Production build: 1,953 Vite modules, 0 warnings.
- Fresh local Playwright at `http://127.0.0.1:4307`, viewport 390x844: create and edit target-date inputs computed at 212x28px; issue count and actions occupied separate rows with no overlap. A disposable milestone was created with target date `2026-09-20` and reopened; the editor read back that exact value.
- Browser console after the workflow: 0 errors and 0 warnings. Observed network requests were loopback-only (`127.0.0.1:4307`); no external provider, Google account, Linear API, MCP, or remote service was used.

## Boundary

This is a responsive presentation/accessibility correction only. It does not change API, SQLite, schema, owner scope, transfer, authentication, identity, licensing, release, or outcome behavior.
