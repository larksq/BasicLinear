# CT-113 Implementation Session

- Issue: `CT-113`, stable ID `c567a55b-b386-4249-aae7-84026e95a60d`, created at revision `1`; expected evidence synchronization revision `2`.
- Session: `CT113-IMPLEMENT-20260822T142603Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, account state, or provider task system was used.

## Finding

At product revision `7665027`, restarting the loopback Node process preserved the cached Workflow screen and the exact SQLite file, but the browser kept the expired process-local session. Active session, team, membership, status, and event reads returned `AUTHENTICATION_REQUIRED`; only a page reload obtained another automatic owner session.

## Implementation

1. Added a single-flight recovery coordinator that renews the existing automatic local owner before any active protected query refresh.
2. Cached the renewed session and CSRF proof, then invalidated active queries while excluding the health probe.
3. Recreated the workspace event stream after the session cookie changes without remounting the workspace surface.
4. Added polite recovery and reconnect states plus one explicit retry path for a genuine renewal failure.
5. Kept the one-owner, one-implicit-workspace boundary and added no login, OIDC, account switching, member administration, remote access, Docker, or database server.

## Verification

- Focused regression: 3 files / 14 tests passed.
- Complete regression: 71 files / 469 tests passed.
- Typecheck: all 8 workspaces passed.
- Release-audit regression: 10 / 10 tests passed.
- Production build: 1,950 modules and 109 dist files / 1,915,948 bytes, without warnings.
- Connected Chrome 151 at 1440x900 loaded the new `index-B3mCRRCV.js` asset and completed two process-restart cycles against the same schema-2 SQLite file.
- During the observed outage, one alert remained visible while all five cached Workflow statuses stayed present.
- Recovery completed without reload. Client-side navigation then returned 2 projects, 10 issues, 10 My work issues, 1 saved view, and 5 statuses with zero alerts or viewport overflow.
- The SQLite file remained byte-identical at SHA-256 `c90222fbaec1dc799a527abfc8c934f4cb91646a2d7b853fc3ef7037f1d3fd84`; canonical state remained `63653a718fc9d3b8edb4ec886e193faae714f66e708f287290f41c257c625aa2`.

## Review Boundary

Implementation output is committed at `670a9f96e989654d84408e30c527e85b765a9042`. The three-second live success banner elapsed before the connected sampling call returned; rendered tests cover its progress, success, and failure semantics. A distinct application review is still required, so CT-113 remains In Progress and this handoff does not authorize Testing acceptance. CT-12 and P-T21 must be reconciled for product revision `670a9f9`; no complete browser, release, legal, identity, publication, or outcome claim is made.
