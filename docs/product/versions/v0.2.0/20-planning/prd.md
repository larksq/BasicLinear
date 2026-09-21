# Product requirements document

## Product decision

Deliver v0.2.0 — Online Collaboration as the first hosted OpenLinear release within the existing S1 through S6 Control Tower lifecycle. Preserve the local product as a separate authority and give small teams a narrow online path: Google sign-in, one hosted workspace, owner/member collaboration, a one-time 30-day Pro trial, and subscriptions at USD $2 per active user monthly or USD $12 per active user yearly.

The hosted service must be operable by humans and external AI clients through the same PM semantics. REST, MCP, and the packaged skill do not introduce an agent runtime. No code-review or repository model is added.

## Users and jobs

The owner signs in, sees exact trial dates, creates planning records, invites members, manages active seats, assigns tasks, reviews comments, creates scoped automation tokens, chooses a subscription, and exports workspace data. A member accepts one invitation through Google sign-in, finds assigned work, updates permitted records, and comments. An external client performs only the operations and workspace scope authorized by its user token.

## Scope

Must-have scope is R-201 through R-220. The release has one workspace per owner account and exactly two roles. Invitations are email-bound and expiring. Issues have zero or one active-member assignee. Comments are durable, revision-safe, and soft-deletable. Pending invites do not consume seats; active memberships do, including the owner.

The trial is one-time per new owner Firebase UID and lasts 30 consecutive days from trusted server bootstrap. No card is required. An unpaid workspace falls back to one active writer without data deletion. Additional members retain read access until the owner subscribes or reduces the active membership count.

## Packaging and prices

| Plan state | Price | Capability |
|---|---:|---|
| Pro trial | $0 for 30 days | All v0.2.0 hosted collaboration and automation capabilities, subject to fair-use/rate limits |
| Pro monthly | $2 per active user/month | Same Pro capability, billed by active seat |
| Pro annual | $12 per active user/year | Same Pro capability, billed by active seat |
| Free fallback | $0 | One active writer, data read/export, no multi-user or automation writes |

Prices are USD before applicable taxes. Stripe remains the planning recommendation. Refund, tax, proration, cancellation, failed-payment, and seat-change behavior follow documented Stripe state transitions and must be acceptance-tested; Planning creates no production billing configuration.

## Non-goals

AI agents, agent orchestration, code review, repositories, pull requests, presence, custom roles, guests, SSO beyond Google, SCIM, attachments, mentions, notifications, native apps, public webhooks, live SQLite/Firestore sync, and competitor importers are not v0.2.0 scope.

## Outcomes and release rule

O-201 through O-204 remain unchanged from Discovery. Implementation output cannot satisfy an outcome. Public billing activation requires passing the full security/billing/cost gate, a keep/change/stop pricing memo, and sponsor action for any proposed change to price or trial length. Release may proceed only when the exact requirement/test matrix passes and CT-13 explicitly approves the combined v0.1 local plus v0.2 hosted candidate; Outcome Review waits for mature windows.
