# CT-108 Evidence

## Automated Proof

`evidence/media-rename-verification.json` records the complete before/after inventory for all 69 renamed files. Each comparison includes the old path, new path, media type, decoded width and height, byte count, SHA-256, and byte-identity decision.

The repository-local verifier is `verify-evidence-media.mjs`. Its accepted postcondition is:

| Check | Result |
|---|---:|
| Renamed JPEG/JFIF captures | 69 |
| Byte-identical comparisons | 69 / 69 |
| JPEG/JFIF under `.png` | 0 |
| Stale governed references | 0 |
| Genuine PNG files preserved | 19 / 19 |
| Governed JSON documents parsed | 323 / 323 |
| `git diff --check` | PASS |
| Overall verdict | PASS |

The stale-reference scan excludes only `evidence/media-rename-verification.json` itself because that audit record intentionally preserves each historical before path beside its corrected after path. All other governed text remains in scope.

The exact-reference rewrite is implemented by `rewrite-evidence-media-references.mjs` and is driven by the private pre-rename inventory at `.control-tower/evidence/CT-108/pre-rename.json`. The private post-run copy is `.control-tower/evidence/CT-108/post-rename.json`.

## Integrity Boundary

The rename changed directory entries and textual references only. Every screenshot retained its original bytes and SHA-256. The verifier makes no claim that viewport labels embedded in historical filenames equal decoded historical dimensions; actual decoded dimensions are explicit in the comparison records.

No product source, test, runtime input, API, SQLite record, owner-scope metadata, canonical transfer field, browser state, or external service was changed.
