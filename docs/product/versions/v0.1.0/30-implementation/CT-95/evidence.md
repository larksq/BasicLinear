# CT-95 Confirmed Project-Purge Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_ACCEPTANCE_PENDING`. OpenLinear now provides the planned irreversible project-purge boundary after recoverable archive. The exact-name, revision-checked owner action permanently removes only the archived project plus its milestones and resources; every referenced active or archived issue survives with project and milestone references cleared in the same SQLite transaction.

## Behavior

| Contract | Implemented behavior |
| --- | --- |
| Capability | `project:purge` is available only to the owner in the retained internal role metadata. |
| Preconditions | The project must be archived, its expected revision must be current, and confirmation must exactly match the project name. |
| Issue preservation | Active and archived issues retain identifier, title, labels, relations, comments, archive state, and other fields while `projectId` and `milestoneId` become null. |
| Atomicity | Issue detach revisions and activity, project purge activity, idempotency cleanup, and project deletion occur inside one serialized SQLite write. |
| Cascades | Existing foreign keys remove the purged project's milestones and resources only after issue references are detached. |
| Receipt | The response names the purged project and reports detached issue count, removed milestone count, and purge timestamp. |
| UI reachability | A distinct danger action appears only on archived project detail for an owner and opens one exact-name confirmation dialog. |
| Recovery | Wrong confirmation, active project, stale revision, wrong workspace, and unavailable capability paths leave product records unchanged. |
| Feedback | Success closes the invalid detail route, focuses the retained project list search, refreshes dependent reads, and exposes a visible issue-preservation summary. |
| Scope | No schema, Docker, remote service, storage engine, or canonical transfer format changed. |

## Verification

| Check | Result |
| --- | --- |
| Focused and related tests | 6 files / 31 tests passed |
| Complete regression | 62 files / 422 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,948 modules / 109 files / 1,890,839 bytes; no warning |
| Release-audit regression | 6 / 6 passed |
| Loopback readiness | `ready` on port 4275 after loading the rebuilt API process |
| Served candidate | `index-D8DnNmXI.js` and `index-_71zhCk-.css` returned |
| Rendered Chrome evidence | 0 captures; transport remains unavailable before page open |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `packages/domain/src/index.ts` | `c516dc0f5223f949c092a936d06dd5951e12089bd5adbb740b533f45d11f256b` |
| `packages/domain/tests/domain.test.ts` | `9db08389c940487d45b0d7b5b4d43f3a0b0f4deac2aeda974423cc7c9cabed16` |
| `packages/contracts/src/index.ts` | `e5c3fdf87c7f716f0874b476727d99cdfeafe782670749824e2d299c0f0f5030` |
| `packages/db/src/types.ts` | `ff468006a420b91f20bdb88059431066d82251904718cfd409614b5e5a0a1e85` |
| `packages/db/src/sqlite/index.ts` | `b82cd62558625941d977bec00dba76af40e02e7117f65b71bdb4369d29aa2a52` |
| `packages/db/src/sqlite/project-repository.ts` | `41928631e7c38be980f8ef627e003fb3236715a410c9f4fb8f9a0fdcff3feeb4` |
| `packages/db/tests/sqlite.test.ts` | `214f4ffdb0e1d43ef66f87817451d2849e45adab01aea5c81e3fb1c086753e80` |
| `apps/api/src/app.ts` | `01d7584c9cf04356b704659fe163b1352611b3dc95870fd86f5cabf0c90778db` |
| `apps/api/tests/sqlite.test.ts` | `32458f701d43383d604a2cd4de4be50ed00265c9d8a8d9e6c1c60e7668b85e63` |
| `apps/api/tests/validation.test.ts` | `57d3b311c0022d4fac5759ec7a5fecd8659bd95201fa749e6aa77dd2e9e56d4c` |
| `apps/web/src/api.ts` | `cf8d83fb79f7dbc55f685577331e5b8dd6677b7e428f022c414564e17feeb02b` |
| `apps/web/src/projects.tsx` | `92081b9b4a6e48ba9b1020e0c36d84eb6f4ccb8fd9652dac0b803cf4a9fca031` |
| `apps/web/src/styles.css` | `f3f362b3d8d87fe94fd86b34fdf794dd37bd5f60c1950685cc4f761477f71a7c` |
| `apps/web/tests/project-purge.test.ts` | `8e6c77ccf2275508fa2ffc7ca8b8cd5b4d41cab8a0aa7bd323cecc7ce8ced6cd` |
| `apps/web/tests/workspace-capabilities.test.ts` | `5711086684d9123d97c442f747fc605c9dee7829e81695f7c2f7a3851e5c81a2` |

## Protected Gates

No rendered acceptance is inferred from repository, API, source-inspection, test, typecheck, build, or loopback evidence. CT-12 must verify archived-only reachability, dialog focus and Escape recovery, exact confirmation error, preserved issue readback, success focus/status, long names, responsive geometry, and pinned Light/Dark contrast in Chrome. CT-82, CT-3, source-revision, provenance, and accountable-review gates remain open.
