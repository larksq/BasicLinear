# CT-108 Evidence Integrity Session

- Issue: `CT-108`, stable ID `31ce5581-20c9-48e0-8b64-25d26edf056a`, opened at revision `1`, expanded at revision `2`, initially completed at revision `3`, reopened at revision `4`, and completed at revision `5`.
- Session: `CT108-EVIDENCE-20260822T101237Z`.
- Actor: `codex-independent-testing`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, external account, or outbound service was used.

## Finding

A magic-byte scan found 65 tracked v0.1 evidence screenshots and four current private CT-104 screenshots with JPEG/JFIF bytes but `.png` filename suffixes. Nineteen other tracked `.png` files contained genuine PNG bytes. Rendered pixels, byte counts, and recorded SHA-256 values were valid, but the affected media extensions and references were not.

## Resolution

1. Inventoried all affected and genuine PNG files before mutation.
2. Renamed the 69 affected files from `.png` to `.jpg` without transcoding.
3. Rewrote only exact affected paths and basenames in governed Markdown, JSON, JavaScript, and changed-file records.
4. Preserved historical filename dimension labels while recording decoded dimensions separately.
5. Re-ran the verifier against the renamed files and every governed text reference.
6. After a later clean-tree rerun exposed a self-reference false positive, reopened at revision `4`, excluded only the verifier's own historical before/after inventory from resolving-reference checks, and completed again at revision `5`.

## Verification

- Affected files renamed: 69.
- Byte-identical comparisons: 69 / 69.
- JPEG/JFIF files remaining under `.png`: 0.
- Stale affected references: 0.
- Genuine PNG files preserved: 19 / 19.
- Product code, tests, screenshot bytes, rendered pixels, and product revision changed: no.
- Verifier self-reference rerun: pass; the comparison inventory remains evidence, not a resolving file reference.

## Acceptance Boundary

CT-108 closes only the governed evidence media-extension defect. It does not expand CT-12 coverage, qualify a product revision, accept identity/legal risk, authorize release, or claim an outcome.
