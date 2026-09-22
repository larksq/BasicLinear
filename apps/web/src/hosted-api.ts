import {refreshHostedGoogleIdToken} from './hosted-auth.js';

export interface HostedBootstrapResponse {
  created: boolean;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    provider: 'google.com';
  };
  workspace: {
    id: string;
    name: string;
    authority: 'firebase-hosted';
  };
  membership: {
    id: string;
    role: 'owner';
    status: 'active';
  };
  trial: {
    id: string;
    plan: 'pro';
    status: 'active';
    startedAt: string;
    endsAt: string;
    durationDays: 30;
  };
}

export interface HostedWorkspaceDirectoryEntry {
  id: string;
  name: string;
  role: 'owner' | 'member';
}

export type HostedInvitationState = 'pending' | 'expired' | 'revoked' | 'accepted';

export interface HostedInvitation {
  id: string;
  workspaceId: string;
  invitedEmail: string;
  inviterDisplayName: string;
  workspaceName: string;
  role: 'member';
  teamIds?: string[];
  state: HostedInvitationState;
  createdAt: string;
  lastSentAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  sendCount: number;
  activeSeatApplied: boolean;
  revision: number;
}

export interface HostedInvitationMutationResponse {
  changed: boolean;
  invitation: HostedInvitation;
  inviteUrl: string | null;
}

export interface HostedInvitationPreview {
  invitationId: string;
  workspaceId: string;
  invitedEmail: string;
  inviterDisplayName: string;
  workspaceName: string;
  role: 'member';
  state: HostedInvitationState | 'superseded';
  expiresAt: string;
}

export interface HostedInvitationAcceptanceResponse {
  state: 'accepted';
  firstAcceptance: boolean;
  activeSeatAdded: boolean;
  workspace: {id: string; name: string};
  membership: {
    userId: string;
    role: 'owner' | 'member';
    status: 'active';
    revision: number;
  };
}

export interface HostedCollaborationMember {
  userId: string;
  role: 'owner' | 'member';
  displayName: string | null;
}

export type HostedWorkflowStatusCategory =
  | 'backlog'
  | 'unstarted'
  | 'started'
  | 'completed'
  | 'canceled';
export type HostedWorkflowStatusIcon =
  | 'circle'
  | 'circle-dashed'
  | 'circle-dot'
  | 'circle-check'
  | 'circle-x';

export interface HostedTeam {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  color: string;
  description: string;
  createdByUserId: string;
  archivedAt: null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface HostedTeamMembership {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  teamId: string;
  userId: string;
  role: 'owner' | 'member';
  status: 'active' | 'left';
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface HostedWorkflowStatus {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  teamId: string;
  name: string;
  category: HostedWorkflowStatusCategory;
  color: string;
  icon: HostedWorkflowStatusIcon;
  position: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export type HostedSavedViewType = 'issues' | 'projects';
export type HostedSavedViewPredicate =
  | 'all'
  | 'active'
  | 'backlog'
  | 'my_open'
  | 'unassigned'
  | 'high_priority'
  | 'completed';

export interface HostedSavedView {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  teamId: string;
  name: string;
  viewType: HostedSavedViewType;
  predicate: HostedSavedViewPredicate;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export type HostedProjectStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'canceled';

export interface HostedProject {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  name: string;
  summary: string;
  status: HostedProjectStatus;
  createdByUserId: string;
  archivedAt: null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface HostedMilestone {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string;
  targetDate: string | null;
  createdByUserId: string;
  archivedAt: null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export type HostedIssueStatus = 'todo' | 'in_progress' | 'done';
export type HostedIssuePriority = 'no_priority' | 'low' | 'medium' | 'high' | 'urgent';

export interface HostedIssueResource {
  label: string;
  url: string;
}

export interface HostedIssue {
  schemaVersion: 1;
  id: string;
  number: number;
  workspaceId: string;
  title: string;
  description: string;
  status: HostedIssueStatus;
  priority: HostedIssuePriority;
  teamId: string;
  statusId: string;
  projectId: string | null;
  milestoneId: string | null;
  parentIssueId: string | null;
  resources: HostedIssueResource[];
  dueAt: string | null;
  assigneeUserId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface HostedIssueActivity {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  issueId: string;
  actorUserId: string;
  action: string;
  entityType: 'issue' | 'comment';
  entityId: string;
  occurredAt: string;
  revisionBefore: number | null;
  revisionAfter: number;
}

export interface HostedIssueObservation {
  issueId: string;
  subscribed: boolean;
  mode: 'automatic' | 'explicit' | 'implicit' | 'none';
  readThroughAt: string;
  revision: number;
  subscriberUserIds: string[];
}

export interface HostedIssueNotification {
  id: string;
  issueId: string;
  issueTitle: string;
  action: string;
  actorUserId: string | null;
  occurredAt: string;
  unread: boolean;
}

export interface HostedComment {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  issueId: string;
  authorUserId: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  revision: number;
}

export type HostedBillingPlan = 'monthly' | 'annual';
export type HostedEntitlementMode = 'trial_pro' | 'paid_pro' | 'free';

export interface HostedBillingSummary {
  workspaceId: string;
  mode: HostedEntitlementMode;
  trial: {startedAt: string; endsAt: string; active: boolean};
  seats: {active: number; pendingInvitations: number};
  prices: {
    currency: 'usd';
    monthlyPerSeatCents: 200;
    annualPerSeatCents: 1200;
    monthlyTotalCents: number;
    annualTotalCents: number;
  };
  subscription: null | {
    plan: HostedBillingPlan;
    status: 'trialing' | 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused';
    activeSeats: number;
    paidThrough: string;
    cancelAtPeriodEnd: boolean;
  };
  verificationAccess?: {
    source: 'operator_allowlist';
    endsAt: '9999-12-31T23:59:59.999Z';
    noCharge: true;
  };
  free: {
    writerUserId: string;
    dataReadable: true;
    exportEligible: true;
    exportAvailable: true;
    extraMemberWritesPaused: true;
    automationWritesPaused: true;
  };
}

export interface HostedBillingCheckout {
  checkoutSessionId: string;
  checkoutUrl: string;
  plan: HostedBillingPlan;
  activeSeats: number;
  totalCents: number;
  currency: 'usd';
  expiresAt: string;
}

export interface HostedBillingMemberRemoval {
  changed: boolean;
  userId: string;
  activeSeats: number;
}

export const hostedPersonalTokenScopes = [
  'workspace:read',
  'projects:read',
  'projects:write',
  'milestones:read',
  'milestones:write',
  'issues:read',
  'issues:write',
  'comments:read',
  'comments:write',
  'members:read',
  'members:write',
  'invitations:read',
  'invitations:write',
  'billing:read',
  'workspace:export',
] as const;
export type HostedPersonalTokenScope = (typeof hostedPersonalTokenScopes)[number];

export interface HostedPersonalToken {
  id: string;
  workspaceId: string;
  name: string;
  prefix: string;
  scopes: HostedPersonalTokenScope[];
  audience: 'basiclinear-api-v1';
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revision: number;
}

export interface HostedPersonalTokenCreation {
  changed: boolean;
  token: HostedPersonalToken;
  rawToken: string | null;
}

export interface HostedWorkspaceExport {
  mediaType: 'application/vnd.basiclinear.workspace-export+json;version=1';
  workspaceId: string;
  sha256: string;
  data: {
    schemaVersion: 'basiclinear.workspace-export.v1';
    workspace: Record<string, unknown>;
    memberships: Array<Record<string, unknown>>;
    invitations: Array<Record<string, unknown>>;
    projects: Array<Record<string, unknown>>;
    milestones: Array<Record<string, unknown>>;
    issues: Array<Record<string, unknown>>;
    comments: Array<Record<string, unknown>>;
    teams: Array<Record<string, unknown>>;
    teamMemberships: Array<Record<string, unknown>>;
    workflowStatuses: Array<Record<string, unknown>>;
    cycles: Array<Record<string, unknown>>;
    savedViews: Array<Record<string, unknown>>;
  };
}

export interface HostedOAuthConsentView {
  requestId: string;
  client: {id: string; name: string};
  redirectUri: string;
  workspace: {id: string; name: string};
  scopes: HostedPersonalTokenScope[];
  state: 'pending' | 'approved' | 'denied';
  expiresAt: string;
}

export interface HostedOAuthConsentDecision {
  decision: 'approved' | 'denied';
  redirectUri: string;
}

interface HostedErrorEnvelope {
  error?: {code?: string; message?: string; correlationId?: string};
}

export class HostedApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId: string | null;

  constructor(status: number, body: HostedErrorEnvelope) {
    super(body.error?.message ?? 'The hosted request could not be completed.');
    this.name = 'HostedApiError';
    this.status = status;
    this.code = body.error?.code ?? 'HOSTED_REQUEST_FAILED';
    this.correlationId = body.error?.correlationId ?? null;
  }
}

export async function bootstrapHostedOwner(
  idToken: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedBootstrapResponse> {
  const response = await fetcher('/api/v1/hosted/bootstrap', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    },
    body: '{}',
  });
  const body = await response.json().catch(() => ({})) as HostedErrorEnvelope | {data: HostedBootstrapResponse};
  if (!response.ok || !('data' in body)) {
    throw new HostedApiError(response.status, body as HostedErrorEnvelope);
  }
  return body.data;
}

export function listHostedWorkspaces(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedWorkspaceDirectoryEntry[]> {
  return hostedRequest<{workspaces: HostedWorkspaceDirectoryEntry[]}>(
    '/api/v1/hosted/workspaces',
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  ).then((data) => data.workspaces);
}

async function hostedRequest<Data>(
  path: string,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<Data> {
  const requestInit: RequestInit = {
    cache: 'no-store',
    credentials: 'same-origin',
    ...init,
  };
  let response = await fetcher(path, requestInit);
  let body = await response.json().catch(() => ({})) as HostedErrorEnvelope | {data: Data};
  if (response.status === 401 && !('data' in body)
    && body.error?.code === 'AUTHENTICATION_REQUIRED') {
    const headers = new Headers(requestInit.headers);
    if (headers.get('authorization')?.startsWith('Bearer ') === true) {
      const refreshedIdToken = await refreshHostedGoogleIdToken().catch(() => null);
      if (refreshedIdToken !== null) {
        headers.set('authorization', `Bearer ${refreshedIdToken}`);
        response = await fetcher(path, {...requestInit, headers});
        body = await response.json().catch(() => ({})) as HostedErrorEnvelope | {data: Data};
      }
    }
  }
  if (!response.ok || !('data' in body)) {
    throw new HostedApiError(response.status, body as HostedErrorEnvelope);
  }
  return body.data;
}

const authenticatedJsonHeaders = (
  idToken: string,
  idempotencyKey?: string,
): Record<string, string> => ({
  accept: 'application/json',
  authorization: `Bearer ${idToken}`,
  'content-type': 'application/json',
  ...(idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey }),
});

export function listHostedInvitations(
  idToken: string,
  workspaceId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedInvitation[]> {
  return hostedRequest<{invitations: HostedInvitation[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
    { method: 'GET', headers: authenticatedJsonHeaders(idToken) },
    fetcher,
  ).then((data) => data.invitations);
}

export function createHostedInvitation(
  idToken: string,
  workspaceId: string,
  email: string,
  idempotencyKey: string,
  teamIdsOrFetcher: string[] | typeof fetch = [],
  providedFetcher: typeof fetch = fetch,
): Promise<HostedInvitationMutationResponse> {
  const includeTeamIds = Array.isArray(teamIdsOrFetcher) && arguments.length >= 5;
  const teamIds = Array.isArray(teamIdsOrFetcher) ? teamIdsOrFetcher : [];
  const fetcher = typeof teamIdsOrFetcher === 'function' ? teamIdsOrFetcher : providedFetcher;
  return hostedRequest<HostedInvitationMutationResponse>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify(includeTeamIds ? { email, teamIds } : {email}),
    },
    fetcher,
  );
}

export function resendHostedInvitation(
  idToken: string,
  workspaceId: string,
  invitationId: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedInvitationMutationResponse> {
  return hostedRequest<HostedInvitationMutationResponse>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}/resend`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: '{}',
    },
    fetcher,
  );
}

export function revokeHostedInvitation(
  idToken: string,
  workspaceId: string,
  invitationId: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedInvitationMutationResponse> {
  return hostedRequest<HostedInvitationMutationResponse>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: '{}',
    },
    fetcher,
  );
}

export function inspectHostedInvitation(
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedInvitationPreview> {
  return hostedRequest<HostedInvitationPreview>(
    '/api/v1/hosted/invitations/inspect',
    {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    },
    fetcher,
  );
}

export function acceptHostedInvitation(
  token: string,
  idToken: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedInvitationAcceptanceResponse> {
  return hostedRequest<HostedInvitationAcceptanceResponse>(
    '/api/v1/hosted/invitations/accept',
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify({ token }),
    },
    fetcher,
  );
}

export function listHostedMembers(
  idToken: string,
  workspaceId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedCollaborationMember[]> {
  return hostedRequest<{members: HostedCollaborationMember[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/members`,
    { method: 'GET', headers: authenticatedJsonHeaders(idToken) },
    fetcher,
  ).then((data) => data.members);
}

export function bootstrapHostedWorkspaceConfiguration(
  idToken: string,
  workspaceId: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<{team: HostedTeam; statuses: HostedWorkflowStatus[]}> {
  return hostedRequest<{team: HostedTeam; statuses: HostedWorkflowStatus[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/configuration/bootstrap`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: '{}',
    },
    fetcher,
  );
}

export function listHostedTeams(
  idToken: string,
  workspaceId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedTeam[]> {
  return hostedRequest<{teams: HostedTeam[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/teams`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  ).then((data) => data.teams);
}

export function listHostedTeamMemberships(
  idToken: string,
  workspaceId: string,
  teamId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedTeamMembership[]> {
  return hostedRequest<{memberships: HostedTeamMembership[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/teams/${encodeURIComponent(teamId)}/members`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  ).then((data) => data.memberships);
}

export function joinHostedTeam(
  idToken: string,
  workspaceId: string,
  teamId: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedTeamMembership> {
  return hostedRequest<{membership: HostedTeamMembership}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/teams/${encodeURIComponent(teamId)}/members`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: '{}',
    },
    fetcher,
  ).then((data) => data.membership);
}

export function leaveHostedTeam(
  idToken: string,
  workspaceId: string,
  teamId: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedTeamMembership> {
  return hostedRequest<{membership: HostedTeamMembership}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/teams/${encodeURIComponent(teamId)}/members`,
    {
      method: 'DELETE',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: '{}',
    },
    fetcher,
  ).then((data) => data.membership);
}

export function createHostedTeam(
  idToken: string,
  workspaceId: string,
  input: {name: string; key: string; color?: string; description?: string},
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<{team: HostedTeam; statuses: HostedWorkflowStatus[]}> {
  return hostedRequest<{team: HostedTeam; statuses: HostedWorkflowStatus[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/teams`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify(input),
    },
    fetcher,
  );
}

export function updateHostedTeam(
  idToken: string,
  workspaceId: string,
  teamId: string,
  expectedRevision: number,
  patch: {name?: string; key?: string; color?: string; description?: string},
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedTeam> {
  return hostedRequest<{team: HostedTeam}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/teams/${encodeURIComponent(teamId)}`,
    {
      method: 'PATCH',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify({expectedRevision, ...patch}),
    },
    fetcher,
  ).then((data) => data.team);
}

export function listHostedWorkflowStatuses(
  idToken: string,
  workspaceId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedWorkflowStatus[]> {
  return hostedRequest<{statuses: HostedWorkflowStatus[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/workflow-statuses`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  ).then((data) => data.statuses);
}

export function createHostedWorkflowStatus(
  idToken: string,
  workspaceId: string,
  input: {
    teamId: string;
    name: string;
    category: HostedWorkflowStatusCategory;
    color: string;
    icon?: HostedWorkflowStatusIcon;
    position?: number;
  },
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedWorkflowStatus> {
  return hostedRequest<{status: HostedWorkflowStatus}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/workflow-statuses`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify(input),
    },
    fetcher,
  ).then((data) => data.status);
}

export function updateHostedWorkflowStatus(
  idToken: string,
  workspaceId: string,
  statusId: string,
  expectedRevision: number,
  patch: {name?: string; category?: HostedWorkflowStatusCategory; color?: string; icon?: HostedWorkflowStatusIcon; position?: number},
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedWorkflowStatus> {
  return hostedRequest<{status: HostedWorkflowStatus}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/workflow-statuses/${encodeURIComponent(statusId)}`,
    {
      method: 'PATCH',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify({expectedRevision, ...patch}),
    },
    fetcher,
  ).then((data) => data.status);
}

export function listHostedSavedViews(
  idToken: string,
  workspaceId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedSavedView[]> {
  return hostedRequest<{views: HostedSavedView[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/saved-views`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  ).then((data) => data.views);
}

export function createHostedSavedView(
  idToken: string,
  workspaceId: string,
  input: {teamId: string; name: string; viewType: HostedSavedViewType; predicate: HostedSavedViewPredicate},
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedSavedView> {
  return hostedRequest<{view: HostedSavedView}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/saved-views`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify(input),
    },
    fetcher,
  ).then((data) => data.view);
}

export function getHostedBillingSummary(
  idToken: string,
  workspaceId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedBillingSummary> {
  return hostedRequest<HostedBillingSummary>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/billing`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  );
}

export function createHostedBillingCheckout(
  idToken: string,
  workspaceId: string,
  plan: HostedBillingPlan,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedBillingCheckout> {
  return hostedRequest<HostedBillingCheckout>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/billing/checkout`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify({plan}),
    },
    fetcher,
  );
}

export function removeHostedMember(
  idToken: string,
  workspaceId: string,
  userId: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedBillingMemberRemoval> {
  return hostedRequest<HostedBillingMemberRemoval>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: '{}',
    },
    fetcher,
  );
}

export function listHostedIssues(
  idToken: string,
  workspaceId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedIssue[]> {
  return hostedRequest<{issues: HostedIssue[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/issues`,
    { method: 'GET', headers: authenticatedJsonHeaders(idToken) },
    fetcher,
  ).then((data) => data.issues);
}

export function listHostedProjects(
  idToken: string,
  workspaceId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedProject[]> {
  return hostedRequest<{projects: HostedProject[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/projects`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  ).then((data) => data.projects);
}

export function createHostedProject(
  idToken: string,
  workspaceId: string,
  input: {name: string; summary?: string; status?: HostedProjectStatus},
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedProject> {
  return hostedRequest<{project: HostedProject}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/projects`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify(input),
    },
    fetcher,
  ).then((data) => data.project);
}

export function updateHostedProject(
  idToken: string,
  workspaceId: string,
  projectId: string,
  expectedRevision: number,
  patch: {name?: string; summary?: string; status?: HostedProjectStatus},
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedProject> {
  return hostedRequest<{project: HostedProject}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify({expectedRevision, ...patch}),
    },
    fetcher,
  ).then((data) => data.project);
}

export function listHostedMilestones(
  idToken: string,
  workspaceId: string,
  projectId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedMilestone[]> {
  return hostedRequest<{milestones: HostedMilestone[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/milestones`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  ).then((data) => data.milestones);
}

export function createHostedMilestone(
  idToken: string,
  workspaceId: string,
  projectId: string,
  input: {name: string; description?: string; targetDate?: string | null},
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedMilestone> {
  return hostedRequest<{milestone: HostedMilestone}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/milestones`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify(input),
    },
    fetcher,
  ).then((data) => data.milestone);
}

export function updateHostedMilestone(
  idToken: string,
  workspaceId: string,
  milestoneId: string,
  expectedRevision: number,
  patch: {name?: string; description?: string; targetDate?: string | null},
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedMilestone> {
  return hostedRequest<{milestone: HostedMilestone}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/milestones/${encodeURIComponent(milestoneId)}`,
    {
      method: 'PATCH',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify({expectedRevision, ...patch}),
    },
    fetcher,
  ).then((data) => data.milestone);
}

export function createHostedIssue(
  idToken: string,
  workspaceId: string,
  input: string | {
    title: string;
    description?: string;
    teamId?: string;
    statusId?: string;
    projectId?: string | null;
    milestoneId?: string | null;
    parentIssueId?: string | null;
    resources?: HostedIssueResource[];
    dueAt?: string | null;
  },
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedIssue> {
  return hostedRequest<{issue: HostedIssue}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/issues`,
    {
      method: 'POST', headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify(typeof input === 'string' ? {title: input} : input),
    },
    fetcher,
  ).then((data) => data.issue);
}

export function updateHostedIssue(
  idToken: string,
  workspaceId: string,
  issueId: string,
  expectedRevision: number,
  patch: {
    title?: string;
    description?: string;
    status?: HostedIssueStatus;
    priority?: HostedIssuePriority;
    teamId?: string;
    statusId?: string;
    projectId?: string | null;
    milestoneId?: string | null;
    parentIssueId?: string | null;
    resources?: HostedIssueResource[];
    dueAt?: string | null;
  },
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedIssue> {
  return hostedRequest<{issue: HostedIssue}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}`,
    {
      method: 'PATCH', headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify({ expectedRevision, ...patch }),
    },
    fetcher,
  ).then((data) => data.issue);
}

export function listHostedIssueActivity(
  idToken: string,
  workspaceId: string,
  issueId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedIssueActivity[]> {
  return hostedRequest<{activity: HostedIssueActivity[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/activity`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  ).then((data) => data.activity);
}

export function getHostedIssueObservation(
  idToken: string,
  workspaceId: string,
  issueId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedIssueObservation> {
  return hostedRequest<{observation: HostedIssueObservation}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/subscription`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  ).then((data) => data.observation);
}

export function setHostedIssueSubscription(
  idToken: string,
  workspaceId: string,
  issueId: string,
  subscribed: boolean,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedIssueObservation> {
  return hostedRequest<{observation: HostedIssueObservation}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/subscription`,
    {
      method: 'PUT',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify({subscribed}),
    },
    fetcher,
  ).then((data) => data.observation);
}

export function listHostedNotifications(
  idToken: string,
  workspaceId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedIssueNotification[]> {
  return hostedRequest<{notifications: HostedIssueNotification[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/notifications`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  ).then((data) => data.notifications);
}

export function markHostedIssueNotificationsRead(
  idToken: string,
  workspaceId: string,
  issueId: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedIssueObservation> {
  return hostedRequest<{observation: HostedIssueObservation}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/notifications/read`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: '{}',
    },
    fetcher,
  ).then((data) => data.observation);
}

export function assignHostedIssue(
  idToken: string,
  workspaceId: string,
  issueId: string,
  expectedRevision: number,
  assigneeUserId: string | null,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedIssue> {
  return hostedRequest<{issue: HostedIssue}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/assignee`,
    {
      method: 'PUT', headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify({ expectedRevision, assigneeUserId }),
    },
    fetcher,
  ).then((data) => data.issue);
}

export function listHostedComments(
  idToken: string,
  workspaceId: string,
  issueId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedComment[]> {
  return hostedRequest<{comments: HostedComment[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/comments`,
    { method: 'GET', headers: authenticatedJsonHeaders(idToken) },
    fetcher,
  ).then((data) => data.comments);
}

export function createHostedComment(
  idToken: string,
  workspaceId: string,
  issueId: string,
  body: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedComment> {
  return hostedRequest<{comment: HostedComment}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/comments`,
    {
      method: 'POST', headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify({ body }),
    },
    fetcher,
  ).then((data) => data.comment);
}

export function editHostedComment(
  idToken: string,
  workspaceId: string,
  issueId: string,
  commentId: string,
  expectedRevision: number,
  body: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedComment> {
  return hostedRequest<{comment: HostedComment}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'PATCH', headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify({ expectedRevision, body }),
    },
    fetcher,
  ).then((data) => data.comment);
}

export function deleteHostedComment(
  idToken: string,
  workspaceId: string,
  issueId: string,
  commentId: string,
  expectedRevision: number,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedComment> {
  return hostedRequest<{comment: HostedComment}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'DELETE', headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify({ expectedRevision }),
    },
    fetcher,
  ).then((data) => data.comment);
}

export function listHostedPersonalTokens(
  idToken: string,
  workspaceId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedPersonalToken[]> {
  return hostedRequest<{tokens: HostedPersonalToken[]}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/tokens`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  ).then((data) => data.tokens);
}

export function createHostedPersonalToken(
  idToken: string,
  workspaceId: string,
  input: {name: string; scopes: HostedPersonalTokenScope[]; expiresInDays: number},
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedPersonalTokenCreation> {
  return hostedRequest<HostedPersonalTokenCreation>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/tokens`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: JSON.stringify(input),
    },
    fetcher,
  );
}

export function revokeHostedPersonalToken(
  idToken: string,
  workspaceId: string,
  tokenId: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<{changed: boolean; token: HostedPersonalToken}> {
  return hostedRequest<{changed: boolean; token: HostedPersonalToken}>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/tokens/${encodeURIComponent(tokenId)}`,
    {
      method: 'DELETE',
      headers: authenticatedJsonHeaders(idToken, idempotencyKey),
      body: '{}',
    },
    fetcher,
  );
}

export function getHostedWorkspaceExport(
  idToken: string,
  workspaceId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedWorkspaceExport> {
  return hostedRequest<HostedWorkspaceExport>(
    `/api/v1/hosted/workspaces/${encodeURIComponent(workspaceId)}/export`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  );
}

export function getHostedOAuthConsent(
  idToken: string,
  requestId: string,
  fetcher: typeof fetch = fetch,
): Promise<HostedOAuthConsentView> {
  return hostedRequest<HostedOAuthConsentView>(
    `/oauth/consent/${encodeURIComponent(requestId)}`,
    {method: 'GET', headers: authenticatedJsonHeaders(idToken)},
    fetcher,
  );
}

export function decideHostedOAuthConsent(
  idToken: string,
  requestId: string,
  decision: 'approve' | 'deny',
  fetcher: typeof fetch = fetch,
): Promise<HostedOAuthConsentDecision> {
  return hostedRequest<HostedOAuthConsentDecision>(
    `/oauth/consent/${encodeURIComponent(requestId)}`,
    {
      method: 'POST',
      headers: authenticatedJsonHeaders(idToken),
      body: JSON.stringify({decision}),
    },
    fetcher,
  );
}
