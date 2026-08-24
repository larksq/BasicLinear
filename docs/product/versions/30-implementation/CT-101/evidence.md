# CT-101 Semantic Text-Token Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_ACCEPTANCE_PENDING`. Every shipped `--ol-*` consumer now resolves to a shared token definition. Recovery correlation IDs and the workflow-status drag handle no longer depend on inherited browser paint.

## Token Contract

| Mode | Subtle-text token | Minimum checked contrast | Emphasis |
| --- | --- | ---: | --- |
| Light | `#6d6e74` | 4.50:1 against Light surface-subtle | Lower contrast than Light muted text on all surfaces |
| Explicit Dark | `#8b8b94` | 4.52:1 against Dark surface-subtle | Lower contrast than Dark muted text on all surfaces |
| System Dark | `#8b8b94` | Same ratios as explicit Dark | Matches explicit Dark exactly |

Light ratios are 5.08:1 against `#ffffff`, 4.75:1 against `#f7f7f8`, and 4.50:1 against `#f1f1f3`. Dark ratios are 5.30:1 against `#171719`, 4.98:1 against `#1d1d20`, and 4.52:1 against `#252529`.

## Preserved Boundary

| Contract | Result |
| --- | --- |
| Semantic graph | Every shipped `var(--ol-*)` consumer has a definition in `packages/ui/src/tokens.css` |
| Existing consumers | Connection correlation ID, query-error correlation ID, and workflow-status drag handle remain on `var(--ol-text-subtle)` |
| Milestone affordance | Unchanged on its existing `var(--ol-text-muted)` contract |
| Other palette | Text, muted text, accent, primary, focus, status, surface, project, label, and user colors unchanged |
| Product behavior | Layout, typography, navigation, workflow behavior, API, SQLite, schema, canonical transfer, authentication, and external services unchanged |

## Verification

| Check | Result |
| --- | --- |
| Focused semantic-token/appearance/recovery/workflow regression | 5 files / 35 tests passed |
| Complete regression | 68 files / 448 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,948 modules / 105 files / 1,890,920 bytes; no warning |
| Release-audit regression | 6 / 6 passed |
| Isolated loopback | `ready` and `live` on port 4281 with a temporary data directory |
| Served assets | `index-DvgrHPGW.js` and `index-BVLPlYtU.css` |
| Served CSS integrity | 3 definitions / 3 consumers / 0 undefined semantic tokens; all 3 expected rules retain the token |
| Rendered Chrome evidence | 0 captures; required Chrome transport remains unavailable before page open |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `packages/ui/src/tokens.css` | `5af4447abe9cad749ed893e4a25bafc33ab0445278170ee5371cdc2e078111fa` |
| `apps/web/tests/semantic-token-integrity.test.ts` | `2f714b8f9de42a97f9e145a6daa6b0cc2daf4fcdeaa71c6f31bde49c2b1fb61b` |
| `apps/web/dist/assets/index-BVLPlYtU.css` | `0d008e16165d7b0916c6651b848e8da13a7a7a9506ecf6396258c34983bf58b9` |
| `apps/web/dist/assets/index-DvgrHPGW.js` | `8dde54cd3c146fdfb9bf6e1c30c0fb8d5fdaeaf5c990bd70ecb67f117b82ba2a` |

## Protected Gates

Source contrast math and served-asset inspection do not establish computed browser paint, hover/focus behavior, wrapping, non-color affordance, or System-mode rendering. CT-12 must execute the current Chrome matrix across accepted viewports in pinned Light, pinned Dark, and live System. CT-82, CT-3, source-revision, provenance, and accountable-review gates remain open.
