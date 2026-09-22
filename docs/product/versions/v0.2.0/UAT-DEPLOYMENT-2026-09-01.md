# v0.2.0 UAT deployment — 1 September 2026

Status: deployed and verified in development and production.

This deployment publishes the six September UAT corrections described in
[UAT-SCOPE.md](./UAT-SCOPE.md), the open-source UI alignment, the in-product
AI connection guide, and the Codex MCP compatibility corrections recorded in
[CODEX-MCP-UAT-2026-09-01.md](./CODEX-MCP-UAT-2026-09-01.md). It updates the
hosted browser and trusted API in both configured environments. It does not change Firebase projects,
Firestore rules or data, identity configuration, Stripe state, Checkout,
subscriptions, charges, or the no-charge verification boundary.

The deployment was built from the working tree based on Git commit `928767e`;
the UAT implementation was not represented by a new commit at deployment time.
Historical CT-143 review records remain historical and were not rewritten.

## Deployed environments

| Environment | Cloud Run revision | Image digest | Vercel deployment | Public site |
| --- | --- | --- | --- | --- |
| Development | `basiclinear-hosted-api-dev-00014-4mb` | `sha256:1e2bf6ea19202767db1ad46ffa73567a74ea1cc3a1c53298bc914f97fd74ba47` | `dpl_9LEyatgZNCrRnYvcADjUbsVXRz5H` | <https://basiclinear-development.vercel.app> |
| Production | `basiclinear-hosted-api-00010-25m` | `sha256:1360a5543db27fd691a549fa72443dc186f144410c0fc86ba8935a8ac8a97e22` | `dpl_ByUZBAonF5SnMbZwd2ZqEq95Hw1G` | <https://basiclinear-gray.vercel.app> |

Both Cloud Run revisions serve 100 percent of their environment's traffic.
The final development and production images were built separately in their isolated
Google Cloud projects by builds `bb7c30db-3992-479c-8cd9-76288b0e021c` and
`fd8db1b6-e9a1-4d94-9faf-9278bb00ab71` respectively.

## Verification

- The original UAT pre-deployment full suite passed: 124 files and 748 tests.
- The final post-implementation suite passed: 125 files and 755 tests.
- The final full workspace build passed: 1,956 local modules and 1,824 hosted
  modules. The environment contract and `git diff --check` also passed.
- Each Cloud Run `/health/ready` endpoint returned HTTP 200 with
  `{"status":"ready","authority":"firebase-hosted"}` after traffic moved.
- Each public Vercel alias returned HTTP 200. A request through each `/api/**`
  rewrite reached the matching backend and returned the expected bounded 405
  response for an unsupported GET, proving the environment-specific route.
- Both deployed browser bundles contain `Join team`, `Leave team`,
  `Remove from organization`, `Show less`, and `Show more`; neither contains a
  `Cycles` label.
- Exact due-time notification behavior and completed-task suppression are
  covered by `packages/hosted/tests/issue-observation-service.test.ts`.
- A later compatibility pass exercised browser OAuth and real issue operations
  through Codex CLI `0.144.1` against development. It also verified the final
  production AI guide and endpoint without mutating production product data.

The first production frontend attempt, `dpl_8JwdqBcSY3T2fCmccU7aUsBeE1cw`,
failed its environment guard because Vercel read the development build command.
It was never aliased. The corrected production-bound build passed and only
`dpl_6q1BxczLnRL5DDqbx7Rguq76tkY6` was published to the public production
alias. The checkout's default Vercel link and `vercel.json` were restored to
development after deployment.

The later AI/MCP rollout superseded those initial public deployments with the
final IDs in the table above. The development checkout remains linked to the
development Vercel project after the production publish.
