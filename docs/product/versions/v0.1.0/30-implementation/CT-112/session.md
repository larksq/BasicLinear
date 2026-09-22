# CT-112 Implementation Session

- Issue: `CT-112`, stable ID `6bc35315-4b0d-4795-9f91-82d38f3ce426`, created at revision `1`; expected evidence synchronization revision `2`.
- Session: `CT112-IMPLEMENT-20260822T113821Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, account state, or external runtime service was used.

## Finding

Default issue-board cards at `1e96055` measured 86px and resolved their rows to `24px / 8px / 20px`. The title line-height was 16.2px, so every visible title was internally clipped even though document overflow remained zero.

## Implementation

1. Added one density-to-virtual-item contract: 96px compact, 108px default, and 120px comfortable.
2. Kept a fixed 6px virtual separation, producing 90px, 102px, and 114px card border boxes.
3. Reserved a 24px action header, at least 17px for the title, and 20px for metadata, with density-specific padding and gaps.
4. Bound loading skeleton heights and regression tests to the same final card geometry.

## Verification

- Focused regression: 3 files / 31 tests passed.
- Complete regression: 70 files / 465 tests passed.
- Typecheck: all 8 workspaces passed.
- Release-audit regression: 10 / 10 tests passed.
- Production build: 1,949 modules, 105 governed runtime files / 1,895,747 bytes, without warnings.
- Chrome 151 at 1440x900: all 10 visible cards passed in compact, default, and comfortable modes in pinned Light and Dark. Card heights were exactly 90/102/114px, titles exposed 24/24/28px content tracks against a 16.2px line-height, metadata stayed inside, title and metadata never overlapped, inter-card gaps were exactly 6px, and document overflow was zero.
- The current 20-screen Light/Dark golden tranche was recaptured after the fix.

## Review Boundary

Implementation output is committed at `7665027c0266fa5f0be0070dd75c2541959a9eb5`. A distinct application review is still required, so CT-112 remains In Progress and this handoff does not enter Testing. CT-12 remains at 20/60 named captures and current P-T21 qualification is pending. No release or outcome claim is made.
