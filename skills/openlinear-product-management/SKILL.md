---
name: openlinear-product-management
description: Operate a hosted OpenLinear workspace through its MCP product-management tools. Use when a user asks to inspect or manage OpenLinear workspaces, projects, milestones, issues, assignments, comments, members, invitations, billing summaries, or workspace exports. Do not use for agents, source repositories, pull requests, code review, token administration, or billing purchases.
---

# OpenLinear product management

Use the hosted OpenLinear MCP server as the workspace authority. Keep every action inside the explicit workspace chosen by the user.

## Connect safely

1. Connect to the configured `/mcp` endpoint with the stable `2026-07-28` protocol.
2. Complete the server's OAuth authorization-code flow with PKCE and explicit workspace/scope consent. Never substitute a REST personal access token for MCP OAuth.
3. Call `server/discover`, then `tools/list`. Use only tools returned for the current grant.
4. If no workspace is explicit, ask the user for its OpenLinear workspace ID. Never infer one from another task or account.

See [references/safety.md](references/safety.md) for the authority, privacy, retry, and confirmation boundaries.

## Work in a read-first sequence

Start with the narrowest read that establishes current state. Prefer `workspace.get`, the relevant collection `list`, and then an entity `get`. Before a revision-protected mutation, read the latest entity revision.

Use [references/tool-map.md](references/tool-map.md) to choose the exact PM tool and required scope.

## Mutate deliberately

- Provide the explicit `workspaceId` on every call.
- Generate one stable, non-secret `idempotencyKey` for one logical mutation. Reuse it only for an identical retry; use a new key for changed intent.
- Supply the last-read `expectedRevision` where required. On a conflict, reread, explain what changed, and do not overwrite silently.
- Obtain explicit user confirmation immediately before `comment.delete`, `member.remove`, or `invitation.revoke`.
- Treat returned invitation links or share tokens as one-response secrets. Show them only to the authorized user and never place them in comments or retained summaries.
- After a successful mutation, read the affected entity or collection and report the resulting ID, state, and revision.

## Keep the product boundary

Operate product-management records only. Do not invent or seek tools for autonomous agents, source code, repositories, pull requests, code review, API-token administration, arbitrary data access, or subscription purchase. `billing.get` is read-only; plan purchase and payment changes stay in the owner web flow.

When access, entitlement, membership, or scope is denied, relay the safe recovery message. Do not probe other workspaces, broaden scopes, or expose provider and storage details.
