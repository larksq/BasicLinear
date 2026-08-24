# CT-82 Local Runtime Rehearsal

Status: `NON_INDEPENDENT_REHEARSAL_DEFECT_RETURNED_AND_FIXED`. This session is implementation support, not P-T21 acceptance.

The fresh macOS / Node 24.18.0 run proved owner bootstrap, five default statuses, project, milestone, issue, private saved view, search, issue query, exact loopback listener, hostile Host/Origin rejection, strict session cookie, restart renewal, canonical export/import, online backup, backup verification, restore into a fresh directory, tampered-export rejection without promotion, corrupt-backup rejection without target mutation, and schema-1 to schema-2 startup upgrade.

The first run found persistent WAL/SHM files after the documented npm Ctrl-C path and returned the defect to CT-84. CT-84 selected rollback journaling for the one-process, one-connection runtime. Its final built-process rerun left zero WAL, SHM, or rollback-journal sidecars while idle and after Ctrl-C, retained `0600` database and backup files, preserved stable record IDs, and held the canonical digest `fe4961acf50cf1240e5e83e1ae0d0100b83f95f2df240762343db56aa6f8ef83` across restart.

Automated support is 56 files / 386 tests, eight workspace typechecks, a clean 1,946-module build, and two release-audit regressions. Structured evidence is in `evidence/rehearsal-20260821.json` and the CT-84 implementation package.

CT-85 subsequently reconciled the stale PostgreSQL-fixture request against CT-79. Its deterministic two-workspace legacy backup now locks canonical SHA-256 `000473521838884d216ef7ad87185a94b8400fcf488add218722d0a88d120772`, rejects ambiguity before target creation, preserves the source file byte-for-byte, and imports one explicit scope with digest parity without Docker or a database server. Current automated support is 56 files / 387 tests, eight workspace typechecks, a clean 1,946-module / 1,027,388-byte build, and two release-audit regressions.

CT-82 remains `Todo@3`; CT-84 and CT-85 are `Done@2`. A distinct actor/session must still run a clean supported account from a locked artifact, deny and observe outbound network, reproduce the locked transfer proof, cover the remaining interruption and rejected-upgrade matrix, record exact environment identities, and record independent acceptance. The repository also lacks a source revision, so no release candidate is hash-bound. No live PostgreSQL or Docker check remains under CT-79's accepted P-T21 amendment.

## CT-88 Qualification Runner

CT-88 adds `scripts/verify-clean-runtime.mjs` and its qualification-only network guard. The one-command runner locks the built artifact, launches the supported process from a fresh temporary home and data directory, records Node-visible outbound and subprocess attempts, executes the owner workflow, restart, backup/restore, canonical transfer, accepted and rejected migrations, full interruption matrix, permissions, sidecar cleanup, and accepted-scale scan/search/sort, then emits structured evidence.

The implementation-session rehearsal passed against artifact SHA-256 `2dc6cc5751d136a1c0495e68283f4052066053c850de7094567f456c2478e776`, with zero attempts across six guarded phases and 10,001-issue accepted-scale checks completing in 168.02 ms. This improves reproducibility but is not independent acceptance. CT-82 stays Todo until a distinct actor/session runs strict mode from a clean Git revision. Evidence: `evidence/ct88-runner-readiness.json` and `../../30-implementation/CT-88/`.
