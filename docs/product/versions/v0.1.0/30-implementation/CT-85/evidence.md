# CT-85 Legacy Transfer Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_TESTING_PENDING`. Legacy canonical compatibility is now proven with a deterministic server-free document. Ambiguous scope fails before any target directory or SQLite file is created.

## Automated Evidence

| Check | Result |
| --- | --- |
| Fixture canonical SHA-256 | `000473521838884d216ef7ad87185a94b8400fcf488add218722d0a88d120772` |
| Fixture scopes | 2 workspaces; 1 team per workspace |
| Fixture selected records | 19 |
| Ambiguous import | `AMBIGUOUS_SCOPE`; no target directory |
| Source immutability | Byte-identical before and after rejected and selected imports |
| Selected digest parity | `5f35bf5f1b8cb00c808d043d1ef31fd03e0a6b022ca43095be1f1b700683f128` |
| Selected database | schema 2; integrity `ok`; 0 FK violations; `0600` |
| Runtime identity surface | No OIDC/session tables; no owner `password_hash` column |
| Legacy secret payload | Password hash and OIDC issuer bytes absent from SQLite and workspace export |
| Focused regression | 2 files / 15 tests passed |
| Complete regression | 56 files / 387 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,946 modules / 1,027,388 bytes |
| Release audit | 2 / 2 tests passed |

## Built Operator Rehearsal

The 19,321-byte canonical source file retained SHA-256 `3bbd2aeebf83148d48bf6eba986fdbc1cd4203829e6aea0311d72752f8d3222c` across both runs. The ambiguous run created nothing beside that source. Explicit selection produced a 225,280-byte SQLite file and a 9,086-byte canonical workspace export; both reported the selected digest above. The database SHA-256 was `3eacc0b54a088f3a7aeece7ff578ae404fe87af96182560f5bc9e11da7bc2955`; export SHA-256 was `3ba4957472e1bf1e655a7a9e493e7d464c92a3fd630c8f0bf3f8fcdb0e8c7198`.

The fixture models the last accepted legacy transfer schema. It does not require or emulate a PostgreSQL process, and it is not a supported second runtime. Independent CT-82 acceptance remains open.

Control Tower readback is healthy: `CT-85 Done@2`, `CT-82 Todo@3`, and `CT-12 In Progress@61`. Project totals are 6 active, 79 completed, and 0 trashed issues; provider projection remains disabled and `not_synced`.
