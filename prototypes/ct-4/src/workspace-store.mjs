export class AccessDeniedError extends Error {
  constructor() {
    super('Record is unavailable');
    this.code = 'NOT_FOUND';
  }
}

export class RevisionConflictError extends Error {
  constructor(currentRevision) {
    super('The record changed before this update');
    this.code = 'REVISION_CONFLICT';
    this.currentRevision = currentRevision;
  }
}

export class WorkspaceStore {
  #memberships = new Map();
  #issues = new Map();
  #activity = [];

  addMembership({ userId, workspaceId }) {
    const current = this.#memberships.get(userId) ?? new Set();
    current.add(workspaceId);
    this.#memberships.set(userId, current);
  }

  seedIssue(issue) {
    this.#issues.set(issue.id, structuredClone({ ...issue, revision: issue.revision ?? 1 }));
  }

  listIssues({ userId, workspaceId }) {
    this.#assertMembership(userId, workspaceId);
    return [...this.#issues.values()]
      .filter((issue) => issue.workspaceId === workspaceId)
      .map((issue) => structuredClone(issue));
  }

  getIssue({ userId, workspaceId, issueId }) {
    this.#assertMembership(userId, workspaceId);
    const issue = this.#issues.get(issueId);
    if (!issue || issue.workspaceId !== workspaceId) throw new AccessDeniedError();
    return structuredClone(issue);
  }

  updateIssue({ userId, workspaceId, issueId, expectedRevision, patch }) {
    const issue = this.getIssue({ userId, workspaceId, issueId });
    if (issue.revision !== expectedRevision) throw new RevisionConflictError(issue.revision);

    const next = {
      ...issue,
      ...structuredClone(patch),
      id: issue.id,
      workspaceId: issue.workspaceId,
      revision: issue.revision + 1,
    };
    this.#issues.set(issueId, next);
    this.#activity.push({
      workspaceId,
      issueId,
      actorId: userId,
      beforeRevision: issue.revision,
      afterRevision: next.revision,
    });
    return structuredClone(next);
  }

  activity({ userId, workspaceId }) {
    this.#assertMembership(userId, workspaceId);
    return this.#activity
      .filter((entry) => entry.workspaceId === workspaceId)
      .map((entry) => structuredClone(entry));
  }

  #assertMembership(userId, workspaceId) {
    if (!this.#memberships.get(userId)?.has(workspaceId)) throw new AccessDeniedError();
  }
}
