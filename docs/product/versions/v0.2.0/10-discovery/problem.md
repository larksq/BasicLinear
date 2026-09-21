# Problem framing

## Recommendation and exact scope

Build v0.2.0 for a small product team whose owner wants the existing OpenLinear workflow available online and shareable without operating a server. Let the owner sign in with Google, create one hosted workspace, invite members, assign one member to a task, discuss work through comments, and connect external AI clients through a narrow PM-only API/MCP/skill surface.

The release does not attempt to become an engineering suite. Repositories, pull requests, code review, autonomous agents, agent orchestration, presence, mentions, notifications, files, custom roles, and enterprise identity remain out.

## Target user and current workflow

The primary user is a technical founder, product lead, or small-team operator currently using the local OpenLinear build or a hosted tracker. The current local build is fast and owner-controlled but cannot be safely reached by collaborators or external clients. The user must either share another tool, exchange status in chat, or run unsupported remote access. Those workarounds fragment ownership, assignment, and decision context.

The secondary user is an invited team member. They need a low-friction Google sign-in, an unambiguous invitation, a list of work assigned to them, and a durable comment thread. They do not need billing or workspace administration.

## Alternatives and insufficiency

Linear and Plane already provide hosted collaboration. They are strong substitutes, not evidence of unmet demand. OpenLinear's testable opportunity is a much lower hosted price plus open-source continuity and an automation surface centered on product management. The proposed release should be stopped or repositioned if target users do not complete the invite-to-assigned-work loop or if Firebase and payment costs make the stated price unsafe.

## Trust conditions

Users must see which workspace they are acting in, who can access it, when the 30-day trial ends, which seats are billable, and what happens after expiry. Authorization must be enforced server-side and in Firestore rules; hiding controls is never access control. Pending invitations do not count as seats. Accepted active memberships do. Billing and entitlement records are server-owned and webhook-driven.

API and MCP callers act as a named user with explicit scopes. They cannot bypass workspace membership, use an implicit global workspace, manage billing by default, or invoke code-review/agent operations because those operations do not exist in this release.

## Observable change and invalidation

The desired behavior change is that a new owner can sign in, create a first task, invite one teammate, assign work, and receive a teammate comment without leaving OpenLinear. A second behavior change is that an external client can perform the same bounded PM actions through documented contracts.

Invalidation signals are low completion of the first-task or collaboration loops, zero or uneconomic paid conversion, cross-workspace authorization defects, unclear downgrade behavior, or unreliable API/MCP task completion. These are governed by O-201 through O-204.
