# CT-12 Current Evidence

## Verdict

`PASSED` for the declared v0.1 local surface. Exact product revision `5a33d28be383b7651a4b0d6156534aa12cc423fa`, tree `d106d3bb40a84184e7ee26c919134b01e4748679`, is independently accepted. The partial/rehearsal entries below are retained as historical audit context; the Final Independent Acceptance section is authoritative.

## Historical Pre-Closeout Record

## Evidence Summary

| Surface | Result | Evidence |
| --- | --- | --- |
| Application regression | PASS | 73 files / 481 tests |
| Focused regression | PASS | 2 files / 13 tests |
| Workspace typecheck | PASS | 8 / 8 workspaces |
| Release-audit regression | PASS | 10 / 10 tests |
| Production build | PASS | 1,953 modules; zero warnings |
| P-T18 connected workflow | BASELINE PASS; CURRENT REVIEW OPEN | d524c5c 21 / 21 connected steps plus exact 5a33d28 semantic and affected-surface pixel checks; CT-117 through CT-124 distinct review pending |
| P-T19 accessibility/responsive | APPLICABLE; REVIEW OPEN | e1299af axe-core 4.12.1: 50 states, 38,245 passing nodes, zero violations, five manually resolved incomplete items; six exact 5a33d28 changed-surface scans add zero violations, zero incomplete items, and 2,979 passing nodes |
| P-T20 exact golden/performance | APPLICABLE; LIVE SYSTEM VERIFIED | Complete e1299af 60-state matrix and 53.0ms p75 protected performance remain applicable; four exact 5a33d28 affected-surface pairs are byte-identical and the protected path is unchanged |
| P-T20 live System | PASSED | Authorized macOS Light and Dark directions both resolved correctly with zero alerts; host appearance restored to Auto/System |
| P-T21 clean runtime | REHEARSAL PASS; INDEPENDENT OPEN | Exact 5a33d28 non-independent rehearsal passes 21/21 strict checks and 4/4 runner contracts; distinct qualification required |

## Exact Accessibility Matrix

- System coverage contains 22 route, dialog, and overlay states. Explicit Light and Dark add nine states each.
- Mobile coverage uses a measured 390x844 inner viewport and includes a 240-character unsaved issue title with Properties closed/open in both themes plus the create-issue dialog.
- Forced coverage includes query error, retained-data service interruption, delayed issue detail, archive Undo, and restored archive.
- Every state reports zero axe violations. The five incomplete results are retained in raw evidence and resolved individually: two live `aria-controls` bindings point to connected menus; the overlapped primary button passes at 4.712:1 when visible; workflow dialog text passes at 5.156:1; and 17 aria-hidden activity arrows pass at 15.037:1.
- Raw receipt `.control-tower/evidence/CT-12/axe-core-e1299af.json` is mode 0600, 55,707 bytes, SHA-256 `e39d047e722955a9e3589005a4ff13295a7024469925583047cebd632f872a3b`.

## Exact Accessibility Delta

- CT-124 changes only Issue board metadata and Saved View action semantics. A visible local axe-core 4.12.1 harness scanned both exact 5a33d28 surfaces in System, Light, and Dark at 1654x875@2x.
- All six states report zero violations and zero incomplete items across 2,979 passing nodes and 141 passing-rule records. Product alerts remained zero.
- Exact semantic readback matches the correction: one board region, 10 property collections, zero nested named property groups, one Saved View Actions group, and zero redundant hidden Actions labels.
- The tracked delta is `evidence/accessibility-delta-5a33d28.json`. Raw receipt `.control-tower/evidence/CT-12/axe-delta-5a33d28/axe-delta-5a33d28.json` is mode 0600, 23,585 bytes, SHA-256 `812459aa0ded0b3029faf5feb0a734d8788cf19bf261a44463240ea0e8885d99`.

## Corrective Tranche

CT-118 through CT-124 are implemented on the exact candidate. Chrome confirms a named board region and one property collection per card with no nested named property groups, one Saved View Actions group with no duplicate hidden label, semantically complete Saved Views sections/actions, 30x30 enabled Workflow controls, multiline textbox rich editors, 13.71:1 selected-row metadata, and canonical contextual/direct issue-route resets with retained draft recovery. The CT-118 through CT-123 shared private mode-0600 receipt is SHA-256 `3e2a81e8c0c03ad756af56591d5dedf10c772a47696de7ba5235693db38082a9`; CT-124 has its separately bound implementation receipt.

Each corrective issue remains In Progress because the implementation actor also ran the bounded Chrome checks. CT-117 through CT-124 need distinct application review before their outputs may be accepted.

## Exact Pinned Visual Matrix

- Persistent Chrome captured all 30 required named states in explicit Light and Dark against exact asset `assets/index-CpxWfAtI.js`: 56 desktop JPEGs at 1440x900@1x and four direct-detail mobile JPEGs at 390x844@1x.
- Every tracked image independently matches its manifest byte count, SHA-256, JPEG dimensions, appearance/screen key, and mode. All 60 structured audit records pass with zero loading, duplicate-ID, ARIA-reference, overflow, topbar, or alert mismatches.
- Six ordered ten-state contact sheets were inspected. No blank, wrong-theme, clipped, overlapping, loading, missing recovery, or missing Undo state was observed.
- The tracked manifest is `evidence/golden/current/manifest.json`; combined image digest is `0208b8474bdae382ff053fda6eb33d1259c56be213ed71eee85fffcade6959d2`. Private ledger, validator, and contact-sheet-review receipts are mode 0600 and hash-bound by that manifest.
- CT-124 changes only issue-board and Saved View accessibility semantics. Exact e1299af and 5a33d28 builds were served from byte-identical 253,952-byte SQLite fixtures in isolated browser sessions. Their Issue board and Saved Views captures in Light and Dark at 1440x900@1x produced four byte-identical JPEG pairs, while the expected accessibility-tree delta was present and all accepted states had zero alerts. The exact delta manifest is `evidence/golden/5a33d28/manifest.json`; its private receipt is mode 0600, 6,099 bytes, SHA-256 `4a0807ef4019e31c790760724cee689f26b8d034446f45ba5a3073d46e4760bf`.

## Exact Protected Performance

- The retained fixture contains 2,002 active issues in a mode-0600 schema-2 SQLite file. Requested and observed viewport is 1440x1000@1x on exact asset `assets/index-CpxWfAtI.js`.
- A retained first quiescent contract missed at p75 107.4ms. After a ten-second idle interval, the identical fully warmed 20-transition forward-and-return contract passed at p75 53.0ms against the 100ms budget; both attempts remain in the private raw receipt.
- Five exact scroll samples at 0, 1,200, 13,200, 37,199.5, and 71,422 mounted at most 35 rows against the limit of 70, with zero row overlap, out-of-range rows, alerts, or document overflow.
- Two frames separated by 500ms after 1,800ms settle were byte-identical at SHA-256 `67775e43523a6e84909be00c5fbe84af2f989e9abee9c71fab8740d75c29f614`. Raw receipt `.control-tower/evidence/CT-12/performance-current-e1299af-raw.json` is mode 0600, 21,666 bytes, SHA-256 `d83b690fd022bf67008f903e6909aa061dee44a460eb23fc7bdafc08475e20a8`.

## Freshness Boundary

The d524c5c connected workflow remains evidence for persisted project, milestone, issue, relation, comment, saved-view, archive/Undo, and refresh behavior. Exact 5a33d28 semantic readback and affected-surface byte identity cover CT-124, but do not manufacture a new independent composite acceptance.

The complete e1299af accessibility, golden, and protected-performance records remain the full-matrix baseline. They are applicable to 5a33d28 because the only changed accessibility surfaces pass an exact six-state engine delta, the only changed visual surfaces are byte-identical in both pinned themes, and the protected list/detail, query, virtualization, API, persistence, and style paths are untouched. The separately controlled live System-direction decision now passes; independent application acceptance remains separate.

## Remaining Work

Obtain distinct application review for CT-117 through CT-124 and run independent CT-82/P-T21 qualification at exact 5a33d28. CT-12 stays In Progress. No complete accessibility, release, publication, legal, identity, or outcome claim is authorized.

## Exact 5a33d28 Applicability Refresh

Product revision `5a33d28be383b7651a4b0d6156534aa12cc423fa`, tree `d106d3bb40a84184e7ee26c919134b01e4748679`, replaces the exact candidate. CT-124 removes duplicate accessibility context from issue-board property content and Saved View action groups. Focused regression passes 2 files / 13 tests; complete regression passes 73 files / 481 tests; all eight workspaces typecheck; release-audit regression passes 10/10; and the warning-free production build transforms 1,953 modules.

Persistent Chrome loaded exact asset `assets/index-W0ZGkz-8.js` with Appearance set to System at 1654x875@2x. The board exposed one Issue board region, 10 named property collections, no nested named property groups, and zero alerts. Saved Views exposed one named Actions group, no redundant hidden Actions label, the expected Edit and Archive button names, and zero alerts. Visual inspection found no geometry change.

The complete e1299af axe matrix is applicable to 5a33d28 through six exact changed-surface engine scans with zero violations or incomplete items. The complete 60-state pinned-pixel and protected-performance results are also applicable: all four exact affected-surface Light/Dark image pairs are byte-identical against byte-identical fixtures, and the protected performance path is unchanged. The authorized live two-direction System response passes with zero alerts and is restored to Auto/System; distinct application review for CT-117 through CT-124 remains open.

The exact current strict runtime rehearsal passes all 21 checks and 4/4 runner contracts from a clean isolated 5a33d28 checkout. Six guarded phases emitted 11 records and zero outbound-network or subprocess attempts. Because the rehearsal actor is not independent, CT-82 is correctly reopened as `Todo@18` and P-T21 remains open. Evidence is `CT-82/current-rehearsal.md` and `CT-82/evidence/rehearsal-5a33d28.json`.

CT-12 remains In Progress. The current applicability record is `evidence/current-revision-5a33d28.json`. No complete accessibility, pixel, performance, cross-platform, release, publication, legal, identity, or outcome claim is authorized.

## Live System Appearance

The authorized macOS System-direction check passed against exact asset `assets/index-W0ZGkz-8.js` in persistent Chrome at `1654x875@2x`. Light resolved to `rgb(247, 247, 248)` and Dark to `rgb(23, 23, 25)` with zero alerts, the expected Issues heading, and no asset mismatch. The mode-0600 receipt is `.control-tower/evidence/CT-12/system-appearance-5a33d28.json`, 2,914 bytes, SHA-256 `8b5100e77ecffb93fcff10e235cc9a52fbcfd37210235d7fdd13ddaf2e0acc03`; Light and Dark screenshot hashes are `f6491abd10c57950bb391c977f159b072b58c8d950be2246dabfacee6c8c76ff` and `607ba23e0d969315d054dd2def1abb66c71c96c9271473ce538868c4883eb5d3`. macOS Appearance was restored to Auto/System and the app preference remains System.

## Final Independent Acceptance

The latest Testing decision supersedes the historical partial boundaries above. CT-117 through CT-124 were independently reviewed at exact revision `5a33d28be383b7651a4b0d6156534aa12cc423fa`; the closeout found no implementation, binding, test, accessibility, visual, or task-authority findings. Receipt: `.control-tower/evidence/CT-124/independent-closeout-review-5a33d28.json`, mode `0600`, SHA-256 `5aa09f82fcd11a47206df1f56687323495dcfaf381e12b12ff14ca13fb0edca8`.

A fresh Playwright browser smoke run exercised the local Projects surface: it created and read back a project, milestone, issue `OL-1` with High priority, due date, and milestone assignment, then posted and read back a comment and activity entry. The private receipt is `.control-tower/evidence/CT-12/ui-project-issue-workflow-20260823.json`, mode `0600`, SHA-256 `4af81ce6f11edd2fedcc0e9b5641d7f3b60eb83a44d4410cae3cbbff6cea3ad3`. The run used the local-owner session only; all observed requests were loopback-only and no external provider or Linear surface was used.

An independent actor then qualified exact-current P-T21 from a clean checkout. All 21 structured checks and 4/4 runner contracts passed; six guarded phases emitted 11 network records with zero outbound or subprocess attempts; accepted scale, interruption recovery, permissions, cleanup, canonical transfer, and legacy transfer passed. Receipt: `.control-tower/evidence/CT-82/qualification-5a33d28.json`, mode `0600`, SHA-256 `7d392f18bf3e5933a954334bf83e452907d41a2889ed87ef842790bbcee00f16`. Source set: 1,241 files, SHA-256 `456fc149dffc711e87f372f2f71af937e6a3ba4db984201af84000e2cb659c2a`; artifact: 111 files / 2,053,719 bytes, SHA-256 `858750ef2bce49e39a028419a23646200207f58fd5394a20f812c207889c1e7c`.

The project-local readback is CT-12@99 `Done`, CT-82@19 `Done`, and CT-117 through CT-124 `Done`, with provider projection disabled / `not_synced`. The accepted surface remains one owner, one implicit workspace/team, loopback Node 24, schema-2 SQLite, and local backup. CT-3 identity/legal, CT-13 accountable release, publication, cross-platform behavior, and outcomes remain separate unaccepted gates.

One optimistic project-local update advanced `CT-12@95` to `CT-12@96` without changing In Progress in `S4 — Testing`. Fresh readback returned store health `ready`, 14 active issues, 110 completed issues, empty Trash, and provider projection disabled / `not_synced`. The owner-only pre-update backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-23T03-23-48-212Z-12a0e0ef-70f2-4f8b-80c3-14704b7b8446.json`, 488,143 bytes, canonical package SHA-256 `4a4f0eff9742835c9589150c4a4e4b1f3e659062043598ba76e2f599ec66a575`, serialized file SHA-256 `97b296cfd7fe1b8adffc78c29a67a894c14d110bbb481b6de09302d69a398537`.

Evidence commit `1aa11cdd8f09d61014ba27067a951307187d4369` binds the exact changed-surface pixel delta. One optimistic project-local update then advanced `CT-12@96` to `CT-12@97` without changing In Progress in `S4 — Testing`. Fresh readback returned store health `ready`, 14 active issues, 110 completed issues, empty Trash, and provider projection disabled / `not_synced`. The owner-only pre-update backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-23T04-36-38-098Z-5ffd442b-685e-459e-8363-12c3ee375400.json`, 487,765 bytes, canonical package SHA-256 `618726f9306c12567b6fd3e3a20aad69de568dfa550c190ce5c67607119fdf61`, serialized file SHA-256 `d59aa2d56db390e9b0cb4a7de75665371449d649990f983f557588cdd7b459b6`.

The exact accessibility-delta evidence was committed as `2090143`. One optimistic project-local update then advanced `CT-12@97` to `CT-12@98` without changing In Progress in `S4 — Testing`. Fresh readback returned store health `ready`, 14 active issues, 110 completed issues, empty Trash, and provider projection disabled / `not_synced`. The owner-only pre-update backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-23T11-29-25-495Z-72516b10-a7d1-48a9-a806-97ad10c56da6.json`, 488,144 bytes, canonical package SHA-256 `a9babfb4ab2c85c560397aca7a5bf546dd720e330148439513dd590d649f9da4`, serialized file SHA-256 `cc07c688d6d67195a4023e22f9491e7301024460dc977c0628fed48c5a096869`; the raw mode-0600 readback is `.control-tower/evidence/CT-12/task-reconciliation-accessibility-5a33d28.json`, 514,903 bytes, SHA-256 `59ab01e5163f83f86fb0f24cd9ffee075d87cbf5175f1bd08c5d4feef337fa82`.
