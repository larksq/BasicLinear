# CT-27 Browser-Tool Artifact Exclusion Evidence

## Verdict

`OUTPUT_DONE_FOR_CT13`. Generated `.playwright-mcp` state is now outside the public source candidate, container context, deterministic digest, private scan, and provenance inventories.

## Finding

The CT-26 provenance refresh reported 402 candidate files. The local `.playwright-mcp` root contained 50 generated records: console logs were incidentally excluded by the broad `*.log` rule, while YAML page snapshots were still walked by the release audit. Page snapshots can contain rendered application text or other local browsing state, so their inclusion contradicted the stated release boundary even though the current synthetic records did not trigger a high-confidence secret signature.

## Correction

- `.gitignore` excludes `.playwright-mcp/`.
- `.dockerignore` excludes `.playwright-mcp`.
- `ops/release/audit-policy.json` treats `.playwright-mcp` as an ignored root and requires both ignore-file entries.
- The release-audit fixture creates `.playwright-mcp/page.yml` containing a dynamically synthesized GitHub-token-shaped value. The complete clean fixture still returns `READY`, proving the generated root is not walked or scanned.

## Verification

| Check | Result |
|---|---|
| Generated browser files observed | 50 |
| Candidate before correction | 402 files |
| Candidate after correction, before attaching this evidence bundle | 352 files |
| Generated records removed from candidate | 50 |
| `git check-ignore` | `.playwright-mcp/page-2026-08-20T02-30-41-559Z.yml` matched `.gitignore:8` |
| Release-audit regression | 1 file, 2 tests passed |
| Project preflight | Expected exit 1; `NOT_READY`, 5 PASS / 3 FAIL / 6 BLOCKED |
| Provenance inventories | 64 assets; 13 public-copy files |
| Browser-tool paths in written preflight | 0 |
| Private scan | PASS; 0 private artifacts, 0 high-confidence secret indicators, 0 symlinks |
| Private-path contract | PASS; 0 missing ignore entries |

The source count and digest are expected to move once this five-file CT-27 evidence bundle is attached. CT-13 owns the subsequent stable candidate binding; CT-27 proves the exclusion delta and control behavior rather than claiming a self-referential final digest.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-015 | Generated browser state is excluded before private-artifact and provenance review, so local page snapshots cannot silently become public release inputs. |
| R-108 | The release manifest's ignore contract now explicitly covers browser-control output in both source and container contexts. |

## Privacy And Authority

The regression secret-shaped value is synthesized at runtime and never appears as a literal credential in repository source. No generated page snapshot was copied into project evidence or inspected for product content. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This closes CT-27 implementation output only. It does not approve any asset or public-copy record, accept third-party distribution classification, select a license or public identity, pass P-T21, authorize a release, or validate O-005.
