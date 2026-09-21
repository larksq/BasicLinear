# v0.2.0 Sprint Planning

Planning translates the validated hosted-product Discovery package into ten flat, dependency-ordered implementation slices. It is complete as product-management work only. No Firebase project, Google OAuth configuration, Stripe product, credential, API endpoint, MCP server, skill runtime, or application code is created here.

Read [PRD](./prd.md), [architecture](./architecture.md), [UX design](./ux-design.md), [risk analysis](./risk-analysis.md), [acceptance criteria](./acceptance-criteria.md), [backlog](./backlog.md), [sprint plan](./sprint-plan.md), and [combined release gates](./combined-release-gates.md). The normalized [Planning package](./planning-package.json) is the deterministic traceability and readiness boundary.

Readiness is `yellow`: all ten slices are safe to plan and dependency-closed, while baseline collection and five-user pricing comprehension remain visibly pending. T-SECURITY-MCP is now a conditional GO that requires OAuth 2.1 discovery and audience-bound access tokens for remote MCP; PAT-only MCP is a NO-GO. Yellow does not mean product outcomes, billing activation, or release readiness are achieved.

The project-local Control Tower v0.8 store binds I-201 through I-209 to CT-133 through CT-141 in S3 — Implementation and binds I-210 to CT-142 in S4 — Testing. No version-specific milestone exists. CT-3, CT-13, CT-14, and CT-15 are the shared qualification, approval, outcome-review, and retrospective gates for v0.1 and v0.2 together. See the [backlog](./backlog.md) and [combined release gates](./combined-release-gates.md) for the exact mapping and readback evidence.
