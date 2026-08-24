import type {
  ActivityEntry,
  BulkIssueMutationRequest,
  BulkIssueMutationResult,
  Comment,
  CreateCommentRequest,
  CreateIssueRelationRequest,
  CreateIssueRequest,
  CreateLabelRequest,
  Issue,
  IssuePriority,
  IssueRelation,
  IssueViewState,
  Label,
  Membership,
  Milestone,
  Project,
  ProjectResourceInput,
  ProjectStatus,
  ProjectPriority,
  PurgeMilestoneReceipt,
  PurgeIssueReceipt,
  PurgeProjectReceipt,
  RetireStatusRequest,
  RetireStatusResult,
  RichTextDocument,
  SavedView,
  SearchResult,
  Session,
  Team,
  UpdateCommentRequest,
  UpdateIssueRequest,
  UpdateLabelRequest,
  WorkflowStatus,
} from '@openlinear/contracts';

interface ApiEnvelope<T> {
  data: T;
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    correlationId?: string;
    field?: string;
    currentRevision?: number;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId: string | undefined;
  readonly field: string | undefined;
  readonly currentRevision: number | undefined;

  constructor(status: number, body: ErrorEnvelope) {
    super(body.error?.message ?? `Request failed (${status}).`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.error?.code ?? 'REQUEST_FAILED';
    this.correlationId = body.error?.correlationId;
    this.field = body.error?.field;
    this.currentRevision = body.error?.currentRevision;
  }
}

export class TransportError extends Error {
  readonly code = 'LOCAL_SERVICE_UNAVAILABLE';

  constructor() {
    super('The local OpenLinear service could not be reached.');
    this.name = 'TransportError';
  }
}

async function sameOriginFetch(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(path, { ...init, credentials: 'same-origin' });
  } catch {
    throw new TransportError();
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const stateChanging = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const response = await sameOriginFetch(path, {
    ...init,
    headers: {
      ...(stateChanging ? { 'content-type': 'application/json' } : {}),
      ...(stateChanging && csrfToken !== undefined ? { 'x-openlinear-csrf': csrfToken } : {}),
      ...init.headers,
    },
  });
  const nextCsrfToken = response.headers.get('x-openlinear-csrf-token');
  if (nextCsrfToken !== null) csrfToken = nextCsrfToken;
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ErrorEnvelope;
    throw new ApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json() as ApiEnvelope<T>).data;
}

const json = (value: unknown): string => JSON.stringify(value);
let csrfToken: string | undefined;

export const api = {
  health: async () => {
    const response = await sameOriginFetch('/health/ready', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    const body = await response.json().catch(() => ({})) as { status?: string };
    if (!response.ok || body.status !== 'ready') {
      throw new ApiError(response.status, {
        error: {
          code: 'LOCAL_SERVICE_NOT_READY',
          message: 'The local OpenLinear service is not ready.',
        },
      });
    }
    return { status: 'ready' as const };
  },
  localOwnerSession: () => request<Session>('/api/v1/local-owner-session', {
    method: 'POST',
    body: '{}',
  }),
  session: () => request<Session>('/api/v1/session'),
  teams: (workspaceId: string) => request<Team[]>(`/api/v1/workspaces/${workspaceId}/teams`),
  memberships: (workspaceId: string) =>
    request<Membership[]>(`/api/v1/workspaces/${workspaceId}/memberships`),
  statuses: (workspaceId: string) =>
    request<WorkflowStatus[]>(`/api/v1/workspaces/${workspaceId}/statuses`),
  createStatus: (
    workspaceId: string,
    input: {
      teamId: string;
      name: string;
      category: WorkflowStatus['category'];
      color: string;
      position: number;
    },
  ) => request<WorkflowStatus>(`/api/v1/workspaces/${workspaceId}/statuses`, {
    method: 'POST',
    body: json({ ...input, idempotencyKey: crypto.randomUUID() }),
  }),
  updateStatus: (
    workspaceId: string,
    statusId: string,
    input: Partial<Pick<WorkflowStatus, 'name' | 'category' | 'color' | 'position'>> & {
      expectedRevision: number;
    },
  ) => request<WorkflowStatus>(`/api/v1/workspaces/${workspaceId}/statuses/${statusId}`, {
    method: 'PATCH',
    body: json(input),
  }),
  reorderStatuses: (workspaceId: string, teamId: string, statuses: WorkflowStatus[]) =>
    request<WorkflowStatus[]>(
      `/api/v1/workspaces/${workspaceId}/teams/${teamId}/statuses/reorder`,
      {
        method: 'POST',
        body: json({
          items: statuses.map(({ id, revision }) => ({ id, expectedRevision: revision })),
        }),
      },
    ),
  retireStatus: (workspaceId: string, statusId: string, input: RetireStatusRequest) =>
    request<RetireStatusResult>(
      `/api/v1/workspaces/${workspaceId}/statuses/${statusId}/retire`,
      { method: 'POST', body: json(input) },
    ),
  projects: (
    workspaceId: string,
    filters: {
      query?: string;
      teamId?: string;
      status?: ProjectStatus;
      priority?: ProjectPriority;
      archiveState?: 'active' | 'archived' | 'all';
      order?: 'position' | 'name' | 'targetDate' | 'updatedAt';
      direction?: 'asc' | 'desc';
    } = {},
  ) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') query.set(key, value);
    }
    const suffix = query.size === 0 ? '' : `?${query.toString()}`;
    return request<Project[]>(`/api/v1/workspaces/${workspaceId}/projects${suffix}`);
  },
  project: (workspaceId: string, projectId: string) =>
    request<Project>(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`),
  createProject: (
    workspaceId: string,
    input: {
      teamId: string;
      name: string;
      summary?: string;
      status?: ProjectStatus;
      priority?: ProjectPriority;
      leadUserId?: string | null;
      startDate?: string | null;
      targetDate?: string | null;
      icon?: Project['icon'];
      color?: string;
      overviewDocument?: RichTextDocument;
      resources?: ProjectResourceInput[];
    },
  ) => request<Project>(`/api/v1/workspaces/${workspaceId}/projects`, {
    method: 'POST',
    body: json({ ...input, idempotencyKey: crypto.randomUUID() }),
  }),
  updateProject: (
    workspaceId: string,
    projectId: string,
    input: Partial<Pick<Project,
      'teamId' | 'name' | 'summary' | 'status' | 'priority' | 'leadUserId' |
      'startDate' | 'targetDate' | 'icon' | 'color' | 'overviewDocument'>> & {
        resources?: ProjectResourceInput[];
        expectedRevision: number;
      },
  ) => request<Project>(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`, {
    method: 'PATCH',
    body: json(input),
  }),
  archiveProject: (workspaceId: string, projectId: string, expectedRevision: number) =>
    request<Project>(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/archive`, {
      method: 'POST',
      body: json({ expectedRevision }),
    }),
  restoreProject: (workspaceId: string, projectId: string, expectedRevision: number) =>
    request<Project>(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/restore`, {
      method: 'POST',
      body: json({ expectedRevision }),
    }),
  purgeProject: (
    workspaceId: string,
    projectId: string,
    expectedRevision: number,
    confirmation: string,
  ) => request<PurgeProjectReceipt>(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/purge`,
    {
      method: 'POST',
      body: json({ expectedRevision, confirmation }),
    },
  ),
  reorderProjects: (workspaceId: string, projects: Project[]) =>
    request<Project[]>(`/api/v1/workspaces/${workspaceId}/projects/reorder`, {
      method: 'POST',
      body: json({ items: projects.map(({ id, revision }) => ({ id, expectedRevision: revision })) }),
    }),
  milestones: (workspaceId: string, projectId: string, includeArchived = false) =>
    request<Milestone[]>(
      `/api/v1/workspaces/${workspaceId}/projects/${projectId}/milestones?includeArchived=${includeArchived}`,
    ),
  workspaceMilestones: (workspaceId: string, includeArchived = false) =>
    request<Milestone[]>(
      `/api/v1/workspaces/${workspaceId}/milestones?includeArchived=${includeArchived}`,
    ),
  createMilestone: (
    workspaceId: string,
    projectId: string,
    input: { name: string; description?: string; targetDate?: string | null },
  ) => request<Milestone>(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/milestones`, {
    method: 'POST',
    body: json({ ...input, idempotencyKey: crypto.randomUUID() }),
  }),
  updateMilestone: (
    workspaceId: string,
    projectId: string,
    milestoneId: string,
    input: Partial<Pick<Milestone, 'name' | 'description' | 'targetDate'>> & {
      expectedRevision: number;
    },
  ) => request<Milestone>(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/${milestoneId}`,
    { method: 'PATCH', body: json(input) },
  ),
  archiveMilestone: (
    workspaceId: string,
    projectId: string,
    milestoneId: string,
    expectedRevision: number,
  ) => request<Milestone>(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/${milestoneId}/archive`,
    { method: 'POST', body: json({ expectedRevision }) },
  ),
  restoreMilestone: (
    workspaceId: string,
    projectId: string,
    milestoneId: string,
    expectedRevision: number,
  ) => request<Milestone>(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/${milestoneId}/restore`,
    { method: 'POST', body: json({ expectedRevision }) },
  ),
  purgeMilestone: (
    workspaceId: string,
    projectId: string,
    milestoneId: string,
    expectedRevision: number,
    confirmation: string,
  ) => request<PurgeMilestoneReceipt>(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/${milestoneId}/purge`,
    { method: 'POST', body: json({ expectedRevision, confirmation }) },
  ),
  reorderMilestones: (workspaceId: string, projectId: string, milestones: Milestone[]) =>
    request<Milestone[]>(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/reorder`, {
      method: 'POST',
      body: json({ items: milestones.map(({ id, revision }) => ({ id, expectedRevision: revision })) }),
    }),
  projectActivity: (workspaceId: string, projectId: string) =>
    request<ActivityEntry[]>(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/activity`),
  labels: (workspaceId: string, includeArchived = false) =>
    request<Label[]>(`/api/v1/workspaces/${workspaceId}/labels?includeArchived=${includeArchived}`),
  createLabel: (workspaceId: string, input: Omit<CreateLabelRequest, 'idempotencyKey'>) =>
    request<Label>(`/api/v1/workspaces/${workspaceId}/labels`, {
      method: 'POST',
      body: json({ ...input, idempotencyKey: crypto.randomUUID() }),
    }),
  updateLabel: (workspaceId: string, labelId: string, input: UpdateLabelRequest) =>
    request<Label>(`/api/v1/workspaces/${workspaceId}/labels/${labelId}`, {
      method: 'PATCH',
      body: json(input),
    }),
  archiveLabel: (workspaceId: string, labelId: string, expectedRevision: number) =>
    request<Label>(`/api/v1/workspaces/${workspaceId}/labels/${labelId}/archive`, {
      method: 'POST',
      body: json({ expectedRevision }),
    }),
  restoreLabel: (workspaceId: string, labelId: string, expectedRevision: number) =>
    request<Label>(`/api/v1/workspaces/${workspaceId}/labels/${labelId}/restore`, {
      method: 'POST',
      body: json({ expectedRevision }),
    }),
  issues: (
    workspaceId: string,
    filters: {
      query?: string;
      teamId?: string;
      statusId?: string;
      priority?: IssuePriority;
      assigneeUserId?: string;
      projectId?: string;
      milestoneId?: string;
      labelId?: string;
      archiveState?: 'active' | 'archived' | 'all';
      order?: 'updatedAt' | 'identifier' | 'priority' | 'dueDate';
      direction?: 'asc' | 'desc';
    } = {},
  ) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') query.set(key, value);
    }
    const suffix = query.size === 0 ? '' : `?${query.toString()}`;
    return request<Issue[]>(`/api/v1/workspaces/${workspaceId}/issues${suffix}`);
  },
  queryIssues: (workspaceId: string, state: IssueViewState) =>
    request<Issue[]>(`/api/v1/workspaces/${workspaceId}/issues/query`, {
      method: 'POST',
      body: json({ state }),
    }),
  savedViews: (workspaceId: string, includeArchived = false) =>
    request<SavedView[]>(`/api/v1/workspaces/${workspaceId}/views?includeArchived=${includeArchived}`),
  createSavedView: (
    workspaceId: string,
    input: { name: string; sharingScope: SavedView['sharingScope']; state: IssueViewState },
  ) => request<SavedView>(`/api/v1/workspaces/${workspaceId}/views`, {
    method: 'POST',
    body: json({ ...input, idempotencyKey: crypto.randomUUID() }),
  }),
  updateSavedView: (
    workspaceId: string,
    viewId: string,
    input: { expectedRevision: number; name?: string; sharingScope?: SavedView['sharingScope']; state?: IssueViewState },
  ) => request<SavedView>(`/api/v1/workspaces/${workspaceId}/views/${viewId}`, {
    method: 'PATCH',
    body: json(input),
  }),
  archiveSavedView: (workspaceId: string, viewId: string, expectedRevision: number) =>
    request<SavedView>(`/api/v1/workspaces/${workspaceId}/views/${viewId}/archive`, {
      method: 'POST',
      body: json({ expectedRevision }),
    }),
  restoreSavedView: (workspaceId: string, viewId: string, expectedRevision: number) =>
    request<SavedView>(`/api/v1/workspaces/${workspaceId}/views/${viewId}/restore`, {
      method: 'POST',
      body: json({ expectedRevision }),
    }),
  bulkIssues: (workspaceId: string, input: BulkIssueMutationRequest) =>
    request<BulkIssueMutationResult[]>(`/api/v1/workspaces/${workspaceId}/issues/bulk`, {
      method: 'POST',
      body: json(input),
    }),
  search: (workspaceId: string, query: string, limit = 20) => {
    const params = new URLSearchParams({ query, limit: String(limit) });
    return request<SearchResult[]>(`/api/v1/workspaces/${workspaceId}/search?${params.toString()}`);
  },
  issue: (workspaceId: string, issueId: string) =>
    request<Issue>(`/api/v1/workspaces/${workspaceId}/issues/${issueId}`),
  createIssue: (workspaceId: string, input: Omit<CreateIssueRequest, 'idempotencyKey'>) =>
    request<Issue>(`/api/v1/workspaces/${workspaceId}/issues`, {
      method: 'POST',
      body: json({ ...input, idempotencyKey: crypto.randomUUID() }),
    }),
  updateIssue: (workspaceId: string, issueId: string, input: UpdateIssueRequest) =>
    request<Issue>(`/api/v1/workspaces/${workspaceId}/issues/${issueId}`, {
      method: 'PATCH',
      body: json(input),
    }),
  archiveIssue: (workspaceId: string, issueId: string, expectedRevision: number) =>
    request<Issue>(`/api/v1/workspaces/${workspaceId}/issues/${issueId}/archive`, {
      method: 'POST',
      body: json({ expectedRevision }),
    }),
  restoreIssue: (workspaceId: string, issueId: string, expectedRevision: number) =>
    request<Issue>(`/api/v1/workspaces/${workspaceId}/issues/${issueId}/restore`, {
      method: 'POST',
      body: json({ expectedRevision }),
    }),
  purgeIssue: (
    workspaceId: string,
    issueId: string,
    expectedRevision: number,
    confirmation: string,
  ) => request<PurgeIssueReceipt>(`/api/v1/workspaces/${workspaceId}/issues/${issueId}/purge`, {
    method: 'POST',
    body: json({ expectedRevision, confirmation }),
  }),
  issueRelations: (workspaceId: string, issueId: string) =>
    request<IssueRelation[]>(`/api/v1/workspaces/${workspaceId}/issues/${issueId}/relations`),
  createIssueRelation: (
    workspaceId: string,
    issueId: string,
    input: Omit<CreateIssueRelationRequest, 'idempotencyKey'>,
  ) => request<IssueRelation>(`/api/v1/workspaces/${workspaceId}/issues/${issueId}/relations`, {
    method: 'POST',
    body: json({ ...input, idempotencyKey: crypto.randomUUID() }),
  }),
  deleteIssueRelation: (
    workspaceId: string,
    issueId: string,
    relationId: string,
    expectedRevision: number,
  ) => request<void>(
    `/api/v1/workspaces/${workspaceId}/issues/${issueId}/relations/${relationId}`,
    { method: 'DELETE', body: json({ expectedRevision }) },
  ),
  comments: (workspaceId: string, issueId: string, includeArchived = false) =>
    request<Comment[]>(
      `/api/v1/workspaces/${workspaceId}/issues/${issueId}/comments?includeArchived=${includeArchived}`,
    ),
  createComment: (
    workspaceId: string,
    issueId: string,
    input: Omit<CreateCommentRequest, 'idempotencyKey'>,
  ) => request<Comment>(`/api/v1/workspaces/${workspaceId}/issues/${issueId}/comments`, {
    method: 'POST',
    body: json({ ...input, idempotencyKey: crypto.randomUUID() }),
  }),
  updateComment: (
    workspaceId: string,
    issueId: string,
    commentId: string,
    input: UpdateCommentRequest,
  ) => request<Comment>(
    `/api/v1/workspaces/${workspaceId}/issues/${issueId}/comments/${commentId}`,
    { method: 'PATCH', body: json(input) },
  ),
  archiveComment: (
    workspaceId: string,
    issueId: string,
    commentId: string,
    expectedRevision: number,
  ) => request<Comment>(
    `/api/v1/workspaces/${workspaceId}/issues/${issueId}/comments/${commentId}/archive`,
    { method: 'POST', body: json({ expectedRevision }) },
  ),
  restoreComment: (
    workspaceId: string,
    issueId: string,
    commentId: string,
    expectedRevision: number,
  ) => request<Comment>(
    `/api/v1/workspaces/${workspaceId}/issues/${issueId}/comments/${commentId}/restore`,
    { method: 'POST', body: json({ expectedRevision }) },
  ),
  issueActivity: (workspaceId: string, issueId: string) =>
    request<ActivityEntry[]>(`/api/v1/workspaces/${workspaceId}/issues/${issueId}/activity`),
};
