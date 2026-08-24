# CT-8 Implementation Session

## Scope

- Control Tower issue: `CT-8`, stable ID `b69d8b70-f5be-420e-8746-602e0b3bbde7`, starting revision `2`, status `In Progress`, milestone `S3 Implementation`.
- Completed dependency: `CT-6`, stable ID `7d88459a-3877-4bc0-b628-0d6ed6031558`, revision `3`, status `Done`.
- Planning package: `d161247c9c523e004a14d6e31ebcf9d12aab9764015b312383e13a0bb851f834`.
- Requirements: `R-005`, `R-006`, `R-007`, `R-012`.
- Tests: `P-T08`, `P-T09`.
- Mode: code-mutating issue, relation, comment, activity, and recovery vertical slice.

## Allowed paths

- Production code and tests under `apps/**` and `packages/**`.
- Operations wiring under `ops/**` only when required for the migration or runtime verification.
- CT-8 evidence under `docs/product/versions/v0.1.0/30-implementation/CT-8/**`.
- Local Control Tower request artifacts under `.control-tower/**`.

Discovery, Planning, PMO, CT-4, CT-6, and CT-7 artifacts are read-only inputs. Private reference screenshots remain ignored and must not enter product assets or public evidence.

## Intended outputs

1. Workspace- and team-scoped issues with transactional stable identifiers, rich descriptions, core properties, labels, archive/restore, and an owner-only confirmed purge boundary.
2. Typed blocking, related, duplicate, and parent/sub-issue relations with atomic inverse semantics and graph-integrity checks.
3. Revision-safe comments and issue activity recorded in the same transaction as accepted mutations, with failed mutations producing no activity.
4. Issue-driven project and milestone progress projections using the versioned policy fixed by CT-7.
5. A usable dense issue list, global and contextual issue creation, and a full-page issue detail workflow with keyboard and pointer paths.

## Session record

Actor: Codex in the current user-authorized goal. No sub-agent or external coding agent is used. The project-local Control Tower v0.8 store remains the only work authority; all provider projections remain disabled.

## Boundary decision

CT-8 owns the issue aggregate, labels, relation/comment/recovery primitives, a basic issue list, full-page detail, and global plus project-contextual creation. CT-9 owns saved views, the versioned filter AST, board/grouping/property configuration, global search and command palette, bulk workflows, context-preserving side-panel composition, and seeded-scale interaction polish. CT-10 owns canonical export, backup, and restore. CT-8 may expose narrowly scoped list queries needed to make its own workflow usable, but it does not claim CT-9 or CT-10 acceptance.

## Safety decisions

- Team sequence allocation, issue mutation, activity, outbox, and progress projection updates commit transactionally.
- Rich text is versioned ProseMirror JSON and is normalized through an allowlist; product rendering does not use raw HTML.
- Relation storage uses one canonical edge with derived inverse presentation. Self-relations, invalid endpoint scopes, duplicate cycles, and parent cycles fail atomically.
- Archive is routine and recoverable. Purge requires owner capability, an archived issue, the current revision, and exact identifier confirmation.
- Descriptions, comments, session material, and private evidence do not enter logs or outbox payloads.
