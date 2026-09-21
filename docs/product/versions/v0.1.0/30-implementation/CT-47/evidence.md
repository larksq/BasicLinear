# CT-47 Rich Project Overview Evidence

## Verdict

`IMPLEMENTED_AWAITING_DATABASE_AND_BROWSER_VERIFICATION`. Project overviews now use the shared versioned rich-text contract across create, edit, repository validation, activity, canonical recovery, detail rendering, and the deterministic fixture. PostgreSQL-backed migration/recovery execution and rendered desktop, tablet, and mobile acceptance remain open.

## Correction

- The public project and issue boundaries now share one explicit recursive rich-text schema for headings, paragraphs, lists, quotes, code blocks, breaks, rules, text, bounded marks, and safe-link attributes. The retired `{ type: "paragraph", text: "..." }` representation fails the public document schema.
- Project create and revision-bound update normalize content through the established 1,000-node, depth-12, 100,000-character rich-text sanitizer. Links are credential-free HTTP(S), normalized to `_blank`, and receive `noopener noreferrer nofollow`.
- Project activity compares the full normalized document so same-length edits remain mutations, but stores only node and character summaries. No overview body is copied into activity metadata.
- Migration 008 rewrites legacy project paragraph records to semantic rich-text nodes in place. It does not assign identity, position, revision, or timestamp fields.
- The populated-upgrade integration path constructs a verified pre-008 backup, requires that backup before migration, applies migration 008, and checks the converted document while preserving project revision, position, and `updated_at`.
- Project create/edit uses the existing accessible rich-text toolbar and editor. Project overview uses the shared semantic renderer for headings, lists, quotes, marks, safe links, and code without decorative nesting.
- Source review found and fixed a redaction-related no-op defect before evidence freeze: comparing only `{ nodes, characters }` would miss a same-shape, same-length body change. The repository now performs deep comparison first and redacts only the recorded activity values.
- Executable contract review found and fixed a second boundary defect: the first recursive schema allowed a `text` property on non-text nodes. Explicit discriminated node variants now reject the retired legacy paragraph at request validation.

## Automated Verification

| Check | Result |
|---|---|
| Focused rich-text contract, normalization, and project-slice tests | 3 files, 15 tests passed |
| Complete unit regression | 29 files, 179 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,926 modules; CSS 71,734 bytes; projects 37,129 bytes; index 267,483 bytes; issues 112,045 bytes; editor 402,713 bytes; no chunk warning |
| PostgreSQL integration runner | 6 files and 16 tests skipped because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent |

The skipped integration result is not a pass. The unexecuted cases include project rich-document create/update/readback, same-length edit activity, restart persistence, canonical export/import, backup/restore, clean migration 008, and the verified populated pre-008 upgrade. No database-backed result is inferred from source, unit, typecheck, or build output.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-003 | Project create, detail, edit, search storage, revision-bound update, and restart contracts now carry the accepted rich overview rather than plain textarea paragraphs. |
| R-007 | Full documents determine mutation/no-op behavior while project activity receives only node and character summaries; failed and no-op writes remain transactionally empty. |
| R-013 | Current rich documents remain canonical JSON, and migration 008 plus the pre-upgrade backup gate cover legacy project records without changing identity or order. |
| R-104 | Create and edit reuse the keyboard-operable named rich-text toolbar; detail renders semantic headings, lists, quotes, code, marks, and links. Rendered assistive-technology verification remains required. |
| R-107 | Migration and transfer tests bind exact rich-document round trips, populated legacy upgrade, and unchanged project revision/position/timestamp evidence. PostgreSQL execution remains required. |
| R-110 | The project overview remains an unframed document surface and shares the established editor and renderer geometry. Desktop, tablet, and mobile rendering remains unverified. |

## Pending Database Matrix

Run the existing integration suite against an isolated PostgreSQL admin URL and application password. It must prove clean migration 008, populated legacy paragraph conversion with a matching verified backup, unchanged project ID/workspace/team/position/revision/timestamps, rich create/update/readback, same-node/same-character edit commitment, redacted activity metadata, stale/no-op atomicity, restart persistence, export/import digest equality, and backup/restore digest equality.

## Pending Browser Matrix

No browser result is inferred from source or build output. At `1440x900`, `1024x768`, and `390x844`, the follow-up must create and edit headings, paragraphs, bold, italic, strike, code, lists, quotes, and HTTP(S) links; verify toolbar pressed state, visible focus, keyboard operation, link safety, empty/long/nested content, archive read-only behavior, activity summaries, dialog scrolling, overview semantics, and zero overlap, uncontained overflow, duplicate IDs, hidden focus, console warnings, or console errors.

## Privacy And Authority

The automated checks use repository source and synthetic values only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-47, complete CT-12, pass database-backed P-T06/P-T07/P-T14/P-T18, pass rendered P-T19, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
