# CT-86 Release Audit Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_RELEASE_REVIEW_PENDING`. The supported direct single-process launcher is now hash-bound and accepted by P-T22 without relaxing the local-runtime topology.

## Contract Evidence

| Check | Result |
| --- | --- |
| Runtime topology | `single_node_loopback_sqlite` |
| Manifest start command | `node apps/api/dist/index.js` |
| Root start command | Exact manifest match |
| Container command scan | No root script beginning with `compose:` |
| Manifest input bindings | 5 of 5 hashes match |
| Package drift fixture | Rejected with `start_command_mismatch` |
| Unsupported manifest fixture | Rejected with `unsupported_start_command` and `start_command_mismatch` |
| Focused regression | 1 file / 3 tests passed |
| Complete regression | 56 files / 387 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,946 modules / 1,027,388 bytes |
| Real release audit | `NOT_READY`; 5 PASS / 3 FAIL / 6 BLOCKED |
| Reproducible build control | PASS; 0 mismatches |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `scripts/audit-public-release.mjs` | `4de4f70b15a985b46d4e48e497c75346bbc6be501c6faad4d273ca561bb4a5ba` |
| `scripts/tests/audit-public-release.test.mjs` | `7a1ee514d0a9f6143f4ba901f44f3ecfb3dbce1a53870129a3002e0378e332dd` |
| `ops/release/reproducible-build.json` | `a381d8ee94bcd593deeb7842a8eaa5f53b62e8d2c4fc1f051f316849601bfccb` |

The build manifest binds `package.json` to `0fad2001605b682cb6fb7dcd7a13b59ce2d51aa6e60513846933c27103e2329b`; all other declared inputs retain their verified hashes.

## Protected Gates

The expected nonzero audit exit is retained because the candidate is not releasable. Dependency inventory, private-path controls, private-artifact scan, contribution/security policy, and reproducible-build inputs pass. Notice review, asset provenance, and copy provenance fail. Source revision, public identity decision, working-codename removal, project license, independent clean-user runtime, and accountable release review remain blocked.
