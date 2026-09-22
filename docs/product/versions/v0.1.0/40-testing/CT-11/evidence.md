# CT-11 Isolation, Conflict, and Service Security Evidence

## Verdict

`PASSED`. P-T16 and P-T17 cover every CT-11 requirement and acceptance reference without skips or unresolved failures. Three findings were routed to CT-16, CT-17, and CT-18 before mutation; each now reads back Done at revision 3 and has a validator-passing implementation handoff.

## Test Environment

- Independent actor/session: `codex-testing-ct11` / `CT11-TEST-20260819T213417Z`.
- Immutable test image: `basiclinear-test:ct11-final-r2`, ID `b073182b066e765bdda111ffa6f32a0befba85039e6cccd2794b781913cc325d`, 442,958,382 bytes.
- Matching release images: API `bfe66f44`, web `6a163b38`, operator `8c14b3de`.
- Real disposable PostgreSQL databases were created per integration run. The exact immutable filesystem ran as image UID 503.
- Live ingress: `http://localhost:4175`; readiness HTTP 200; synthetic owner remained authenticated in Chrome.

## Automated Matrix

| Surface | Result |
|---|---|
| Cross-workspace HTTP, search, filter, saved view, export, activity, event, progress, relation, and comment paths | Pass; no victim record, count, highlight, activity, event, or aggregate disclosed |
| Least privilege | Pass for manager membership, private-view ownership, export, archive, and owner-confirmed purge boundaries |
| Restricted database role | Pass; RLS prevents cross-workspace reads and direct writes, and the application role cannot bypass RLS |
| Concurrency and retry | Pass across issue, project, milestone, label, saved view, workflow status, and comment; one 200, one 409 with committed revision 2, one activity, one outbox effect |
| Rich-text and CSP | Pass; hostile schemes/unsupported structures rejected, plain HTML remains text, safe external links retain protected attributes |
| Session security | Pass; setup/login/password change rotate sessions, logout/recovery revoke cookies, foreign origins fail, database stores token hashes only |
| Restart persistence | Pass; workspace state and authenticated sessions survive API restart |
| Failure and log redaction | Pass; API/operator/startup failures remain structured without cookies, tokens, passwords, descriptions, comments, or private evidence |

## Regression Evidence

| Command/gate | Result |
|---|---|
| `npm run typecheck` | Pass, 8 workspaces |
| `npm test` | Pass, 5 files / 20 tests |
| `npm run test:integration` | Pass, 6 files / 16 tests |
| `npm run build` | Pass; largest JavaScript chunk 481.43 kB |
| Exact immutable image execution | Pass for typecheck, unit, and integration gates |
| Live API/web deployment | Pass; deployed executable artifact hashes match verified local outputs |
| Authenticated Chrome SSE smoke | Pass; a synthetic API update appeared without UI mutation/reload, the restoring update appeared, and browser warning/error logs remained empty |

## Bug Return Loops

- `CT-16`: missing workspace event boundary. Fixed with workspace RLS repository access, cursor-aware SSE, minimal payloads, client invalidation, and streaming proxy policy. Focused P-T16 and full immutable regression pass.
- `CT-17`: stale current-revision hint during simultaneous writes. Fixed with workspace-scoped row locking and committed-revision rereads across all accepted revisioned entity types. Focused P-T17 and full immutable regression pass.
- `CT-18`: `.env.example` absent from the source-frozen test stage. Fixed by copying only the public static fixture. The rebuilt image passes its complete suite and includes no secret environment file.

## Requirement Trace

| Requirement | Evidence |
|---|---|
| R-001 | Offline local setup/login/logout/password rotation/recovery and origin protections pass. |
| R-002 | Workspace/team/member/status state survives restart and stays workspace scoped. |
| R-005 | Issue direct-ID and mutation paths are authorized; rich text is allowlisted and safe. |
| R-008 | Saved-view/filter/bulk state cannot cross workspace or private-view ownership boundaries. |
| R-009 | Search ranking returns no unauthorized record, count, or highlight. |
| R-101 | Every tested direct, derived, export, event, activity, relation, and database path denies unauthorized access. |
| R-102 | Concurrent stale writers and idempotent retries preserve a single committed state and effect set. |
| R-106 | API, operator, startup, log, event, and conflict outputs remain structured and secret-safe. |

## Residual Boundary

The host's Docker engine still deadlocks starts for newly created containers. Source-frozen verification used the documented exact-filesystem workaround inside the running internal network. This does not weaken CT-11's artifact/security result, but clean-host full-Compose rehearsal remains P-T21 / CT-12. O-001 and O-004 remain pending.
