# CT-22 Milestone Issue Drill-down Evidence

## Verdict

`OUTPUT_DONE_FOR_CT2`. A project milestone's issue count is now a named keyboard and pointer control. It opens the project's Issues section with project and milestone predicates composed as mandatory `AND` scope, shows the selected milestone in a removable filter, and preserves that context across issue detail open and Escape return.

## Root Cause And Correction

The data contract and repository already supported `milestoneId`, but the project overview rendered the count as plain text and the embedded issue list scoped only by project. The client now:

- labels zero, one, and many issue counts consistently;
- opens the embedded issue surface from the count control;
- removes conflicting nested project or milestone predicates before applying the selected context;
- wraps user filter logic and context predicates in a mandatory `AND` root;
- renders the active milestone as a visible, named, removable filter; and
- resets the transient milestone context when the project or workspace context changes.

## Verification

| Check | Result |
|---|---|
| Focused unit | `issue-scope.test.ts`: 5 tests passed, covering mandatory scope, nested conflicting predicates, source immutability, no-scope identity, and `0`/`1`/many labels |
| Complete unit | 7 files, 28 tests passed |
| Type check | All 8 workspaces passed |
| Production build | All packages and Vite passed; 1,912 modules transformed |
| Pointer path | `Open 1 issue for Acceptance setup` opened one correctly scoped active issue |
| Keyboard path | Enter on the same named button opened the identical scoped result |
| Clear path | `Clear milestone filter Acceptance setup` removed the chip and restored both project issues |
| Detail return | Opening `QA-1` and returning with Escape retained the project, selected milestone, and issue row |
| Mobile 390x844 | Count and filter controls remained exposed; 0 visible controls crossed the viewport; document scroll width was 375px |
| O-T04 rerun | Warm-up 342.7 ms; samples 373.3, 340.6, 343.4 ms; median 343.4 ms; 1 interaction; 0 errors |

Screenshots:

- `evidence/milestone-filter-desktop-1440x900.jpg`, SHA-256 `84f68d3eea0583fde0604302fbf821e7e5e28a66aebda3440285488b372e4146`.
- `evidence/milestone-filter-mobile-390x844.jpg`, SHA-256 `d4537d9f9949c78db554226dfa303df7dab66014e36fe18a65ebc46a6cf73e12`.
- `evidence/milestone-count-mobile-390x844.jpg`, SHA-256 `880c9b4c5035508745a4442a9980a97edcb6b01ae27b439c952398fc62326ac6`.

The Chrome connector encoded these captures as JPEG bytes while retaining the requested `.png` filenames; the hashes bind the exact reviewed artifacts.

## Benchmark Boundary

The O-T04 result uses the same authenticated Chrome window, configured 1440x900 viewport, one warm-up, three measured attempts, excluded setup navigation, and discrete interaction-count rule as the Linear reference run. Browser-control round-trip latency is included, so the result is suitable only for the matched same-harness comparison. It is not a standalone rendering or network latency metric.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-004 | Milestone progress context now drills into exactly the selected milestone's issues. |
| R-008 | The selected milestone is represented as explicit, removable issue-view state. |
| R-010 | Pointer and Enter activation both work, and controls have deterministic accessible names. |
| R-011 | Issue detail open and Escape return preserve project and milestone context. |
| R-103 | O-T04 completed under the controlled matched-browser protocol with retained samples. |

## Privacy And Authority

All retained screenshots show only the synthetic OpenLinear acceptance fixture. No authenticated Linear workspace name, entity title, identifier, URL, raw DOM, screenshot, credential, API result, or MCP result enters this evidence. Control Tower local v0.8 remains the only issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This is implementation evidence for CT-22 and the missing CT-2 task only. It does not validate O-002, which retains its eligible-user population and 2026-09-05 through 2026-10-20 observation window. It does not resolve CT-21's clean-host Docker environment blocker.
