# CT-88 Clean Runtime Runner Evidence

## Finding

CT-82 had strong unit/integration support and a manual implementation rehearsal, but no checked-in command that a distinct tester could run against the built artifact. Its offline test replaced `fetch` inside the API process, so it did not externally launch the supported process or retain an attempted-network audit.

## Interface

An implementation-session rehearsal is explicit and non-accepting:

```sh
node scripts/verify-clean-runtime.mjs \
  --actor ACTOR_ID \
  --session SESSION_ID \
  --implementation-rehearsal \
  --output /absolute/path/to/evidence.json
```

Independent CT-82 execution omits `--implementation-rehearsal` and must identify the implementation actor/session it differs from:

```sh
node scripts/verify-clean-runtime.mjs \
  --actor INDEPENDENT_ACTOR_ID \
  --session INDEPENDENT_SESSION_ID \
  --implementation-actor codex-ct88-tooling \
  --implementation-session CT88-IMPLEMENT-20260821T0915Z \
  --output /absolute/path/to/evidence.json
```

Independent mode fails closed unless Git has a source revision, the working tree is clean, and actor and session identities differ. `--plan-only` checks those preconditions and the artifact lock without opening a listener. Temporary data is deleted unless `--keep-work-directory` is explicit.

## Guard Boundary

The preload runs only in tested child processes. It blocks the Node networking and subprocess APIs available to this all-JavaScript runtime while allowing loopback traffic. Every denied attempt is appended immediately to an owner-only JSONL audit. A forced kill cannot write a final summary, so the runner separately requires the start record and zero attempt records; graceful phases also require their exit summary.

This is deterministic application-process enforcement, not a claim about unrelated host processes. The implementation rehearsal used no external credential and six guarded phases observed zero attempts.

## Rehearsal Result

The final rehearsal locked the fresh build as SHA-256 `2dc6cc5751d136a1c0495e68283f4052066053c850de7094567f456c2478e776`. Core export, restore, import, and accepted-upgrade canonical digests matched at `405afa923ebdb2dd8893034b18ee33315eeb183a9bda092b4089b3718e399312`. Accepted-scale HTTP scan/search/sort completed in 168.02 ms, below the 5,000 ms ceiling.

The CT-85 legacy fixture reproduced canonical SHA-256 `000473521838884d216ef7ad87185a94b8400fcf488add218722d0a88d120772`, byte hash `3bbd2aeebf83148d48bf6eba986fdbc1cd4203829e6aea0311d72752f8d3222c`, and selected digest `5f35bf5f1b8cb00c808d043d1ef31fd03e0a6b022ca43095be1f1b700683f128` without changing its source.

Structured evidence is `evidence/qualification-rehearsal.json`.

## Remaining Gate

CT-88 can complete when regression and Control Tower readback are recorded. CT-82 cannot complete from this session. A distinct tester must run the strict command from a clean, revision-bound checkout and review the resulting evidence. Cross-platform observations remain limited to the environment recorded by that run. Browser fidelity and public-release decisions remain outside this issue.
