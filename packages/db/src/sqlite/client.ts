import { constants, accessSync, chmodSync, lstatSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { AppError } from '@openlinear/domain';

const schemaVersion = 2;

const schemaV1 = `
  CREATE TABLE owner_profile (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    disabled_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE scope_metadata (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    workspace_id TEXT NOT NULL UNIQUE,
    workspace_name TEXT NOT NULL,
    workspace_slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
    membership_id TEXT NOT NULL UNIQUE,
    team_id TEXT NOT NULL UNIQUE,
    team_name TEXT NOT NULL,
    team_key TEXT NOT NULL UNIQUE COLLATE NOCASE,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE transfer_metadata (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    source_migrations TEXT NOT NULL CHECK (json_valid(source_migrations)),
    source_product_version TEXT NOT NULL,
    source_build_id TEXT NOT NULL,
    users_json TEXT NOT NULL CHECK (json_valid(users_json)),
    workspaces_json TEXT NOT NULL CHECK (json_valid(workspaces_json)),
    memberships_json TEXT NOT NULL CHECK (json_valid(memberships_json)),
    teams_json TEXT NOT NULL CHECK (json_valid(teams_json))
  ) STRICT;

  CREATE TABLE workflow_statuses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('backlog', 'unstarted', 'started', 'completed', 'canceled')),
    color TEXT NOT NULL,
    position REAL NOT NULL CHECK (position >= 0),
    is_default INTEGER NOT NULL CHECK (is_default IN (0, 1)),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE UNIQUE INDEX workflow_statuses_name_unique ON workflow_statuses(name);

  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    summary TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'paused', 'completed', 'canceled')),
    priority TEXT NOT NULL CHECK (priority IN ('none', 'urgent', 'high', 'medium', 'low')),
    lead_user_id TEXT,
    start_date TEXT,
    target_date TEXT,
    icon TEXT NOT NULL CHECK (icon IN ('briefcase', 'layers', 'target', 'compass', 'rocket')),
    color TEXT NOT NULL,
    position REAL NOT NULL CHECK (position >= 0),
    overview_document TEXT NOT NULL CHECK (json_valid(overview_document)),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    archived_at TEXT,
    archived_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE project_resources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    position REAL NOT NULL CHECK (position >= 0),
    created_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX project_resources_project_idx ON project_resources(project_id);

  CREATE TABLE milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    target_date TEXT,
    position REAL NOT NULL CHECK (position >= 0),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    archived_at TEXT,
    archived_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX milestones_project_idx ON milestones(project_id);

  CREATE TABLE issue_sequence (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    next_number INTEGER NOT NULL CHECK (next_number >= 1)
  ) STRICT;

  CREATE TABLE labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    archived_at TEXT,
    archived_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE UNIQUE INDEX labels_active_name_unique ON labels(lower(name)) WHERE archived_at IS NULL;

  CREATE TABLE issues (
    id TEXT PRIMARY KEY,
    sequence_number INTEGER NOT NULL UNIQUE CHECK (sequence_number >= 1),
    identifier TEXT NOT NULL UNIQUE COLLATE NOCASE,
    title TEXT NOT NULL,
    description_document TEXT NOT NULL CHECK (json_valid(description_document)),
    status_id TEXT NOT NULL REFERENCES workflow_statuses(id),
    priority TEXT NOT NULL CHECK (priority IN ('none', 'urgent', 'high', 'medium', 'low')),
    assignee_user_id TEXT,
    due_date TEXT,
    project_id TEXT REFERENCES projects(id),
    milestone_id TEXT REFERENCES milestones(id),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    archived_at TEXT,
    archived_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX issues_status_idx ON issues(status_id);
  CREATE INDEX issues_project_idx ON issues(project_id);
  CREATE INDEX issues_milestone_idx ON issues(milestone_id);

  CREATE TABLE issue_resources (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    position REAL NOT NULL CHECK (position >= 0),
    created_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX issue_resources_issue_idx ON issue_resources(issue_id);

  CREATE TABLE issue_labels (
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id),
    position REAL NOT NULL CHECK (position >= 0),
    created_at TEXT NOT NULL,
    PRIMARY KEY(issue_id, label_id)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX issue_labels_label_idx ON issue_labels(label_id);

  CREATE TABLE issue_relations (
    id TEXT PRIMARY KEY,
    source_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    target_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL CHECK (relation_type IN ('blocks', 'related', 'duplicate', 'parent')),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    created_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK(source_issue_id <> target_issue_id),
    UNIQUE(source_issue_id, target_issue_id, relation_type)
  ) STRICT;
  CREATE INDEX issue_relations_source_idx ON issue_relations(source_issue_id);
  CREATE INDEX issue_relations_target_idx ON issue_relations(target_issue_id);

  CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    author_user_id TEXT,
    body_document TEXT NOT NULL CHECK (json_valid(body_document)),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    archived_at TEXT,
    archived_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX comments_issue_idx ON comments(issue_id);

  CREATE TABLE saved_views (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sharing_scope TEXT NOT NULL CHECK (sharing_scope IN ('private', 'workspace')),
    state TEXT NOT NULL CHECK (json_valid(state)),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    archived_at TEXT,
    archived_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE activity_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_revision INTEGER NOT NULL CHECK (entity_revision >= 1),
    metadata TEXT NOT NULL CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX activity_entity_idx ON activity_entries(entity_type, entity_id, id);

  CREATE TABLE idempotency_records (
    operation TEXT NOT NULL,
    key TEXT NOT NULL,
    user_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_revision INTEGER NOT NULL CHECK (entity_revision >= 1),
    created_at TEXT NOT NULL,
    PRIMARY KEY(operation, key)
  ) STRICT, WITHOUT ROWID;
`;

const schemaV2 = `
  ALTER TABLE owner_profile DROP COLUMN password_hash;
`;

export interface LocalSession {
  userId: string;
  expiresAt: number;
  csrfTokenHashes: string[];
}

export class OpenLinearDatabase {
  readonly sqlite: DatabaseSync;
  readonly path: string;
  readonly sessions = new Map<string, LocalSession>();

  constructor(path: string) {
    this.path = path === ':memory:' ? path : resolve(path);
    if (this.path !== ':memory:') prepareDatabasePath(this.path);
    this.sqlite = new DatabaseSync(this.path, {
      allowExtension: false,
      defensive: false,
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      timeout: 2_000,
    });
    try {
      this.sqlite.exec('PRAGMA trusted_schema = OFF; PRAGMA foreign_keys = ON;');
      migrate(this.sqlite);
      if (this.path !== ':memory:') {
        this.sqlite.exec('PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL;');
        chmodSync(this.path, 0o600);
      }
      this.sqlite.enableDefensive(true);
    } catch (error) {
      this.sqlite.close();
      throw asDatabaseOpenError(error);
    }
  }

  write<T>(callback: () => T): T {
    if (this.sqlite.isTransaction) return callback();
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const result = callback();
      this.sqlite.exec('COMMIT');
      return result;
    } catch (error) {
      if (this.sqlite.isTransaction) this.sqlite.exec('ROLLBACK');
      if (error instanceof Error && error.name === 'TransferError') throw error;
      throw asSqliteError(error);
    }
  }

  close(): void {
    if (this.sqlite.isOpen) this.sqlite.close();
  }

  async destroy(): Promise<void> {
    this.close();
  }
}

function prepareDatabasePath(path: string): void {
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    accessSync(dirname(path), constants.R_OK | constants.W_OK);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new AppError('SERVICE_UNAVAILABLE', 'The database path must be a regular file.', 503, {
        field: 'databasePath',
      });
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (!isErrno(error, 'ENOENT')) {
      throw new AppError(
        'SERVICE_UNAVAILABLE',
        'The OpenLinear database directory is unavailable or not writable.',
        503,
        { field: 'databasePath', cause: error },
      );
    }
  }
}

function migrate(sqlite: DatabaseSync): void {
  const row = sqlite.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
  const current = Number(row?.user_version ?? 0);
  if (!Number.isSafeInteger(current) || current < 0 || current > schemaVersion) {
    throw new AppError('SERVICE_UNAVAILABLE', 'The database schema version is unsupported.', 503, {
      cause: { currentVersion: current, supportedVersion: schemaVersion },
    });
  }
  if (current === schemaVersion) return;
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    if (current === 0) sqlite.exec(schemaV1);
    if (current <= 1) sqlite.exec(schemaV2);
    sqlite.exec(`PRAGMA user_version = ${schemaVersion}`);
    sqlite.exec('COMMIT');
  } catch (error) {
    if (sqlite.isTransaction) sqlite.exec('ROLLBACK');
    throw error;
  }
}

function asDatabaseOpenError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const code = sqliteCode(error);
  if (message.includes('not a database') || message.includes('malformed') || code === 'ERR_SQLITE_CORRUPT') {
    return new AppError(
      'SERVICE_UNAVAILABLE',
      'The OpenLinear database is corrupt. Restore a verified backup before starting.',
      503,
      { field: 'databasePath', cause: error },
    );
  }
  if (message.includes('readonly') || message.includes('unable to open') || code === 'ERR_SQLITE_CANTOPEN') {
    return new AppError(
      'SERVICE_UNAVAILABLE',
      'The OpenLinear database cannot be opened for writing. Check the data-directory permissions.',
      503,
      { field: 'databasePath', cause: error },
    );
  }
  return new AppError(
    'SERVICE_UNAVAILABLE',
    'The OpenLinear database could not be opened or migrated.',
    503,
    { field: 'databasePath', cause: error },
  );
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function sqliteCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

export function asSqliteError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const code = sqliteCode(error);
  if (code?.startsWith('ERR_SQLITE_ERROR')) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE constraint failed')) {
      return new AppError('CONFLICT', 'That value is already in use.', 409);
    }
    if (message.includes('FOREIGN KEY constraint failed')
      || message.includes('NOT NULL constraint failed')
      || message.includes('CHECK constraint failed')) {
      return new AppError('VALIDATION_ERROR', 'A referenced record is unavailable or invalid.', 400);
    }
  }
  return new AppError('INTERNAL_ERROR', 'The operation could not be completed.', 500, { cause: error });
}

export function createDatabase(path = ':memory:'): OpenLinearDatabase {
  return new OpenLinearDatabase(path);
}

export async function databaseReady(db: OpenLinearDatabase): Promise<boolean> {
  try {
    const integrity = db.sqlite.prepare('PRAGMA quick_check').get() as { quick_check?: string } | undefined;
    const version = db.sqlite.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
    return integrity?.quick_check === 'ok' && Number(version?.user_version) === schemaVersion;
  } catch {
    return false;
  }
}

export function writeTransaction<T>(db: OpenLinearDatabase, callback: () => T): T {
  return db.write(callback);
}

export function databaseSchemaVersion(): number {
  return schemaVersion;
}
