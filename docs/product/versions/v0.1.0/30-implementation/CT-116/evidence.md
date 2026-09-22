# CT-116 Buffered Native Date Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_REVIEW_PASSED`. Project, milestone, and issue native date fields preserve in-progress native segments until an explicit commit boundary, restore invalid or stale drafts safely, and retain confirmed authority after failed mutations.

## Behavioral Matrix

| Case | Result |
| --- | --- |
| Project target from empty | Eight segmented keypresses produced `2026-10-30` while focused with no intermediate mutation |
| Project Enter commit | Blurred and committed exactly once; readback reached revision 5 |
| Milestone target edit | Existing day segment changed to `2026-09-20` without a focused rerender |
| Milestone Save ordering | Buffered blur committed before submit; readback reached revision 3 |
| Invalid partial Escape | Restored authoritative project target with no mutation |
| Invalid partial blur | Restored authoritative project target with no mutation or error notice |
| Full reload | Read back project target `2026-10-30` and milestone target `2026-09-20` |
| Local service outage | Disclosed `Local service unavailable` while retaining the application shell |
| Automatic recovery | Recovered without reload after restart and restored two issues plus the saved view |
| Restart entity readback | Preserved dates, 50% project progress, and both active issues |

## Verification

| Check | Result |
| --- | --- |
| Implementation-focused regression | 4 files / 35 tests passed |
| Independent focused regression | 5 files / 42 tests passed |
| Complete regression | 72 files / 475 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Release audit | 10 / 10 tests passed |
| Production build | 1,952 modules; zero warnings |
| Independent application review | PASS; no findings |
| Exact Chrome exercise | 10 / 10 bounded checks passed at 1440x900 |

## Source Bindings

| Path at `f7c3625` | SHA-256 |
| --- | --- |
| `apps/web/src/buffered-date-input.tsx` | `b5ad5427fe4b02b503a4f8607591c41e41ab05d20511451816a55ad6a59565d8` |
| `apps/web/src/issue-inline-properties.ts` | `ddbd3da124dcd96e64fb57c47ff391d2c4dbbc62a893990a50673749dddff90d` |
| `apps/web/src/issues.tsx` | `aee98ecba555595232dba96fe5aad1200f0a64a930bfa8b5b8ab15d612fe0154` |
| `apps/web/src/native-date-input.ts` | `c73c46c113445de7d2163198400da5fcb407204673cc19c1d6e733e58e98f911` |
| `apps/web/src/projects.tsx` | `204bc677a52628f2447760ffa0d056e63b6d8ecea2f801ce1b87eba216751c11` |
| `apps/web/tests/issue-inline-properties.test.ts` | `cda2a201e2843b5e0a8abbaf3a6bb786ad1bfd00d4f4b442760833fb08316819` |
| `apps/web/tests/issue-properties-inspector.test.ts` | `6066f026812a03828f2e9ab77172373c830906e301af8a2cdbabbc3aa0716366` |
| `apps/web/tests/native-date-input.test.ts` | `ccc2b596b322edd9c7440c0d386bd5419c8692239f5e499fa5211ba8467e3936` |

The sorted eight-file manifest is SHA-256 `1bb4ad20abcff23d1104fb3903528811d99337b86102e7f3896558766c6e001d`.

## Browser And Review Bindings

The tracked 1440x900 JPEG/JFIF readback capture is `evidence/project-milestone-restart-readback-1440x900.jpg`, 71,715 bytes, SHA-256 `af6b63319d604955d0b382561908f015178f854ff80acd6760f6fa0478356c9d`. The private raw browser record is `.control-tower/evidence/CT-116/browser-uat-f7c3625.json`, mode 0600, SHA-256 `a70dafd294c6e1dee1577f24938f794be9cd18cc3e41667c4b9d26bb90121721`.

The independent review receipt is `evidence/independent-review.json`. Its private mode-0600 source is `.control-tower/evidence/CT-116/independent-review-f7c3625.json`, SHA-256 `564cc63ff2134671aef805f5f8de3bca0f2c3b12f1abb06b553f2b71f79a187c`.

The Chrome actor was not independent from implementation, so its observations are bounded verification rather than complete user acceptance. The independent reviewer did not use Chrome. Neither record closes CT-12, CT-82/P-T21, identity/legal, release, publication, or outcomes gates.
