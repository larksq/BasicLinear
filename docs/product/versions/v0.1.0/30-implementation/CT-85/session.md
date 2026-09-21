# CT-85 Implementation Session

- Issue: `CT-85`, stable ID `46b9e2bf-1caa-40ce-9953-113fc6c41370`, starting revision `1`, intended completion revision `2`.
- Session: `CT85-IMPLEMENT-20260821T080630Z`.
- Actor: `codex-platform-runtime`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, browser, Google account, external identity, Docker, PostgreSQL server, or database URL was used.

## Finding

CT-79 explicitly superseded the Docker/PostgreSQL portions of P-T21, and the accepted R-014 criterion requires SQLite migration without Docker or a database server. CT-82 nevertheless retained a stale request for a live last-PostgreSQL fixture. The supported parser still accepts the versioned legacy database-backup document, but the repository lacked a deterministic fixture for that compatibility boundary.

The file import also opened a temporary SQLite database before discovering that a multi-workspace source lacked an explicit selection. Cleanup removed the temporary file, but CT-79 requires ambiguous scope to fail before output creation.

## Implementation

1. Split selected-document import from parsing and scope selection.
2. Preflight and select the canonical document before resolving, creating, or opening any target path.
3. Added a deterministic two-workspace legacy backup fixture with fixed migrations, users, credential/OIDC source payloads, scope metadata, project, milestone, issues, rich text, resources, labels, relations, comment, saved view, activity, dates, fractional ordering, and digests.
4. Locked the fixture's canonical SHA-256 at `000473521838884d216ef7ad87185a94b8400fcf488add218722d0a88d120772`.
5. Added file-level checks that ambiguous import preserves the source byte-for-byte and creates no target directory, while explicit selection imports one owner/workspace/team, preserves the selected canonical digest, and persists no password or OIDC payload.

## Verification

- Focused canonical/SQLite suite: 2 files, 15 tests passed.
- Complete regression: 56 files, 387 tests passed.
- Typecheck: all 8 workspaces passed.
- Build: 1,946 modules; 1,027,388 output bytes; no chunk warning.
- Release-audit regression: 2 of 2 tests passed.
- `git diff --check`: clean. Source revision remains unavailable because the repository has no commit.
- Built operator ambiguous run: `AMBIGUOUS_SCOPE`, exit 1, source SHA-256 unchanged at `3bbd2aeebf83148d48bf6eba986fdbc1cd4203829e6aea0311d72752f8d3222c`, and no target directory or database created.
- Built operator selected run: 19 records, schema 2, integrity `ok`, 0 foreign-key violations, `0600` database, journal `delete`, synchronous `FULL`, and canonical digest `5f35bf5f1b8cb00c808d043d1ef31fd03e0a6b022ca43095be1f1b700683f128` before and after import/export.
- Legacy password and OIDC claim payloads were absent from the selected SQLite file and canonical workspace export. Public owner/scope metadata remained by design.

## Boundary

This completes a deterministic implementation prerequisite. It replaces the stale live-PostgreSQL request with a server-free compatibility fixture; it does not weaken canonical transfer or authorize PostgreSQL as a supported runtime. CT-82 still requires a distinct actor/session, locked artifact, outbound-network observation, remaining interruption/rejected-upgrade matrix, exact environment identities, and a hash-bound source revision. CT-12 still requires rendered accessibility, responsive, fidelity, and UAT evidence. No outcome or release claim is made.

Control Tower completion readback: `CT-85 Done@2`, `CT-82 Todo@3`, `CT-12 In Progress@61`; 6 active, 79 completed, 0 trash. S3 is 65 of 70 complete (`0.9285714285714286`). The completion mutation backup SHA-256 is `0133f45d530cc84ee53f7e50f25ac28c0184eaa13327c46ede6298aad84d101d`.
