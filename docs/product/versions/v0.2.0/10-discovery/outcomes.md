# Outcome contracts

The canonical machine-readable objects live in [`discovery-package.json`](./discovery-package.json). All four baselines are `measurement_required`; no hosted cohort exists yet.

| Outcome | Metric | Target | Planned window | Guardrail |
|---|---|---|---|---|
| O-201 Hosted activation | Eligible new owners creating a project and first issue within ten minutes of completed Google sign-in | at least 70% | 2026-11-01 through 2026-11-30 | bootstrap error rate at most 1% |
| O-202 Collaboration loop | Eligible trial workspaces completing invite acceptance, non-owner assignment action, and non-owner comment within seven days | at least 60% | 2026-11-01 through 2026-12-15 | unwanted/duplicate accepted membership rate 0% |
| O-203 Paid conversion | Eligible workspaces whose 30-day trials end and that activate a paid plan within seven days | at least 12% | 2026-12-01 through 2027-01-31 | variable hosted/payment cost at most 50% of recognized subscription revenue |
| O-204 Automation reliability | Canonical PM operations completed correctly through both REST and MCP in the approved UAT matrix | at least 95% | 2026-10-01 through 2026-10-31 | successful cross-workspace unauthorized operations = 0 |

These dates are provisional observation windows, not a release-date commitment. If the product is unavailable, the cohort windows move and Outcome Review remains pending. T-BASELINE-201 through T-BASELINE-204 own the event dictionaries, eligible populations, exclusions, queries, and baseline reports.
