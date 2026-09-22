#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  canonicalStringify,
  createDatabase,
  createOnlineBackup,
  createWorkspaceExport,
  importWorkspaceExportFile,
  prepareLocalStorage,
  resolveLocalStoragePaths,
  restoreDatabaseFile,
  TransferError,
  verifyDatabaseFile,
} from '@basiclinear/db';

interface CliResult {
  ok: boolean;
  command: string;
  data?: unknown;
  error?: { code: string; message: string };
}

const maximumTransferBytes = 512 * 1024 * 1024;

function emit(result: CliResult): void {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function fail(command: string, code: string, message: string, exitCode = 1): never {
  emit({ ok: false, command, error: { code, message } });
  process.exit(exitCode);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    fail(args.join(' '), 'USAGE_ERROR', `${name} requires a value.`, 2);
  }
  return value;
}

function requiredOption(args: string[], name: string): string {
  const value = option(args, name);
  if (value === undefined) fail(args.join(' '), 'USAGE_ERROR', `${name} is required.`, 2);
  return value;
}

function requireConfirmation(args: string[], command: string): void {
  if (!args.includes('--yes')) {
    fail(command, 'CONFIRMATION_REQUIRED', 'Review the operation and repeat with --yes.', 2);
  }
}

async function readTransferFile(path: string): Promise<{ value: unknown; bytes: number; sha256: string }> {
  let info;
  try {
    info = await lstat(path);
  } catch {
    throw new TransferError('INPUT_UNAVAILABLE', 'The requested input file is unavailable.');
  }
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximumTransferBytes) {
    throw new TransferError('INPUT_UNAVAILABLE', 'The input must be a regular file within the supported size limit.');
  }
  const data = await readFile(path);
  try {
    return {
      value: JSON.parse(data.toString('utf8')) as unknown,
      bytes: data.byteLength,
      sha256: createHash('sha256').update(data).digest('hex'),
    };
  } catch {
    throw new TransferError('INVALID_JSON', 'The input file does not contain valid JSON.');
  }
}

async function writeTransferFile(
  path: string,
  value: unknown,
  overwrite: boolean,
): Promise<{ bytes: number; sha256: string }> {
  try {
    const existing = await lstat(path);
    if (!overwrite) throw new TransferError('OUTPUT_EXISTS', 'The output exists; use --overwrite to replace it.');
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw new TransferError('OUTPUT_UNSAFE', 'The output path must be a regular file.');
    }
  } catch (error) {
    if (error instanceof TransferError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new TransferError('OUTPUT_UNAVAILABLE', 'The output path cannot be inspected safely.');
    }
  }

  const data = Buffer.from(`${canonicalStringify(value)}\n`, 'utf8');
  const temporary = join(dirname(path), `.${process.pid}-${randomBytes(8).toString('hex')}.basiclinear-tmp`);
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, path);
  } catch {
    if (handle !== undefined) await handle.close().catch(() => undefined);
    await unlink(temporary).catch(() => undefined);
    throw new TransferError('OUTPUT_UNAVAILABLE', 'The output file could not be written atomically.');
  }
  return { bytes: data.byteLength, sha256: createHash('sha256').update(data).digest('hex') };
}

function buildIdentity(): { productVersion: string; buildId: string } {
  return {
    productVersion: '0.1.0',
    buildId: process.env.BASICLINEAR_BUILD_ID?.trim() || 'development',
  };
}

const paths = resolveLocalStoragePaths();

function databasePath(args: string[]): string {
  const explicit = option(args, '--database');
  if (explicit !== undefined) return explicit;
  prepareLocalStorage(paths);
  return paths.databasePath;
}

async function health(args: string[]): Promise<void> {
  const database = databasePath(args);
  emit({ ok: true, command: 'health', data: verifyDatabaseFile(database) });
}

async function importWorkspace(args: string[]): Promise<void> {
  requireConfirmation(args, 'import');
  const inputPath = requiredOption(args, '--input');
  const database = databasePath(args);
  const input = await readTransferFile(inputPath);
  const result = await importWorkspaceExportFile(input.value, database, {
    replace: args.includes('--replace'),
    ...(option(args, '--workspace') === undefined ? {} : { workspaceId: option(args, '--workspace')! }),
    ...(option(args, '--team') === undefined ? {} : { teamId: option(args, '--team')! }),
    ...(option(args, '--owner') === undefined ? {} : { ownerUserId: option(args, '--owner')! }),
  });
  emit({
    ok: true,
    command: 'import',
    data: { ...result, database, input: inputPath, inputBytes: input.bytes, inputSha256: input.sha256 },
  });
}

async function exportWorkspace(args: string[]): Promise<void> {
  const database = databasePath(args);
  const output = requiredOption(args, '--output');
  const db = createDatabase(database);
  try {
    const scope = db.sqlite.prepare(`
      SELECT o.id AS ownerId, s.workspace_id AS workspaceId
      FROM owner_profile o CROSS JOIN scope_metadata s
      WHERE o.singleton = 1 AND s.singleton = 1
    `).get() as { ownerId: string; workspaceId: string } | undefined;
    if (scope === undefined) throw new TransferError('DATABASE_EMPTY', 'The local workspace is not initialized.');
    const document = await createWorkspaceExport(db, scope.workspaceId, scope.ownerId, buildIdentity());
    const file = await writeTransferFile(output, document, args.includes('--overwrite'));
    emit({
      ok: true,
      command: 'export',
      data: {
        workspaceId: scope.workspaceId,
        canonicalDigest: document.digests.canonical,
        records: Object.values(document.collections).reduce((sum, records) => sum + records.length, 0),
        output,
        ...file,
      },
    });
  } finally {
    db.close();
  }
}

async function backup(args: string[]): Promise<void> {
  if (args[1] === 'verify') {
    const input = requiredOption(args, '--input');
    emit({ ok: true, command: 'backup verify', data: verifyDatabaseFile(input) });
    return;
  }
  const database = databasePath(args);
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const requestedOutput = option(args, '--output');
  if (requestedOutput === undefined) prepareLocalStorage(paths);
  const output = requestedOutput ?? join(paths.backupDirectory, `basiclinear-${timestamp}.sqlite3`);
  const db = createDatabase(database);
  try {
    emit({
      ok: true,
      command: 'backup',
      data: await createOnlineBackup(db, output, args.includes('--overwrite')),
    });
  } finally {
    db.close();
  }
}

async function restore(args: string[]): Promise<void> {
  requireConfirmation(args, 'restore');
  const input = requiredOption(args, '--input');
  const database = databasePath(args);
  emit({
    ok: true,
    command: 'restore',
    data: restoreDatabaseFile(input, database, args.includes('--replace')),
  });
}

function help(): void {
  emit({
    ok: true,
    command: 'help',
    data: {
      dataDirectory: paths.dataDirectory,
      database: paths.databasePath,
      backupDirectory: paths.backupDirectory,
      commands: [
        'health [--database FILE]',
        'import --input FILE --yes [--database FILE] [--workspace UUID] [--team UUID] [--owner UUID] [--replace]',
        'export --output FILE [--database FILE] [--overwrite]',
        'backup [--database FILE] [--output FILE] [--overwrite]',
        'backup verify --input FILE',
        'restore --input FILE --yes [--database FILE] [--replace]',
        'paths',
      ],
    },
  });
}

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === 'local' ? rawArgs.slice(1) : rawArgs;
try {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') help();
  else if (args[0] === 'paths') emit({ ok: true, command: 'paths', data: paths });
  else if (args[0] === 'health') await health(args);
  else if (args[0] === 'import') await importWorkspace(args);
  else if (args[0] === 'export') await exportWorkspace(args);
  else if (args[0] === 'backup') await backup(args);
  else if (args[0] === 'restore') await restore(args);
  else fail('unknown', 'USAGE_ERROR', 'Unknown command. Run basiclinear help.', 2);
} catch (error) {
  if (error instanceof TransferError) fail(args.join(' ') || 'unknown', error.code, error.message);
  const message = error instanceof Error ? error.message : 'The local operator command failed.';
  fail(args.join(' ') || 'unknown', 'OPERATION_FAILED', message);
}
