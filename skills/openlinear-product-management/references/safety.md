# OpenLinear MCP safety boundary

## Authority and authentication

- The hosted OpenLinear service is authoritative for hosted workspace data.
- MCP uses audience-bound OAuth access tokens obtained with authorization code plus PKCE S256. REST personal access tokens are rejected at `/mcp`.
- Access is bound to one client, user, workspace, resource, and scope set. Current active membership is checked again for protected requests.
- Access tokens are short-lived. Refresh tokens rotate; reuse revokes the token family.

## Data minimization

- Request only the scopes needed for the user's current task.
- Never paste access tokens, refresh tokens, invitation share tokens, Firebase credentials, or provider identifiers into issues or comments.
- Do not probe foreign workspace IDs after a denial.
- Preserve redacted service errors; do not infer or disclose storage internals from them.

## Retry and concurrency

- An idempotency key identifies exactly one logical mutation and its full arguments.
- Identical retries may reuse the key. Changed arguments require a new key.
- Revision conflicts require a reread and user-visible reconciliation; never substitute a guessed revision.
- If a transport response is interrupted after work may have begun, retry the exact request with the same idempotency key before taking another action.

## Confirmation boundary

Require a fresh, explicit user confirmation immediately before:

- `comment.delete` because it soft-deletes visible content;
- `member.remove` because it revokes access and can change paid seat quantity;
- `invitation.revoke` because the current invitation link stops working.

Do not use MCP to buy or change a subscription. `billing.get` is observation only.

## Protocol profile

The server implements the stable `2026-07-28` stateless Streamable HTTP profile. Each JSON-RPC request uses its own POST. There is no GET event stream or persistent MCP session. A tool call may return a request-scoped SSE response; a closed stream is best-effort cancellation before application work begins.
