# Local recovery runbook

The supported v0.1 runtime is one loopback Node 24 process, one SQLite application file, and one backup directory. The operator is non-interactive, emits one structured JSON result, and defaults to the same platform data directory as `npm start`. No database URL, environment file, credential, Docker service, or external connection is used.

The application uses SQLite `DELETE` rollback journaling and `FULL` synchronous durability for its single writer. The idle and cleanly stopped data directory has no persistent WAL or shared-memory sidecar. SQLite may create a temporary `-journal` during a transaction or crash recovery; leave it in place so SQLite can complete recovery safely.

Build before running operator commands:

```sh
npm run build
npm run operator -- paths
npm run operator -- health
```

`OPENLINEAR_DATA_DIR` is the only storage-location override. `--database FILE` can target a stopped copy for a bounded recovery operation.

## Workspace export and import

A canonical export preserves stable IDs, revisions, timestamps, ordering, relations, rich text, activity, and the selected owner/workspace/team metadata. It excludes the process-memory session and derived progress.

```sh
npm run operator -- export --output ./workspace.json
```

The export is written atomically with owner-only permissions. Existing output is preserved unless `--overwrite` is explicit.

Import validates the format, migration manifest, allowlisted fields, canonical ordering, references, collection digests, and complete digest before promotion. Stop OpenLinear before importing into its active file. The target must be empty unless `--replace` is explicit:

```sh
npm run operator -- import --input ./workspace.json --yes
```

A source with multiple scopes fails closed. Select exactly one workspace, team, and owner as needed:

```sh
npm run operator -- import --input ./workspace.json --yes \
  --workspace WORKSPACE_UUID --team TEAM_UUID --owner OWNER_UUID
```

The source export is read-only. Import builds a temporary SQLite file, verifies foreign keys, integrity, counts, and the canonical digest, then atomically promotes the result.

## Online backup

Create a consistent SQLite backup while the application is running:

```sh
npm run operator -- backup
```

Without `--output`, the operator writes a timestamped `openlinear-*.sqlite3` file under the standard `backups/` directory. To choose a path:

```sh
npm run operator -- backup --output ./openlinear-backup.sqlite3
npm run operator -- backup verify --input ./openlinear-backup.sqlite3
```

Backups are regular owner-only files. Verification checks the supported schema version, `integrity_check`, and foreign-key violations without altering the input.

## Restore

Stop the application before restoring its active database. Prefer restoring into a fresh directory first:

```sh
OPENLINEAR_DATA_DIR=/path/to/fresh-directory \
  npm run operator -- restore --input ./openlinear-backup.sqlite3 --yes
```

After `health` and canonical workflow readback pass against the fresh directory, retain the previous application file until acceptance completes. Replacing an existing target requires both confirmation flags:

```sh
npm run operator -- restore --input ./openlinear-backup.sqlite3 --yes --replace
```

Restore verifies the source before creating a temporary target, syncs the promoted file and directory, and leaves the existing target unchanged if verification or promotion fails. Sessions are process-memory only and are renewed automatically after restart.

## Upgrade and rollback

Before upgrading a populated application:

1. Create and verify an online backup with the current build.
2. Stop the application cleanly.
3. Install and build the new locked source.
4. Run `npm start` against the same data directory.
5. Run `health`, then verify a project, milestone, issue, saved view, search, and canonical export.

SQLite schema steps execute inside `BEGIN IMMEDIATE`. A failed or unsupported migration rolls back and startup exits with an actionable error. Keep the verified pre-upgrade backup unchanged until the new build is accepted. To roll back, stop the process and restore that backup into a fresh directory with the prior build.
