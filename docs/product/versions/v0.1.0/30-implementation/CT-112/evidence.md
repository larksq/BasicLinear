# CT-112 Board Geometry Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_REVIEW_PENDING`. Every board density now contains one complete title line, metadata, and stable virtual separation in pinned Light and Dark. A distinct application review is pending.

## Verification

| Check | Result |
| --- | --- |
| Focused regression | 3 files / 31 tests passed |
| Complete regression | 70 files / 465 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,949 modules / 105 files / 1,895,747 bytes; no warning |
| Release-audit regression | 10 / 10 passed |
| Chrome density/theme states | 6 / 6 passed |
| Card border-box heights | 90px compact / 102px default / 114px comfortable |
| Title tracks | 24px compact/default / 28px comfortable; line-height 16.2px |
| Virtual separation | Exactly 6px in all six states |
| Geometry failures | 0 title, metadata, overlap, containment, or viewport-overflow failures |
| Independent application review | PENDING |

## Source Bindings

| Path at `7665027` | SHA-256 |
| --- | --- |
| `apps/web/src/issues.tsx` | `bd8fd2ff5c80acebc00a05bb88f00a53b283f5182b9b22b8cbe446c9b4110e26` |
| `apps/web/src/styles.css` | `c1ed94e3fbe63874753dca1ac89874c013fa8898e0c0d29089f295271e34ed0d` |
| `apps/web/tests/issue-loading-geometry.test.ts` | `432226eb5b3547df259556602781d283044727d9a1ca7ce7945618b1cbc1aba1` |

`evidence/geometry.json` contains every per-card measurement. Two before captures preserve the clipped default state; six after captures preserve all density/theme states. The after default captures are also the current CT-12 golden board images.

This evidence establishes bounded implementation output only. It does not provide independent review, complete CT-12 acceptance, fresh P-T21 qualification, or release authority.
