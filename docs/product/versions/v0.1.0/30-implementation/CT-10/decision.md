# CT-10 canonical transfer and recovery decision

Status: accepted for the private `v0.1.0` implementation candidate.

## Canonical workspace format

- Format identifier: `basiclinear.workspace-export`, version `1`.
- One export contains exactly one workspace, every referenced public user, memberships, teams, workflow statuses, projects, project resources, milestones, issue sequences, labels, issues, label links, issue relations, comments, saved views, and activity entries.
- Password hashes, sessions, idempotency records, outbox delivery state, and derived progress are excluded. Imported new users receive a random unrecoverable credential hash and require explicit local password recovery.
- Every record uses an explicit field allowlist. Records and collections have deterministic order. Recursive object keys are lexically normalized without changing array order.
- SHA-256 binds every collection. The complete digest binds format version, migration manifest, workspace ID, and all collection digests. Generation time and build label remain provenance metadata and do not destabilize a data round trip.

## Database backup format

- Format identifier: `basiclinear.database-backup`, version `1`.
- A backup contains all local credential hashes plus the canonical snapshot for every workspace. It deliberately excludes sessions and transient delivery/retry state.
- Backup files are private, atomically replaced only with `--overwrite`, and created with owner-only mode `0600`.
- `backup verify --against-current` validates the complete file first, then recomputes the current database digest under repeatable read. A changed canonical record or credential makes the backup stale.

## Import and restore semantics

- Validation of format, fields, ordering, identifiers, references, migrations, and digests completes before mutation.
- Workspace import accepts an empty target or `--replace` for the same sole workspace. It inserts explicit identifiers, revisions, ordering, rich text, and timestamps inside a serializable transaction, rebuilds derived progress, resets sequences, and commits only after digest equality.
- Database restore requires an empty already-migrated target on the same PostgreSQL major version. It restores credential hashes but no sessions, performs the same in-transaction digest readback, and never replaces populated data.
- A populated migration plan fails with `BACKUP_REQUIRED` unless a backup matches the current applied-migration manifest and canonical database digest. Each SQL migration retains its existing transactional digest check.

## Operational topology

- PostgreSQL remains authoritative. Export, import, backup, restore, and migrations use the explicitly privileged operator URL; workspace export additionally requires an owner or administrator actor and fails without revealing whether an unauthorized workspace exists.
- Compose exposes the operator only through the `tools` profile. Database and backup persistence use named volumes; API, migration, operator, and database traffic remain on the outbound-isolated internal network.
- The public runtime has no Linear, Google, paid host, or external-service dependency. Provider access remains a research edge and is absent from recovery artifacts.
