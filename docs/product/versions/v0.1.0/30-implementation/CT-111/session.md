# CT-111 Implementation Session

- Issue: `CT-111`, stable ID `448bd793-c0f7-4d72-b4cb-fcea8016c926`, created at revision `1`; expected evidence synchronization revision `2`.
- Session: `CT111-IMPLEMENT-20260822T111513Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, account state, or external runtime service was used.

## Finding

TipTap normalizes a focused empty editor from an empty document to an empty paragraph. Byte-shape comparison treated that normalization as meaningful content, so 44 keyboard Tabs without typing created an `Unsaved draft retained` banner.

## Implementation

1. Added semantic empty-document comparison for issue content drafts.
2. Treated empty paragraphs and whitespace-only editor normalization as server-equivalent empty content.
3. Preserved meaningful text and structural-content dirtiness plus independent content/comment pruning.

## Verification

- Focused regression: 1 file / 7 tests passed.
- Current complete regression: 70 files / 465 tests passed.
- Typecheck: all 8 workspaces passed.
- Release-audit regression: 10 / 10 tests passed.
- Production build: 1,949 modules, 105 governed runtime files / 1,895,747 bytes, without warnings.
- Chrome 151 at 1440x900: discard then reload produced zero retained-draft banners; 44 real Tabs focused the empty named description editor without creating a banner; meaningful input created exactly one retained draft; explicit discard returned the count to zero.

## Review Boundary

Implementation output is complete at source revision `1e960558bba51413657f75391478e56ddbdac275`, and the current `7665027` regression remains green. A distinct application review is still required, so CT-111 remains In Progress and this handoff does not enter Testing. No release or outcome claim is made.
