# CT-117 Long Issue Title Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_REVIEW_PENDING`. The issue title now expands and shrinks to its complete content height and remeasures when the detail width changes. A distinct application review remains open.

## Exact Source

| Binding | Value |
| --- | --- |
| Revision | `d524c5c7eff38664bad7b8fb612283f2e2092563` |
| Tree | `4c5e21bbf45386f11face5c034dd433b663d14e0` |
| Parent | `4ec13058390b413c55070b05c6d73a289b596572` |
| Served main asset | `assets/index-DtJuzGa7.js` |
| Three-file manifest SHA-256 | `520a07cdfc05a04a6186be7485191c53ea84d5997227d1013ae51583a1ec30dc` |

## Browser Geometry

| Surface | Appearance | Viewport | Font | Client / scroll height | Gap to Description | Overflow | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Contextual panel | Light | 1440x900 | 20px | 135 / 135px | 23px | 0px | Pass |
| Direct detail | Light | 1440x900 | 24px | 130 / 130px | 31px | 0px | Pass |
| Direct responsive reflow | Light | 390x844 | 21px | 198 / 198px | 31px | 0px | Pass |
| Mobile shrink-back | Light | 390x844 | 21px | 66 / 66px | not applicable | 0px | Pass |
| Direct detail | Dark | 1440x900 | 24px | 130 / 130px | 31px | 0px | Pass |
| Draft cleanup | Dark | 1440x900 | 24px | server title restored | not applicable | 0px | Pass |

Every long-title surface used the full 240-character value. Visual inspection found no clipped glyph, title/Description overlap, or unintended document overflow. Discard restored `Stop issue board density cards from clipping titles` and removed the retained-draft banner without a server mutation.

## Tracked Captures

| Capture | Bytes | SHA-256 |
| --- | ---: | --- |
| `evidence/contextual-long-title-1440x900.jpg` | 111,916 | `320899245052e2a9a9e0651fd53a5c5bdea90011df0e6319180fa34f9c6ff0b9` |
| `evidence/direct-long-title-1440x900.jpg` | 82,709 | `fbb093f4f800ccc05d78257a0afcd0205d4ddf52f752c43bb423300f7d20360b` |
| `evidence/direct-long-title-390x844.jpg` | 43,453 | `5ae38deb1051b1334e3354d5be528e8ae657c5bb83052a72a03d98da1a0ddb9b` |
| `evidence/direct-long-title-dark-1440x900.jpg` | 81,546 | `aec215a50a02c73e95375177e17c818ee7a16890525394f14948142e89b3883b` |

The private raw receipt is `.control-tower/evidence/CT-117/browser-uat-d524c5c.json`, mode 0600, 5,918 bytes, SHA-256 `acea3121c019676ed16ea3f0bde4b09867e61c63dcfea11e775c562e08358344`.

## Automated Verification

| Check | Result |
| --- | --- |
| Focused regression | 4 files / 18 tests passed |
| Complete regression | 73 files / 478 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Release audit | 10 / 10 tests passed |
| Production build | 1,953 modules; zero warnings |
| Git diff check | Passed |

## Local Task Readback

The reviewed Control Tower v0.8 runtime applied one revision-checked update and returned `CT-117@2`, In Progress, stable ID `474ecd99-7266-4dc4-bc53-52d2bf7be92e`, milestone `S3 — Implementation`, store health `ready`, and provider projection disabled / `not_synced`. The private pre-update backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-22T20-56-14-043Z-1f63754b-1b2b-4c3f-a095-39e360ec04be.json`, mode 0600, 469,954 bytes. The export's canonical package digest is `8baa2169184034514b697b85babdd924c476685133e1e036f7efc09e9255dfdd`; its serialized file SHA-256 is `03aac05e5da34ee667f496d1406f28638304a862f9f779043555d88b3360f15e`.

## Boundaries

The Chrome actor was the implementation actor, so this is bounded verification, not independent acceptance. CT-117 remains In Progress pending distinct review. CT-12 complete acceptance, refreshed exact-candidate goldens and performance, CT-82/P-T21 requalification, CT-3 identity/legal review, CT-13 accountable release review, publication, and outcomes remain separate gates.
