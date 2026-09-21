# Technical-investigation critical QA

| Canonical ID | Status | Answer |
|---|---|---|
| `technical-investigation.cli-feasibility` | Pass | Versioned REST plus the packaged skill supports scriptable PM operation without adding an agent runtime. |
| `technical-investigation.tmux-feasibility` | Pass | tmux is not a hosted-product dependency; no downstream artifact assumes it. |
| `technical-investigation.local-source-of-truth` | Pass | Firestore is hosted authority; SQLite remains a separate local authority with no live sync. |
| `technical-investigation.safe-sync` | Pass | No bidirectional local/cloud sync is included; API/MCP share one hosted service layer. |
| `technical-investigation.restart-safety` | Pass | Stateless handlers, durable idempotency records, and webhook replay rules are specified. |
| `technical-investigation.revision-drift` | Pass | Optimistic revisions and idempotency keys are required across web/API/MCP. |
| `technical-investigation.breaking-assumptions` | Pass | Blaze cost, tenant security, billing state, and MCP token compatibility are explicit risks. |
| `technical-investigation.prototype-list` | Pass | Five risky contract prototypes are bounded in the technical investigation. |
