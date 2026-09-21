# Sprint Plan

## Readiness

Planning readiness remains **yellow**. CT-79 amends the original implementation topology without invalidating accepted feature behavior:

1. Preserve completed feature/domain work and finish the bounded workflow-status change in `CT-75`.
2. Complete the single-owner contract under `CT-76`; `CT-78` hides unsupported collaboration controls while retaining only internal scope metadata and canonical transfer compatibility.
3. `CT-80` ports application persistence and recovery to embedded SQLite behind the accepted service contracts.
4. `CT-81` serves the built web application and API from one loopback Node process and retires Docker/PostgreSQL as a supported runtime.
5. `CT-82` independently rehearses clean local start, upgrade, backup, restore, rollback, source import, accepted-scale search/sort, and offline operation before `CT-12` closes.

The original normalized order remains historical evidence for the already-built slices. Current new work follows `CT-75/76/79 -> CT-80`, `CT-78/80 -> CT-81`, and `CT-81 -> CT-82 -> CT-12`. `CT-13` remains blocked by `CT-3`; `CT-14` waits for CT-2, Testing, release audit, and complete outcome windows; `CT-15` follows Outcome Review.

## Delivery slices

### Slice A: risk proof and foundation

`CT-4` and `CT-6` are historical implementation inputs. CT-79 rejects their generalized-tenancy, login, PostgreSQL, and Compose end state for the accepted personal scope while preserving reusable domain, API, revision, activity, health, and visual evidence.

Exit: CT-80 and CT-81 produce a network-denied owner runtime that starts with one command, receives one owner profile plus internal scope identifiers, restarts with persisted state, exposes no administration/login UI, rejects hostile origins and unsafe paths, and surfaces stale writes correctly.

### Slice B: planning and execution domains

`CT-7` implements projects, overview, ordered milestones, progress, and activity. `CT-8` implements issues, properties, rich text, relations, comments, activity, and archive/restore. They share only accepted domain/contracts and migration conventions, preventing UI coupling.

Exit: API and minimal harness complete the project/milestone/issue mutation sequence with revisions, activity, and persisted readback.

### Slice C: daily interaction surface

`CT-9` implements list/board, filter AST, grouping/order, property visibility, saved views, search, context-preserving details, command palette, shortcuts, accessibility, responsiveness, and clean-room visual fixtures.

Exit: the synthetic core workflow is usable through pointer and keyboard, retains context, and produces deterministic screenshots. O-002 remains pending.

### Slice D: ownership and operations

`CT-10` supplies reusable canonical transfer and recovery behavior. CT-80 ports that behavior to SQLite; CT-81 supplies the one-process runtime; CT-82 verifies the complete current operational contract.

Exit: canonical seeded records round-trip with identical digests and interrupted operations preserve a known-good state.

## Testing and release path

`CT-11` security evidence is retained where it covers conflicts, rich-text security, logs, and failures; pre-CT-79 tenancy/RLS evidence is historical. `CT-12` independently verifies integrated workflow, keyboard/AT, performance, screenshots, responsive behavior, restart, local runtime, and recovery after CT-82. Findings return to the owning implementation issue and receive regression evidence.

`CT-13` can prepare a private audit template but cannot complete the public path until `CT-3` resolves identity, license, and clean-room ownership. CT-78 must close unsupported collaboration controls, and CT-82 must close the local-runtime rehearsal, before CT-12 can accept the current candidate. `CT-14` begins only after all observation windows and CT-2 baseline evidence are valid. `CT-15` closes the lifecycle without changing historical results.

## Dependency policy

Dependencies are blocking edges in the local Control Tower store and `depends_on` edges in the normalized package. Work cannot bypass a missing transitive dependency. `blocked_by` in the Planning package is reserved for unresolved conditions rather than normal sequencing. No parent/child issue hierarchy is used. Every issue is flat and belongs to exactly one milestone.

## Change and evidence policy

Each implementation session declares exact issue scope and writable files, then records changed files, commands, results, manual checks, and remaining risks. Framework or contract changes update architecture and affected acceptance/test refs before implementation proceeds. Generated code receives ordinary review and tests. Private reference screenshots never enter product files, fixtures, snapshots, or public CI artifacts.

## Automatic resolution

The accepted Discovery contract explicitly records O-002 as `baseline_needed` with CT-2. Planning applies `AUTO-O002-IMPLEMENTATION`: CT-7, CT-8, CT-9, and CT-12 may build and test their behavior before the reference baseline exists. This changes no outcome field, does not permit target acceptance, and does not remove CT-2 from Outcome Review.
