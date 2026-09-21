# Codex MCP OAuth and issue-operation UAT — 1 September 2026

Status: passed against development; production verification was read-only.

This UAT connected Codex CLI `0.144.1` to the deployed OpenLinear MCP endpoint,
completed browser OAuth with explicit workspace and scope consent, and exercised
real issue reads and revision-aware writes through the standard MCP lifecycle.
No access token, authorization code, PKCE verifier, client secret, Google token,
or callback URL is recorded here.

## Authorized boundary

- Endpoint: `https://openlinear-development.vercel.app/mcp`
- Workspace: `ws_d1ef593484c64dfeb9197889fbb668df`
- Approved scopes: `workspace:read`, `issues:read`, `issues:write`
- Production: UI, discovery, readiness, and guide checks only; no issue mutation

The browser flow restored the signed-in Google identity, presented only
workspaces visible to that identity, then required a separate scope review and
approval. Choosing a workspace did not itself create a grant.

## Real client operation matrix

| Step | MCP operation | Result |
| --- | --- | --- |
| 1 | Standard `initialize` and `notifications/initialized` | Passed |
| 2 | `tools/list` | Passed; OAuth-bound schemas omitted `workspaceId` |
| 3 | `workspace.get` | Passed for the authorized workspace |
| 4 | `issue.list` | Passed; returned the three pre-existing issues |
| 5 | `issue.create` | Passed; created one clearly labelled UAT issue |
| 6 | `issue.get` | Passed; read back revision 1 |
| 7 | `issue.update` | Passed using the latest revision |
| 8 | `issue.get` | Passed; read back the final revision 2 state |

Retained development evidence:

- Issue ID: `issue_6cabca24f4264b25ab5ac4fee50ad70c`
- Title: `[Codex MCP API UAT 2026-09-01] Authorization and issue operations`
- Final priority: `high`
- Final status: `todo`
- Final revision: `2`
- Final description: `Created and updated by Codex through the OpenLinear development MCP server. OAuth authorization, issue.create, issue.get, and revision-aware issue.update passed on 2026-09-01. Retained as labeled UAT evidence.`

No other issue was created by this live run.

## Compatibility corrections proven by the run

1. Dynamic client registration accepts, canonicalizes, and echoes the optional
   OAuth `scope` metadata used by current clients.
2. A standard OAuth client that cannot pre-supply `workspace_id` receives a
   backend-validated workspace chooser before the explicit consent screen.
3. Authorization-server discovery reports
   `authorization_response_iss_parameter_supported: false` for Codex CLI
   `0.144.x` compatibility, while OpenLinear still emits `iss` in direct
   authorization responses for clients that preserve it.
4. A refresh request that omits `resource` remains bound to the resource from
   the original grant; an explicitly wrong resource is still rejected.
5. Standard MCP `2025-06-18` initialization, ping, discovery, and tool calls
   coexist with the existing enhanced transport. The OAuth grant injects the
   workspace server-side and every call still rechecks membership and scope.

The issuer workaround is bounded to the exact behavior reproduced in
[openai/codex#33354](https://github.com/openai/codex/issues/33354). The setup
guide links to the official [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp),
[Claude Code MCP documentation](https://code.claude.com/docs/en/mcp), and the
[MCP lifecycle specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle).

## Final deployed artifacts

| Environment | Backend revision | Image digest | Frontend deployment |
| --- | --- | --- | --- |
| Development | `openlinear-hosted-api-dev-00014-4mb` | `sha256:1e2bf6ea19202767db1ad46ffa73567a74ea1cc3a1c53298bc914f97fd74ba47` | `dpl_9LEyatgZNCrRnYvcADjUbsVXRz5H` |
| Production | `openlinear-hosted-api-00010-25m` | `sha256:1360a5543db27fd691a549fa72443dc186f144410c0fc86ba8935a8ac8a97e22` | `dpl_ByUZBAonF5SnMbZwd2ZqEq95Hw1G` |

Both Cloud Run revisions are ready and serve 100 percent of traffic. Both
public aliases return the correct environment-specific OAuth discovery and MCP
route. Production renders the bottom-left guide with
`https://openlinear-gray.vercel.app/mcp`, closes cleanly, restores focus, has no
horizontal overflow, and reported no broken images in the final Chrome pass.

The final automated suite passed 125 files and 755 tests. The full build passed
all declared workspace TypeScript projects and emitted 1,956 local UI modules
and 1,824 hosted UI modules. The hosted environment contract and
`git diff --check` also passed.

## Verification boundary

This is positive OAuth, protocol interoperability, UI, and product-operation
evidence. It is not an independent penetration test, payment-provider test, or
cross-tenant security acceptance. The labeled development issue is intentionally
retained as auditable UAT evidence.
