# OpenLinear v0.2.0 — Online Collaboration

Version `v0.2.0` is the governed hosted-product release increment for OpenLinear. It extends the accepted local-first project-management core with Google sign-in, Firebase-hosted workspace data, a one-time 30-day Pro trial, low-cost per-seat subscriptions, basic collaboration, and external automation through a versioned API, MCP tools, and a reusable product-management skill.

The sponsor-confirmed prices are USD $2 per active user per month and USD $12 per active user per year. Planning treats these prices as product intent, not evidence that unit economics or tax treatment are already validated.

The release is deliberately narrow. It includes hosted workspaces, `owner` and `member` roles, email invitations, discoverable multi-team membership, one assignee per task, comments, project-management operations, and bounded in-app activity and due-time reminders. It excludes AI agents, code review, source-control workflows, real-time presence, custom roles, SSO beyond Google, SCIM, attachments, mentions, external notification delivery, enterprise administration, and cycles/sprints.

The [UAT scope clarification](./UAT-SCOPE.md) is authoritative for the current hosted workspace surface. In particular, cycles are not part of v0.2.0 even where an earlier historical implementation artifact or screenshot mentions them.

- [Discovery](./10-discovery/README.md)
- [Sprint Planning](./20-planning/README.md)
- [Combined v0.1 + v0.2 release gates](./20-planning/combined-release-gates.md)
- [Pricing and unit-economics checkpoint](./30-implementation/research/T-VALIDATE-PRICING.md)
- [MCP authorization and transport checkpoint](./30-implementation/research/T-SECURITY-MCP.md)

The project-local Control Tower v0.8 task store remains the live work authority. v0.2.0 creates no version-specific milestone: CT-133 through CT-141 reuse S3 — Implementation, CT-142 reuses S4 — Testing, and the unfinished CT-3, CT-13, CT-14, and CT-15 gates now qualify, approve, review, and close v0.1 and v0.2 together. Linear projection remains disabled.
