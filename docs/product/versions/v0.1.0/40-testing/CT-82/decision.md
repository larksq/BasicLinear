# CT-82 Independent Runtime Acceptance Decision

Status: `ACCEPTED` for P-T21 against product revision `f7c362562fdf0657114a862331b893e470b824c0` and tree `7b5f5af4d6f0b5ead0f403f69d4695b82779194c`.

Authority: `codex-independent-testing-ct82-f7c3625` in independent session `CT82-INDEPENDENT-20260822T191944Z`. This actor/session is distinct from product implementation and CT-12 browser-testing actors, used an isolated clean checkout, and did not mutate shared tracked files or task state.

The strict CT-88 qualification independently recomputed the 111-file, 2,052,706-byte artifact at SHA-256 `c5d496806136aaf904d480e85c23c38974374a5f79ad0b651b898cc0f1cd3822` from the 1,197-file source set at SHA-256 `6b765bace3480b63a79fe01b5ac8a2158bff34248c917c82044f9aa4bd0b27fd`. All 21 structured checks and 4 runner-contract tests passed. Six guarded phases produced eleven audit records with zero outbound-network or subprocess attempts, and the accepted scale run covered 1,001 projects, 2,001 milestones, 10,001 issues, and 50,006 activity entries in 151.05 ms.

Acceptance covers CT-82 and P-T21 on macOS 25.5 arm64 with Node 24.18. The private raw acceptance is mode `0600` at `.control-tower/evidence/CT-82/qualification-f7c3625.json`, SHA-256 `ffc378a4337c24466d04a589a5c811367660e269f1dd9546d2e554b1cebe3734`; the tracked receipt is `evidence/qualification-f7c3625.json`, SHA-256 `82851883f97cfadf1057d59e489ca6951ba9ec9c71aea794636a930a156d4c9a`.

This decision supersedes the `279a9b2` revision-bound decision for current acceptance. It does not accept unfinished CT-12 P-T18/P-T19/P-T20 matrices, cross-platform behavior, CT-3 identity or legal review, accountable provenance or release approval, publication, or any product outcome.
