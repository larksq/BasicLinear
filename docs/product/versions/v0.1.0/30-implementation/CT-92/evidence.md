# CT-92 Query-Recovery Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_ACCEPTANCE_PENDING`. Initial core read failures now replace unknown results with one local retry state, while stale data remains usable and mutation errors stay contextual.

## Behavior

| Surface | Blocking failure | Stale-data failure | Retry scope |
| --- | --- | --- | --- |
| Owner context | Replaces the workspace result area | Preserves reachable workspace content | Only failed teams, memberships, or statuses reads |
| Command search | Replaces result content | Preserves existing results | Search query only |
| Projects | Replaces list, detail, milestones, or activity result | Preserves available data | Exact failed project query |
| Saved views | Replaces the collection result | Preserves available rows | Saved-view query only |
| Issues | Replaces list or primary detail result | Preserves available rows/detail | Only failed list dependencies or issue query |
| Issue subsections | Replaces relationships, comments, milestones, or activity subsection | Preserves available subsection data | Exact failed subsection query set |
| Empty states | Hidden until the collection read succeeds | Remain available for confirmed empty data | Not applicable |
| Mutation feedback | Remains at the initiating control or editor | Not conflated with initial reads | Existing mutation recovery |

## Verification

| Check | Result |
| --- | --- |
| Focused tests | 1 file / 5 tests passed |
| Complete regression | 59 files / 404 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,947 modules / 109 files / 1,870,112 bytes; no warning |
| Release-audit regression | 6 / 6 passed |
| Loopback readiness | `ready` on port 4275 |
| Served candidate | Current generated JavaScript and CSS asset names returned |
| Rendered Chrome evidence | 0 captures; blocked before page open |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `apps/web/src/components.tsx` | `23f7d04bafad0b6ac3dd11a5c21a4f36c1ca4aa7d93c55315cdd354fb786df20` |
| `apps/web/src/App.tsx` | `27f34995a11da91ba5a183a24225aad76dfab01aee5a1e6ef28fa240c3a253dc` |
| `apps/web/src/projects.tsx` | `cf9b934b51b63c54b4e8fc677e66a933631b7d1b48fabd62c2773b78b7e5fb17` |
| `apps/web/src/issues.tsx` | `e3b7830339a7c5b041ce5d8a0c96c02942471957bb508031421b1dce34d18ad5` |
| `apps/web/src/saved-views.tsx` | `f09a69e6d401a174907023ec1afbdd0b8af547003b4a615bf47d0d11c2f64587` |
| `apps/web/src/styles.css` | `5c5f7aa2d937a7f8d9fa3f58209927e68ac7ce17c50a45121efe2078351cbad6` |
| `apps/web/tests/query-error-recovery.test.ts` | `5be35242cd128ecf28bd8314b769927c5b056a3bc25bca2e771fae5a1d0d7610` |

## Protected Gates

No rendered acceptance is inferred from source inspection, tests, typechecks, build output, loopback health, or served HTML. CT-12 must inject initial and stale failures, verify exact retry behavior, focus order, announcements, long diagnostics, restored data, responsive geometry, and pinned Light/Dark contrast in Chrome. CT-82, CT-3, source-revision, provenance, and accountable-review gates remain open.
