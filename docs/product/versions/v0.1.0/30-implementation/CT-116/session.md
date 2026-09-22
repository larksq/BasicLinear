# CT-116 Implementation Session

- Issue: `CT-116`, stable ID `a0267e95-cffb-4dd2-ae3d-01dcc646f638`, created at revision `1`, evidence synchronized at revision `2`, and expected to complete at revision `3`.
- Session: `CT116-IMPLEMENT-20260822T184413Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Google account, Docker, database server, or outbound runtime service was used.

## Finding

Exact Chrome UAT exposed a controlled-native-date race outside the issue due-date surface fixed by CT-104. While a user entered a project or milestone date by keyboard, a valid intermediate native value could trigger a parent render. React then replaced the input value before the remaining native segments were complete, corrupting or clearing the draft.

## Implementation

1. Added one shared `BufferedDateInput` for issue due date, project start, project target, and milestone target.
2. Kept the native date input uncontrolled while focused and dirty, including partial keyboard segments whose serialized value remains empty.
3. Synchronized confirmed authority after parent renders whenever no focused dirty draft exists.
4. Committed a complete valid date or deliberate clear once on blur; restored invalid input and rejected stale baselines.
5. Made Escape restore authority and Enter commit through blur without native form submission.
6. Preserved existing issue mutation behavior and added project failure readback plus milestone retryable-draft recovery.
7. Left the API, SQLite schema, one-owner scope, stable internal scope metadata, canonical transfer, authentication, and collaboration surfaces unchanged.

## Verification

- Implementation-focused regression: 4 files / 35 tests passed.
- Independent focused regression: 5 files / 42 tests passed.
- Complete regression: 72 files / 475 tests passed.
- Typecheck: all 8 workspaces passed.
- Release-audit regression: 10 / 10 tests passed.
- Production build: 1,952 modules with zero warnings.
- Chrome 151 at 1440x900: segmented project and milestone dates remained stable until commit; invalid partial Escape and blur restored authority; full reload persisted dates; service outage was disclosed; automatic local-owner recovery completed without reload after restart.

## Independent Review

Distinct actor `codex-independent-application-review-ct116`, session `CT116-INDEPENDENT-REVIEW-20260822T185649Z`, reviewed the exact eight-file product diff in an isolated clean checkout at `f7c3625`. The reviewer reran all declared checks and found no remaining defect or material test gap. See `evidence/independent-review.json`.

## Acceptance Boundary

Product output is committed at `f7c362562fdf0657114a862331b893e470b824c0`, tree `7b5f5af4d6f0b5ead0f403f69d4695b82779194c`. CT-116 closes this bounded native-date defect only. Complete CT-12 workflow, accessibility, responsive, appearance, golden, and performance matrices; fresh CT-82/P-T21 qualification; CT-3 identity/legal review; CT-13 release review; publication; and outcomes remain separate gates.
