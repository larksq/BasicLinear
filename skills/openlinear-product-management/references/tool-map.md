# Hosted OpenLinear MCP tool map

All tools require an explicit `workspaceId`. Mutation tools require a stable `idempotencyKey`; update, assignment, and comment edit/delete tools also require the current `expectedRevision`.

| Area | Read tools | Mutation tools | OAuth scopes |
|---|---|---|---|
| Workspace | `workspace.get`, `workspace.export` | — | `workspace:read`, `workspace:export` |
| Projects | `project.list`, `project.get` | `project.create`, `project.update` | `projects:read`, `projects:write` |
| Milestones | `milestone.list`, `milestone.get` | `milestone.create`, `milestone.update` | `milestones:read`, `milestones:write` |
| Issues | `issue.list`, `issue.get` | `issue.create`, `issue.update`, `issue.assign` | `issues:read`, `issues:write` |
| Comments | `comment.list`, `comment.get` | `comment.create`, `comment.update`, `comment.delete` | `comments:read`, `comments:write` |
| Members | `member.list` | `member.remove` | `members:read`, `members:write` |
| Invitations | `invitation.list` | `invitation.create`, `invitation.resend`, `invitation.revoke` | `invitations:read`, `invitations:write` |
| Billing | `billing.get` | — | `billing:read` |

Owner-only behavior still applies even when an OAuth scope is present. Members cannot use an owner action merely because a client requested that scope.

There are exactly 27 PM tools. There is no archive tool in this release. Soft-deleting a comment, removing a member, and revoking an invitation are the destructive operations.
