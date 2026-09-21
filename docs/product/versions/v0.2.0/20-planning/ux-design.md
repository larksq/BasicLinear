# UX design

## Journey 1 — first owner

1. Landing explains hosted versus local, Google sign-in, 30-day no-card Pro trial, exact prices, and Free fallback.
2. Google sign-in returns to a trusted bootstrap state. A progress screen prevents duplicate workspaces during retries.
3. The owner sees `Trial ends <date>` and `0 additional active seats` in a persistent workspace/account surface.
4. A guided empty state creates the first project and issue without forcing billing or invitations.
5. The owner may invite a member after first useful work; the invitation copy says pending invites are not billed.

The user must not encounter a card form before choosing a paid plan. Trial consent copy distinguishes the product account from Google and Stripe. Authentication errors preserve a retry path and never create a second trial.

## Journey 2 — invited member

1. The invitation link shows inviter, workspace, invited email, expiry, and expected `member` role before acceptance.
2. Google sign-in must match the invited email. Mismatch offers sign-out/retry without revealing unrelated workspace data.
3. Acceptance is one-time and idempotent. Expired, revoked, used, and wrong-account states have distinct recovery messages.
4. The member lands on `My work`, can open the assigned issue, update allowed fields, and create a comment.

## Journey 3 — assignment and comments

Assignee controls list only active members and support `Unassigned`. Removal of a member clears or visibly invalidates assignments according to an atomic policy; no ghost user remains selectable. Comment composer exposes author, timestamp, revision conflict, edit, and soft-delete recovery. Mentions, reactions, attachments, and notifications do not appear.

## Journey 4 — trial, subscription, and downgrade

The owner sees trial dates, active/pending seat counts, and monthly/annual totals before checkout. Price copy uses `$2 × active users / month` and `$12 × active users / year`. The annual savings statement must not obscure the absolute total.

Before expiry, reminders stay in-product only; notifications are out of scope. After unpaid expiry, the workspace explains why collaboration and automation writes are paused, which one user remains active, that data is preserved, and the two recovery paths: subscribe or reduce active membership. Read/export remains available.

## Journey 5 — API, MCP, and skill

For REST, the owner creates a named personal token with workspace, scopes, audience, and expiry. The raw value is shown once with copy/download controls and a warning not to paste it into chat. A token list shows prefix, audience, scopes, last use, expiry, and revoke. For MCP, the owner follows a standards-based connect flow that names the client, exact redirect URI, workspace, and requested scopes before explicit consent; Firebase/Google authentication backs the OAuth authorization session.

API docs show OpenAPI and REST PAT examples. MCP setup shows the endpoint, stable `2026-07-28` stateless protocol profile, OAuth discovery/connect behavior, and exact PM tools; it does not instruct users to paste a PAT into general MCP clients. The packaged skill starts with workspace discovery/read operations and requires explicit confirmation for remove/revoke actions. No screen markets autonomous agents or code review.

## Accessibility and responsive behavior

Google, invite, billing, downgrade, token, assignment, and comment flows must be keyboard-complete and meet the existing WCAG 2.2 AA posture. Status and entitlement changes use visible text plus live-region announcements. Mobile layouts preserve workspace identity, price totals, assignee labels, and destructive-action confirmation without horizontal information loss.
