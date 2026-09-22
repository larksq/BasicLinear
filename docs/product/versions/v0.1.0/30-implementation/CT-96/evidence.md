# CT-96 Confirmed Milestone-Purge Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_ACCEPTANCE_PENDING`. BasicLinear now provides the accepted irreversible milestone-removal boundary after recoverable archive. The exact-name, revision-checked owner action permanently removes one archived milestone while every linked active or archived issue remains in its project with a revisioned, auditable milestone detachment.

## Behavior

| Contract | Implemented behavior |
| --- | --- |
| Capability | `milestone:purge` is available only to the owner in retained internal role metadata. |
| Preconditions | The milestone must be archived, its expected revision must be current, and confirmation must exactly match its name. |
| Issue preservation | Active and archived issues retain project, identity, content, labels, relations, comments, resources, archive state, and unrelated fields while `milestoneId` becomes null. |
| Atomicity | Issue detach revisions and activity, retained project activity, idempotency cleanup, and milestone deletion occur inside one serialized SQLite write. |
| Retained audit | The parent project's activity keeps a counted `milestone.purged` entry after the milestone row is gone. |
| Receipt | The response identifies the milestone and project and reports detached issue count and purge timestamp. |
| UI reachability | A distinct danger action appears only for an archived milestone and owner and opens one exact-name confirmation dialog. |
| Recovery | Wrong confirmation, active milestone, stale revision, wrong project, wrong workspace, and unavailable capability paths leave product records unchanged. |
| Feedback | Success clears matching milestone URL context, refreshes dependent reads, restores focus to the adjacent milestone or archived toggle, and exposes a visible counted preservation result. |
| Scope | No schema, Docker, remote service, storage engine, project reference, or canonical transfer format changed. |

## Verification

| Check | Result |
| --- | --- |
| Focused and related tests | 6 files / 32 tests passed |
| Complete regression | 63 files / 428 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,948 modules / 109 files / 1,902,251 bytes; no warning |
| Release-audit regression | 6 / 6 passed |
| Isolated loopback readiness | `ready` on port 4276 using a temporary local data directory |
| Served candidate | `index-GpJbqAul.js` and `index-vO8y3zKJ.css` returned |
| Live active-purge guard | HTTP 400; milestone and issue remained unchanged |
| Live confirmed purge | Counted receipt returned; issue retained its project at revision 2 with `milestoneId: null`; milestone readback was empty; `milestone.purged` remained in project activity |
| Rendered Chrome evidence | 0 captures; required transport remains unavailable before page open |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `packages/domain/src/index.ts` | `629c95da2f34582e8317fb1a6f5956c219f85c1889a505df6fb27780d530f00f` |
| `packages/domain/tests/domain.test.ts` | `07c404310d6f896387a73fa27c0b4a41fb836ff9c59f09d3a5610b740cf35ff6` |
| `packages/contracts/src/index.ts` | `82e3c3afdcf5ac5e0b7bcb6394c4945a1375e7e28be30942058fed5344d3e6d2` |
| `packages/db/src/types.ts` | `c83a58214b4c0b4f4709e6f97fc9b7cd69cefa6a79a7b14627904134d0751b83` |
| `packages/db/src/sqlite/index.ts` | `40d9e66f703d46f03703eeba75829473b5aca57d8e3d302c1f7050bec84d03d1` |
| `packages/db/src/sqlite/project-repository.ts` | `0347859380bacb8ac988fcdfccb3e28a5419484d6742d1809e877eef2b6ddc82` |
| `packages/db/tests/sqlite.test.ts` | `e4c26c1465b812098e848c7bb8dc7009cee51fcf60ed7af9c5d3def3edcd447d` |
| `apps/api/src/app.ts` | `023dbcb7aef3d85d426dfbe0ddf5adb1908ac3bedfe2070041baee82e5a379f4` |
| `apps/api/tests/sqlite.test.ts` | `27fe5d2d4568d54958444eab8778191d998d4eed6edb080c5b80b5f657b7bf2a` |
| `apps/api/tests/validation.test.ts` | `059e2771b923dff958a2e06124aa5568bef102d0aa1b4957860ab57b0560f50a` |
| `apps/web/src/api.ts` | `dc0133b600360e9506c0f7adb1ff147cf84d291be1227c14da5afe36a8d4bdbd` |
| `apps/web/src/projects.tsx` | `92e5f7786c5c074f638f9b034570589c1d0fd98a9e99eeba402a22c680ff9d2c` |
| `apps/web/src/styles.css` | `173cd52797c6d3db539c944ede45eefa3dfef293605b599dec22ed74e9d9bd03` |
| `apps/web/tests/milestone-purge.test.ts` | `546972a8872626b82e0edea3cc06cf889be19aabd55c63590f7d6fbc973ca51e` |
| `apps/web/tests/workspace-capabilities.test.ts` | `cd7f0af7258fc5636ab5d2f154db2769313f9fb78a03c3f1e4eed694086c3f08` |

## Protected Gates

No rendered acceptance is inferred from repository, API, source-inspection, test, typecheck, build, or loopback evidence. CT-12 must verify archived-only reachability, dialog initial focus and Escape recovery, exact-confirmation feedback, preserved active and archived issue readback, URL-context clearing, success focus and announcement, long names, responsive geometry, and pinned Light/Dark contrast in Chrome. CT-82, CT-3, source-revision, provenance, and accountable-review gates remain open.
