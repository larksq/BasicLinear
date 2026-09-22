# CT-117 Implementation Session

- Issue: `CT-117`, stable ID `474ecd99-7266-4dc4-bc53-52d2bf7be92e`, current revision `2`, status `In Progress`.
- Session: `CT117-IMPLEMENT-20260822T204149Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection is disabled and `not_synced`; no Linear API, MCP, or UI was used for tracking.

## Finding

Full-resolution CT-12 review exposed an internal clipping failure that the bounded document-overflow audit could not detect. The issue title accepts 240 characters, but its controlled textarea was fixed to two rows with `overflow: hidden`. A long retained title therefore rendered additional wrapped text outside the visible control and immediately behind the Description section.

## Implementation

1. Added a deterministic `fitTextareaHeight` helper that clears the fixed height before measuring `scrollHeight`, then applies the complete content height.
2. Refit the title after every controlled title change so expansion and shrinkage both use current content.
3. Observed title width changes and refit after direct-route, contextual-panel, and responsive layout transitions.
4. Preserved the existing controlled draft expression, two-row minimum, 240-character limit, title typography, focus paint, disabled/archive behavior, and content-save boundary.
5. Left issue values, API, SQLite, schema, one-owner scope, stable internal scope metadata, canonical transfer, authentication, and collaboration surfaces unchanged.

## Verification

- Focused regression: 4 files / 18 tests passed.
- Complete regression: 73 files / 478 tests passed.
- Typecheck: all 8 workspaces passed.
- Release-audit regression: 10 / 10 tests passed.
- Production build: 1,953 modules with zero warnings.
- Chrome at 1440x900 and 390x844: 6 / 6 bounded checks passed across Light and Dark, including contextual, direct, responsive reflow, shrink-back, and explicit draft cleanup.

## Review Boundary

The implementation actor also ran the bounded Chrome verification. A distinct application review is still required before CT-117 can move to Done or its output can be credited as accepted CT-12 evidence. The new product revision also invalidates prior exact-candidate CT-12 goldens and CT-82 qualification until they are refreshed against `d524c5c`.

## Task Reconciliation

One optimistic project-local update advanced `CT-117@1` to `CT-117@2` without changing its In Progress status. Fresh readback returned store health `ready`, milestone `S3 — Implementation`, provider projection disabled and `not_synced`, 6 active issues, 111 completed issues, and an empty Trash. The private pre-update export is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-22T20-56-14-043Z-1f63754b-1b2b-4c3f-a095-39e360ec04be.json`, mode 0600, 469,954 bytes. Its canonical package digest is `8baa2169184034514b697b85babdd924c476685133e1e036f7efc09e9255dfdd`; the serialized file SHA-256 is `03aac05e5da34ee667f496d1406f28638304a862f9f779043555d88b3360f15e`.
