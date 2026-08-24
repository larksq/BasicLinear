# CT-106 Implementation Session

- Issue: `CT-106`, stable ID `ac8d8b25-e69c-4220-a466-ac0ab7587d06`, created at revision `1` and completed at revision `2`.
- Session: `CT106-IMPLEMENT-20260822T091635Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, external account, or outbound runtime service was used.

## Finding

At 390x844, the open mobile drawer and issue detail both listened for the same bubbling Escape event on `window`. Escape closed the drawer, then the detail listener handled the same event and removed the issue route, losing user context.

## Implementation

1. Made the drawer own Escape during the capture phase while it is open.
2. Prevented default and stopped propagation before closing the drawer.
3. Kept listener registration and cleanup symmetric with the same capture option.
4. Retained the existing close routine, including focus restoration to `Open navigation`.
5. Added a focused source regression for interception, close dispatch, and cleanup.

## Independent Review

An independent reviewer found no remaining issue. The reviewer confirmed that capture-phase interception prevents the issue-detail bubble listener from seeing the event only while the drawer is open, cleanup is symmetric, and normal detail Escape remains unchanged when the drawer is closed. The reviewer made no file or task-store mutation.

## Verification

- Focused regression: 1 file / 1 test passed.
- Complete regression: 70 files / 461 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,949 modules, 105 files / 1,894,235 bytes, without warnings.
- Release-audit regression: 10 / 10 tests passed.
- Current Chrome: 390x844. Escape from the trigger, scrim, drawer navigation, and a subsequently focused issue-detail control closed only the drawer, preserved the exact issue URL, and restored one visible 2px focus indicator to `Open navigation`.

## Acceptance Boundary

CT-106 closes only mobile drawer Escape arbitration. Product revision `cf99bb834f544633ad820328817dcc2320d09744` requires fresh independent P-T21 qualification. CT-12 retains the complete P-T18, P-T19, and P-T20 acceptance surfaces; identity/legal, accountable release, publication, cross-platform, and outcome gates remain open.
