#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir, platform, release, arch, hostname } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiEntry = join(root, 'apps/api/dist/index.js');
const operatorEntry = join(root, 'ops/cli/dist/index.js');
const guardEntry = join(root, 'scripts/clean-runtime-network-guard.cjs');
const supportedArtifactRoots = [
  'apps/api/dist',
  'apps/web/dist',
  'ops/cli/dist',
  'packages/contracts/dist',
  'packages/db/dist',
  'packages/domain/dist',
  'packages/test-fixtures/dist',
  'packages/ui/dist',
];
const supportedArtifactFiles = ['package.json', 'package-lock.json'];

class QualificationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'QualificationError';
    this.details = details;
  }
}

function check(condition, message, details = {}) {
  if (!condition) throw new QualificationError(message, details);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(path) {
  return sha256(readFileSync(path));
}

function mode(path) {
  return statSync(path).mode & 0o777;
}

function inside(parent, child) {
  const value = relative(parent, child);
  return value === '' || (value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value));
}

function executableFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new QualificationError(`Artifact path is symlinked: ${path}`);
    if (entry.isDirectory()) result.push(...executableFiles(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

export function parseArguments(argv) {
  const options = {
    actor: '',
    session: '',
    implementationActor: '',
    implementationSession: '',
    output: null,
    keepWorkDirectory: false,
    implementationRehearsal: false,
    planOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--actor') options.actor = argv[++index] ?? '';
    else if (argument === '--session') options.session = argv[++index] ?? '';
    else if (argument === '--implementation-actor') options.implementationActor = argv[++index] ?? '';
    else if (argument === '--implementation-session') options.implementationSession = argv[++index] ?? '';
    else if (argument === '--output') options.output = argv[++index] ?? '';
    else if (argument === '--keep-work-directory') options.keepWorkDirectory = true;
    else if (argument === '--implementation-rehearsal') options.implementationRehearsal = true;
    else if (argument === '--plan-only') options.planOnly = true;
    else throw new QualificationError(`Unknown argument: ${argument}`);
  }
  check(options.actor.trim().length > 0, '--actor is required.');
  check(options.session.trim().length > 0, '--session is required.');
  if (options.output !== null) check(options.output.trim().length > 0, '--output requires a path.');
  if (!options.implementationRehearsal) {
    check(options.implementationActor.trim().length > 0, '--implementation-actor is required for independent acceptance.');
    check(options.implementationSession.trim().length > 0, '--implementation-session is required for independent acceptance.');
    check(options.actor !== options.implementationActor, 'The acceptance actor must differ from the implementation actor.');
    check(options.session !== options.implementationSession, 'The acceptance session must differ from the implementation session.');
  }
  return options;
}

export function artifactManifest(projectRoot = root) {
  const paths = [];
  for (const relativePath of supportedArtifactRoots) {
    const directory = join(projectRoot, relativePath);
    check(existsSync(directory) && lstatSync(directory).isDirectory(), `Missing built artifact directory: ${relativePath}`);
    paths.push(...executableFiles(directory));
  }
  for (const relativePath of supportedArtifactFiles) {
    const path = join(projectRoot, relativePath);
    check(existsSync(path) && lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink(), `Missing artifact input: ${relativePath}`);
    paths.push(path);
  }
  const files = [...new Set(paths)].map((path) => ({
    path: relative(projectRoot, path).split(sep).join('/'),
    sha256: fileSha256(path),
    bytes: statSync(path).size,
  })).sort((left, right) => left.path.localeCompare(right.path));
  const digest = sha256(files.map((file) => `${file.sha256}  ${file.path}\n`).join(''));
  return { digest, files, bytes: files.reduce((sum, file) => sum + file.bytes, 0) };
}

async function runCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const timeoutMs = options.timeoutMs ?? 60_000;
  const result = await new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new QualificationError(`Command timed out: ${basename(command)}`, { args }));
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolvePromise({ code, signal, stdout, stderr });
    });
  });
  if (options.expectSuccess !== false) {
    check(result.code === 0, `Command failed: ${basename(command)} ${args.join(' ')}`, {
      code: result.code,
      signal: result.signal,
      stderr: result.stderr.slice(-2_000),
    });
  }
  return result;
}

async function gitState(projectRoot = root) {
  const revisionResult = await runCommand('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: projectRoot,
    expectSuccess: false,
  });
  const statusResult = await runCommand('git', ['status', '--porcelain=v1', '-z'], { cwd: projectRoot });
  const filesResult = await runCommand('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: projectRoot,
  });
  const files = filesResult.stdout.split('\0').filter(Boolean).sort();
  const records = [];
  for (const relativePath of files) {
    const path = resolve(projectRoot, relativePath);
    if (!inside(projectRoot, path) || !existsSync(path)) continue;
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    records.push({ path: relativePath.split(sep).join('/'), sha256: fileSha256(path) });
  }
  return {
    revision: revisionResult.code === 0 ? revisionResult.stdout.trim() : null,
    clean: statusResult.stdout.length === 0,
    statusEntries: statusResult.stdout.split('\0').filter(Boolean).length,
    sourceSetSha256: sha256(records.map((record) => `${record.sha256}  ${record.path}\n`).join('')),
    sourceFiles: records.length,
  };
}

function cleanEnvironment({ dataDirectory, port, auditPath, buildId, homeDirectory }) {
  const allow = ['PATH', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'ComSpec', 'PATHEXT', 'LANG', 'LC_ALL', 'TZ'];
  const environment = {};
  for (const key of allow) if (process.env[key] !== undefined) environment[key] = process.env[key];
  return {
    ...environment,
    HOME: homeDirectory,
    USERPROFILE: homeDirectory,
    LOCALAPPDATA: join(homeDirectory, 'AppData', 'Local'),
    XDG_DATA_HOME: join(homeDirectory, '.local', 'share'),
    OPENLINEAR_DATA_DIR: dataDirectory,
    OPENLINEAR_HOST: '127.0.0.1',
    OPENLINEAR_PORT: String(port),
    OPENLINEAR_BUILD_ID: buildId,
    OPENLINEAR_NETWORK_AUDIT_PATH: auditPath,
    LOG_LEVEL: 'warn',
  };
}

async function freePort() {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.once('error', rejectPromise);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : null;
      server.close((error) => {
        if (error) rejectPromise(error);
        else if (port === null) rejectPromise(new QualificationError('Could not reserve a loopback port.'));
        else resolvePromise(port);
      });
    });
  });
}

function captureChild(child) {
  const capture = { stdout: '', stderr: '' };
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { capture.stdout += chunk; });
  child.stderr.on('data', (chunk) => { capture.stderr += chunk; });
  return capture;
}

function waitForChild(child, timeoutMs = 15_000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new QualificationError('Runtime child did not exit in time.'));
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolvePromise({ code, signal });
    });
  });
}

async function waitReady(child, capture, origin, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new QualificationError('Runtime exited before readiness.', {
        exitCode: child.exitCode,
        stderr: capture.stderr.slice(-2_000),
      });
    }
    try {
      const response = await fetch(`${origin}/health/ready`, { signal: AbortSignal.timeout(750) });
      if (response.status === 200 && (await response.json()).status === 'ready') return;
    } catch {
      // Startup polling is bounded by the deadline.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new QualificationError('Runtime did not become ready.', { stderr: capture.stderr.slice(-2_000) });
}

async function startRuntime({ dataDirectory, auditPath, buildId, homeDirectory }) {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--require', guardEntry, apiEntry], {
    cwd: root,
    env: cleanEnvironment({ dataDirectory, port, auditPath, buildId, homeDirectory }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const capture = captureChild(child);
  await waitReady(child, capture, origin);
  return { child, capture, origin, port };
}

async function stopRuntime(runtime, signal) {
  const killed = runtime.child.kill(signal);
  check(killed, `Could not send ${signal} to the runtime.`);
  const result = await waitForChild(runtime.child);
  if (signal === 'SIGINT' || signal === 'SIGTERM') {
    check(result.code === 0, `Runtime did not close cleanly after ${signal}.`, {
      ...result,
      stderr: runtime.capture.stderr.slice(-2_000),
    });
  }
  return result;
}

async function runtimeFailure({ dataDirectory, auditPath, buildId, homeDirectory }) {
  const port = await freePort();
  const child = spawn(process.execPath, ['--require', guardEntry, apiEntry], {
    cwd: root,
    env: cleanEnvironment({ dataDirectory, port, auditPath, buildId, homeDirectory }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const capture = captureChild(child);
  const result = await waitForChild(child);
  check(result.code !== 0, 'Rejected runtime unexpectedly started successfully.');
  return { ...result, ...capture };
}

async function jsonRequest(origin, path, options = {}) {
  const method = options.method ?? 'GET';
  const headers = { accept: 'application/json', ...(options.headers ?? {}) };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers['x-openlinear-csrf'] = options.csrf;
  if (options.body !== undefined) {
    headers.origin = options.origin ?? origin;
    headers['content-type'] = 'application/json';
  }
  const response = await fetch(`${origin}${path}`, {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  });
  const text = await response.text();
  let payload = null;
  if (text !== '') {
    try { payload = JSON.parse(text); } catch { payload = { text }; }
  }
  return { response, payload };
}

function rawHostStatus(port, hostHeader) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = httpRequest({
      host: '127.0.0.1',
      port,
      path: '/api/v1/meta',
      method: 'GET',
      headers: { host: hostHeader },
    }, (response) => {
      response.resume();
      response.once('end', () => resolvePromise(response.statusCode));
    });
    request.once('error', rejectPromise);
    request.end();
  });
}

function sessionHeaders(result) {
  const cookie = result.response.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  const csrf = result.response.headers.get('x-openlinear-csrf-token') ?? '';
  check(cookie !== '' && csrf !== '', 'The local owner session did not issue strict session material.');
  return { cookie, csrf };
}

function defaultViewState() {
  return {
    version: 1,
    layout: 'list',
    groupBy: 'status',
    order: { field: 'updatedAt', direction: 'desc' },
    visibleProperties: ['priority', 'assignee', 'project', 'labels', 'dueDate'],
    density: 'default',
    filter: { version: 1, root: { type: 'group', operator: 'and', children: [] } },
    searchQuery: '',
    archiveState: 'active',
    collapsedGroups: [],
  };
}

async function ownerWorkflow(runtime) {
  const rootPage = await fetch(`${runtime.origin}/projects`);
  check(rootPage.status === 200 && (await rootPage.text()).includes('<div id="root"></div>'), 'The built SPA was not served.');
  check(await rawHostStatus(runtime.port, 'attacker.example') === 403, 'A hostile Host header was not rejected.');
  const hostileOrigin = await jsonRequest(runtime.origin, '/api/v1/meta', {
    headers: { origin: 'https://attacker.example' },
  });
  check(hostileOrigin.response.status === 403, 'A hostile Origin header was not rejected.');
  const oidc = await jsonRequest(runtime.origin, '/api/v1/auth/oidc/start');
  check(oidc.response.status === 404, 'A retired OIDC route is reachable.');

  const owner = await jsonRequest(runtime.origin, '/api/v1/local-owner-session', {
    method: 'POST',
    body: {},
  });
  check(owner.response.status === 201, 'Fresh owner bootstrap did not create the local owner.', { status: owner.response.status });
  const session = owner.payload?.data;
  check(session?.workspaces?.length === 1, 'Fresh bootstrap did not return exactly one workspace.');
  const workspaceId = session.workspaces[0].id;
  const ownerId = session.user.id;
  const { cookie, csrf } = sessionHeaders(owner);

  const tabTwo = await jsonRequest(runtime.origin, '/api/v1/session', { cookie });
  check(tabTwo.response.status === 200, 'A second local tab could not renew CSRF state.');
  const csrfTwo = tabTwo.response.headers.get('x-openlinear-csrf-token') ?? '';
  check(csrfTwo !== '' && csrfTwo !== csrf, 'Separate tabs did not receive distinct CSRF proofs.');

  const teams = await jsonRequest(runtime.origin, `/api/v1/workspaces/${workspaceId}/teams`, { cookie });
  const statuses = await jsonRequest(runtime.origin, `/api/v1/workspaces/${workspaceId}/statuses`, { cookie });
  check(teams.payload?.data?.length === 1, 'The owner runtime did not expose exactly one internal team.');
  check(statuses.payload?.data?.length === 5, 'The owner runtime did not create five default statuses.');
  const teamId = teams.payload.data[0].id;
  const defaultStatus = statuses.payload.data.find((status) => status.isDefault);
  const completedStatus = statuses.payload.data.find((status) => status.category === 'completed');
  check(defaultStatus && completedStatus, 'Default or completed workflow status is missing.');

  const project = await jsonRequest(runtime.origin, `/api/v1/workspaces/${workspaceId}/projects`, {
    method: 'POST', cookie, csrf, body: {
      teamId,
      name: 'Clean runtime project',
      summary: 'External artifact qualification',
      leadUserId: ownerId,
      status: 'in_progress',
      priority: 'urgent',
      idempotencyKey: 'ct88-project-clean-runtime',
    },
  });
  check(project.response.status === 201, 'Project creation failed.', { status: project.response.status, payload: project.payload });
  const projectRecord = project.payload.data;

  const milestone = await jsonRequest(runtime.origin, `/api/v1/workspaces/${workspaceId}/projects/${projectRecord.id}/milestones`, {
    method: 'POST', cookie, csrf, body: {
      name: 'Qualification milestone',
      description: 'Prove local recovery.',
      idempotencyKey: 'ct88-milestone-clean-runtime',
    },
  });
  check(milestone.response.status === 201, 'Milestone creation failed.', { payload: milestone.payload });
  const milestoneRecord = milestone.payload.data;

  const label = await jsonRequest(runtime.origin, `/api/v1/workspaces/${workspaceId}/labels`, {
    method: 'POST', cookie, csrf, body: {
      name: 'Qualification',
      color: '#2563EB',
      idempotencyKey: 'ct88-label-clean-runtime',
    },
  });
  check(label.response.status === 201, 'Label creation failed.');

  const issue = await jsonRequest(runtime.origin, `/api/v1/workspaces/${workspaceId}/issues`, {
    method: 'POST', cookie, csrf, body: {
      teamId,
      title: 'Verify the locked local artifact',
      statusId: defaultStatus.id,
      priority: 'urgent',
      assigneeUserId: ownerId,
      projectId: projectRecord.id,
      milestoneId: milestoneRecord.id,
      labelIds: [label.payload.data.id],
      descriptionDocument: {
        version: 1,
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Runtime evidence' }] }],
      },
      idempotencyKey: 'ct88-issue-clean-runtime',
    },
  });
  check(issue.response.status === 201, 'Issue creation failed.', { payload: issue.payload });
  const issueRecord = issue.payload.data;

  const savedView = await jsonRequest(runtime.origin, `/api/v1/workspaces/${workspaceId}/views`, {
    method: 'POST', cookie, csrf: csrfTwo, body: {
      name: 'Qualification view',
      sharingScope: 'workspace',
      state: defaultViewState(),
      idempotencyKey: 'ct88-view-clean-runtime',
    },
  });
  check(savedView.response.status === 201 && savedView.payload?.data?.sharingScope === 'private', 'Saved view was not forced to private scope.');

  const completed = await jsonRequest(runtime.origin, `/api/v1/workspaces/${workspaceId}/issues/${issueRecord.id}`, {
    method: 'PATCH', cookie, csrf, body: {
      expectedRevision: issueRecord.revision,
      statusId: completedStatus.id,
    },
  });
  check(completed.response.status === 200, 'Issue completion failed.', { payload: completed.payload });

  const projectReadback = await jsonRequest(runtime.origin, `/api/v1/workspaces/${workspaceId}/projects/${projectRecord.id}`, { cookie });
  const milestonesReadback = await jsonRequest(runtime.origin, `/api/v1/workspaces/${workspaceId}/projects/${projectRecord.id}/milestones`, { cookie });
  check(projectReadback.payload?.data?.progress?.completedCount === 1, 'Project progress did not derive completed work.');
  check(milestonesReadback.payload?.data?.[0]?.progress?.completedCount === 1, 'Milestone progress did not derive completed work.');

  const search = await jsonRequest(runtime.origin, `/api/v1/workspaces/${workspaceId}/search?query=locked%20local&limit=20`, { cookie });
  check(search.response.status === 200 && search.payload?.data?.some((record) => record.id === issueRecord.id), 'Workspace search did not return the created issue.');
  const issueQuery = await jsonRequest(runtime.origin, `/api/v1/workspaces/${workspaceId}/issues?query=locked%20local&order=identifier&direction=asc`, { cookie });
  check(issueQuery.response.status === 200 && issueQuery.payload?.data?.length === 1, 'Issue scan/sort did not return a deterministic result.');

  return {
    ownerId,
    workspaceId,
    teamId,
    projectId: projectRecord.id,
    milestoneId: milestoneRecord.id,
    issueId: issueRecord.id,
    viewId: savedView.payload.data.id,
    cookie,
    csrf,
  };
}

async function returningOwner(runtime, expected) {
  const stale = await jsonRequest(runtime.origin, '/api/v1/session', { cookie: expected.cookie });
  check(stale.response.status === 401, 'A process-memory session survived restart.');
  const owner = await jsonRequest(runtime.origin, '/api/v1/local-owner-session', { method: 'POST', body: {} });
  check(owner.response.status === 200, 'Returning owner bootstrap did not reuse local identity.');
  check(owner.payload?.data?.user?.id === expected.ownerId, 'Owner ID changed across restart.');
  check(owner.payload?.data?.workspaces?.[0]?.id === expected.workspaceId, 'Workspace ID changed across restart.');
  const { cookie } = sessionHeaders(owner);
  const projects = await jsonRequest(runtime.origin, `/api/v1/workspaces/${expected.workspaceId}/projects`, { cookie });
  const issue = await jsonRequest(runtime.origin, `/api/v1/workspaces/${expected.workspaceId}/issues/${expected.issueId}`, { cookie });
  check(projects.payload?.data?.some((record) => record.id === expected.projectId), 'Project did not persist across restart.');
  check(issue.payload?.data?.id === expected.issueId, 'Issue did not persist across restart.');
  return { cookie };
}

async function operator(args, environment, expectSuccess = true) {
  const result = await runCommand(process.execPath, [operatorEntry, ...args], {
    env: environment,
    expectSuccess,
    timeoutMs: 120_000,
  });
  let payload = null;
  try { payload = JSON.parse(result.stdout); } catch { /* failure output is retained below */ }
  if (expectSuccess) check(payload?.ok === true, `Operator command did not return success: ${args[0]}`);
  return { ...result, payload };
}

function operatorEnvironment(dataDirectory, buildId, homeDirectory) {
  return cleanEnvironment({
    dataDirectory,
    port: 4174,
    auditPath: join(dataDirectory, 'operator-unused-network-audit.jsonl'),
    buildId,
    homeDirectory,
  });
}

function assertNoSidecars(databasePath) {
  for (const suffix of ['-journal', '-shm', '-wal']) {
    check(!existsSync(`${databasePath}${suffix}`), `SQLite sidecar remains: ${basename(databasePath)}${suffix}`);
  }
}

function assertOwnerMode(path) {
  if (platform() === 'win32') return 'not_applicable';
  check(mode(path) === 0o600, `Expected owner-only 0600 permissions: ${path}`, { mode: mode(path).toString(8) });
  return 'passed';
}

function parseAudit(path) {
  const records = readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const attempts = records.filter((record) => record.event === 'outbound_denied');
  check(attempts.length === 0, 'The runtime attempted an outbound or subprocess operation.', { attempts });
  check(records.some((record) => record.event === 'guard_started'), 'The outbound-denial guard did not start.');
  return {
    records: records.length,
    attempts: attempts.length,
    summaryPresent: records.some((record) => record.event === 'guard_summary'),
  };
}

function createPriorVersionFixture(sourceDatabase, targetDatabase) {
  copyFileSync(sourceDatabase, targetDatabase);
  chmodSync(targetDatabase, 0o600);
  const database = new DatabaseSync(targetDatabase);
  database.exec("ALTER TABLE owner_profile ADD COLUMN password_hash TEXT NOT NULL DEFAULT '$legacy$ct88'; PRAGMA user_version = 1;");
  database.close();
}

function createFutureVersionFixture(sourceDatabase, targetDatabase) {
  copyFileSync(sourceDatabase, targetDatabase);
  chmodSync(targetDatabase, 0o600);
  const database = new DatabaseSync(targetDatabase);
  database.exec('PRAGMA user_version = 3;');
  database.close();
}

function createRejectedMigrationFixture(targetDatabase) {
  const database = new DatabaseSync(targetDatabase);
  database.exec(`
    CREATE TABLE owner_profile (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      id TEXT NOT NULL,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;
    PRAGMA user_version = 1;
  `);
  database.close();
  chmodSync(targetDatabase, 0o600);
}

function seedAcceptedScale(sourceDatabase, targetDatabase, ids) {
  copyFileSync(sourceDatabase, targetDatabase);
  chmodSync(targetDatabase, 0o600);
  const database = new DatabaseSync(targetDatabase);
  const timestamp = '2026-08-21T00:00:00.000Z';
  database.exec('PRAGMA foreign_keys = ON; BEGIN IMMEDIATE;');
  try {
    const projectInsert = database.prepare(`
      INSERT INTO projects (
        id, name, summary, status, priority, lead_user_id, start_date, target_date,
        icon, color, position, overview_document, revision, created_at, updated_at
      ) VALUES (?, ?, '', 'planned', 'none', NULL, NULL, NULL, 'layers', '#5E6AD2', ?,
                '{"version":1,"type":"doc","content":[]}', 1, ?, ?)
    `);
    const milestoneInsert = database.prepare(`
      INSERT INTO milestones (
        id, project_id, name, description, target_date, position, revision, created_at, updated_at
      ) VALUES (?, ?, ?, '', NULL, ?, 1, ?, ?)
    `);
    const issueInsert = database.prepare(`
      INSERT INTO issues (
        id, sequence_number, identifier, title, description_document, status_id,
        priority, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, '{"version":1,"type":"doc","content":[]}', ?, 'none', 1, ?, ?)
    `);
    const activityInsert = database.prepare(`
      INSERT INTO activity_entries (
        actor_user_id, entity_type, entity_id, action, entity_revision, metadata, created_at
      ) VALUES (?, 'issue', ?, 'issue.updated', 1, '{"fields":[]}', ?)
    `);
    const projects = [];
    for (let index = 0; index < 1_000; index += 1) {
      const id = randomUUID();
      projects.push(id);
      projectInsert.run(id, `Scale project ${String(index).padStart(4, '0')}`, (index + 2) * 100, timestamp, timestamp);
    }
    for (let index = 0; index < 2_000; index += 1) {
      milestoneInsert.run(randomUUID(), projects[index % projects.length], `Scale milestone ${index}`, (index + 2) * 100, timestamp, timestamp);
    }
    for (let index = 2; index <= 10_001; index += 1) {
      issueInsert.run(
        randomUUID(), index, `OL-${index}`,
        index === 10_001 ? 'Qualification needle 10001' : `Scale issue ${index}`,
        ids.statusId, timestamp, timestamp,
      );
    }
    database.prepare('UPDATE issue_sequence SET next_number = 10002 WHERE singleton = 1').run();
    for (let index = 0; index < 50_000; index += 1) {
      activityInsert.run(ids.ownerId, randomUUID(), timestamp);
    }
    database.exec('COMMIT;');
  } catch (error) {
    if (database.isTransaction) database.exec('ROLLBACK;');
    database.close();
    throw error;
  }
  const counts = {
    projects: Number(database.prepare('SELECT COUNT(*) AS count FROM projects').get().count),
    milestones: Number(database.prepare('SELECT COUNT(*) AS count FROM milestones').get().count),
    issues: Number(database.prepare('SELECT COUNT(*) AS count FROM issues').get().count),
    activityEntries: Number(database.prepare('SELECT COUNT(*) AS count FROM activity_entries').get().count),
  };
  database.close();
  return counts;
}

async function acceptedScale(runtime, expected) {
  const owner = await jsonRequest(runtime.origin, '/api/v1/local-owner-session', { method: 'POST', body: {} });
  check(owner.response.status === 200, 'Scale fixture owner session failed.');
  const { cookie } = sessionHeaders(owner);
  const startedAt = performance.now();
  const issue = await jsonRequest(runtime.origin, `/api/v1/workspaces/${expected.workspaceId}/issues?query=Qualification%20needle%2010001`, { cookie, timeoutMs: 15_000 });
  const search = await jsonRequest(runtime.origin, `/api/v1/workspaces/${expected.workspaceId}/search?query=OL-10001&limit=20`, { cookie, timeoutMs: 15_000 });
  const projects = await jsonRequest(runtime.origin, `/api/v1/workspaces/${expected.workspaceId}/projects?order=name&direction=asc`, { cookie, timeoutMs: 15_000 });
  const milestones = await jsonRequest(runtime.origin, `/api/v1/workspaces/${expected.workspaceId}/milestones`, { cookie, timeoutMs: 15_000 });
  const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
  check(issue.payload?.data?.length === 1, 'Accepted-scale issue scan failed.');
  check(search.payload?.data?.[0]?.identifier === 'OL-10001', 'Accepted-scale search ranking failed.');
  check(projects.payload?.data?.length === 1_001, 'Accepted-scale project scan returned the wrong count.');
  check(milestones.payload?.data?.length === 2_001, 'Accepted-scale milestone scan returned the wrong count.');
  check(durationMs < 5_000, 'Accepted-scale scan/search/sort exceeded five seconds.', { durationMs });
  return { durationMs };
}

async function legacyFixture(workDirectory, environment) {
  const sourcePath = join(root, 'packages/db/tests/legacy-transfer-fixture.ts');
  const sourceBefore = fileSha256(sourcePath);
  const expression = `
    import { createLegacyTransferFixture, legacyTransferFixtureIds, legacyTransferFixtureSha256 } from './packages/db/tests/legacy-transfer-fixture.ts';
    import { canonicalSha256, canonicalStringify } from './packages/db/src/canonical.ts';
    const document = createLegacyTransferFixture();
    process.stdout.write(JSON.stringify({
      document,
      ids: legacyTransferFixtureIds,
      expected: legacyTransferFixtureSha256,
      actual: canonicalSha256(document),
      canonicalText: canonicalStringify(document)
    }));
  `;
  const generated = await runCommand(process.execPath, ['--import', 'tsx/esm', '--input-type=module', '--eval', expression], {
    timeoutMs: 60_000,
  });
  const fixture = JSON.parse(generated.stdout);
  check(fixture.actual === fixture.expected, 'Locked legacy transfer fixture hash changed.');
  const fixturePath = join(workDirectory, 'legacy-database-backup-v1.json');
  writeFileSync(fixturePath, `${fixture.canonicalText}\n`, { mode: 0o600 });
  const fixtureFileBefore = fileSha256(fixturePath);
  const ambiguousTarget = join(workDirectory, 'legacy-ambiguous', 'openlinear.sqlite3');
  const ambiguous = await operator(['import', '--input', fixturePath, '--database', ambiguousTarget, '--yes'], environment, false);
  check(ambiguous.code !== 0 && ambiguous.payload?.error?.code === 'AMBIGUOUS_SCOPE', 'Ambiguous legacy scope was not rejected.');
  check(!existsSync(dirname(ambiguousTarget)), 'Ambiguous legacy import created its target directory.');
  const selectedTarget = join(workDirectory, 'legacy-selected', 'openlinear.sqlite3');
  const selected = await operator([
    'import', '--input', fixturePath, '--database', selectedTarget,
    '--workspace', fixture.ids.workspace, '--yes',
  ], environment);
  const selectedExport = join(workDirectory, 'legacy-selected-export.json');
  const exported = await operator(['export', '--database', selectedTarget, '--output', selectedExport], environment);
  const expectedWorkspaceDigest = fixture.document.workspaces.find((item) => item.workspaceId === fixture.ids.workspace).digests.canonical;
  check(selected.payload?.data?.canonicalDigest === expectedWorkspaceDigest, 'Selected legacy import digest changed.');
  check(exported.payload?.data?.canonicalDigest === expectedWorkspaceDigest, 'Selected legacy export digest changed.');
  check(fileSha256(sourcePath) === sourceBefore && fileSha256(fixturePath) === fixtureFileBefore, 'Legacy source or generated fixture changed during transfer.');
  return {
    canonicalSha256: fixture.actual,
    sourceSha256: sourceBefore,
    fixtureFileSha256: fixtureFileBefore,
    selectedWorkspaceDigest: expectedWorkspaceDigest,
    ambiguousTargetCreated: existsSync(dirname(ambiguousTarget)),
    sourceUnchanged: true,
  };
}

async function writeEvidence(path, value) {
  if (path === null) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  const output = resolve(path);
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
  await writeFile(output, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ verdict: value.verdict, output }, null, 2)}\n`);
}

async function qualify(options) {
  check(process.version.startsWith('v24.'), 'The qualification runner requires Node 24.', { node: process.version });
  for (const entry of [apiEntry, operatorEntry, guardEntry]) check(existsSync(entry), `Missing required runtime entry: ${relative(root, entry)}`);
  const artifact = artifactManifest();
  const git = await gitState();
  if (!options.implementationRehearsal) {
    check(git.revision !== null, 'Independent acceptance requires a Git source revision.');
    check(git.clean, 'Independent acceptance requires a clean source revision.');
  }
  const base = {
    schema_version: 'ct88-clean-runtime-qualification-v1',
    issue: 'CT-88',
    acceptance_issue: 'CT-82',
    captured_at: new Date().toISOString(),
    actor: options.actor,
    session: options.session,
    independent: !options.implementationRehearsal,
    environment: {
      os: `${platform()} ${release()} ${arch()}`,
      host_fingerprint: sha256(hostname()).slice(0, 16),
      node: process.version,
      npm: null,
      source_revision: git.revision,
      source_clean: git.clean,
      source_status_entries: git.statusEntries,
      source_set_sha256: git.sourceSetSha256,
      source_files: git.sourceFiles,
      docker: false,
      postgresql: false,
      external_identity: false,
    },
    artifact: {
      sha256: artifact.digest,
      files: artifact.files.length,
      bytes: artifact.bytes,
    },
  };
  const npmResult = await runCommand(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version']);
  base.environment.npm = npmResult.stdout.trim();
  if (options.planOnly) return { ...base, verdict: 'PLAN_READY', checks: {} };

  const workDirectory = await mkdtemp(join(tmpdir(), 'openlinear-clean-runtime-'));
  const homeDirectory = join(workDirectory, 'home');
  const dataDirectory = join(workDirectory, 'data');
  mkdirSync(homeDirectory, { recursive: true, mode: 0o700 });
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const databasePath = join(dataDirectory, 'openlinear.sqlite3');
  const buildId = `ct88-${artifact.digest.slice(0, 20)}`;
  const audits = [];
  try {
    const firstAudit = join(workDirectory, 'network-first.jsonl');
    const firstRuntime = await startRuntime({ dataDirectory, auditPath: firstAudit, buildId, homeDirectory });
    const workflow = await ownerWorkflow(firstRuntime);
    const statuses = await jsonRequest(firstRuntime.origin, `/api/v1/workspaces/${workflow.workspaceId}/statuses`, { cookie: workflow.cookie });
    const statusId = statuses.payload.data[0].id;
    const environment = operatorEnvironment(dataDirectory, buildId, homeDirectory);
    const exportPath = join(workDirectory, 'workspace-export.json');
    const backupPath = join(workDirectory, 'online-backup.sqlite3');
    const exported = await operator(['export', '--output', exportPath], environment);
    const backedUp = await operator(['backup', '--output', backupPath], environment);
    const verifiedBackup = await operator(['backup', 'verify', '--input', backupPath], environment);
    const crashResult = await stopRuntime(firstRuntime, platform() === 'win32' ? 'SIGTERM' : 'SIGKILL');
    audits.push({ phase: 'first_crash', ...parseAudit(firstAudit), termination: crashResult });

    const restartAudit = join(workDirectory, 'network-restart.jsonl');
    const restarted = await startRuntime({ dataDirectory, auditPath: restartAudit, buildId, homeDirectory });
    await returningOwner(restarted, workflow);
    await stopRuntime(restarted, 'SIGTERM');
    audits.push({ phase: 'restart', ...parseAudit(restartAudit) });
    assertNoSidecars(databasePath);
    const databasePermission = assertOwnerMode(databasePath);
    const backupPermission = assertOwnerMode(backupPath);
    const exportPermission = assertOwnerMode(exportPath);

    const restoredPath = join(workDirectory, 'restored', 'openlinear.sqlite3');
    const restored = await operator(['restore', '--input', backupPath, '--database', restoredPath, '--yes'], environment);
    const restoredExportPath = join(workDirectory, 'restored-export.json');
    const restoredExport = await operator(['export', '--database', restoredPath, '--output', restoredExportPath], environment);
    check(exported.payload.data.canonicalDigest === restoredExport.payload.data.canonicalDigest, 'Backup/restore canonical digest changed.');
    const corruptPath = join(workDirectory, 'corrupt.sqlite3');
    writeFileSync(corruptPath, 'not a SQLite database', { mode: 0o600 });
    const restoredBeforeCorruptAttempt = fileSha256(restoredPath);
    const corruptRestore = await operator(['restore', '--input', corruptPath, '--database', restoredPath, '--replace', '--yes'], environment, false);
    check(corruptRestore.code !== 0 && corruptRestore.payload?.error?.code === 'DATABASE_CORRUPT', 'Corrupt restore was not rejected.');
    check(fileSha256(restoredPath) === restoredBeforeCorruptAttempt, 'Corrupt restore mutated the last known-good database.');

    const importedPath = join(workDirectory, 'imported', 'openlinear.sqlite3');
    const imported = await operator(['import', '--input', exportPath, '--database', importedPath, '--yes'], environment);
    const importedExportPath = join(workDirectory, 'imported-export.json');
    const importedExport = await operator(['export', '--database', importedPath, '--output', importedExportPath], environment);
    check(imported.payload.data.canonicalDigest === exported.payload.data.canonicalDigest, 'Canonical import digest changed.');
    check(importedExport.payload.data.canonicalDigest === exported.payload.data.canonicalDigest, 'Canonical import/export digest changed.');

    const upgradeDirectory = join(workDirectory, 'upgrade');
    mkdirSync(upgradeDirectory, { recursive: true, mode: 0o700 });
    const upgradePath = join(upgradeDirectory, 'openlinear.sqlite3');
    createPriorVersionFixture(databasePath, upgradePath);
    const preUpgradeBackup = join(workDirectory, 'pre-upgrade.sqlite3');
    copyFileSync(upgradePath, preUpgradeBackup);
    chmodSync(preUpgradeBackup, 0o600);
    const upgradeAudit = join(workDirectory, 'network-upgrade.jsonl');
    const upgradeRuntime = await startRuntime({ dataDirectory: upgradeDirectory, auditPath: upgradeAudit, buildId, homeDirectory });
    await returningOwner(upgradeRuntime, { ...workflow, cookie: 'stale=upgrade' });
    await stopRuntime(upgradeRuntime, 'SIGINT');
    audits.push({ phase: 'accepted_upgrade', ...parseAudit(upgradeAudit) });
    const upgraded = new DatabaseSync(upgradePath, { readOnly: true });
    const upgradedVersion = Number(upgraded.prepare('PRAGMA user_version').get().user_version);
    const upgradedColumns = upgraded.prepare('PRAGMA table_info(owner_profile)').all().map((column) => column.name);
    upgraded.close();
    check(upgradedVersion === 2 && !upgradedColumns.includes('password_hash'), 'Accepted schema upgrade did not reach schema 2.');
    const upgradedExportPath = join(workDirectory, 'upgraded-export.json');
    const upgradedExport = await operator(['export', '--database', upgradePath, '--output', upgradedExportPath], environment);
    check(upgradedExport.payload.data.canonicalDigest === exported.payload.data.canonicalDigest, 'Accepted upgrade changed canonical data.');

    const futureDirectory = join(workDirectory, 'future');
    mkdirSync(futureDirectory, { recursive: true, mode: 0o700 });
    const futurePath = join(futureDirectory, 'openlinear.sqlite3');
    createFutureVersionFixture(databasePath, futurePath);
    const futureBefore = fileSha256(futurePath);
    const futureAudit = join(workDirectory, 'network-future.jsonl');
    const futureFailure = await runtimeFailure({ dataDirectory: futureDirectory, auditPath: futureAudit, buildId, homeDirectory });
    check(futureFailure.stderr.includes('schema version is unsupported'), 'Future schema rejection was not actionable.');
    check(fileSha256(futurePath) === futureBefore, 'Future schema rejection mutated the database.');
    audits.push({ phase: 'future_schema_rejected', ...parseAudit(futureAudit) });

    const rejectedDirectory = join(workDirectory, 'rejected');
    mkdirSync(rejectedDirectory, { recursive: true, mode: 0o700 });
    const rejectedPath = join(rejectedDirectory, 'openlinear.sqlite3');
    createRejectedMigrationFixture(rejectedPath);
    const rejectedBefore = fileSha256(rejectedPath);
    const rejectedAudit = join(workDirectory, 'network-rejected.jsonl');
    const rejectedFailure = await runtimeFailure({ dataDirectory: rejectedDirectory, auditPath: rejectedAudit, buildId, homeDirectory });
    check(rejectedFailure.stderr.includes('could not be opened or migrated'), 'Rejected migration error was not actionable.');
    check(fileSha256(rejectedPath) === rejectedBefore, 'Rejected migration mutated the source database.');
    const rejectedReadback = new DatabaseSync(rejectedPath, { readOnly: true });
    const rejectedVersion = Number(rejectedReadback.prepare('PRAGMA user_version').get().user_version);
    rejectedReadback.close();
    check(rejectedVersion === 1, 'Rejected migration changed user_version.');
    audits.push({ phase: 'migration_rollback', ...parseAudit(rejectedAudit) });

    const scaleDirectory = join(workDirectory, 'scale');
    mkdirSync(scaleDirectory, { recursive: true, mode: 0o700 });
    const scalePath = join(scaleDirectory, 'openlinear.sqlite3');
    const scaleCounts = seedAcceptedScale(databasePath, scalePath, {
      ownerId: workflow.ownerId,
      statusId,
    });
    const scaleAudit = join(workDirectory, 'network-scale.jsonl');
    const scaleRuntime = await startRuntime({ dataDirectory: scaleDirectory, auditPath: scaleAudit, buildId, homeDirectory });
    const scale = await acceptedScale(scaleRuntime, workflow);
    await stopRuntime(scaleRuntime, 'SIGINT');
    audits.push({ phase: 'accepted_scale', ...parseAudit(scaleAudit) });
    assertNoSidecars(scalePath);

    const legacy = await legacyFixture(workDirectory, environment);
    const result = {
      ...base,
      verdict: options.implementationRehearsal ? 'PASSED_IMPLEMENTATION_REHEARSAL' : 'PASSED_INDEPENDENT_RUNTIME_GATE',
      acceptance: {
        p_t21: options.implementationRehearsal ? 'open' : 'passed',
        ct82: options.implementationRehearsal ? 'Todo' : 'eligible_for_readback',
        self_acceptance: false,
        source_revision_bound: git.revision !== null && git.clean,
      },
      checks: {
        built_spa_and_single_process: 'passed',
        fresh_owner_scope_status_bootstrap: 'passed',
        project_milestone_issue_private_view_search: 'passed',
        derived_progress: 'passed',
        host_origin_csrf_multiple_tabs: 'passed',
        outbound_network_and_subprocess_denial: 'passed',
        restart_session_rotation_stable_ids: 'passed',
        interruption_matrix: platform() === 'win32' ? ['SIGTERM', 'SIGINT'] : ['SIGKILL', 'SIGTERM', 'SIGINT'],
        sidecar_cleanup: 'passed',
        canonical_export_import_digest: exported.payload.data.canonicalDigest,
        online_backup_sha256: backedUp.payload.data.sha256,
        backup_integrity: verifiedBackup.payload.data.integrity,
        restore_canonical_digest: restoredExport.payload.data.canonicalDigest,
        corrupt_restore_last_known_good: 'passed',
        accepted_upgrade: { from: 1, to: upgradedVersion, canonicalDigest: upgradedExport.payload.data.canonicalDigest },
        future_upgrade_rejected_unchanged: 'passed',
        malformed_upgrade_rolled_back: 'passed',
        pre_upgrade_backup_sha256: fileSha256(preUpgradeBackup),
        accepted_scale: { ...scaleCounts, ...scale },
        permissions: { database: databasePermission, backup: backupPermission, export: exportPermission },
        legacy_transfer: legacy,
      },
      network_audits: audits,
      work_directory: options.keepWorkDirectory ? workDirectory : null,
      outcomes_claimed: [],
    };
    return result;
  } finally {
    if (!options.keepWorkDirectory) rmSync(workDirectory, { recursive: true, force: true });
  }
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
    const result = await qualify(options);
    await writeEvidence(options.output, result);
  } catch (error) {
    const failure = {
      schema_version: 'ct88-clean-runtime-qualification-v1',
      issue: 'CT-88',
      captured_at: new Date().toISOString(),
      verdict: 'FAILED',
      error: {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof QualificationError ? error.details : {},
      },
      outcomes_claimed: [],
    };
    await writeEvidence(options?.output ?? null, failure).catch(() => undefined);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
