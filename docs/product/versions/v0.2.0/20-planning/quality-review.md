# Planning quality review

## Traceability

All 20 Must requirements map to at least one implementation issue, one concrete test, and one unchanged outcome. Every issue separates output, quality, and outcome completion. The graph is dependency-closed and acyclic. REST and MCP parity, trial/billing state, workspace security, costs, accessibility, and exclusions are covered explicitly.

## Contradiction review

- Local SQLite and hosted Firestore are separate authorities; no artifact promises silent upload or live sync.
- Google is the only hosted sign-in provider; no password database or enterprise SSO is implied.
- “Free Pro” is interpreted as a no-card 30-day trial; exact dates are shown and no automatic charge occurs without checkout.
- The sponsor's $2/$12 prices are preserved; the pricing task can recommend but not mutate them.
- MCP and skills enable external operation but do not add AI agents.
- Comments and assignment are basic: one assignee, no mentions/notifications/files/presence.
- v0.2 reuses the existing S1 through S6 lifecycle; it creates no version-specific milestone or separate human approval path.
- T-SECURITY-MCP resolves the PAT compatibility risk by keeping PATs on REST and requiring discoverable OAuth 2.1 authorization for remote MCP; no downstream token passthrough is allowed.
- IR-202 preserves the existing Vite application on supported Firebase Hosting and routes trusted dynamic surfaces to Cloud Run/Functions; it avoids an unsupported App Hosting framework assumption.

## Residual warnings

Hosted demand and all four baselines are unmeasured. T-VALIDATE-PRICING remains partial because its five owner sessions are unavailable; T-SECURITY-MCP has a conditional GO documented under Implementation research; and T-BASELINE-201 through T-BASELINE-204 remain visible. An accepted-contract automatic resolution makes baseline collection non-blocking for implementation only; it does not authorize outcome claims or public billing.

## Decision

Planning readiness is yellow with exact allowed scope I-201 through I-210 in topological order. There is no global stop before implementation and no protected human-action issue within CT-133 through CT-142. Runtime provider setup, implementation, independent testing, combined qualified/accountable approval, public release, and outcome validation remain explicit stage boundaries.
