# CT-2 Reference Efficiency Benchmark Protocol

## Purpose

Measure a reproducible, non-destructive Linear reference baseline for eight approved project, milestone, issue, view, search, and detail tasks, then exercise behaviorally corresponding BasicLinear tasks through the same Chrome automation harness. This protocol supplies a reference worksheet and an engineering diagnostic; it does not replace the eligible-user O-002 observation window.

## Boundary

- Linear observation is authenticated, read-only, and UI-only. No Linear API, MCP, issue creation, comment, update, deletion, or task tracking is permitted.
- Control Tower local v0.8 is the sole work ledger. Provider projection remains disabled and `not_synced`.
- Private Linear workspace names, project or issue titles, identifiers, URLs, raw DOM, and screenshots are not retained in repository artifacts.
- BasicLinear uses the synthetic `ct12-acceptance-fixture-v1` workspace at `http://localhost:4175`.

## Environment

| Field | Value |
|---|---|
| Browser | Google Chrome 151.0.7922.138 |
| Operating system | macOS 26.5.2, build 25F84 |
| Viewport | 1440x900 CSS pixels, device pixel ratio 1 |
| Reference | Authenticated hosted Linear UI; provider build revision not exposed |
| BasicLinear build | Unborn, uncommitted repository state; exact production bundle hashes are in `matched-comparison.json` |
| Harness | Same connected Chrome control surface and locator/wait semantics for both conditions |
| Operator eligibility | Scripted browser-control operator, not an eligible target-user outcome participant |

## Trial Rules

1. Complete one warm-up before three measured attempts for each task and condition.
2. Exclude setup navigation used only to establish the task's starting state.
3. Start timing immediately before the first counted interaction and stop when the defined result is visible and interactive.
4. Count discrete user intents, not raw key events: opening a surface, entering a query, activating a result, or returning with Escape each counts once.
5. Record unrecovered user, product, or harness failures as errors. Do not silently retry a measured attempt.
6. Use the median of three attempts per task. O-002's diagnostic is the median across tasks of `100 * BasicLinear task median / Linear task median - 100`.
7. Do not compare runs made with different task definitions, viewports, browser surfaces, or start/end rules without an accepted normalization method.

## Task Definitions

| Task | Start state and counted action | End condition |
|---|---|---|
| T01 Open workspace project list | Stable workspace shell; invoke Projects | Project list is visible and interactive |
| T02 Open project detail | Project list; activate first eligible project row | Project heading and section navigation are visible |
| T03 Reach first project milestone | Project detail default section; invoke milestone navigation if the product requires it | First milestone and progress are exposed; zero interaction is valid when already present |
| T04 Open milestone issues | First milestone visible; activate its issue-count control | Project issue list is visibly scoped to that milestone |
| T05 Open saved/workspace view | Stable workspace shell; invoke the available saved-view entry | Saved/view issue context is visible and interactive |
| T06 Open team issue list | Stable workspace shell; invoke the team's issue list | Grouped team issue list is visible and interactive |
| T07 Detail and Escape return | Team issue list; open first eligible issue, then press Escape | Detail is closed and originating issue context is restored |
| T08 Exact identifier search | Stable shell; open search and enter the exact identifier, with any required scope selection | Exact issue result is visible |

T05 is analogous rather than structurally identical: Linear exposes a workspace Views entry, while BasicLinear exposes the seeded saved issue view. T03 permits zero BasicLinear interactions because milestones are already in the default project overview. These differences are retained as limitations rather than hidden through normalization.

## Retained Evidence

- `reference-baseline.json`: anonymized Linear samples, medians, interactions, and limitations.
- `matched-comparison.json`: BasicLinear samples and same-harness diagnostic comparison.
- `source-register.json`: first-party public documentation used to validate task semantics.
- `evidence.md` and `result.json`: decision boundary and Control Tower readback intent.
- CT22 implementation evidence: `../../30-implementation/CT-22/evidence.md`.

No private Linear capture is distributed with these artifacts.
