import {hostedOperationsPolicyV1} from './operations-control.js';

export interface HostedWorkspaceDirectoryEntry {
  id: string;
  name: string;
  role: 'owner' | 'member';
}

export interface WorkspaceDirectoryRepository {
  listMembershipsForUser(userId: string, limit: number): Promise<unknown[]>;
  readDocument(path: string): Promise<unknown | null>;
}

export class WorkspaceDirectoryServiceError extends Error {
  readonly code: 'INVALID_WORKSPACE_DIRECTORY_REQUEST' | 'WORKSPACE_DIRECTORY_UNAVAILABLE';

  constructor(code: WorkspaceDirectoryServiceError['code'], message: string) {
    super(message);
    this.name = 'WorkspaceDirectoryServiceError';
    this.code = code;
  }
}

const record = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const canonicalTimestamp = (value: unknown): value is string => (
  typeof value === 'string'
  && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value
);

function safeReference(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(normalized)) {
    throw new WorkspaceDirectoryServiceError(
      'INVALID_WORKSPACE_DIRECTORY_REQUEST',
      'The workspace directory request is invalid.',
    );
  }
  return normalized;
}

function activeMembership(value: unknown, userId: string): {workspaceId: string; role: 'owner' | 'member'} | null {
  const candidate = record(value);
  if (candidate === null || candidate.status !== 'active') return null;
  if (candidate.schemaVersion !== 1
    || candidate.userId !== userId
    || (candidate.role !== 'owner' && candidate.role !== 'member')
    || typeof candidate.workspaceId !== 'string'
    || safeReference(candidate.workspaceId) !== candidate.workspaceId
    || !canonicalTimestamp(candidate.createdAt)
    || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision as number) < 1) {
    throw new WorkspaceDirectoryServiceError(
      'WORKSPACE_DIRECTORY_UNAVAILABLE',
      'The workspace directory is temporarily unavailable.',
    );
  }
  return {workspaceId: candidate.workspaceId, role: candidate.role};
}

function workspaceEntry(
  value: unknown,
  workspaceId: string,
  role: 'owner' | 'member',
): HostedWorkspaceDirectoryEntry {
  const candidate = record(value);
  if (candidate === null
    || candidate.schemaVersion !== 1
    || candidate.id !== workspaceId
    || candidate.workspaceId !== workspaceId
    || typeof candidate.name !== 'string'
    || candidate.name !== candidate.name.trim()
    || candidate.name.length < 1
    || candidate.name.length > 160
    || candidate.authority !== 'firebase-hosted'
    || !canonicalTimestamp(candidate.createdAt)
    || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision as number) < 1) {
    throw new WorkspaceDirectoryServiceError(
      'WORKSPACE_DIRECTORY_UNAVAILABLE',
      'The workspace directory is temporarily unavailable.',
    );
  }
  return {id: workspaceId, name: candidate.name, role};
}

export class WorkspaceDirectoryService {
  constructor(private readonly repository: WorkspaceDirectoryRepository) {}

  async listUserWorkspaces(userIdInput: string): Promise<HostedWorkspaceDirectoryEntry[]> {
    const userId = safeReference(userIdInput);
    try {
      const maximum = Math.min(250, hostedOperationsPolicyV1.queries.maximumTransactionListRecords);
      const rawMemberships = await this.repository.listMembershipsForUser(userId, maximum + 1);
      if (rawMemberships.length > maximum) {
        throw new WorkspaceDirectoryServiceError(
          'WORKSPACE_DIRECTORY_UNAVAILABLE',
          'The workspace directory is temporarily unavailable.',
        );
      }
      const memberships = rawMemberships
        .map((value) => activeMembership(value, userId))
        .filter((value): value is NonNullable<typeof value> => value !== null);
      const unique = new Map<string, 'owner' | 'member'>();
      for (const membership of memberships) {
        if (unique.has(membership.workspaceId)) {
          throw new WorkspaceDirectoryServiceError(
            'WORKSPACE_DIRECTORY_UNAVAILABLE',
            'The workspace directory is temporarily unavailable.',
          );
        }
        unique.set(membership.workspaceId, membership.role);
      }
      const entries = await Promise.all([...unique.entries()].map(async ([workspaceId, role]) => (
        workspaceEntry(
          await this.repository.readDocument(`workspaces/${workspaceId}`),
          workspaceId,
          role,
        )
      )));
      return entries.sort((left, right) => (
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
      ));
    } catch (error) {
      if (error instanceof WorkspaceDirectoryServiceError) throw error;
      throw new WorkspaceDirectoryServiceError(
        'WORKSPACE_DIRECTORY_UNAVAILABLE',
        'The workspace directory is temporarily unavailable.',
      );
    }
  }
}

export class MemoryWorkspaceDirectoryRepository implements WorkspaceDirectoryRepository {
  readonly #documents = new Map<string, unknown>();

  async listMembershipsForUser(userId: string, limit: number): Promise<unknown[]> {
    return [...this.#documents.entries()]
      .filter(([path, value]) => (
        /^workspaces\/[^/]+\/memberships\/[^/]+$/u.test(path)
        && record(value)?.userId === userId
      ))
      .map(([, value]) => structuredClone(value))
      .slice(0, limit);
  }

  async readDocument(path: string): Promise<unknown | null> {
    const value = this.#documents.get(path);
    return value === undefined ? null : structuredClone(value);
  }

  seedDocument(path: string, value: Record<string, unknown>): void {
    this.#documents.set(path, structuredClone(value));
  }
}
