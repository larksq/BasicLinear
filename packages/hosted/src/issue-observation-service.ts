import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import type {
  CollaborationIssue,
  CollaborationRepository,
  CollaborationTransaction,
} from './collaboration-service.js';
import {
  readTrustedCollaborationIssue,
  readTrustedCollaborationIssues,
} from './collaboration-service.js';
import {hostedOperationsPolicyV1} from './operations-control.js';
import {
  WorkspaceAuthorizationError,
  type WorkspaceAuthorizationService,
  type WorkspacePrincipal,
} from './workspace-authorization.js';

export interface IssueObservationRecord {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  issueId: string;
  userId: string;
  state: 'subscribed' | 'unsubscribed';
  mode: 'automatic' | 'explicit';
  createdAt: string;
  updatedAt: string;
  readThroughAt: string;
  revision: number;
  binding: string;
}

export interface IssueObservationView {
  issueId: string;
  subscribed: boolean;
  mode: 'automatic' | 'explicit' | 'implicit' | 'none';
  readThroughAt: string;
  revision: number;
  subscriberUserIds: string[];
}

export interface IssueNotification {
  id: string;
  issueId: string;
  issueTitle: string;
  action: string;
  actorUserId: string | null;
  occurredAt: string;
  unread: boolean;
}

export interface IssueObservationServiceOptions {
  secret: string | Uint8Array;
  clock?: () => Date;
}

interface ObservationCommand {
  principal: WorkspacePrincipal;
  workspaceId: string;
  issueId: string;
  requestId: string;
}

interface ObservationMutationCommand extends ObservationCommand {
  idempotencyKey: string;
}

interface ObservationIdempotencyRecord {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  issueId: string;
  userId: string;
  operation: 'subscribe' | 'unsubscribe' | 'read';
  requestDigest: string;
  outcomeRevision: number;
  createdAt: string;
  binding: string;
}

interface ObservationActivity {
  id: string;
  issueId: string;
  actorUserId: string;
  action: string;
  occurredAt: string;
}

export class IssueObservationServiceError extends Error {
  readonly code:
    | 'INVALID_OBSERVATION_REQUEST'
    | 'INVALID_IDEMPOTENCY_KEY'
    | 'OBSERVATION_CONFLICT'
    | 'OBSERVATION_NOT_FOUND'
    | 'OBSERVATION_SERVICE_UNAVAILABLE';

  constructor(code: IssueObservationServiceError['code'], message: string) {
    super(message);
    this.name = 'IssueObservationServiceError';
    this.code = code;
  }
}

const observationKeys = [
  'schemaVersion', 'id', 'workspaceId', 'issueId', 'userId', 'state', 'mode',
  'createdAt', 'updatedAt', 'readThroughAt', 'revision', 'binding',
] as const;
const idempotencyKeys = [
  'schemaVersion', 'id', 'workspaceId', 'issueId', 'userId', 'operation',
  'requestDigest', 'outcomeRevision', 'createdAt', 'binding',
] as const;

const record = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const canonicalTimestamp = (value: unknown): value is string => (
  typeof value === 'string'
  && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value
);

function safeReference(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(normalized)) throw invalid();
  return normalized;
}

function safeIssueId(value: string): string {
  const normalized = value.trim();
  if (!/^issue_[a-f0-9]{32}$/u.test(normalized)) throw invalid();
  return normalized;
}

function secretLength(secret: string | Uint8Array): number {
  return typeof secret === 'string' ? Buffer.byteLength(secret, 'utf8') : secret.byteLength;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(secret: string | Uint8Array, value: unknown): string {
  return createHmac('sha256', secret).update(stable(value)).digest('hex');
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const candidate = value as Record<string, unknown>;
  return `{${Object.keys(candidate).sort().map((key) => `${JSON.stringify(key)}:${stable(candidate[key])}`).join(',')}}`;
}

function equalDigest(left: string, right: string): boolean {
  return /^[a-f0-9]{64}$/u.test(left) && /^[a-f0-9]{64}$/u.test(right)
    && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function issueObservationId(workspaceId: string, issueId: string, userId: string): string {
  return `observation_${hash(`${workspaceId}:${issueId}:${userId}`).slice(0, 32)}`;
}

export function issueObservationPath(workspaceId: string, issueId: string, userId: string): string {
  return `workspaces/${workspaceId}/issueObservers/${issueObservationId(workspaceId, issueId, userId)}`;
}

function observationUnsigned(value: Omit<IssueObservationRecord, 'binding'>): Omit<IssueObservationRecord, 'binding'> {
  return {...value};
}

export function buildAutomaticIssueObservation(
  secret: string | Uint8Array,
  workspaceId: string,
  issueId: string,
  userId: string,
  now: string,
): IssueObservationRecord {
  const unsigned: Omit<IssueObservationRecord, 'binding'> = {
    schemaVersion: 1,
    id: issueObservationId(workspaceId, issueId, userId),
    workspaceId,
    issueId,
    userId,
    state: 'subscribed',
    mode: 'automatic',
    createdAt: now,
    updatedAt: now,
    readThroughAt: now,
    revision: 1,
  };
  return {...unsigned, binding: hmac(secret, unsigned)};
}

export function trustedIssueObservationRecord(
  value: unknown,
  secret: string | Uint8Array,
  workspaceId: string,
  issueId?: string,
  userId?: string,
): IssueObservationRecord {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, observationKeys)
    || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^observation_[a-f0-9]{32}$/u.test(candidate.id)
    || candidate.workspaceId !== workspaceId
    || typeof candidate.issueId !== 'string' || !/^issue_[a-f0-9]{32}$/u.test(candidate.issueId)
    || issueId !== undefined && candidate.issueId !== issueId
    || typeof candidate.userId !== 'string' || safeReference(candidate.userId) !== candidate.userId
    || userId !== undefined && candidate.userId !== userId
    || candidate.id !== issueObservationId(workspaceId, candidate.issueId, candidate.userId)
    || (candidate.state !== 'subscribed' && candidate.state !== 'unsubscribed')
    || (candidate.mode !== 'automatic' && candidate.mode !== 'explicit')
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.updatedAt)
    || !canonicalTimestamp(candidate.readThroughAt)
    || Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt)
    || Date.parse(candidate.readThroughAt) > Date.parse(candidate.updatedAt)
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1
    || typeof candidate.binding !== 'string') throw unavailable();
  const unsigned = observationUnsigned(candidate as unknown as Omit<IssueObservationRecord, 'binding'>);
  delete (unsigned as Partial<IssueObservationRecord>).binding;
  const expected = hmac(secret, unsigned);
  if (!equalDigest(candidate.binding, expected)) throw unavailable();
  return {...unsigned, binding: expected};
}

function storedMembership(value: unknown, workspaceId: string, userId: string): void {
  const candidate = record(value);
  if (candidate === null || candidate.schemaVersion !== 1
    || candidate.workspaceId !== workspaceId || candidate.userId !== userId
    || candidate.status !== 'active' || (candidate.role !== 'owner' && candidate.role !== 'member')
    || !canonicalTimestamp(candidate.createdAt)) throw unavailable();
}

function activityRecord(value: unknown, workspaceId: string, issueId: string): ObservationActivity {
  const candidate = record(value);
  if (candidate === null || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^activity_[a-f0-9]{32}$/u.test(candidate.id)
    || candidate.workspaceId !== workspaceId || candidate.issueId !== issueId
    || typeof candidate.actorUserId !== 'string' || safeReference(candidate.actorUserId) !== candidate.actorUserId
    || typeof candidate.action !== 'string' || candidate.action.length < 3 || candidate.action.length > 160
    || !canonicalTimestamp(candidate.occurredAt)) throw unavailable();
  return {
    id: candidate.id,
    issueId,
    actorUserId: candidate.actorUserId,
    action: candidate.action,
    occurredAt: candidate.occurredAt,
  };
}

export class IssueObservationService {
  readonly #clock: () => Date;

  constructor(
    private readonly repository: CollaborationRepository,
    private readonly authorization: WorkspaceAuthorizationService,
    private readonly options: IssueObservationServiceOptions,
  ) {
    if (secretLength(options.secret) < 32 || secretLength(options.secret) > 512) {
      throw new Error('Issue observation secret must contain 32 to 512 bytes.');
    }
    this.#clock = options.clock ?? (() => new Date());
  }

  async getIssueObservation(command: ObservationCommand): Promise<IssueObservationView> {
    const context = await this.#context(command);
    try {
      const {issue, observations} = await this.repository.runTransaction(async (transaction) => {
        const now = this.#now();
        await this.#activeMember(transaction, context.workspaceId, context.userId);
        const issue = await readTrustedCollaborationIssue(
          transaction, context.workspaceId, context.issueId, now,
        );
        const observations = (await transaction.list(
          `workspaces/${context.workspaceId}/issueObservers`,
          hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
        )).map((value) => trustedIssueObservationRecord(value, this.options.secret, context.workspaceId));
        return {issue, observations};
      });
      return this.#view(issue, observations, context.userId);
    } catch (error) {
      if (error instanceof IssueObservationServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  async listNotifications(command: Omit<ObservationCommand, 'issueId'>): Promise<IssueNotification[]> {
    const workspaceId = safeReference(command.workspaceId);
    const userId = safeReference(command.principal.userId);
    const requestId = safeReference(command.requestId);
    await this.authorization.authorize({
      principal: command.principal,
      workspaceId,
      action: 'issue.read',
      targetEntityType: 'issue',
      targetEntityId: 'collection',
      requestId,
    });
    try {
      return await this.repository.runTransaction(async (transaction) => {
        const now = this.#now();
        await this.#activeMember(transaction, workspaceId, userId);
        const issues = (await readTrustedCollaborationIssues(transaction, workspaceId, now)).slice(0, 500);
        const observations = (await transaction.list(
          `workspaces/${workspaceId}/issueObservers`,
          hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
        )).map((value) => trustedIssueObservationRecord(value, this.options.secret, workspaceId));
        const ownByIssue = new Map(observations.filter((value) => value.userId === userId)
          .map((value) => [value.issueId, value]));
        const relevant = issues.filter((issue) => {
          const explicit = ownByIssue.get(issue.id);
          if (explicit !== undefined) return explicit.state === 'subscribed';
          return issue.createdByUserId === userId || issue.assigneeUserId === userId;
        });
        const notifications = (await Promise.all(relevant.map(async (issue) => {
          const own = ownByIssue.get(issue.id);
          const readThroughAt = own?.readThroughAt ?? issue.createdAt;
          const activities = await transaction.list(
            `workspaces/${workspaceId}/issues/${issue.id}/activity`,
            Math.min(500, hostedOperationsPolicyV1.queries.maximumTransactionListRecords),
          );
          const activityNotifications = activities.map((value) => activityRecord(value, workspaceId, issue.id))
            .filter((activity) => activity.actorUserId !== userId)
            .map((activity): IssueNotification => ({
              id: `${issue.id}:${activity.id}`,
              issueId: issue.id,
              issueTitle: issue.title,
              action: activity.action,
              actorUserId: activity.actorUserId,
              occurredAt: activity.occurredAt,
              unread: activity.occurredAt > readThroughAt,
            }));
          const dueNotification: IssueNotification[] = issue.dueAt !== null
            && issue.status !== 'done'
            && issue.dueAt <= now
            ? [{
                id: `${issue.id}:due:${issue.dueAt}`,
                issueId: issue.id,
                issueTitle: issue.title,
                action: 'issue.due',
                actorUserId: null,
                occurredAt: issue.dueAt,
                unread: issue.dueAt > readThroughAt,
              }]
            : [];
          return [...activityNotifications, ...dueNotification];
        }))).flat();
        return notifications.sort((left, right) => (
          right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id)
        )).slice(0, 250);
      });
    } catch (error) {
      if (error instanceof IssueObservationServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  setIssueSubscription(
    command: ObservationMutationCommand & {subscribed: boolean},
  ): Promise<IssueObservationView> {
    return this.#mutate(command, command.subscribed ? 'subscribe' : 'unsubscribe');
  }

  markIssueNotificationsRead(command: ObservationMutationCommand): Promise<IssueObservationView> {
    return this.#mutate(command, 'read');
  }

  async #mutate(
    command: ObservationMutationCommand,
    operation: ObservationIdempotencyRecord['operation'],
  ): Promise<IssueObservationView> {
    const context = await this.#context(command);
    const key = command.idempotencyKey.trim();
    if (key.length < 16 || key.length > 160 || /\s/u.test(key)) {
      throw new IssueObservationServiceError('INVALID_IDEMPOTENCY_KEY', 'A bounded idempotency key is required.');
    }
    const idempotencyId = hash(`${context.userId}:${operation}:${key}`);
    const idempotencyPath = `workspaces/${context.workspaceId}/issueObservationIdempotency/${idempotencyId}`;
    const requestDigest = hmac(this.options.secret, {
      workspaceId: context.workspaceId, issueId: context.issueId, userId: context.userId, operation,
    });
    try {
      return await this.repository.runTransaction(async (transaction) => {
        const now = this.#now();
        await this.#activeMember(transaction, context.workspaceId, context.userId);
        const issue = await readTrustedCollaborationIssue(
          transaction, context.workspaceId, context.issueId, now,
        );
        const observationPath = issueObservationPath(context.workspaceId, context.issueId, context.userId);
        const [rawObservation, rawIdempotency, rawObservations] = await Promise.all([
          transaction.get(observationPath),
          transaction.get(idempotencyPath),
          transaction.list(`workspaces/${context.workspaceId}/issueObservers`, hostedOperationsPolicyV1.queries.maximumTransactionListRecords),
        ]);
        const observations = rawObservations.map((value) => trustedIssueObservationRecord(
          value, this.options.secret, context.workspaceId,
        ));
        const current = rawObservation === null ? null : trustedIssueObservationRecord(
          rawObservation, this.options.secret, context.workspaceId, context.issueId, context.userId,
        );
        if (rawIdempotency !== null) {
          const replay = this.#idempotency(rawIdempotency, idempotencyId, context, operation, requestDigest);
          if (current === null || current.revision !== replay.outcomeRevision || current.updatedAt !== replay.createdAt) {
            throw new IssueObservationServiceError('OBSERVATION_CONFLICT', 'The observation changed. Refresh and try again.');
          }
          return this.#view(issue, observations, context.userId, current);
        }
        const createdAt = current?.createdAt ?? now;
        const unsigned: Omit<IssueObservationRecord, 'binding'> = {
          schemaVersion: 1,
          id: issueObservationId(context.workspaceId, context.issueId, context.userId),
          workspaceId: context.workspaceId,
          issueId: context.issueId,
          userId: context.userId,
          state: operation === 'unsubscribe' ? 'unsubscribed' : 'subscribed',
          mode: operation === 'read' ? current?.mode ?? 'automatic' : 'explicit',
          createdAt,
          updatedAt: now,
          readThroughAt: operation === 'unsubscribe' ? current?.readThroughAt ?? now : now,
          revision: (current?.revision ?? 0) + 1,
        };
        const next = {...unsigned, binding: hmac(this.options.secret, unsigned)};
        const idempotencyUnsigned: Omit<ObservationIdempotencyRecord, 'binding'> = {
          schemaVersion: 1, id: idempotencyId, workspaceId: context.workspaceId,
          issueId: context.issueId, userId: context.userId, operation, requestDigest,
          outcomeRevision: next.revision, createdAt: now,
        };
        if (current === null) transaction.create(observationPath, {...next});
        else transaction.set(observationPath, {...next});
        transaction.create(idempotencyPath, {
          ...idempotencyUnsigned,
          binding: hmac(this.options.secret, idempotencyUnsigned),
        });
        const nextObservations = observations.filter((value) => value.id !== next.id).concat(next);
        return this.#view(issue, nextObservations, context.userId, next);
      });
    } catch (error) {
      if (error instanceof IssueObservationServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  async #context(command: ObservationCommand) {
    const workspaceId = safeReference(command.workspaceId);
    const issueId = safeIssueId(command.issueId);
    const requestId = safeReference(command.requestId);
    const userId = safeReference(command.principal.userId);
    await this.authorization.authorize({
      principal: command.principal, workspaceId, action: 'issue.read', targetEntityType: 'issue',
      targetEntityId: issueId, requestId,
    });
    return {workspaceId, issueId, requestId, userId};
  }

  async #activeMember(transaction: CollaborationTransaction, workspaceId: string, userId: string): Promise<void> {
    storedMembership(
      await transaction.get(`workspaces/${workspaceId}/memberships/${userId}`),
      workspaceId,
      userId,
    );
  }

  #view(
    issue: CollaborationIssue,
    observations: IssueObservationRecord[],
    userId: string,
    currentOverride?: IssueObservationRecord,
  ): IssueObservationView {
    const byUser = new Map(observations.filter((value) => value.issueId === issue.id)
      .map((value) => [value.userId, value]));
    if (currentOverride !== undefined) byUser.set(userId, currentOverride);
    const implicit = new Set([issue.createdByUserId, ...(issue.assigneeUserId === null ? [] : [issue.assigneeUserId])]);
    const subscribers = new Set<string>();
    for (const implicitUserId of implicit) {
      if (byUser.get(implicitUserId)?.state !== 'unsubscribed') subscribers.add(implicitUserId);
    }
    for (const observation of byUser.values()) {
      if (observation.state === 'subscribed') subscribers.add(observation.userId);
      else subscribers.delete(observation.userId);
    }
    const current = byUser.get(userId);
    const implicitlySubscribed = current === undefined && implicit.has(userId);
    return {
      issueId: issue.id,
      subscribed: current?.state === 'subscribed' || implicitlySubscribed,
      mode: current?.mode ?? (implicitlySubscribed ? 'implicit' : 'none'),
      readThroughAt: current?.readThroughAt ?? issue.createdAt,
      revision: current?.revision ?? 0,
      subscriberUserIds: [...subscribers].sort(),
    };
  }

  #idempotency(
    value: unknown,
    id: string,
    context: {workspaceId: string; issueId: string; userId: string},
    operation: ObservationIdempotencyRecord['operation'],
    requestDigest: string,
  ): ObservationIdempotencyRecord {
    const candidate = record(value);
    if (candidate === null || !exactKeys(candidate, idempotencyKeys)
      || candidate.schemaVersion !== 1 || candidate.id !== id
      || candidate.workspaceId !== context.workspaceId || candidate.issueId !== context.issueId
      || candidate.userId !== context.userId || candidate.operation !== operation
      || candidate.requestDigest !== requestDigest
      || !Number.isSafeInteger(candidate.outcomeRevision) || (candidate.outcomeRevision as number) < 1
      || !canonicalTimestamp(candidate.createdAt) || typeof candidate.binding !== 'string') {
      throw new IssueObservationServiceError('OBSERVATION_CONFLICT', 'The idempotency key is already in use.');
    }
    const unsigned: Omit<ObservationIdempotencyRecord, 'binding'> = {
      schemaVersion: 1, id, workspaceId: context.workspaceId, issueId: context.issueId,
      userId: context.userId, operation, requestDigest,
      outcomeRevision: candidate.outcomeRevision as number, createdAt: candidate.createdAt,
    };
    if (!equalDigest(candidate.binding, hmac(this.options.secret, unsigned))) throw unavailable();
    return {...unsigned, binding: candidate.binding};
  }

  #now(): string {
    const now = this.#clock();
    if (!Number.isFinite(now.getTime())) throw unavailable();
    return now.toISOString();
  }
}

function invalid(): IssueObservationServiceError {
  return new IssueObservationServiceError('INVALID_OBSERVATION_REQUEST', 'The observation request is invalid.');
}

function unavailable(): IssueObservationServiceError {
  return new IssueObservationServiceError(
    'OBSERVATION_SERVICE_UNAVAILABLE',
    'Issue observation is temporarily unavailable.',
  );
}
