# CT-12 Current Testing Session

- Issue: `CT-12`, stable ID `b6a43ac3-2f25-40d8-aa36-2738d0bb59a9`, read back In Progress at revision `95`.
- Session: `CT12-TEST-20260821T100112Z`.
- Actor: `codex-testing-ct12-current`, independent for the recorded browser-test session; CT-90 through CT-102 synchronization was performed by `codex-application-engineering` and is retained only as implementation evidence.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, or UI was used.

## Work

1. Rechecked Chrome-only transport after reading the configured recovery contract.
2. Confirmed Chrome 151 is running, Profile 1 owns an installed and enabled extension, and the native-host manifest and allowed origins are correct.
3. Performed the required two-second browser-client retry; both attempts reported browser unavailable.
4. Used no fallback browser and accessed no provider session or account state.
5. Audited P-T18 through P-T21 freshness against the final owner-only and SQLite scope.
6. Reopened P-T20 because retained screenshots predate the current owner-only source.
7. Replaced the stale historical result package with a concise current decision, evidence map, and executable Chrome matrix.
8. Synchronized CT-90 implementation evidence and expanded P-T19/P-T20 to cover System behavior and deterministic pinned Light/Dark captures.
9. Synchronized CT-91 implementation evidence and expanded P-T18/P-T19 to cover true-empty, filtered, search, archive, contextual-create, focus, and long-content behavior.
10. Retried Chrome transport once. The fifth cumulative attempt failed before page open; the execution-time request to open Profile 1 was rejected because direct user approval is required.
11. Synchronized CT-92 implementation evidence and expanded P-T18/P-T19/P-T20 to cover initial-failure exclusivity, exact retry, stale-data preservation, alert/focus behavior, long diagnostics, restored data, and responsive query-error geometry.
12. Retried Chrome transport once. The sixth cumulative attempt failed before page open; no fallback browser was used.
13. Synchronized CT-93 implementation evidence and expanded P-T18/P-T19/P-T20 to cover loopback disconnect/reconnect, owner-bootstrap separation, retained lists/details/drafts, retry focus, one disconnect alert, one reconnect status, restored active data, long diagnostics, and responsive banner geometry.
14. Retried Chrome transport once. The seventh cumulative attempt failed before page open; no fallback browser was used.
15. Synchronized CT-94 implementation evidence and expanded P-T18/P-T19/P-T20 to cover per-issue title, description, resource, and new-comment draft restoration and isolation through navigation, responsive remount, local-service interruption, conflict reapply, matching save/discard, long labels, focus, and pinned-theme geometry. The eighth cumulative Chrome attempt failed before page open after the prescribed two-second retry; no fallback browser was used.
16. Synchronized CT-95 implementation evidence and expanded P-T18/P-T19/P-T20 to cover owner-only archived-project purge, wrong and exact confirmation, atomic preservation of active and archived issues, counted feedback, list focus, long names, responsive geometry, and pinned-theme screens. No additional Chrome connection attempt was made; the cumulative count remains eight.
17. Synchronized CT-96 implementation evidence and expanded P-T18/P-T19/P-T20 to cover owner-only archived-milestone purge, wrong and exact confirmation, same-project preservation of active and archived issues, retained project activity, URL-context clearing, counted feedback, contextual focus, long names, responsive geometry, and pinned-theme screens. No additional Chrome connection attempt was made; the cumulative count remains eight.
18. Reapplied the required Chrome recovery procedure. Both the initial tab-list probe and its prescribed two-second retry failed before page open, bringing the cumulative count to ten. Chrome 151, selected Profile 1, the enabled extension, and the native-host manifest passed fresh diagnostics. The execution-time request to open the authenticated profile was rejected pending fresh explicit user approval; no workaround or fallback browser was used.
19. Synchronized CT-97 implementation evidence and expanded P-T18/P-T19/P-T20 to cover visible named issue/project/milestone archive Undo, exact server-returned revision restore, pending and failure semantics, latest-action replacement, dismissal, activity and dependent-data readback, focus transfer and recovery, long names, responsive geometry, and pinned-theme screens. No additional Chrome connection attempt was made; the cumulative count remains ten.
20. Reviewed archive live-region behavior, removed duplicate legacy success and raw Undo-failure announcements, rebuilt the current candidate, and synchronized the final implementation hashes. No additional Chrome connection attempt was made; the cumulative count remains ten.
21. Synchronized CT-98 implementation evidence and expanded P-T19/P-T20 to require an exact computed `44px` topbar across baseline viewports and live breakpoints, token-aligned recovery/detail containment, opaque unblurred Light/Dark paint, focus visibility, and zero overlap or document overflow. No additional Chrome connection attempt was made; the cumulative count remains ten.
22. Synchronized CT-99 implementation evidence and expanded P-T19/P-T20 to require a computed project Overview maximum of `920px`, fluid non-overview work views, `20px` page titles, `24px` displayed and edited project titles, and unblurred dialog paint across all baseline viewports and live breakpoints. No additional Chrome connection attempt was made; the cumulative count remains ten.
23. Synchronized CT-100 implementation evidence and expanded P-T19/P-T20 to require visible unclipped cyan focus/selection across global controls, fields, project and issue rows/cards, boards, tabs, editors, drag targets, checkboxes, dialogs, and primary commands, with pinned Light/Dark contrast, equivalent explicit/System Dark resolution, and non-color cues. No additional Chrome connection attempt was made; the cumulative count remains ten.
24. Synchronized CT-101 implementation evidence and expanded P-T19/P-T20 to require explicit, contrast-checked subtle semantic text paint for long recovery correlation identifiers and the workflow-status drag handle, including visible focus, non-color pointer/keyboard affordance, and stable containment. No additional Chrome connection attempt was made; the cumulative count remains ten.
25. Synchronized CT-102 implementation evidence and expanded P-T19/P-T20 to require the explicit issue-properties inspector at 390x844 and across 767/768, including default collapse, named controlled-region state, pointer and keyboard operation, focus retention, forced pending/error visibility, long labels, stable geometry, continuous tablet/desktop visibility, and pinned Light/Dark plus live System paint. No additional Chrome connection attempt was made; the cumulative count remains ten.
26. Final source review reopened CT-102 after identifying that the authored `.issue-properties { display: grid; }` rule could override the browser's user-agent `[hidden]` rule. Added an explicit `.issue-properties[hidden] { display: none; }` rule, reran focused and complete regression, typecheck, release-audit regression, production build, and byte-integrity checks, and made no additional Chrome attempt.
27. Consumed the distinct-actor strict CT-82 result from clean revision `a746615f31576675955b6610d559e0358870fe0e`. The independent runner reproduced the locked artifact, passed all 21 checks, recorded zero guarded outbound-network or subprocess attempts, and accepted P-T21. This synchronization changes evidence only and makes no additional Chrome attempt.

## Current Evidence

- `npm test`: 69 files / 455 tests passed.
- `npm run typecheck`: 8 of 8 workspaces passed.
- `npm run build`: 1,949 modules, 105 output files, 1,893,145 output bytes; no warning.
- `npm run test:release-audit`: 6 of 6 tests passed.
- Combined clean-runtime and release-evidence regression: 10 of 10 tests passed.
- Isolated loopback readiness and liveness: `{"status":"ready"}` and `{"status":"ok"}` at port 4283 using a temporary local data directory; the existing loopback candidates were left untouched.
- Independent CT-82 strict qualification: `PASSED_INDEPENDENT_RUNTIME_GATE` for clean revision `a746615f31576675955b6610d559e0358870fe0e` and artifact `52d4ca71088c5073cdc23bbe3e0bcd985df241455651d34a490cf36d01bad125` across 111 files / 2,048,386 bytes. All 21 checks passed; six guarded phases recorded zero outbound-network or subprocess attempts; P-T21 is accepted for the tested macOS 25.5 arm64 / Node 24.18 environment.
- CT-90 focused appearance regression: 1 file / 5 tests passed; implementation evidence only.
- CT-91 focused empty-state regression: 1 file / 5 tests passed; implementation evidence only.
- CT-92 focused query-recovery regression: 1 file / 5 tests passed; implementation evidence only.
- CT-93 focused local-service recovery regression: 1 file / 6 tests passed; implementation evidence only.
- CT-94 focused issue-detail draft regression: 1 file / 6 tests passed; implementation evidence only.
- CT-95 focused and related project-purge regression: 6 files / 31 tests passed; implementation evidence only.
- CT-96 focused and related milestone-purge regression: 6 files / 32 tests passed; implementation evidence only. The isolated live route rejected active purge with HTTP 400 and preserved one linked issue in its project after confirmed archived purge.
- CT-97 focused archive-Undo regression: 1 file / 5 tests passed; implementation evidence only. The isolated same-origin live workflow archived and restored one project, milestone, and issue at revisions `1 -> 2 -> 3` each.
- CT-98 focused shell/recovery regression: 2 files / 9 tests passed; implementation evidence only. The isolated served CSS contains the accepted 44px header token and contains neither raw `49px` nor the removed `blur(12px)` topbar effect.
- CT-99 focused visual/navigation/overview regression: 3 files / 14 tests passed; implementation evidence only. The isolated served CSS contains the accepted 920px, 20px, and 24px tokens, overview-only cap, and fluid work-surface rule, with no backdrop filter or stale heading rule.
- CT-100 focused focus-palette/appearance/visual regression: 3 files / 13 tests passed; implementation evidence only. The isolated served CSS contains one Light cyan focus token and two identical explicit/System Dark cyan tokens, contains neither retired blue focus value, and retains semantic global/project/issue focus consumers.
- CT-101 semantic-token focused and related regression: 5 files / 35 tests passed; implementation evidence only. The isolated served CSS contains one Light and two identical explicit/System Dark subtle-text definitions, all three intended recovery/workflow consumers, no undefined semantic token consumer, and deterministic surface contrast of at least 4.5:1.
- CT-102 mobile issue-inspector focused and related regression: 4 files / 37 tests passed; implementation evidence only. The isolated candidate serves all nine web artifacts byte for byte and contains the accepted 768px state contract, named controlled region, 42px mobile trigger, pending/error forced visibility, issue-navigation reset, an explicit author-origin `[hidden]` paint rule, and a continuously visible tablet/desktop property region.
- Chrome transport: 10 cumulative attempts; browser unavailable before page open, and opening the authenticated profile requires fresh explicit user approval.
- Chrome UAT: 0 steps, 0 current screenshots; pinned Light, pinned Dark, and live System behavior remain unrendered.

## Boundary

This synchronization passes P-T21 only. It does not pass P-T18, P-T19, or P-T20 and makes no rendered, accessibility, fidelity, cross-platform, outcome, identity, legal, provenance-approval, or release assertion.

## 2026-08-22 Current Chrome Continuation

28. Connected the required Chrome 151 transport to the current candidate at `http://127.0.0.1:4284/` with synthetic owner-only data. No external account or authenticated website state was used.
29. Inspected bounded project, ordered-milestone, global issue-create, issue-detail, Light/Dark, desktop/tablet/mobile, and exact 767/768 issue-properties states. The checked shell had a 44px opaque unblurred topbar, 920px project Overview, 24px project title, correct mobile Properties disclosure behavior, and no document overflow at the sampled boundaries.
30. Found that the native due-date field could erase segmented keyboard drafts. CT-104 introduced explicit dirty/baseline handling and was independently reviewed through stale-authority, rejected-write, and initially empty partial-segment regressions.
31. Verified the final CT-104 build in Chrome: complete date commit, Escape restoration, SSE authority reconciliation, forced rejected-write restoration, and empty partial `09/dd/yyyy` retention across SSE all behaved as specified. Four current-build screenshots were recorded; the six earlier CT-12 captures remain historical.
32. Consumed distinct-actor CT-82 qualification for clean product revision `6d2f330e15cc714b2e131d0fd693bc1d4cdcff78`. All 21 strict checks passed for artifact SHA-256 `4a5b3867a51f7f5e216cd93fe5f12523c81b9d936918216abae78626c06768d0`.

## Current Evidence Refresh

- `npm test`: 69 files / 460 tests passed.
- `npm run typecheck`: 8 of 8 workspaces passed.
- `npm run build`: 1,949 modules / 109 files / 1,912,735 bytes; no warning.
- `npm run test:release-audit`: 10 of 10 tests passed.
- Chrome transport: connected; 4 current CT-104 captures and 6 historical CT-12 captures.
- P-T18, P-T19, and P-T20: in progress and incomplete.
- P-T21: passed independently.

## Refreshed Boundary

Transport is no longer blocked, but bounded execution is not full acceptance. CT-12 remains In Progress until every P-T18 workflow, P-T19 accessibility/responsive check, and P-T20 golden/performance requirement is executed. No complete UAT, accessibility, fidelity, release, publication, or outcome assertion is made.

## 2026-08-22 Accessibility And Keyboard Continuation

33. Continued the current Chrome matrix at exact 1440x900 and 390x844 viewports in pinned Dark and Light themes with synthetic owner-only data.
34. Found a missing direct focus indicator on the keyboard-focused rich-text surface. CT-105 added a contained token-driven 2px outline, received no-finding independent review, and passed a 42-Tab live focus check.
35. Found that mobile drawer Escape also dismissed the open issue route. CT-106 made the drawer own Escape during capture, received no-finding independent review, and preserved the exact issue URL plus visible trigger focus from four tested focus origins.
36. Verified mobile Properties default collapse, pointer/keyboard expansion, focus retention, named controlled-region state, pinned Dark/Light paint, 44px opaque topbar, and zero checked unnamed-control, invalid-ARIA, direct-text contrast, or overflow failures. Two current screenshots were recorded.
37. Found a dangling project-menu `aria-controls` reference while the menu was closed. CT-107 made the relationship conditional, received no-finding independent review, and passed a live closed/open/closed keyboard and focus check at 1440x900.
38. Bound the three fixes to local product revision `cf99bb834f544633ad820328817dcc2320d09744` and tree `5bb99828de1171fa47137fe497b062212248f454`. The prior `6d2f330` P-T21 result is now historical; fresh independent qualification is required before P-T21 can pass for the current candidate.

## Current Evidence Refresh 2

- `npm test`: 70 files / 461 tests passed.
- `npm run typecheck`: 8 of 8 workspaces passed.
- `npm run build`: 1,949 modules / 105 files / 1,894,235 bytes; no warning.
- `npm run test:release-audit`: 10 of 10 tests passed.
- CT-105, CT-106, and CT-107 independent application reviews: passed with no finding.
- Current Chrome captures: 9 bounded current-build captures plus 6 historical screenshots.
- P-T18, P-T19, and P-T20: in progress and incomplete.
- P-T21: superseded by the later accepted `cf99bb8` qualification recorded below.

## Current Boundary 2

The three observed defects are fixed, but this is not complete browser or release acceptance. The automated accessibility engine could not be injected into the Chrome bridge's hardened evaluation realm; structured accessibility-tree, DOM, computed-style, focus, geometry, and contrast checks were used for the bounded states, and the complete automated accessibility requirement remains open. CT-12 remains In Progress.

## 2026-08-22 Core Route Matrix Continuation

39. Audited settled My work, Projects, Issues, Views, and Workflow states at 1440x900 and 390x844 in pinned Light and Dark. All 20 states exposed one main, nav, and H1; a 44px opaque unblurred topbar; and zero duplicate IDs, unnamed controls, invalid ARIA references, direct-text contrast failures, alerts, or horizontal overflow.
40. Walked the actual Tab order through all 20 route/viewport/theme states. Across 410 focus stops, every active control matched `:focus-visible`, painted a non-none outline of at least 2px, remained in the viewport, and exited the document without trapping focus.
41. Captured and hash-bound the five settled desktop core routes in both pinned Light and Dark. Visual inspection found no blank state, theme mismatch, overlap, or clipping in the sampled set. P-T20 advances to 10 / 60 named captures; the remaining detail, creation, command, error, reconnect, draft, purge, archive, live System, and performance states remain open.

## Current Evidence Refresh 3

- Structured core-route accessibility states: 20 / 20 passed.
- Real keyboard traversal: 410 focus stops, 0 focus-visible, indicator, viewport-visibility, or trap failures.
- P-T20 named captures: 10 / 60 current, pinned Light/Dark.
- Current-build screenshots: 19; historical screenshots: 6.
- P-T18, P-T19, and P-T20 remain partial; P-T21 is independently accepted for `cf99bb8`.

42. Consumed the final distinct-actor CT-82 qualification for exact product revision `cf99bb834f544633ad820328817dcc2320d09744`. Session `CT82-INDEPENDENT-20260822T095807Z` passed all 21 strict checks from a clean isolated checkout, bound source-set SHA-256 `933a89469ee5bf29d61cfa4be661f1fc2ce2a4f6ef107192425be6b0973b5ad7`, and reproduced artifact SHA-256 `4380a34d46c60b8abce09ad2c2684e47498bcb635fe6809eb9c346f16c2a4a69`. CT-103 and CT-82 read back Done at revisions 5 and 15. This passes P-T21 only; CT-12 remains In Progress for P-T18, P-T19, and P-T20.

## 2026-08-22 Current Candidate Continuation

43. Continued Chrome traversal and found two issue-detail defects at `cf99bb8`: missing semantic focus paint on the title/native due-date surfaces and focus-only TipTap normalization creating an empty retained draft. Registered CT-110 and CT-111 in project-local Control Tower.
44. Implemented both fixes at `1e960558bba51413657f75391478e56ddbdac275`. Focused tests passed 2 files / 11 tests for CT-110 and 1 file / 7 tests for CT-111. Exact Chrome readback passed in Light and Dark for focus paint and passed discard -> reload -> 44 Tabs -> meaningful input -> matching discard for draft state.
45. Began the expanded golden tranche and found every default-density board title internally clipped: 86px cards resolved the title track to 8px against a 16.2px line-height. Registered CT-112, replaced the density geometry, and committed product revision `7665027c0266fa5f0be0070dd75c2541959a9eb5`.
46. Verified CT-112 in compact, default, and comfortable modes in pinned Light and Dark. All 60 measured cards retained a complete title track, contained metadata, exact 6px inter-card separation, and zero viewport overflow. Focused regression passed 3 files / 31 tests.
47. Ran current complete verification: 70 files / 465 tests, all eight workspace typechecks, 10 / 10 release-audit regressions, and a warning-free 1,949-module production build with 105 governed runtime files / 1,895,747 bytes.
48. Recaptured 10 named 1440x900 states in pinned Light and Dark. All 20 current states settled without loading or alerts and passed the structured landmark, ID, control-name, ARIA-reference, 44px topbar, blur, and viewport-overflow audit. P-T20 advances to 20 / 60.
49. Preserved freshness boundaries: CT-110/111/112 remain In Progress pending distinct application review; the prior 410-stop keyboard/core-route tranche and CT-82 P-T21 acceptance remain historical for `cf99bb8`; current `7665027` requires a new keyboard tranche where applicable and fresh independent P-T21 qualification.

## Current Evidence Refresh 4

- Current product revision/tree: `7665027c0266fa5f0be0070dd75c2541959a9eb5` / `573f0747c927aa0b35a1688de73c508c70665978`.
- Application regression: 70 files / 465 tests passed.
- Typecheck: 8 / 8 workspaces passed.
- Release-audit regression: 10 / 10 passed.
- Production build: 1,949 modules / 105 governed files / 1,895,747 bytes; no warning.
- Current structured visual states: 20 / 20 passed.
- P-T20 named captures: 20 / 60 current, pinned Light/Dark.
- CT-110, CT-111, CT-112: implementation complete, review pending.
- P-T18, P-T19, P-T20: partial. P-T21: pending for `7665027`.

## 2026-08-22 Complete Named Golden-State Continuation

50. Extended the exact `7665027` Chrome run from 20 to all 60 required pinned Light/Dark named states. The final set contains 56 desktop captures at 1440x900 and four direct mobile-detail captures at 390x844.
51. Exercised compact/expanded issue create, empty/result command search, project/issue/four-subsection query failure with successful Retry, true loopback outage, transient reconnect, content/comment drafts, issue/project/milestone archive Undo, and archived project/milestone purge confirmation/result states. Destructive checks used synthetic records only.
52. Restored the fixture after the destructive tranche and verified two projects, two milestones, and ten active issues through Chrome. The production service resumed at `http://127.0.0.1:4284/`; the fault proxy was stopped and disabled.
53. Audited every new state for landmarks, accessible control naming, ARIA references, duplicate IDs, topbar paint and geometry, theme resolution, and viewport overflow. The combined 60-state audit has zero failures. Fourteen expected alerts appear only in eight query/local-service recovery states.
54. Visually inspected the Light and Dark contact sheets and each new capture. The complete 60-state set has zero observed blankness, theme mismatch, overlap, or clipping and is bound to immutable image revision `440b6da5c015663fc20d30551b037e97ae8a71da`.

## Current Evidence Refresh 5

- Current product revision/tree: `7665027c0266fa5f0be0070dd75c2541959a9eb5` / `573f0747c927aa0b35a1688de73c508c70665978`.
- Application regression: 70 files / 465 tests passed; all eight workspace typechecks, 10 / 10 release-audit regressions, and the warning-free 1,949-module build remain current.
- P-T18: in progress; bounded recovery, reconnect, draft, archive, and purge paths exercised, with the remaining integrated workflow/failure/focus/refresh/restart matrix open.
- P-T19: in progress; 60 structured states pass, while keyboard, automated accessibility-engine, full responsive, long-content, live System, and overlap matrices remain open.
- P-T20: in progress; named capture set complete at 60 / 60, while live System behavior and protected performance budgets remain open.
- CT-110, CT-111, CT-112: implementation complete, distinct review pending. P-T21: pending exact-revision independent qualification.

## Current Boundary 5

Completing the named visual set does not complete P-T20 or CT-12. No complete UAT, accessibility, responsive, fidelity, performance, independent-runtime, release, publication, or outcome assertion is made.

## 2026-08-22 Restart Recovery And Current-Revision Reconciliation

55. Restarted the exact `7665027` release process while the connected page remained open. Cached content stayed visible, but the process-scoped local-owner session was no longer authoritative; protected reads returned `AUTHENTICATION_REQUIRED` until a page reload. Registered CT-113 in project-local Control Tower rather than accepting the stale state.
56. Implemented single-flight local-owner session renewal at product revision `670a9f96e989654d84408e30c527e85b765a9042`. Renewal now completes before protected query invalidation, caches the renewed CSRF proof, recreates the workspace event stream, and exposes explicit retry only when renewal fails.
57. Ran focused regression (3 files / 14 tests), complete regression (71 files / 469 tests), all eight workspace typechecks, 10 / 10 release-audit regression tests, and a warning-free 1,950-module build with 109 governed files / 1,915,948 bytes.
58. Completed two live process-restart cycles without page reload. The outage retained five cached Workflow statuses behind one alert; recovery restored client-side Projects, Issues, My work, Views, and Workflow navigation with zero alerts or overflow. The SQLite file and canonical state digests remained exact.
59. Repeated the core route audit on `670a9f9`: 20 / 20 desktop/mobile Light/Dark states passed across 638 visible controls. Sequential keyboard traversal covered 482 Tab stops with zero focus-visible, indicator, viewport-visibility, or trap failures.
60. Repeated the responsive tranche at 767/768/1199/1200 in Light and Dark. All 24 pinned states matched accepted geometry; all six live-resize states and pointer/keyboard Properties operation passed with zero document overflow.
61. Loaded 2,002 active issues on current asset `index-B3mCRRCV.js`. The virtualized list mounted 27 to 35 rows against a maximum of 70; two 500ms-separated frames were byte-identical; checked row, scroll-region, topbar, alert, and overflow geometry passed. Comparable current input-to-visible-state timing was not claimed because the available connected interaction methods added automation round-trip latency.
62. Reconciled CT-12 in project-local Control Tower only. The revision-checked update created backup `tasks-v0.8-before-issue-update-2026-08-22T15-14-23-463Z-357d6886-e803-4534-969b-ca05903ca135.json` at SHA-256 `505965418e003256d7765c36de2d51fe1591ef0d0bc85d39610d27fc458bc459`; fresh readback returned `CT-12@89`, In Progress, provider projection disabled and `not_synced`.

## Current Evidence Refresh 6

- Current product revision/tree: `670a9f96e989654d84408e30c527e85b765a9042` / `d4c147b50bee345542286386934ac6e50f11aaf7`.
- Application regression: 71 files / 469 tests passed; all eight workspace typechecks, 10 / 10 release-audit regression tests, and the warning-free 1,950-module build passed.
- P-T18: bounded restart recovery now passes; the complete integrated workflow/failure/focus/refresh matrix remains open.
- P-T19: current route, 482-stop keyboard, pinned responsive, live-resize, and Properties-operation tranches pass; full engine, long-content, forced pending/error, and live System checks remain open.
- P-T20: current virtualization, stable-frame, and geometry checks pass; the 60-image golden set and 71.8ms p75 timing remain historical for `7665027`, while current golden, comparable timing, and live System response remain open.
- CT-110, CT-111, CT-112, and CT-113: implementation complete, distinct review pending. P-T21: pending exact-revision independent qualification for `670a9f9`.

## Current Boundary 6

The restart defect is fixed in implementation and current bounded checks pass, but CT-12 remains In Progress. No complete UAT, accessibility, responsive, fidelity, performance, independent-runtime, release, identity, legal, publication, or outcome assertion is made.

## 2026-08-22 Current Core Visual Continuation

63. Captured the 12 non-destructive core screen types in pinned Light and Dark against exact product revision `670a9f96e989654d84408e30c527e85b765a9042`: Projects, My work, Issues, Views, Workflow, project Overview/Milestones/Activity, issue board, contextual detail, and direct mobile detail with Properties closed and open. The tranche contains 20 desktop images at 1440x900 and four mobile images at 390x844.
64. Sealed the 24 JPEGs in image-only evidence revision `87dda2985c56bfaa80ad17360beb645e6f22f534`. Each file passed signature, exact-dimension, byte-count, SHA-256, path-uniqueness, and candidate-binding checks.
65. Audited every state for main/H1 and navigation landmarks, accessible control naming, ARIA references, duplicate IDs, direct-text contrast, 44px opaque unblurred topbar paint, alerts, and document overflow. All 24 structured audits passed. Contact-sheet and full-size inspection found no blankness, theme mismatch, incoherent overlap, or clipping; the board's explicit horizontal data-region scroll is expected.
66. Reconciled CT-12 through one revision-checked project-local Control Tower update. Backup `tasks-v0.8-before-issue-update-2026-08-22T15-42-26-985Z-33b88512-ac5d-4240-8c4f-140aee59e86c.json` is 461,798 bytes at SHA-256 `ce65e543bcb9557af0557111df5d20f99c25e2f5f0e459a78aab71958acf86e3`; independent fresh readback returned `CT-12@90`, In Progress, with provider projection disabled and `not_synced`.

## Current Evidence Refresh 7

- P-T20 current named captures: 24 / 60, comprising 12 core screen types in pinned Light and Dark.
- Current core visual audit: 24 / 24 passed; zero observed blank/theme, overlap/clipping, control-name, ARIA-reference, contrast, topbar, alert, or document-overflow failures.
- Remaining current named captures: 36 across 18 dialog, command, fault, reconnect, draft, purge, and archive screen types.
- Historical complete visual set: 60 / 60 at `7665027`; retained as non-current evidence.
- Private raw observation: `.control-tower/evidence/CT-12/core-visual-670a9f9-capture-run.json`, SHA-256 `1c0e0f237a1b5e1f16c35718ba83a69ccd2f43ed260f5bd822cc04873ff26139`.

## Current Boundary 7

The core visual tranche advances P-T20 but does not complete it. The 36 dynamic captures, comparable current interaction timing, and live System response remain open, along with the existing P-T18, P-T19, review, and P-T21 gates. No complete fidelity, performance, release, or outcome assertion is made.

## 2026-08-22 Exact f7c3625 Qualification And Performance Continuation

67. Reconciled the runtime delta from `279a9b2` to exact product revision `f7c362562fdf0657114a862331b893e470b824c0`. Five runtime files now share the issue, project, and milestone native-date draft, authority-sync, commit, invalid-restore, Escape, and Enter contract; API, SQLite, schema, local-owner scope, canonical transfer, and global layout sources remain unchanged.
68. Credited CT-116's exact Chrome tranche for 10 bounded project/milestone draft, commit, invalid-restore, reload, outage, recovery, and restart-readback checks at 1440x900. Kept issue due-date evidence at focused and full regression scope, without inventing a separate Chrome acceptance.
69. Recorded the independent CT-82/P-T21 pass by `codex-independent-testing-ct82-f7c3625` / `CT82-INDEPENDENT-20260822T191944Z`: 21 / 21 structured checks, 4 / 4 runner-contract tests, a clean 1,197-file source set, a reproduced 111-file artifact, zero outbound or subprocess attempts, and no self-acceptance.
70. Ran the exact f7c3625 Chrome performance fixture with 2,002 active issues. Retained a 20-sample warm-up and the first timed p75 `100.6 ms` failure; the latter is invalidated because it overlapped the independent build and guarded strict qualifier. After the qualifier completed and a three-second quiescence interval, the identical 20-transition run passed at p75 `43.6 ms` against the `100 ms` threshold.
71. Sampled virtualization at scroll positions 0, 1,200, 13,200, 37,200, and 71,503. Mounted rows stayed between 24 and 33 against the limit of 70, with zero row overlap, alerts, out-of-range rows, or document overflow. Two frames after 1,800 ms settle and 500 ms separation were byte-identical at SHA-256 `82f4d4f67cc6b8567938d3c36940141c1f05e6e78b518372c8192863f018ab84`.
72. Preserved the viewport limitation. External Chrome reported `1654x875` at device-pixel ratio 2 after the requested `1440x1000` override, so timing, bounded-row, stable-frame, and geometry thresholds pass at the observed viewport while exact-viewport comparison remains open. Live two-direction System appearance remains untested because no action-time authorization was supplied.

## Current Evidence Refresh 8

- Current product revision/tree: `f7c362562fdf0657114a862331b893e470b824c0` / `7b5f5af4d6f0b5ead0f403f69d4695b82779194c`.
- Exact automated evidence: 72 files / 475 tests, 8 / 8 workspace typechecks, 10 / 10 release-audit tests, and a warning-free 1,952-module build.
- CT-110 through CT-116: resolved with distinct application review.
- P-T21: exact-revision independent pass.
- P-T18: bounded restart, recovery, date-draft, archive, and purge paths pass; complete integrated matrix open.
- P-T19: bounded route, keyboard, responsive, and date-control support passes; engine, longest-content, forced-state, and live System matrix open.
- P-T20: exact timing, virtualization, stable-frame, and geometry pass at observed `1654x875@2x`; exact-candidate golden completeness, reflected `1440x1000`, and live System response open.

## Current Boundary 8

CT-12 remains In Progress. Passed P-T21 and bounded performance evidence do not complete the missing P-T18, P-T19, or P-T20 surfaces. No complete browser, accessibility, fidelity, performance, release, identity, legal, publication, or outcome assertion is made.

## 2026-08-22 Exact d524c5c Golden And Performance Continuation

73. Reconciled the current source to product revision `d524c5c7eff38664bad7b8fb612283f2e2092563` and tree `4c5e21bbf45386f11face5c034dd433b663d14e0`. The three-file delta adds issue-title autosizing and its focused contract without changing API, session, SQLite, schema, scope, transfer, project/milestone date, or global layout sources.
74. Retained exact automated verification: four focused files / 18 tests, 73 complete files / 478 tests, all eight workspace typechecks, 10 release-audit tests, and a warning-free 1,953-module build. CT-117 implementation and six bounded Chrome checks pass; distinct application review remains pending.
75. Captured all 30 named states in pinned Light and Dark using persistent Chrome against exact asset `assets/index-DtJuzGa7.js`. The 60-state set contains 56 desktop `1440x900@1x` and four mobile `390x844@1x` JPEGs.
76. Validated every image against its sealed ledger for JPEG signature, exact dimensions, bytes, SHA-256, source revision/tree/asset, H1/main, topbar, paint, overflow, control naming, duplicate IDs, ARIA references, bounded direct-text contrast, alerts, visible controls, and private source mode. All 60 passed; combined image SHA-256 is `f63e8fface9f1528b451f71dc0920a0a534ab5e00e45e339151b016566cb2f8c`.
77. Exercised wrong-name and exact-name milestone and project purge confirmation in both themes. All four wrong names were rejected while retaining their dialogs; all exact names completed; the synthetic fixture was restored.
78. Inspected Light and Dark contact sheets. All 60 states were framed, nonblank, theme-correct, and free of observed clipping or incoherent overlap. This is self-authored visual review, not independent acceptance or a substitute for the P-T19 third-party engine.
79. Loaded 2,002 active issues on the exact current asset at requested and observed `1440x1000@1x`. The accepted 20-transition run passed at p75 `53.7 ms` against `100 ms`; virtualization mounted at most 35 rows; two settled frames were byte-identical; and checked geometry had zero row overlap, out-of-range rows, alerts, document overflow, or topbar failure.
80. Closed the former exact-viewport limitation. Kept the live two-direction System check open because changing macOS Appearance requires action-time authorization. The app preference was System and the current host direction resolved Dark.
81. Superseded the prior `f7c3625` P-T21 receipt for current acceptance. Exact `d524c5c` CT-82 qualification and CT-117 distinct application review remain required.

## Current Evidence Refresh 9

- Current product revision/tree: `d524c5c7eff38664bad7b8fb612283f2e2092563` / `4c5e21bbf45386f11face5c034dd433b663d14e0`.
- P-T18: bounded restart, recovery, date-draft, archive, purge, and exact-name confirmation paths pass; complete integrated matrix open.
- P-T19: bounded route, keyboard, responsive, exact visual, and title-autosize support passes; third-party engine, longest-content, forced-state, and live System matrix open.
- P-T20: exact-current 60-state golden and exact-viewport protected performance pass; live two-direction System response open.
- P-T21: pending exact-current independent qualification.
- CT-117: implementation complete; distinct application review pending.

## Current Boundary 9

CT-12 remains In Progress. Exact golden and performance progress does not complete P-T18, P-T19, System behavior, distinct review, or independent qualification. No complete acceptance, release, publication, legal, identity, or outcome assertion is made.

82. Committed the exact-current evidence as `42c0160b2938d0ef5f65f02456efb6414016bad0`, then applied one optimistic project-local update from `CT-12@91` to `CT-12@92`. Fresh readback returned In Progress in S4 Testing, store health ready, six active issues, 111 completed issues, empty Trash, and provider projection disabled / `not_synced`. The private pre-update backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-22T22-13-45-883Z-0993d0ff-76eb-4784-ad40-fce124f1e860.json`, mode 0600, 469,835 bytes, canonical package SHA-256 `26758b9275fead232c7c4b06dde17351ca52caec82ea96e73b29fa2c4b22d0c8`, serialized file SHA-256 `5e54b0a404a3f0cc2d7206c0ff9836ac16fbee06da7903ba24e9b774f8d4d5b8`.

## 2026-08-22 Exact d524c5c Integrated UAT Continuation

83. Ran P-T18's connected Chrome workflow at `1440x900@1x` against exact product revision `d524c5c7eff38664bad7b8fb612283f2e2092563`, tree `4c5e21bbf45386f11face5c034dd433b663d14e0`, and asset `assets/index-DtJuzGa7.js` using a disposable private schema-2 SQLite fixture.
84. Created and edited one project, two ordered milestones, one global keyboard issue, and one contextual issue. Persisted rich content, resources, labels, project/milestone assignment, four relation types, and one inline-edited comment. A duplicate overlapping relation failed without relation or activity growth.
85. Exercised the active/archive/zero-result issue views, project grouping, Identifier order, Compact density, visible properties, group collapse/expand, row selection, bulk properties and labels, the Status board, and a keyboard-submitted status move. OL-12 moved once to Done and derived project and planning-milestone progress became 50%.
86. Saved, searched, opened, renamed, archived, restored, and reopened the private `P18 workflow view verified`. Transient collapse state reset while the saved view was dirty; after activating `Update saved view`, refresh restored the committed collapsed group plus layout, group, order, density, archive state, and visible properties. This was expected uncommitted-state behavior, not state loss.
87. Opened command search with Command-K and matched OL-12 by identifier, description, Frontend label, and project; result status and marked text were present. Home, End, arrows, and Enter opened the project result without selecting a disabled option.
88. Followed OL-12's related OL-1 link from the saved grouped list, used browser Back, and confirmed the exact list URL/collapse configuration plus focus on the OL-12 roving row. Archive moved OL-11 out of the active list, exposed one named Undo notice with focus on Undo, and Enter restored OL-11 plus focus to its row.
89. Refreshed the connected fixture and read back project summary/overview/resource, milestone order and counts, issue states, relations, comment revision, progress, activity, and committed saved-view state. Projects, Issues, My work, Views, and Workflow all read back the committed records.
90. Bound the deliberate empty, query-failure, reconnect, per-issue draft, archive-failure, milestone-purge, project-purge, restart, and native-date branches through current-applicable CT-91 through CT-97, CT-113, and CT-116 evidence. CT-117 proves the exact candidate delta is limited to issue-title autosizing and responsive reflow and does not alter those sources.
91. Sealed the raw mode-0600 receipt at `.control-tower/evidence/CT-12/integrated-uat-d524c5c.json`, 14,746 bytes, SHA-256 `f4e588d6d52092dd8363c05caa90a0aa9839d9d1fc14c9c2a57227eb75972d16`. Its 21 steps all pass, with zero critical errors, facilitator interventions, unsupported controls, or lost committed state.

## Current Evidence Refresh 10

- P-T18: passed as a 21 / 21 composite exact-candidate integrated UAT.
- P-T19: bounded route, keyboard, responsive, exact visual, and title-autosize support passes; third-party engine, longest-content, forced-state, and live System matrix open.
- P-T20: exact-current 60-state golden and exact-viewport protected performance pass; live two-direction System response open.
- P-T21: pending exact-current independent qualification.
- CT-117: implementation complete; distinct application review pending.

## Current Boundary 10

CT-12 remains In Progress. Passing P-T18 does not complete P-T19, authorized System behavior, distinct CT-117 review, or exact-current P-T21. No complete accessibility, cross-platform, release, publication, legal, identity, or outcome assertion is made.

92. Committed the P-T18 evidence as `3009d86f94e1b1f6a20ecf23a1cf04ef01f60ea8`, then applied one optimistic project-local description update from `CT-12@92` to `CT-12@93`. Fresh mutation readback returned In Progress in S4 Testing, store health ready, six active issues, 111 completed issues, empty Trash, and provider projection disabled / `not_synced`. The private pre-update backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-22T23-11-24-530Z-ea08ad7d-29ad-44b7-889b-8db29fc30fbd.json`, mode 0600, 470,611 bytes, canonical package SHA-256 `b1b45351b341caa5e992ce18754ffc52657db4de2c4103dc4dabb346f58b8a2a`, serialized file SHA-256 `7944e887fb0e56a8da5f27074ea4de64166cfd26555a13209afdecbf00bcf98a`.

## 2026-08-23 Exact e1299af Accessibility Continuation

93. Reconciled the product candidate to revision `e1299af1bd06f7438f5010c6f6c030760c5a1dfb`, tree `ce6e21f1b0436e6afa1d11b1fc3f6ff471903bb3`, and asset `assets/index-CpxWfAtI.js`. CT-118 through CT-123 correct board metadata semantics, Saved Views table semantics, Workflow target size, shared rich-editor roles, selected-row contrast, and explicit issue-route reset behavior.
94. Retained exact automated verification: three focused files / 23 tests, 73 complete files / 481 tests, all eight workspace typechecks, 10 / 10 release-audit tests, and a warning-free 1,953-module production build.
95. Ran axe-core 4.12.1 in persistent Chrome across 50 exact-candidate states and 38,245 passing nodes. Coverage includes 22 System route/dialog/overlay states, nine explicit Light states, nine explicit Dark states, five 390x844 mobile long-content/dialog states, and five forced error/pending/archive-recovery states.
96. Recorded zero violations. Retained five incomplete results and resolved them individually: two `aria-controls` IDs point to connected role=menu targets; the overlapped primary button is not visible beneath the open menu and passes at 4.712:1 when visible; workflow retirement text passes at 5.156:1; and all 17 reported activity arrows are aria-hidden decorative markers that pass at 15.037:1.
97. Verified the corrective tranche in live exact Chrome: named board region and metadata groups; six-column Saved Views semantic section plus named action groups; 18 enabled Workflow controls at a minimum 30x30 CSS pixels; `role=textbox` plus `aria-multiline=true` on the shared editor; selected metadata at 13.71:1; and contextual/direct Primary Issues resets to the canonical list with retained draft recovery.
98. Restored the mobile issue title to `P18 contextual milestone issue`, restored OL-11 after the archive/Undo check, closed transient dialogs, and disabled the fault proxy with zero remaining faults and zero delay.
99. Sealed `.control-tower/evidence/CT-12/axe-core-e1299af.json` mode 0600 at 55,707 bytes and SHA-256 `e39d047e722955a9e3589005a4ff13295a7024469925583047cebd632f872a3b`. Sealed the shared CT-118 through CT-123 receipt mode 0600 at 7,876 bytes and SHA-256 `3e2a81e8c0c03ad756af56591d5dedf10c772a47696de7ba5235693db38082a9`.
100. Reopened P-T20 freshness. The 60-state golden and 53.7ms p75 performance records bind to d524c5c; e1299af changes visible Workflow geometry, Saved Views structure, selected-row paint, and issue-route behavior. Exact e1299af golden and performance reruns are required, along with the separately authorized two-direction System check.

## Current Evidence Refresh 11

- P-T18: d524c5c connected 21 / 21 baseline plus exact e1299af changed-surface checks pass; CT-117 through CT-123 distinct review remains open.
- P-T19: exact e1299af engine, long-content, forced-state, keyboard-support, and responsive-support matrix passes; distinct review remains open.
- P-T20: d524c5c golden and performance are historical; exact e1299af refresh and live two-direction System response are open.
- P-T21: pending exact e1299af independent qualification.
- CT-117 through CT-123: implementation output complete; distinct application review pending.

## Current Boundary 11

CT-12 remains In Progress. The fresh accessibility matrix does not waive distinct review, exact-current golden/performance, authorized System behavior, or independent runtime qualification. No complete accessibility, cross-platform, release, publication, legal, identity, or outcome assertion is made.

101. Committed the exact accessibility and corrective-tranche evidence as `d9124b99a3db04017ff2d3b8db93bfe3b3f164ec`, then applied seven optimistic project-local description updates. Fresh readback returned CT-118@2, CT-119@3, CT-120@2, CT-121@2, CT-122@2, CT-123@2, and CT-12@94, all In Progress in their existing milestones, with store health ready and provider projection disabled / `not_synced`. Every mutation created a mode-0600 private pre-update export; CT-12's backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-23T01-04-27-512Z-9d49848f-09d9-44e1-a5ce-8bf9dd035198.json`, 484,552 bytes, canonical package SHA-256 `032f5b80a4afd4616cb9f658852074d1540b480f417117b91c0341b562179787`, serialized file SHA-256 `dbe6d4d3c1809bb24a427c0b811f2d0c8f2a35ce259fd19d5df6d26f2a60d0cc`.

## 2026-08-23 Exact e1299af Golden And Performance Continuation

102. Captured all 30 required named states in explicit Light and Dark using persistent Chrome against exact product revision `e1299af1bd06f7438f5010c6f6c030760c5a1dfb`, tree `ce6e21f1b0436e6afa1d11b1fc3f6ff471903bb3`, and asset `assets/index-CpxWfAtI.js`. The 60-state set contains 56 desktop JPEGs at 1440x900@1x and four direct-detail mobile JPEGs at 390x844@1x.
103. Independently recomputed every tracked JPEG's byte count, SHA-256, dimensions, appearance/screen key, and mode. All 60 match the v3 manifest and structured audit; combined image digest is `0208b8474bdae382ff053fda6eb33d1259c56be213ed71eee85fffcade6959d2`.
104. Inspected six ordered ten-state contact sheets. No blank, wrong-theme, clipped, overlapping, loading, missing recovery, or missing Undo state was observed. Wrong-name milestone and project purge attempts remained blocked in both themes, exact-name purges completed against disposable fixtures, and issue, project, and milestone archive targets were restored through visible Undo.
105. Ran the exact 2,002-issue protected-performance fixture at requested and observed 1440x1000@1x. The retained first quiescent contract missed at p75 `107.4 ms`. After a ten-second idle interval, the identical fully warmed 20-transition forward-and-return contract passed at p75 `53.0 ms` against the `100 ms` threshold; both attempts remain in the private raw receipt.
106. Sampled virtualization at scroll positions 0, 1,200, 13,200, 37,199.5, and 71,422. Mounted rows stayed between 27 and 35 against the limit of 70, with zero row overlap, alerts, out-of-range rows, or document overflow. Two frames after 1,800ms settle and 500ms separation were byte-identical at SHA-256 `67775e43523a6e84909be00c5fbe84af2f989e9abee9c71fab8740d75c29f614`.
107. Independently validated the mode-0600 raw performance receipt at `.control-tower/evidence/CT-12/performance-current-e1299af-raw.json`, 21,666 bytes, SHA-256 `d83b690fd022bf67008f903e6909aa061dee44a460eb23fc7bdafc08475e20a8`. Kept the live two-direction System check open because changing macOS Appearance requires action-time authorization.

## Current Evidence Refresh 12

- P-T18: d524c5c connected 21 / 21 baseline plus exact e1299af changed-surface checks pass; CT-117 through CT-123 distinct review remains open.
- P-T19: exact e1299af engine, long-content, forced-state, keyboard-support, and responsive-support matrix passes; distinct review remains open.
- P-T20: exact e1299af 60-state pinned Light/Dark and exact-viewport protected-performance tranches pass; live two-direction System response remains open.
- P-T21: pending exact e1299af independent qualification.
- CT-117 through CT-123: implementation output complete; distinct application review pending.

## Current Boundary 12

CT-12 remains In Progress. Exact golden and performance evidence does not waive distinct review, authorized System behavior, or independent runtime qualification. No complete accessibility, cross-platform, release, publication, legal, identity, or outcome assertion is made.

108. Committed the exact-current visual and performance evidence as `e9b2d81a1f158eb5eb7d3e716e914b7bea98d8d0`, then applied one optimistic project-local CT-12 description update from revision 94 to 95. Fresh readback returned In Progress in S4 Testing, store health ready, 12 active issues, 111 completed issues, empty Trash, and provider projection disabled / `not_synced`. The private pre-update backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-23T02-29-38-488Z-49a9246b-2e1a-460e-b587-85d3a6dce5ed.json`, mode 0600, 484,085 bytes, canonical package SHA-256 `c3fa270fb82d6b4a13a47defc087f7e59f37d0e57b7a4a91c1643ffbbc381c08`, serialized file SHA-256 `72a1eba5f389daa797c1e3a7f30a741cfd1c9f9ef47a3ee39e94673817d54d22`.

## 2026-08-23 Exact 5a33d28 Applicability And Runtime Continuation

109. Found duplicate screen-reader context while preparing distinct review for CT-118 and CT-119, created project-local CT-124, and implemented the bounded four-file semantic correction at product revision `5a33d28be383b7651a4b0d6156534aa12cc423fa`, tree `d106d3bb40a84184e7ee26c919134b01e4748679`.
110. Verified exact automated state: 2 focused files / 13 tests, 73 complete files / 481 tests, all eight workspace typechecks, 10 / 10 release-audit tests, and a warning-free 1,953-module build pass.
111. Rechecked exact asset `assets/index-W0ZGkz-8.js` in persistent Chrome with Appearance set to System at 1654x875@2x. The board exposes one Issue board region, 10 named property collections, no nested named property groups, and zero alerts. Saved Views exposes one named Actions group, no redundant hidden Actions label, the expected Edit and Archive button names, and zero alerts. Visual inspection finds no geometry change.
112. Preserved e1299af axe, 60-state pinned-pixel, and protected-performance evidence as historical support only. Because CT-124 changes the accessibility DOM and creates a different product artifact, fresh 5a33d28 engine, pixel, and performance evidence remains open; no broad exact-source carry-forward is claimed.
113. Built a clean isolated 5a33d28 checkout with Node 24.19.0 and ran the guarded strict runtime rehearsal. All 21 structured checks and 4 / 4 runner contracts pass; six phases emit 11 network-audit records with zero outbound or subprocess attempts; interruption, cleanup, permissions, transfer, migration, recovery, and accepted-scale checks pass. The initial sandbox attempt failed closed on loopback EPERM, and the exact guarded command passed with only temporary loopback and audited local-subprocess permission.
114. Reopened CT-82 from historical `Done@17` to `Todo@18` for the current product revision. The f7c3625 independent receipt remains historical acceptance for f7c3625 only; the 5a33d28 rehearsal is non-independent and does not accept P-T21.
115. Committed the exact-current applicability checkpoint as `16aa5c72e475386d4bdec52041608be8a2035e9d`, then applied one optimistic project-local CT-12 update from revision 95 to 96. Fresh readback returned In Progress in S4 Testing, store health ready, 14 active issues, 110 completed issues, empty Trash, and provider projection disabled / `not_synced`. The owner-only pre-update backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-23T03-23-48-212Z-12a0e0ef-70f2-4f8b-80c3-14704b7b8446.json`, 488,143 bytes, canonical package SHA-256 `4a4f0eff9742835c9589150c4a4e4b1f3e659062043598ba76e2f599ec66a575`, serialized file SHA-256 `97b296cfd7fe1b8adffc78c29a67a894c14d110bbb481b6de09302d69a398537`.

## Current Evidence Refresh 13

- P-T18: composite workflow evidence plus exact 5a33d28 semantic readback pass; CT-117 through CT-124 distinct review remains open.
- P-T19: the e1299af engine matrix is historical; exact 5a33d28 semantic readback passes, while a fresh engine run and distinct review remain open.
- P-T20: the e1299af pinned pixels and performance remain historical support; exact 5a33d28 refresh and authorized live two-direction System response remain open.
- P-T21: exact 5a33d28 implementation rehearsal passes; distinct independent qualification remains open and CT-82 is Todo.

## Current Boundary 13

CT-12 remains In Progress. Current automated and semantic evidence does not waive distinct review, exact-source engine/pixel/performance refresh, authorized System behavior, or independent runtime qualification. No complete accessibility, cross-platform, release, publication, legal, identity, or outcome assertion is made.

## 2026-08-23 Exact 5a33d28 Affected-Surface Pixel Delta

116. Diffed e1299af to exact product revision `5a33d28be383b7651a4b0d6156534aa12cc423fa`, tree `d106d3bb40a84184e7ee26c919134b01e4748679`. The only runtime changes are in `apps/web/src/issues.tsx` and `apps/web/src/saved-views.tsx`; no styles, protected list/detail query or virtualization path, API, SQLite, schema, owner scope, or transfer source changed.
117. Transactionally copied the live schema-2 SQLite fixture into two isolated data directories. Both 253,952-byte files hash to `38a291ebe617adef1f56a021e3ef66a2d3d88c0856e40a13f478241eb0df3a3d`.
118. Built and served exact e1299af asset `assets/index-CpxWfAtI.js` and exact 5a33d28 asset `assets/index-W0ZGkz-8.js` in separate loopback and browser-session scopes. A preliminary same-host attempt was excluded after port-shared cookies invalidated CSRF proof; the accepted IPv6/IPv4-isolated run had zero alerts in every state.
119. Captured Issues board and Saved Views in explicit Light and Dark at 1440x900@1x after identical 1,800ms settles. All four candidate JPEGs are byte-identical to their e1299af references. Exact semantic readback simultaneously proves the intended delta: 10 property collections remain while 60 nested named property groups become zero, and one Saved View Actions group remains while its redundant hidden Actions label becomes zero.
120. Inspected representative Light board and Dark Saved Views captures with no blank, theme, overlap, clipping, loading, or geometry finding. Sealed private receipt `.control-tower/evidence/CT-12/delta-5a33d28/receipt.json`, mode 0600, 6,099 bytes, SHA-256 `4a0807ef4019e31c790760724cee689f26b8d034446f45ba5a3073d46e4760bf`. Stopped both comparison listeners and restored the surviving exact-current preview to System at 1654x875@2x with zero alerts.

## Current Evidence Refresh 14

- P-T18: composite workflow evidence plus exact 5a33d28 semantic and affected-surface pixel readback pass; CT-117 through CT-124 distinct review remains open.
- P-T19: the complete e1299af engine matrix is historical; exact 5a33d28 semantic readback passes, while a fresh exact-source engine run and distinct review remain open.
- P-T20: the complete e1299af 60-state matrix is applicable through four exact changed-surface byte-identical pairs; the 53.0ms p75 protected performance is applicable because its list/detail path is unchanged. Authorized live two-direction System response remains open.
- P-T21: exact 5a33d28 implementation rehearsal passes; distinct independent qualification remains open and CT-82 is Todo.

## Current Boundary 14

CT-12 remains In Progress. Exact affected-surface pixel identity does not waive fresh exact-source P-T19 engine coverage, distinct application review, authorized live System behavior, or independent runtime qualification. No complete accessibility, cross-platform, release, publication, legal, identity, or outcome assertion is made.

121. Committed the exact changed-surface pixel delta as `1aa11cdd8f09d61014ba27067a951307187d4369`, then applied one optimistic project-local CT-12 description update from revision 96 to 97. Fresh readback returned In Progress in S4 Testing, store health ready, 14 active issues, 110 completed issues, empty Trash, and provider projection disabled / `not_synced`. The private pre-update backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-23T04-36-38-098Z-5ffd442b-685e-459e-8363-12c3ee375400.json`, mode 0600, 487,765 bytes, canonical package SHA-256 `618726f9306c12567b6fd3e3a20aad69de568dfa550c190ce5c67607119fdf61`, serialized file SHA-256 `d59aa2d56db390e9b0cb4a7de75665371449d649990f983f557588cdd7b459b6`.

## 2026-08-23 Exact 5a33d28 Accessibility-Engine Delta

122. Reused the visible local axe-core 4.12.1 harness against exact asset `assets/index-W0ZGkz-8.js` in persistent Chrome at 1654x875@2x. The harness control, not an invisible DOM mutation, initiated every scan and excluded only its own named test section.
123. Scanned Issues board and Saved Views in System, explicit Light, and explicit Dark. All six states report zero violations and zero incomplete items across 2,979 passing nodes and 141 passing-rule records; product alerts remained zero.
124. Confirmed the intended exact semantic delta during the scans: one Issue board region, 10 property collections, zero nested named property groups, one Saved View Actions group, and zero redundant hidden Actions labels.
125. Bound the six-state delta to the complete e1299af 50-state matrix because CT-124 changes no other accessibility surface. Sealed private receipt `.control-tower/evidence/CT-12/axe-delta-5a33d28/axe-delta-5a33d28.json`, mode 0600, 23,585 bytes, SHA-256 `812459aa0ded0b3029faf5feb0a734d8788cf19bf261a44463240ea0e8885d99`.
126. Stopped the accessibility proxy and restored the surviving exact-current preview at `http://127.0.0.1:4284/` to Issues list, Appearance System, 1654x875@2x, exact asset `assets/index-W0ZGkz-8.js`, and zero alerts.

127. Committed the exact changed-surface accessibility delta as `2090143`, then applied one optimistic project-local CT-12 description update from revision 97 to 98. Fresh readback returned In Progress in S4 Testing, store health ready, 14 active issues, 110 completed issues, and provider projection disabled / `not_synced`. The private pre-update backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-23T11-29-25-495Z-72516b10-a7d1-48a9-a806-97ad10c56da6.json`, mode 0600, 488,144 bytes, canonical package SHA-256 `a9babfb4ab2c85c560397aca7a5bf546dd720e330148439513dd590d649f9da4`, serialized file SHA-256 `cc07c688d6d67195a4023e22f9491e7301024460dc977c0628fed48c5a096869`. The raw readback is mode 0600, 514,903 bytes, SHA-256 `59ab01e5163f83f86fb0f24cd9ffee075d87cbf5175f1bd08c5d4feef337fa82`.

## Current Evidence Refresh 15

- P-T18: composite workflow evidence plus exact 5a33d28 semantic, accessibility-engine, and pixel deltas pass; CT-117 through CT-124 distinct review remains open.
- P-T19: the complete e1299af 50-state matrix is applicable through six exact changed-surface engine scans with zero violations or incomplete items; distinct review remains open.
- P-T20: the complete e1299af 60-state matrix and 53.0ms p75 protected performance are applicable through exact byte identity and unchanged paths; authorized live two-direction System response remains open.
- P-T21: exact 5a33d28 implementation rehearsal passes; distinct independent qualification remains open and CT-82 is Todo.

## Current Boundary 15

CT-12 remains In Progress. Exact engine and pixel deltas do not waive distinct application review, authorized live System behavior, or independent runtime qualification. No complete accessibility, cross-platform, release, publication, legal, identity, or outcome assertion is made.

## 2026-08-23 Authorized Live System Appearance

128. Used the visible macOS System Settings Appearance panel under the user-authorized continuation to select Light, then Dark, while the BasicLinear app preference remained System. The exact W0 asset was served from the loopback Fastify runtime at `http://127.0.0.1:4284/` against the disposable restored SQLite fixture.
129. In Light, Chrome reported `prefers-color-scheme: light`, body background `rgb(247, 247, 248)`, body foreground `rgb(32, 33, 36)`, Issues heading, exact `assets/index-W0ZGkz-8.js`, and zero alerts. In Dark, Chrome reported `prefers-color-scheme: dark`, body background `rgb(23, 23, 25)`, body foreground `rgb(236, 236, 239)`, the same heading and asset, and zero alerts.
130. Sealed the mode-0600 receipt `.control-tower/evidence/CT-12/system-appearance-5a33d28.json`, 2,914 bytes, SHA-256 `8b5100e77ecffb93fcff10e235cc9a52fbcfd37210235d7fdd13ddaf2e0acc03`. Light and Dark screenshot artifacts are mode 0600 with SHA-256 `f6491abd10c57950bb391c977f159b072b58c8d950be2246dabfacee6c8c76ff` and `607ba23e0d969315d054dd2def1abb66c71c96c9271473ce538868c4883eb5d3`.
131. Restored macOS Appearance to Auto/System and verified the System control was selected. The app remained on its System preference, the final preview had zero alerts, and P-T20 live System is now passed. Distinct application review for CT-117 through CT-124 and independent exact-current CT-82/P-T21 qualification remain open.

## Current Evidence Refresh 16

- P-T18: composite workflow evidence plus exact 5a33d28 semantic, accessibility-engine, and pixel deltas pass; CT-117 through CT-124 distinct review remains open.
- P-T19: the complete e1299af 50-state matrix is applicable through six exact changed-surface engine scans with zero violations or incomplete items; distinct review remains open.
- P-T20: the complete e1299af 60-state matrix and 53.0ms p75 protected performance are applicable through exact byte identity and unchanged paths; live Light and Dark System directions pass with zero alerts and macOS is restored to Auto/System.
- P-T21: exact 5a33d28 implementation rehearsal passes; distinct independent qualification remains open and CT-82 is Todo.

## Current Boundary 16

CT-12 remains In Progress. P-T20 live System is complete for the declared surface, but distinct application review and independent runtime qualification remain required. No complete accessibility, cross-platform, release, publication, legal, identity, or outcome assertion is made.

## 2026-08-23 Independent Closeout And Testing Handoff

132. Applied the prepared local v0.8 optimistic updates with exact revisions: CT-117 through CT-124 moved to `Done`, CT-82 moved to `Done@19`, and CT-12 moved from `In Progress@98` to `Done@99`. Every mutation produced a private mode-0600 backup and a fresh helper readback; provider projection stayed disabled / `not_synced`.
133. Bound the distinct CT-117 through CT-124 review receipt. The independent actor/session was `codex-independent-closeout-review-ct117-124` / `CT117-124-INDEPENDENT-20260823T113057Z`; exact revision/tree were `5a33d28be383b7651a4b0d6156534aa12cc423fa` / `d106d3bb40a84184e7ee26c919134b01e4748679`; verdict was passed with no findings.
134. Bound the distinct exact-current P-T21 receipt. The independent actor/session was `codex-independent-testing-ct82-5a33d28` / `CT82-INDEPENDENT-20260823T114800Z`; all 21 structured checks and 4/4 runner contracts passed, with zero outbound or subprocess attempts and the source/artifact hashes recorded in the evidence map.
135. Updated the Testing result, evidence map, current-revision applicability records, decision, and handoff. CT-12 is `PASSED` for the declared local v0.1 surface and routes to `ct-review-outcomes`; no CT-3, CT-13, publication, cross-platform, or outcome acceptance was authored.

## Current Evidence Refresh 17

- P-T18: passed with the exact 5a33d28 semantic/accessibility/pixel delta and independent corrective-tranche closeout.
- P-T19: passed for the declared surfaces through the exact six-state engine delta and independent review.
- P-T20: passed for the complete applicable matrix, protected performance, and authorized live System directions.
- P-T21: passed independently for exact 5a33d28; CT-82 is `Done@19`.

## Current Boundary 17

CT-12 Testing is passed and task readback is complete. This does not claim the separate CT-3 identity/legal gate, CT-13 accountable release gate, publication, cross-platform behavior, or product outcomes.
