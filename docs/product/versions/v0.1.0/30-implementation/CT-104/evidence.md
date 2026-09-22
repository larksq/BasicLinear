# CT-104 Native Due-Date Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_EVIDENCE_RECORDED`. Native keyboard drafts are preserved, explicit completion commits once, stale authority wins safely, and rejected writes restore confirmed display state.

## Behavioral Matrix

| Case | Result |
| --- | --- |
| Complete populated-date draft | No write while focused; Enter produced exactly one accepted revision |
| Escape | Restored confirmed date, produced no write, and kept issue detail open |
| Authority changes during focused complete draft | Draft remained visible; Enter restored newer authority without writing |
| Rejected write | Forced SQLite lock rejected PATCH; confirmed authority and revision were restored with recovery feedback |
| Initially empty partial date | `09/dd/yyyy`, serialized `value=''`, and `badInput=true` survived an SSE parent rerender |
| Invalid or unchanged blur | Restores authority or performs no write |

## Verification

| Check | Result |
| --- | --- |
| Focused regression | 2 files / 24 tests passed |
| Complete regression | 69 files / 460 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,949 modules / 109 files / 1,912,735 bytes; no warning |
| Release-audit regression | 10 / 10 passed |
| Independent application review | Passed with no remaining finding |
| Independent clean runtime | 21 / 21 structured checks; artifact SHA-256 `4a5b3867a51f7f5e216cd93fe5f12523c81b9d936918216abae78626c06768d0` |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `apps/web/src/issue-inline-properties.ts` | `da835b28f20f1761c72f6ca81aea29de51e938d38bf1558cc49953b3d1b6d04a` |
| `apps/web/src/issues.tsx` | `648255893d99dde3b43577ff43f0580bb1c8787056c023cb433d3f19fd8b780d` |
| `apps/web/tests/issue-inline-properties.test.ts` | `0556b6f41d505833996bcc67dea08b4a4b77589425ac143fa2cb27123eebe4f0` |
| `apps/web/tests/issue-inspector.test.ts` | `666185680dca11f232686db926626bfd8930f55ba816d2641eb40a442705aa9a` |
| `apps/web/dist/assets/issues-CRAD-s4r.js` | `07454f0674f6dea952d23b76aa203bccfb6b69b4d20662b37e4075a62b6129fb` |
| `apps/web/dist/assets/index-BctJbKwJ.css` | `e0ea2eeb3fa0a809bac758b00a2d1f168b49177d831414f7c7eb282fe967e20f` |
| `apps/web/dist/index.html` | `21d57b71d70927ce5cc7fb4144373e978dbb1c93d8f15c551dbdb550b154e255` |

## Current Chrome Captures

The ignored local evidence directory `.control-tower/evidence/CT-104/` contains four current-build captures:

| Capture | Bytes | SHA-256 |
| --- | ---: | --- |
| `inline-due-date-final-dark.jpg` | 63,461 | `18a52401a621727c22240d09db489739feaf48e77217f0cac650ec3fa81196c4` |
| `rejected-write-restored-dark.jpg` | 65,150 | `cd537fc639d6bf78dc52214ddbc1d836ebb026198eb8a87988e53d96a77436ad` |
| `empty-date-partial-before-sse.jpg` | 61,446 | `ac88ebc61d47bb96c5f31446810abf2ecf6a4756dd24598b4bda181b9c285892` |
| `empty-date-partial-after-sse.jpg` | 61,144 | `d45980c1e5196700ab5716f259eadb1092acc1d21f743cd5dbd9e49570496ab6` |

These captures are bounded evidence for the exercised due-date states. They do not establish complete CT-12 workflow, accessibility, responsive, golden, fidelity, or performance acceptance.
