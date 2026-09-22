# CT-89 Release Provenance Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_ACCOUNTABLE_REVIEW_PENDING`. The three provenance controls are technically complete and fail closed as `BLOCKED` until a named reviewer approves the exact hash-bound evidence.

## Contract Evidence

| Check | Result |
| --- | --- |
| Lockfile dependency coverage | 252 of 252 records classified |
| Missing declared licenses | 0 |
| Distribution scopes | 125 runtime, 48 development, 5 optional runtime, 73 optional development, 1 peer |
| Inventory evidence | 180 local license/NOTICE, 4 declared-license-only, 68 not installed on inventory host |
| Asset provenance | 82 of 82 technically complete; reviewer pending |
| Public-copy provenance | 43 of 43 technically complete; reviewer pending |
| Changed approval behavior | Resets to pending with null reviewer |
| Unchanged valid approval behavior | Preserved |
| Generator-created approval | Prohibited and regression-tested |
| Focused regression | 1 file / 6 tests passed |
| Complete regression | 56 files / 389 tests passed |
| Typecheck | 8 of 8 workspaces passed |
| Production build | 1,946 modules; warning-free |
| Real release audit | `NOT_READY`; 6 PASS / 0 FAIL / 8 BLOCKED |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `scripts/prepare-third-party-notices.mjs` | `0b1740385f95b8ff3c25828fdf4c6ac6e22da46564d7c6b00eea837fdc572686` |
| `scripts/prepare-release-provenance.mjs` | `d62b23da4efb4e1e663e93e0897e5c11d9907c5cb7eec5562eadcbec982bb875` |
| `scripts/audit-public-release.mjs` | `ffb8f16579d1c18cf53338c232ac4377a4ba48a4486c88c5ab896a153c463ac8` |
| `scripts/tests/audit-public-release.test.mjs` | `12dd3f36265563185b7256abe9c71963b13dc1536aaf62828cb8fff94e023916` |
| `THIRD_PARTY_NOTICES.md` | `ed6c5cd3eabb887c415d971a74479272751cb6e3c1268e9cfd7e66620b5002b2` |
| `ops/release/third-party-notices.json` | `6e4c2ea4cb64e5c1d7272b71d85deae7ccec39cc8ae098c36f1912562dfeb319` |

The final asset and copy manifests bind every current inventory entry and record the full source-set digest. The canonical real-audit source binding is `docs/product/versions/v0.1.0/50-outcome-review/CT-13/result.json`.

## Protected Gates

All technical provenance failures are resolved. The expected nonzero audit exit remains because source revision, CT-3 identity clearance, working-name disposition, notice review, asset review, copy review, CT-82 independent clean-runtime qualification, and CT-13 accountable release acceptance are still blocked. No approval or release claim is inferred from technical completeness.
