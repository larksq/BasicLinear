# CT-2 Reference Baseline Evidence

## Decision

`REFERENCE_BASELINE_MEASURED`. The eight read-only Linear reference tasks have a versioned, anonymized timing and interaction baseline, and all eight behaviorally corresponding BasicLinear tasks now complete under the same Chrome harness. CT-2's measurement output is complete; O-002 itself is not validated.

## Results

| Measure | Linear reference | BasicLinear diagnostic |
|---|---:|---:|
| Measured attempts | 24 | 24 |
| Attempt errors | 0 | 0 |
| Median of task medians | 3,251.35 ms | 392.5 ms |
| Eight-task interactions | 11 | 9 |
| Median task-level reference-relative overhead | Baseline | -89.1% |

The negative diagnostic overhead is not a human-speed claim. Several reference timings are dominated by the browser-control visible-ready interval, BasicLinear runs locally, T05 is only analogous, and no eligible target user participated. The retained value proves that the task suite is executable and supplies a controlled baseline for later study; it cannot satisfy the O-002 population or observation window.

## Task Completion

All reference tasks completed without mutation. O-T04 initially had no BasicLinear path, producing CT-22. After CT-22, the milestone count opens a visibly filtered project issue list in one interaction; warm-up was 342.7 ms and the three measured attempts were 373.3, 340.6, and 343.4 ms, for a 343.4 ms median.

The complete samples, medians, interactions, hashes, environment, and limitations are in `reference-baseline.json` and `matched-comparison.json`.

## Sources

Task semantics were cross-checked against Linear's first-party [Search](https://linear.app/docs/search), [Projects](https://linear.app/docs/projects), [Select issues](https://linear.app/docs/select-issues), and [Default team pages](https://linear.app/docs/default-team-pages) documentation. The authenticated UI supplied read-only observed behavior and aggregate measurements only.

## Privacy Review

Repository artifacts contain no private Linear workspace name, project or issue title, identifier, URL, raw DOM, screenshot, cookie, session value, or account credential. The reference JSON contains generic task names and numerical aggregates only. BasicLinear screenshots contain only the synthetic acceptance fixture.

## Outcome Boundary

O-002 remains `not_validated`. Its eligible-user population and 2026-09-05 through 2026-10-20 observation window are unchanged. The earliest valid outcome review remains 2026-10-21. The automated comparison is a pre-window engineering diagnostic and must not be promoted to outcome evidence.

## Control Tower Boundary

CT-2 is tracked only in `.control-tower/tasks-v0.8.sqlite3`. Linear provider projection is disabled and `not_synced`; no Linear API, MCP, provider issue, or provider task write was used.
