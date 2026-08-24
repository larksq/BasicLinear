#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const portArgument = process.argv.indexOf('--port');
const port = portArgument === -1 ? 4176 : Number(process.argv[portArgument + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('Invalid --port value.');

const dist = resolve('apps/web/dist');
const timestamp = '2026-08-20T00:00:00.000Z';
const ids = {
  user: '10000000-0000-4000-8000-000000000023',
  workspace: '20000000-0000-4000-8000-000000000023',
  workspaceB: '20000000-0000-4000-8000-000000000024',
  membership: '21000000-0000-4000-8000-000000000023',
  membershipB: '21000000-0000-4000-8000-000000000024',
  team: '30000000-0000-4000-8000-000000000023',
  teamB: '30000000-0000-4000-8000-000000000024',
  teamC: '30000000-0000-4000-8000-000000000025',
  started: '40000000-0000-4000-8000-000000000023',
  completed: '40000000-0000-4000-8000-000000000024',
  startedB: '40000000-0000-4000-8000-000000000025',
  startedC: '40000000-0000-4000-8000-000000000026',
  project: '50000000-0000-4000-8000-000000000023',
  projectC: '50000000-0000-4000-8000-000000000024',
  projectD: '50000000-0000-4000-8000-000000000025',
  projectArchived: '50000000-0000-4000-8000-000000000026',
  milestone: '52000000-0000-4000-8000-000000000023',
  milestoneB: '52000000-0000-4000-8000-000000000024',
  milestoneC: '52000000-0000-4000-8000-000000000025',
  milestoneD: '52000000-0000-4000-8000-000000000026',
  milestoneArchived: '52000000-0000-4000-8000-000000000027',
  label: '60000000-0000-4000-8000-000000000023',
  labelB: '60000000-0000-4000-8000-000000000024',
  labelC: '60000000-0000-4000-8000-000000000025',
  labelArchived: '60000000-0000-4000-8000-000000000026',
  issueResource: '65000000-0000-4000-8000-000000000023',
  issueA: '70000000-0000-4000-8000-000000000023',
  issueB: '70000000-0000-4000-8000-000000000024',
  issueC: '70000000-0000-4000-8000-000000000025',
  issueCreated: '70000000-0000-4000-8000-000000000026',
  commentA: '71000000-0000-4000-8000-000000000023',
  commentB: '71000000-0000-4000-8000-000000000024',
  savedViewA: '80000000-0000-4000-8000-000000000023',
  savedViewB: '80000000-0000-4000-8000-000000000024',
};

const workspace = {
  id: ids.workspace,
  name: 'Product Studio',
  slug: 'product-studio',
  role: 'owner',
  revision: 3,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const workspaceB = {
  ...workspace,
  id: ids.workspaceB,
  name: 'Research Lab',
  slug: 'research-lab',
  role: 'member',
  revision: 1,
};
const team = {
  id: ids.team,
  workspaceId: ids.workspace,
  name: 'Product Quality',
  key: 'QA',
  revision: 2,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const teamB = {
  ...team,
  id: ids.teamB,
  workspaceId: ids.workspaceB,
  name: 'Research Operations',
  key: 'RO',
  revision: 1,
};
const teamC = {
  ...team,
  id: ids.teamC,
  name: 'Engineering Systems',
  key: 'ENG',
  revision: 1,
};
const membership = {
  id: ids.membership,
  workspaceId: ids.workspace,
  userId: ids.user,
  email: 'reviewer@example.test',
  displayName: 'Jordan Lee',
  role: 'owner',
  revision: 2,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const membershipB = {
  ...membership,
  id: ids.membershipB,
  workspaceId: ids.workspaceB,
  role: 'member',
  revision: 1,
};
const statuses = [
  {
    id: ids.started,
    workspaceId: ids.workspace,
    teamId: ids.team,
    name: 'In progress',
    category: 'started',
    color: '#C18C3A',
    position: 100,
    isDefault: true,
    revision: 2,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: ids.completed,
    workspaceId: ids.workspace,
    teamId: ids.team,
    name: 'Done',
    category: 'completed',
    color: '#4E9F76',
    position: 200,
    isDefault: false,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];
const statusesB = [{
  ...statuses[0],
  id: ids.startedB,
  workspaceId: ids.workspaceB,
  teamId: ids.teamB,
  name: 'Started',
  revision: 1,
}];
const statusC = {
  ...statuses[0],
  id: ids.startedC,
  teamId: ids.teamC,
  name: 'In development',
  revision: 1,
};
let workflowStatusInlineEditStatuses = [
  ...statuses.map((item) => ({ ...item })),
  {
    ...statuses[0],
    id: '40000000-0000-4000-8000-000000000027',
    name: 'Ready for review',
    category: 'started',
    color: '#5279C7',
    position: 300,
    isDefault: false,
    revision: 1,
  },
  { ...statusC, position: 900 },
];
let workflowStatusRetirementStatuses = workflowStatusInlineEditStatuses.map((item) => ({ ...item }));
let workflowStatusInlineEditSequence = 28;
const workflowStatusInlineEditIdempotency = new Map();
const label = {
  id: ids.label,
  workspaceId: ids.workspace,
  name: 'Interaction',
  color: '#5279C7',
  archivedAt: null,
  revision: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const labelB = {
  ...label,
  id: ids.labelB,
  name: 'Release',
  color: '#C65D4B',
};
const labelC = {
  ...label,
  id: ids.labelC,
  name: 'Reliability',
  color: '#3F8B75',
};
const labelArchived = {
  ...label,
  id: ids.labelArchived,
  name: 'Legacy review',
  color: '#7A7D86',
  archivedAt: timestamp,
};
let labelInlineEditLabels = [label, labelB, labelArchived].map((item) => ({ ...item }));
let labelInlineEditSequence = 27;
const labelInlineEditIdempotency = new Map();
const project = {
  id: ids.project,
  workspaceId: ids.workspace,
  teamId: ids.team,
  name: 'Desktop density controls',
  summary: 'Keep navigation and issue context efficient across repeated work.',
  status: 'in_progress',
  priority: 'high',
  leadUserId: ids.user,
  startDate: '2026-08-18',
  targetDate: '2026-09-15',
  icon: 'layers',
  color: '#5E6AD2',
  position: 100,
  overviewDocument: {
    version: 1,
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Release discipline' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Verify ' },
          { type: 'text', text: 'dense desktop controls', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' without relying on private data.' },
        ],
      },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rehearse recovery before release.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep evidence synthetic and reproducible.' }] }] },
        ],
      },
    ],
  },
  resources: [],
  progress: { policy: 'project-progress-v1', issueCount: 2, completedCount: 1, canceledCount: 0, eligibleCount: 2, fraction: 0.5 },
  archivedAt: null,
  revision: 4,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const projectC = {
  ...project,
  id: ids.projectC,
  teamId: ids.teamC,
  name: 'Local sync engine',
  summary: 'Keep the second team isolated in route and query verification.',
  priority: 'medium',
  color: '#3F8B75',
  position: 200,
  progress: { policy: 'project-progress-v1', issueCount: 1, completedCount: 0, canceledCount: 0, eligibleCount: 1, fraction: 0 },
  revision: 1,
};
const projectD = {
  ...project,
  id: ids.projectD,
  name: 'Open source launch',
  summary: 'Prepare a public release with clear ownership and milestones.',
  status: 'planned',
  priority: 'urgent',
  leadUserId: null,
  startDate: null,
  targetDate: '2026-10-01',
  icon: 'rocket',
  color: '#C65D4B',
  position: 300,
  progress: { policy: 'project-progress-v1', issueCount: 3, completedCount: 0, canceledCount: 0, eligibleCount: 3, fraction: 0 },
  revision: 1,
};
const projectArchived = {
  ...project,
  id: ids.projectArchived,
  name: 'Legacy interaction audit',
  summary: 'Retained only to verify current archived issue context.',
  status: 'completed',
  priority: 'none',
  leadUserId: null,
  startDate: null,
  targetDate: null,
  color: '#7A7D86',
  position: 400,
  archivedAt: timestamp,
  revision: 2,
};
let projectInlineEditProject = {
  ...project,
  resources: [{
    id: '51000000-0000-4000-8000-000000000023',
    label: 'Project runbook',
    url: 'https://example.test/project-runbook',
    position: 100,
  }],
};
const milestone = {
  id: ids.milestone,
  workspaceId: ids.workspace,
  projectId: ids.project,
  name: 'Interaction acceptance',
  description: 'Verify pointer and keyboard density controls.',
  targetDate: '2026-09-01',
  position: 100,
  progress: { policy: 'project-progress-v1', issueCount: 2, completedCount: 1, canceledCount: 0, eligibleCount: 2, fraction: 0.5 },
  archivedAt: null,
  revision: 2,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const milestoneB = {
  ...milestone,
  id: ids.milestoneB,
  name: 'Keyboard parity',
  description: 'Confirm every direct manipulation has a keyboard alternative.',
  targetDate: '2026-09-08',
  position: 200,
  progress: { policy: 'project-progress-v1', issueCount: 1, completedCount: 0, canceledCount: 0, eligibleCount: 1, fraction: 0 },
  revision: 1,
};
const milestoneC = {
  ...milestone,
  id: ids.milestoneC,
  name: 'Release rehearsal',
  description: 'Exercise reorder persistence and recovery before acceptance.',
  targetDate: '2026-09-15',
  position: 300,
  progress: { policy: 'project-progress-v1', issueCount: 0, completedCount: 0, canceledCount: 0, eligibleCount: 0, fraction: 0 },
  revision: 1,
};
const milestoneD = {
  ...milestone,
  id: ids.milestoneD,
  projectId: ids.projectD,
  name: 'Public release readiness',
  description: 'Verify cross-project board moves preserve assignment invariants.',
  targetDate: '2026-10-01',
  position: 100,
  progress: { policy: 'project-progress-v1', issueCount: 0, completedCount: 0, canceledCount: 0, eligibleCount: 0, fraction: 0 },
  revision: 1,
};
const milestoneArchived = {
  ...milestone,
  id: ids.milestoneArchived,
  projectId: ids.projectArchived,
  name: 'Legacy acceptance pass',
  description: 'Retained only as an assigned archived milestone.',
  targetDate: null,
  position: 100,
  progress: { policy: 'project-progress-v1', issueCount: 1, completedCount: 0, canceledCount: 0, eligibleCount: 1, fraction: 0 },
  archivedAt: timestamp,
  revision: 2,
};
let milestoneDragMilestones = [milestone, milestoneB, milestoneC];
let milestoneInlineEditMilestones = [
  { ...milestone },
  { ...milestoneB },
  {
    ...milestoneC,
    name: 'Archived release rehearsal',
    archivedAt: timestamp,
    revision: 2,
  },
];
const issue = (id, sequenceNumber, title, statusId, priority) => ({
  id,
  workspaceId: ids.workspace,
  teamId: ids.team,
  sequenceNumber,
  identifier: `QA-${sequenceNumber}`,
  title,
  descriptionDocument: {
    version: 1,
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Use the separator with pointer and arrow keys, then collapse the navigation rail.' }] }],
  },
  statusId,
  priority,
  assigneeUserId: ids.user,
  dueDate: sequenceNumber === 1 ? '2026-09-01' : '2026-09-15',
  projectId: ids.project,
  milestoneId: ids.milestone,
  labels: sequenceNumber === 1 ? [label] : [],
  resources: sequenceNumber === 1 ? [{
    id: ids.issueResource,
    label: 'Interaction review notes',
    url: 'https://example.test/interaction-review',
    position: 100,
  }] : [],
  archivedAt: null,
  revision: 3,
  createdAt: timestamp,
  updatedAt: timestamp,
});
const issues = [
  issue(ids.issueA, 1, 'Resize issue context without losing the list', ids.started, 'high'),
  issue(ids.issueB, 2, 'Collapse navigation into a stable icon rail', ids.completed, 'medium'),
];
let workflowStatusRetirementIssues = [
  { ...issues[0], statusId: ids.started },
  { ...issues[1], statusId: ids.started, archivedAt: timestamp, revision: 4 },
];
let commentInlineEditComments = [
  {
    id: ids.commentA,
    workspaceId: ids.workspace,
    issueId: ids.issueA,
    author: { id: ids.user, displayName: membership.displayName },
    bodyDocument: {
      version: 1,
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Keep the issue context visible while the comment is revised.' }],
      }],
    },
    archivedAt: null,
    revision: 4,
    createdAt: '2026-08-19T09:15:00.000Z',
    updatedAt: timestamp,
  },
  {
    id: ids.commentB,
    workspaceId: ids.workspace,
    issueId: ids.issueA,
    author: null,
    bodyDocument: {
      version: 1,
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Archived context remains in chronology order.' }] }],
    },
    archivedAt: timestamp,
    revision: 2,
    createdAt: '2026-08-19T10:30:00.000Z',
    updatedAt: timestamp,
  },
];
let issueBoardMoveIssues = issues.map((item) => ({ ...item }));
let issueBulkEditIssues = issues.map((item, index) => ({
  ...item,
  labels: index === 0 ? [...item.labels] : [labelB],
}));
let issueCreateIssues = issues.map((item) => ({ ...item }));
let issueInlinePropertyIssue = {
  ...issues[0],
  projectId: ids.projectArchived,
  milestoneId: ids.milestoneArchived,
  labels: [label, labelArchived],
};
const issueC = {
  ...issue(ids.issueC, 1, 'Keep team routes isolated during history navigation', ids.startedC, 'medium'),
  teamId: ids.teamC,
  identifier: 'ENG-1',
  statusId: ids.startedC,
  projectId: ids.projectC,
  milestoneId: null,
  labels: [],
  resources: [],
  revision: 1,
};
let issueRelationDirectionSequence = 24;
let issueRelationDirectionRelations = [{
  id: '72000000-0000-4000-8000-000000000023',
  workspaceId: ids.workspace,
  sourceIssueId: ids.issueC,
  targetIssueId: ids.issueA,
  type: 'blocks',
  revision: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
}];
const issueRelationDirectionIdempotency = new Map();
const savedViews = [
  {
    id: ids.savedViewA,
    workspaceId: ids.workspace,
    ownerUserId: ids.user,
    name: 'Engineering review',
    sharingScope: 'workspace',
    state: {
      version: 1,
      layout: 'board',
      groupBy: 'status',
      order: { field: 'updatedAt', direction: 'desc' },
      visibleProperties: ['priority', 'assignee', 'project'],
      density: 'compact',
      filter: {
        version: 1,
        root: { type: 'condition', field: 'teamId', operator: 'is', value: ids.teamC },
      },
      searchQuery: '',
      archiveState: 'active',
      collapsedGroups: [],
    },
    archivedAt: null,
    revision: 2,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: ids.savedViewB,
    workspaceId: ids.workspace,
    ownerUserId: ids.user,
    name: 'My high-priority queue',
    sharingScope: 'private',
    state: {
      version: 1,
      layout: 'list',
      groupBy: 'priority',
      order: { field: 'priority', direction: 'desc' },
      visibleProperties: ['priority', 'assignee', 'dueDate'],
      density: 'default',
      filter: {
        version: 1,
        root: { type: 'condition', field: 'priority', operator: 'in', value: ['urgent', 'high'] },
      },
      searchQuery: '',
      archiveState: 'active',
      collapsedGroups: [],
    },
    archivedAt: null,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];
const activities = [{
  id: 1,
  entityType: 'issue',
  entityId: ids.issueA,
  action: 'issue.updated',
  entityRevision: 3,
  actor: { id: ids.user, displayName: 'Jordan Lee' },
  fields: [{ field: 'priority', before: 'medium', after: 'high' }],
  createdAt: timestamp,
}];

function json(response, data, status = 200) {
  const body = JSON.stringify({ data });
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

function plainJson(response, data, status = 200) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

function apiError(response, code, message, status, details = {}) {
  const body = JSON.stringify({ error: { code, message, ...details } });
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

function fixtureName(request) {
  const referer = request.headers.referer;
  if (!referer) return null;
  try {
    return new URL(referer).searchParams.get('fixture');
  } catch {
    return null;
  }
}

function isWorkflowStatusFixture(request) {
  return ['workflow-status-inline-edit', 'workflow-status-reorder'].includes(fixtureName(request));
}

function issueFilterValue(node, field) {
  if (node === null || typeof node !== 'object') return null;
  if (node.type === 'condition') {
    return node.field === field && node.operator === 'is' && typeof node.value === 'string'
      ? node.value
      : null;
  }
  if (!Array.isArray(node.children)) return null;
  for (const child of node.children) {
    const value = issueFilterValue(child, field);
    if (value !== null) return value;
  }
  return null;
}

function issueRelationFixtureRecord(record, currentIssueId) {
  const sourceIsCurrent = record.sourceIssueId === currentIssueId;
  const otherIssueId = sourceIsCurrent ? record.targetIssueId : record.sourceIssueId;
  const otherIssue = [...issues, issueC].find((candidate) => candidate.id === otherIssueId);
  let direction = record.type;
  if (record.type === 'blocks') direction = sourceIsCurrent ? 'blocks' : 'blocked_by';
  if (record.type === 'duplicate') direction = sourceIsCurrent ? 'duplicate_of' : 'duplicates';
  if (record.type === 'parent') direction = sourceIsCurrent ? 'sub_issue' : 'parent';
  return {
    ...record,
    direction,
    otherIssue: {
      id: otherIssue.id,
      identifier: otherIssue.identifier,
      title: otherIssue.title,
      archivedAt: otherIssue.archivedAt,
    },
  };
}

function issueRelationFixtureWouldCycle(type, sourceIssueId, targetIssueId) {
  const adjacent = new Map();
  for (const relation of issueRelationDirectionRelations) {
    if (relation.type !== type) continue;
    const targets = adjacent.get(relation.sourceIssueId) ?? [];
    targets.push(relation.targetIssueId);
    adjacent.set(relation.sourceIssueId, targets);
  }
  const pending = [targetIssueId];
  const seen = new Set();
  while (pending.length > 0) {
    const currentIssueId = pending.pop();
    if (currentIssueId === sourceIssueId) return true;
    if (seen.has(currentIssueId)) continue;
    seen.add(currentIssueId);
    pending.push(...(adjacent.get(currentIssueId) ?? []));
  }
  return false;
}

function loadingFixtureDelay(request, path) {
  const fixture = fixtureName(request);
  if (fixture === 'issues-loading' && (path.endsWith('/issues/query') || path.endsWith('/projects'))) return 30_000;
  if (fixture === 'issue-detail-loading' && /\/issues\/[0-9a-f-]{36}$/i.test(path)) return 30_000;
  if (fixture === 'workspace-loading' && (path.endsWith('/teams') || path.endsWith('/memberships') || path.endsWith('/statuses'))) return 30_000;
  if (fixture === 'teams-loading' && path.endsWith('/teams')) return 30_000;
  if (fixture === 'members-loading' && path.endsWith('/memberships')) return 30_000;
  if (fixture === 'workflow-loading' && (path.endsWith('/teams') || path.endsWith('/statuses'))) return 30_000;
  if (fixture === 'project-detail-loading' && /\/projects\/[0-9a-f-]{36}$/i.test(path)) return 30_000;
  if (fixture === 'project-sections-loading' && (/\/projects\/[0-9a-f-]{36}\/milestones$/i.test(path) || /\/projects\/[0-9a-f-]{36}\/activity$/i.test(path))) return 30_000;
  if (fixture === 'issue-sections-loading' && /\/issues\/[0-9a-f-]{36}\/(relations|comments|activity)$/i.test(path)) return 30_000;
  return 0;
}

function apiResponse(request, response, url) {
  const path = url.pathname;
  const workflowStatusCollectionMatch = isWorkflowStatusFixture(request)
    ? path.match(/^\/api\/v1\/workspaces\/([0-9a-f-]{36})\/statuses$/i)
    : null;
  if (request.method === 'POST' && workflowStatusCollectionMatch) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Workflow status payload is not valid JSON.', 400);
        return;
      }
      if (workflowStatusCollectionMatch[1]?.toLowerCase() !== ids.workspace) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The workflow status collection is not in this workspace.', 404);
        return;
      }
      const replay = typeof input?.idempotencyKey === 'string'
        ? workflowStatusInlineEditIdempotency.get(input.idempotencyKey)
        : undefined;
      if (replay !== undefined) {
        json(response, replay, 201);
        return;
      }
      const name = typeof input?.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
      const color = typeof input?.color === 'string' ? input.color.trim().toUpperCase() : '';
      const categories = new Set(['backlog', 'unstarted', 'started', 'completed', 'canceled']);
      if (
        ![ids.team, ids.teamC].includes(input?.teamId)
        || name.length < 1
        || name.length > 80
        || !categories.has(input?.category)
        || !/^#[0-9A-F]{6}$/.test(color)
        || typeof input?.position !== 'number'
        || !Number.isFinite(input.position)
        || input.position < 0
        || typeof input?.idempotencyKey !== 'string'
        || input.idempotencyKey.length < 8
        || input.idempotencyKey.length > 128
      ) {
        apiError(response, 'VALIDATION_ERROR', 'The requested workflow status is invalid.', 422);
        return;
      }
      if (workflowStatusInlineEditStatuses.some((item) =>
        item.teamId === input.teamId && item.name === name)) {
        apiError(response, 'VALIDATION_ERROR', 'A workflow status with this name already exists for the team.', 422);
        return;
      }
      const created = {
        ...statuses[0],
        id: `40000000-0000-4000-8000-${String(workflowStatusInlineEditSequence).padStart(12, '0')}`,
        teamId: input.teamId,
        name,
        category: input.category,
        color,
        position: input.position,
        isDefault: false,
        revision: 1,
      };
      workflowStatusInlineEditSequence += 1;
      workflowStatusInlineEditStatuses.push(created);
      workflowStatusInlineEditIdempotency.set(input.idempotencyKey, created);
      json(response, created, 201);
    });
    return true;
  }
  const workflowStatusReorderMatch = request.method === 'POST'
    && fixtureName(request) === 'workflow-status-reorder'
    ? path.match(/^\/api\/v1\/workspaces\/([0-9a-f-]{36})\/teams\/([0-9a-f-]{36})\/statuses\/reorder$/i)
    : null;
  if (workflowStatusReorderMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Workflow status order is not valid JSON.', 400);
        return;
      }
      const requestedWorkspaceId = workflowStatusReorderMatch[1]?.toLowerCase();
      const requestedTeamId = workflowStatusReorderMatch[2]?.toLowerCase();
      if (requestedWorkspaceId !== ids.workspace || ![ids.team, ids.teamC].includes(requestedTeamId)) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The workflow status team is not in this fixture.', 404);
        return;
      }
      const items = Array.isArray(input?.items) ? input.items : [];
      const current = workflowStatusInlineEditStatuses
        .filter((status) => status.teamId === requestedTeamId)
        .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
      const byId = new Map(current.map((status) => [status.id, status]));
      const uniqueIds = new Set(items.map((item) => item?.id));
      if (
        items.length !== current.length
        || uniqueIds.size !== items.length
        || items.some((item) => typeof item?.id !== 'string' || !byId.has(item.id))
      ) {
        apiError(response, 'VALIDATION_ERROR', 'Order every workflow status in the team exactly once.', 400);
        return;
      }
      for (const item of items) {
        if (!Number.isSafeInteger(item?.expectedRevision) || item.expectedRevision < 1) {
          apiError(response, 'VALIDATION_ERROR', 'Choose a valid expected workflow status revision.', 400);
          return;
        }
        const status = byId.get(item.id);
        if (status !== undefined && status.revision !== item.expectedRevision) {
          apiError(response, 'CONFLICT', 'A workflow status changed. Refresh and try again.', 409, {
            currentRevision: status.revision,
          });
          return;
        }
      }
      if (items.every((item, index) => item.id === current[index]?.id)) {
        apiError(response, 'VALIDATION_ERROR', 'Workflow status order is unchanged.', 400);
        return;
      }
      const nextPositions = new Map(items.map((item, index) => [item.id, (index + 1) * 100]));
      workflowStatusInlineEditStatuses = workflowStatusInlineEditStatuses.map((status) => {
        if (status.teamId !== requestedTeamId) return status;
        const position = nextPositions.get(status.id);
        if (position === undefined || position === status.position) return status;
        return { ...status, position, revision: status.revision + 1, updatedAt: timestamp };
      });
      const ordered = workflowStatusInlineEditStatuses
        .filter((status) => status.teamId === requestedTeamId)
        .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
      json(response, ordered);
    });
    return true;
  }
  const workflowStatusRetirementMatch = request.method === 'POST'
    && fixtureName(request) === 'workflow-status-retire'
    ? path.match(/^\/api\/v1\/workspaces\/([0-9a-f-]{36})\/statuses\/([0-9a-f-]{36})\/retire$/i)
    : null;
  if (workflowStatusRetirementMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Workflow status retirement is not valid JSON.', 400);
        return;
      }
      const requestedWorkspaceId = workflowStatusRetirementMatch[1]?.toLowerCase();
      const sourceId = workflowStatusRetirementMatch[2]?.toLowerCase();
      if (requestedWorkspaceId !== ids.workspace) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The workflow status is not in this workspace.', 404);
        return;
      }
      const source = workflowStatusRetirementStatuses.find((status) => status.id === sourceId);
      if (source === undefined) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The workflow status is not in this fixture.', 404);
        return;
      }
      const teamStatuses = workflowStatusRetirementStatuses
        .filter((status) => status.teamId === source.teamId)
        .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
      if (teamStatuses.length <= 1) {
        apiError(response, 'VALIDATION_ERROR', 'A team must keep at least one workflow status.', 400);
        return;
      }
      if (input?.replacementStatusId === source.id) {
        apiError(response, 'VALIDATION_ERROR', 'Choose a different replacement status.', 400);
        return;
      }
      const replacement = teamStatuses.find((status) => status.id === input?.replacementStatusId);
      if (replacement === undefined) {
        apiError(response, 'VALIDATION_ERROR', 'Choose a replacement status from the same team.', 400);
        return;
      }
      if (
        !Number.isSafeInteger(input?.expectedRevision)
        || input.expectedRevision < 1
        || !Number.isSafeInteger(input?.replacementExpectedRevision)
        || input.replacementExpectedRevision < 1
      ) {
        apiError(response, 'VALIDATION_ERROR', 'Choose valid workflow status revisions.', 400);
        return;
      }
      if (input.expectedRevision !== source.revision) {
        apiError(response, 'CONFLICT', 'This status changed. Refresh and try again.', 409, {
          currentRevision: source.revision,
        });
        return;
      }
      if (input.replacementExpectedRevision !== replacement.revision) {
        apiError(response, 'CONFLICT', 'The replacement status changed. Refresh and try again.', 409, {
          currentRevision: replacement.revision,
        });
        return;
      }
      let reassignedIssueCount = 0;
      workflowStatusRetirementIssues = workflowStatusRetirementIssues.map((current) => {
        if (
          current.workspaceId !== requestedWorkspaceId
          || current.teamId !== source.teamId
          || current.statusId !== source.id
        ) return current;
        reassignedIssueCount += 1;
        return {
          ...current,
          statusId: replacement.id,
          revision: current.revision + 1,
          updatedAt: timestamp,
        };
      });
      workflowStatusRetirementStatuses = workflowStatusRetirementStatuses
        .filter((status) => status.id !== source.id);
      const remaining = workflowStatusRetirementStatuses
        .filter((status) => status.teamId === source.teamId)
        .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
      json(response, {
        retiredStatusId: source.id,
        replacementStatusId: replacement.id,
        reassignedIssueCount,
        statuses: remaining,
      });
    });
    return true;
  }
  const workflowStatusInlineEditMatch = request.method === 'PATCH'
    && isWorkflowStatusFixture(request)
    ? path.match(/\/workspaces\/([0-9a-f-]{36})\/statuses\/([0-9a-f-]{36})$/i)
    : null;
  if (workflowStatusInlineEditMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Workflow status payload is not valid JSON.', 400);
        return;
      }
      const requestedWorkspaceId = workflowStatusInlineEditMatch[1]?.toLowerCase();
      const statusId = workflowStatusInlineEditMatch[2]?.toLowerCase();
      if (requestedWorkspaceId !== ids.workspace) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The workflow status is not in this workspace.', 404);
        return;
      }
      const currentIndex = workflowStatusInlineEditStatuses.findIndex((item) => item.id === statusId);
      const current = workflowStatusInlineEditStatuses[currentIndex];
      if (current === undefined) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The workflow status is not in this fixture.', 404);
        return;
      }
      if (!Number.isSafeInteger(input?.expectedRevision) || input.expectedRevision < 1) {
        apiError(response, 'VALIDATION_ERROR', 'Choose a valid expected workflow status revision.', 422);
        return;
      }
      if (input.expectedRevision !== current.revision) {
        apiError(response, 'CONFLICT', 'This workflow status changed. Refresh and try again.', 409, {
          currentRevision: current.revision,
        });
        return;
      }
      const fields = Object.keys(input ?? {}).filter((field) => field !== 'expectedRevision').sort();
      const supportedFields = new Set(['name', 'category', 'color', 'position']);
      if (fields.length < 1 || fields.some((field) => !supportedFields.has(field))) {
        apiError(response, 'VALIDATION_ERROR', 'Submit at least one supported workflow status change.', 422);
        return;
      }
      const next = { ...current };
      if (fields.includes('name')) {
        next.name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
      }
      if (fields.includes('category')) next.category = input.category;
      if (fields.includes('color')) {
        next.color = typeof input.color === 'string' ? input.color.trim().toUpperCase() : '';
      }
      if (fields.includes('position')) next.position = input.position;
      const categories = new Set(['backlog', 'unstarted', 'started', 'completed', 'canceled']);
      if (
        next.name.length < 1
        || next.name.length > 80
        || !categories.has(next.category)
        || !/^#[0-9A-F]{6}$/.test(next.color)
        || typeof next.position !== 'number'
        || !Number.isFinite(next.position)
        || next.position < 0
      ) {
        apiError(response, 'VALIDATION_ERROR', 'The requested workflow status values are invalid.', 422);
        return;
      }
      if (workflowStatusInlineEditStatuses.some((item, index) =>
        index !== currentIndex && item.teamId === current.teamId && item.name === next.name)) {
        apiError(response, 'VALIDATION_ERROR', 'A workflow status with this name already exists for the team.', 422);
        return;
      }
      if (
        next.name === current.name
        && next.category === current.category
        && next.color === current.color
        && next.position === current.position
      ) {
        apiError(response, 'VALIDATION_ERROR', 'No workflow status changes to save.', 422);
        return;
      }
      workflowStatusInlineEditStatuses[currentIndex] = {
        ...next,
        revision: current.revision + 1,
        updatedAt: timestamp,
      };
      json(response, workflowStatusInlineEditStatuses[currentIndex]);
    });
    return true;
  }
  const labelCollectionMatch = fixtureName(request) === 'label-inline-edit'
    ? path.match(/^\/api\/v1\/workspaces\/([0-9a-f-]{36})\/labels$/i)
    : null;
  if (request.method === 'POST' && labelCollectionMatch) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Label payload is not valid JSON.', 400);
        return;
      }
      if (labelCollectionMatch[1]?.toLowerCase() !== ids.workspace) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The label collection is not in this workspace.', 404);
        return;
      }
      const replay = typeof input?.idempotencyKey === 'string'
        ? labelInlineEditIdempotency.get(input.idempotencyKey)
        : undefined;
      if (replay !== undefined) {
        json(response, replay, 201);
        return;
      }
      const name = typeof input?.name === 'string' ? input.name.trim().replace(/\r\n?/g, '\n') : '';
      const color = typeof input?.color === 'string' ? input.color.trim().toUpperCase() : '';
      if (
        name.length < 1
        || name.length > 60
        || !/^#[0-9A-F]{6}$/.test(color)
        || typeof input?.idempotencyKey !== 'string'
        || input.idempotencyKey.length < 8
      ) {
        apiError(response, 'VALIDATION_ERROR', 'The requested label is invalid.', 422);
        return;
      }
      if (labelInlineEditLabels.some((item) =>
        item.archivedAt === null && item.name.toLowerCase() === name.toLowerCase())) {
        apiError(response, 'VALIDATION_ERROR', 'A label with this name already exists.', 422);
        return;
      }
      const created = {
        ...label,
        id: `60000000-0000-4000-8000-${String(labelInlineEditSequence).padStart(12, '0')}`,
        name,
        color,
      };
      labelInlineEditSequence += 1;
      labelInlineEditLabels.push(created);
      labelInlineEditIdempotency.set(input.idempotencyKey, created);
      json(response, created, 201);
    });
    return true;
  }
  const labelInlineEditMatch = request.method === 'PATCH'
    && fixtureName(request) === 'label-inline-edit'
    ? path.match(/\/workspaces\/([0-9a-f-]{36})\/labels\/([0-9a-f-]{36})$/i)
    : null;
  if (labelInlineEditMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Label payload is not valid JSON.', 400);
        return;
      }
      const requestedWorkspaceId = labelInlineEditMatch[1]?.toLowerCase();
      const labelId = labelInlineEditMatch[2]?.toLowerCase();
      if (requestedWorkspaceId !== ids.workspace) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The label is not in this workspace.', 404);
        return;
      }
      const currentIndex = labelInlineEditLabels.findIndex((item) => item.id === labelId);
      const current = labelInlineEditLabels[currentIndex];
      if (current === undefined) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The label is not in this fixture.', 404);
        return;
      }
      if (input?.expectedRevision !== current.revision) {
        apiError(response, 'CONFLICT', 'This label changed. Refresh and try again.', 409, {
          currentRevision: current.revision,
        });
        return;
      }
      if (current.archivedAt !== null) {
        apiError(response, 'CONFLICT', 'Restore this label before editing it.', 409, {
          currentRevision: current.revision,
        });
        return;
      }
      const fields = Object.keys(input ?? {}).filter((field) => field !== 'expectedRevision').sort();
      const supportedFields = new Set(['name', 'color']);
      if (fields.length < 1 || fields.some((field) => !supportedFields.has(field))) {
        apiError(response, 'VALIDATION_ERROR', 'Submit at least one supported label change.', 422);
        return;
      }
      const next = { ...current };
      if (fields.includes('name')) {
        next.name = typeof input.name === 'string' ? input.name.trim().replace(/\r\n?/g, '\n') : '';
      }
      if (fields.includes('color')) {
        next.color = typeof input.color === 'string' ? input.color.trim().toUpperCase() : '';
      }
      if (
        next.name.length < 1
        || next.name.length > 60
        || !/^#[0-9A-F]{6}$/.test(next.color)
      ) {
        apiError(response, 'VALIDATION_ERROR', 'The requested label values are invalid.', 422);
        return;
      }
      if (labelInlineEditLabels.some((item, index) =>
        index !== currentIndex
        && item.archivedAt === null
        && item.name.toLowerCase() === next.name.toLowerCase())) {
        apiError(response, 'VALIDATION_ERROR', 'A label with this name already exists.', 422);
        return;
      }
      if (next.name === current.name && next.color === current.color) {
        apiError(response, 'VALIDATION_ERROR', 'No label changes to save.', 422);
        return;
      }
      labelInlineEditLabels[currentIndex] = {
        ...next,
        revision: current.revision + 1,
        updatedAt: timestamp,
      };
      json(response, labelInlineEditLabels[currentIndex]);
    });
    return true;
  }
  const labelArchiveMatch = request.method === 'POST'
    && fixtureName(request) === 'label-inline-edit'
    ? path.match(/\/workspaces\/([0-9a-f-]{36})\/labels\/([0-9a-f-]{36})\/(archive|restore)$/i)
    : null;
  if (labelArchiveMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Label archive payload is not valid JSON.', 400);
        return;
      }
      const requestedWorkspaceId = labelArchiveMatch[1]?.toLowerCase();
      const labelId = labelArchiveMatch[2]?.toLowerCase();
      const action = labelArchiveMatch[3]?.toLowerCase();
      if (requestedWorkspaceId !== ids.workspace) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The label is not in this workspace.', 404);
        return;
      }
      const currentIndex = labelInlineEditLabels.findIndex((item) => item.id === labelId);
      const current = labelInlineEditLabels[currentIndex];
      if (current === undefined) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The label is not in this fixture.', 404);
        return;
      }
      if (input?.expectedRevision !== current.revision) {
        apiError(response, 'CONFLICT', 'This label changed. Refresh and try again.', 409, {
          currentRevision: current.revision,
        });
        return;
      }
      if ((action === 'archive' && current.archivedAt !== null)
        || (action === 'restore' && current.archivedAt === null)) {
        apiError(response, 'VALIDATION_ERROR', `Label is already ${action === 'archive' ? 'archived' : 'active'}.`, 422);
        return;
      }
      if (action === 'restore' && labelInlineEditLabels.some((item, index) =>
        index !== currentIndex
        && item.archivedAt === null
        && item.name.toLowerCase() === current.name.toLowerCase())) {
        apiError(response, 'VALIDATION_ERROR', 'An active label with this name already exists.', 422);
        return;
      }
      labelInlineEditLabels[currentIndex] = {
        ...current,
        archivedAt: action === 'archive' ? timestamp : null,
        revision: current.revision + 1,
        updatedAt: timestamp,
      };
      json(response, labelInlineEditLabels[currentIndex]);
    });
    return true;
  }
  const issueRelationCreateMatch = request.method === 'POST'
    && fixtureName(request) === 'issue-relation-directions'
    ? path.match(/\/issues\/([0-9a-f-]{36})\/relations$/i)
    : null;
  if (issueRelationCreateMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Relation payload is not valid JSON.', 400);
        return;
      }
      const sourceIssueId = issueRelationCreateMatch[1]?.toLowerCase();
      const targetIssueId = typeof input?.targetIssueId === 'string'
        ? input.targetIssueId.toLowerCase()
        : '';
      const availableIssues = [...issues, issueC];
      const sourceIssue = availableIssues.find((candidate) => candidate.id === sourceIssueId);
      const targetIssue = availableIssues.find((candidate) => candidate.id === targetIssueId);
      const validTypes = new Set(['blocks', 'related', 'duplicate', 'parent']);
      if (sourceIssue === undefined || targetIssue === undefined) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The relation endpoint is not in this fixture.', 404);
        return;
      }
      if (sourceIssue.id === targetIssue.id) {
        apiError(response, 'VALIDATION_ERROR', 'An issue cannot relate to itself.', 422);
        return;
      }
      if (!validTypes.has(input?.type)
        || typeof input?.idempotencyKey !== 'string'
        || input.idempotencyKey.length < 8) {
        apiError(response, 'VALIDATION_ERROR', 'Choose a valid relation type and idempotency key.', 422);
        return;
      }
      const replay = issueRelationDirectionIdempotency.get(input.idempotencyKey);
      if (replay !== undefined) {
        json(response, issueRelationFixtureRecord(replay, sourceIssue.id), 201);
        return;
      }
      let canonicalSourceId = sourceIssue.id;
      let canonicalTargetId = targetIssue.id;
      if (input.type === 'related' && canonicalSourceId > canonicalTargetId) {
        [canonicalSourceId, canonicalTargetId] = [canonicalTargetId, canonicalSourceId];
      }
      if (issueRelationDirectionRelations.some((relation) =>
        relation.type === input.type
        && relation.sourceIssueId === canonicalSourceId
        && relation.targetIssueId === canonicalTargetId)) {
        apiError(response, 'VALIDATION_ERROR', 'This relation already exists.', 422);
        return;
      }
      if (input.type === 'parent' && issueRelationDirectionRelations.some((relation) =>
        relation.type === 'parent' && relation.targetIssueId === canonicalTargetId)) {
        apiError(response, 'VALIDATION_ERROR', 'This issue already has a parent.', 422);
        return;
      }
      if (input.type !== 'related' && issueRelationFixtureWouldCycle(
        input.type,
        canonicalSourceId,
        canonicalTargetId,
      )) {
        apiError(response, 'VALIDATION_ERROR', `This ${input.type} relation would create a cycle.`, 422);
        return;
      }
      const record = {
        id: `72000000-0000-4000-8000-${String(issueRelationDirectionSequence).padStart(12, '0')}`,
        workspaceId: ids.workspace,
        sourceIssueId: canonicalSourceId,
        targetIssueId: canonicalTargetId,
        type: input.type,
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      issueRelationDirectionSequence += 1;
      issueRelationDirectionRelations.push(record);
      issueRelationDirectionIdempotency.set(input.idempotencyKey, record);
      json(response, issueRelationFixtureRecord(record, sourceIssue.id), 201);
    });
    return true;
  }
  const issueRelationDeleteMatch = request.method === 'DELETE'
    && fixtureName(request) === 'issue-relation-directions'
    ? path.match(/\/issues\/([0-9a-f-]{36})\/relations\/([0-9a-f-]{36})$/i)
    : null;
  if (issueRelationDeleteMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Relation removal payload is not valid JSON.', 400);
        return;
      }
      const currentIssueId = issueRelationDeleteMatch[1]?.toLowerCase();
      const relationId = issueRelationDeleteMatch[2]?.toLowerCase();
      const index = issueRelationDirectionRelations.findIndex((relation) =>
        relation.id === relationId
        && (relation.sourceIssueId === currentIssueId || relation.targetIssueId === currentIssueId));
      const relation = issueRelationDirectionRelations[index];
      if (relation === undefined) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The relation is not in this fixture.', 404);
        return;
      }
      if (input?.expectedRevision !== relation.revision) {
        apiError(response, 'CONFLICT', 'This relation changed. Refresh and try again.', 409, {
          currentRevision: relation.revision,
        });
        return;
      }
      issueRelationDirectionRelations.splice(index, 1);
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
    });
    return true;
  }
  if (request.method === 'POST'
    && path.endsWith(`/projects/${ids.project}/milestones/reorder`)
    && fixtureName(request) === 'milestone-drag') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Milestone reorder payload is not valid JSON.', 400);
        return;
      }
      const currentById = new Map(milestoneDragMilestones.map((item) => [item.id, item]));
      const items = Array.isArray(input?.items) ? input.items : [];
      const idsInRequest = items.map((item) => item?.id);
      const valid = items.length === milestoneDragMilestones.length
        && new Set(idsInRequest).size === milestoneDragMilestones.length
        && items.every((item) => {
          const current = currentById.get(item?.id);
          return current !== undefined && item?.expectedRevision === current.revision;
        });
      if (!valid) {
        apiError(response, 'REVISION_CONFLICT', 'Milestone order changed. Refresh and try again.', 409);
        return;
      }
      milestoneDragMilestones = items.map((item, index) => {
        const current = currentById.get(item.id);
        const position = (index + 1) * 100;
        return {
          ...current,
          position,
          revision: current.revision + Number(current.position !== position),
          updatedAt: timestamp,
        };
      });
      json(response, milestoneDragMilestones);
    });
    return true;
  }
  const commentInlineEditMatch = request.method === 'PATCH'
    && fixtureName(request) === 'comment-inline-edit'
    ? path.match(/\/issues\/([0-9a-f-]{36})\/comments\/([0-9a-f-]{36})$/i)
    : null;
  if (commentInlineEditMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Comment payload is not valid JSON.', 400);
        return;
      }
      const requestedIssueId = commentInlineEditMatch[1]?.toLowerCase();
      const requestedCommentId = commentInlineEditMatch[2]?.toLowerCase();
      const currentIndex = commentInlineEditComments.findIndex((comment) =>
        comment.id === requestedCommentId && comment.issueId === requestedIssueId);
      const current = commentInlineEditComments[currentIndex];
      if (requestedIssueId !== ids.issueA || current === undefined) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The comment is not in this fixture.', 404);
        return;
      }
      if (input?.expectedRevision !== current.revision) {
        apiError(response, 'CONFLICT', 'This comment changed. Refresh and try again.', 409, {
          currentRevision: current.revision,
        });
        return;
      }
      if (current.archivedAt !== null) {
        apiError(response, 'CONFLICT', 'Restore this comment before editing it.', 409, {
          currentRevision: current.revision,
        });
        return;
      }
      const fields = Object.keys(input ?? {}).sort();
      const document = input?.bodyDocument;
      const textValues = [];
      const visit = (node) => {
        if (node !== null && typeof node === 'object') {
          if (node.type === 'text' && typeof node.text === 'string') textValues.push(node.text);
          if (Array.isArray(node.content)) node.content.forEach(visit);
        }
      };
      if (document !== null && typeof document === 'object' && Array.isArray(document.content)) {
        document.content.forEach(visit);
      }
      const validDocument = fields.length === 2
        && fields[0] === 'bodyDocument'
        && fields[1] === 'expectedRevision'
        && document?.version === 1
        && document?.type === 'doc'
        && Array.isArray(document.content)
        && textValues.join(' ').trim().length > 0;
      if (!validDocument) {
        apiError(response, 'VALIDATION_ERROR', 'Comment cannot be empty or invalid.', 422);
        return;
      }
      if (JSON.stringify(document) === JSON.stringify(current.bodyDocument)) {
        apiError(response, 'VALIDATION_ERROR', 'Change the comment before saving.', 422);
        return;
      }
      commentInlineEditComments[currentIndex] = {
        ...current,
        bodyDocument: document,
        revision: current.revision + 1,
        updatedAt: timestamp,
      };
      json(response, commentInlineEditComments[currentIndex]);
    });
    return true;
  }
  const commentArchiveMatch = request.method === 'POST'
    && fixtureName(request) === 'comment-inline-edit'
    ? path.match(/\/issues\/([0-9a-f-]{36})\/comments\/([0-9a-f-]{36})\/(archive|restore)$/i)
    : null;
  if (commentArchiveMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Comment archive payload is not valid JSON.', 400);
        return;
      }
      const requestedIssueId = commentArchiveMatch[1]?.toLowerCase();
      const requestedCommentId = commentArchiveMatch[2]?.toLowerCase();
      const action = commentArchiveMatch[3]?.toLowerCase();
      const currentIndex = commentInlineEditComments.findIndex((comment) =>
        comment.id === requestedCommentId && comment.issueId === requestedIssueId);
      const current = commentInlineEditComments[currentIndex];
      if (requestedIssueId !== ids.issueA || current === undefined) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The comment is not in this fixture.', 404);
        return;
      }
      if (input?.expectedRevision !== current.revision) {
        apiError(response, 'CONFLICT', 'This comment changed. Refresh and try again.', 409, {
          currentRevision: current.revision,
        });
        return;
      }
      if ((action === 'archive' && current.archivedAt !== null)
        || (action === 'restore' && current.archivedAt === null)) {
        apiError(response, 'VALIDATION_ERROR', `Comment is already ${action === 'archive' ? 'archived' : 'active'}.`, 422);
        return;
      }
      commentInlineEditComments[currentIndex] = {
        ...current,
        archivedAt: action === 'archive' ? timestamp : null,
        revision: current.revision + 1,
        updatedAt: timestamp,
      };
      json(response, commentInlineEditComments[currentIndex]);
    });
    return true;
  }
  const milestoneInlineEditMatch = request.method === 'PATCH'
    && fixtureName(request) === 'milestone-inline-edit'
    ? path.match(/\/projects\/([0-9a-f-]{36})\/milestones\/([0-9a-f-]{36})$/i)
    : null;
  if (milestoneInlineEditMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Milestone payload is not valid JSON.', 400);
        return;
      }
      const requestedProjectId = milestoneInlineEditMatch[1]?.toLowerCase();
      const requestedMilestoneId = milestoneInlineEditMatch[2]?.toLowerCase();
      const currentIndex = milestoneInlineEditMilestones.findIndex((item) =>
        item.id === requestedMilestoneId && item.projectId === requestedProjectId);
      const current = milestoneInlineEditMilestones[currentIndex];
      if (requestedProjectId !== ids.project || current === undefined) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The milestone is not in this fixture.', 404);
        return;
      }
      if (input?.expectedRevision !== current.revision) {
        apiError(response, 'CONFLICT', 'Milestone changed. Refresh and try again.', 409, {
          currentRevision: current.revision,
        });
        return;
      }
      if (current.archivedAt !== null) {
        apiError(response, 'CONFLICT', 'Restore this milestone before editing it.', 409, {
          currentRevision: current.revision,
        });
        return;
      }
      const fields = Object.keys(input ?? {}).filter((field) => field !== 'expectedRevision').sort();
      const supportedFields = new Set(['name', 'description', 'targetDate']);
      if (fields.length < 1 || fields.some((field) => !supportedFields.has(field))) {
        apiError(response, 'VALIDATION_ERROR', 'Submit at least one supported milestone change.', 422);
        return;
      }

      const next = { ...current };
      if (fields.includes('name')) {
        next.name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
      }
      if (fields.includes('description')) {
        next.description = typeof input.description === 'string'
          ? input.description.trim().replace(/\r\n?/g, '\n')
          : '';
      }
      if (fields.includes('targetDate')) next.targetDate = input.targetDate;
      const validDate = (value) => {
        if (value === null) return true;
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const parsed = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
      };
      if (
        next.name.length < 1
        || next.name.length > 80
        || next.description.length > 4000
        || !validDate(next.targetDate)
      ) {
        apiError(response, 'VALIDATION_ERROR', 'The requested milestone content is invalid.', 422);
        return;
      }
      if (
        next.name === current.name
        && next.description === current.description
        && next.targetDate === current.targetDate
      ) {
        apiError(response, 'VALIDATION_ERROR', 'No milestone changes to save.', 422);
        return;
      }
      milestoneInlineEditMilestones[currentIndex] = {
        ...next,
        revision: current.revision + 1,
        updatedAt: timestamp,
      };
      json(response, milestoneInlineEditMilestones[currentIndex]);
    });
    return true;
  }
  const projectInlineEditMatch = request.method === 'PATCH'
    && fixtureName(request) === 'project-inline-edit'
    ? path.match(/\/projects\/([0-9a-f-]{36})$/i)
    : null;
  if (projectInlineEditMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Project payload is not valid JSON.', 400);
        return;
      }
      const requestedProjectId = projectInlineEditMatch[1]?.toLowerCase();
      const current = projectInlineEditProject;
      if (requestedProjectId !== current.id) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The project is not in this fixture.', 404);
        return;
      }
      if (input?.expectedRevision !== current.revision) {
        apiError(response, 'CONFLICT', 'Project changed. Refresh and try again.', 409, {
          currentRevision: current.revision,
        });
        return;
      }
      const fields = Object.keys(input ?? {}).filter((field) => field !== 'expectedRevision').sort();
      const propertyFields = new Set(['status', 'priority', 'leadUserId', 'startDate', 'targetDate']);
      const contentFields = new Set(['name', 'summary', 'icon', 'color', 'overviewDocument', 'resources']);
      const validShape = fields.length === 1 && propertyFields.has(fields[0])
        || fields.length > 0 && fields.every((field) => contentFields.has(field));
      if (!validShape) {
        apiError(response, 'VALIDATION_ERROR', 'Submit one project property or a supported content patch.', 422);
        return;
      }

      const next = { ...current };
      if (fields.includes('status')) next.status = input.status;
      if (fields.includes('priority')) next.priority = input.priority;
      if (fields.includes('leadUserId')) next.leadUserId = input.leadUserId;
      if (fields.includes('startDate')) next.startDate = input.startDate;
      if (fields.includes('targetDate')) next.targetDate = input.targetDate;
      const validDate = (value) => {
        if (value === null) return true;
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const parsed = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
      };
      const propertyValid = ['planned', 'in_progress', 'paused', 'completed', 'canceled'].includes(next.status)
        && ['none', 'urgent', 'high', 'medium', 'low'].includes(next.priority)
        && (next.leadUserId === null || next.leadUserId === ids.user)
        && validDate(next.startDate)
        && validDate(next.targetDate)
        && (next.startDate === null || next.targetDate === null || next.startDate <= next.targetDate);
      if (!propertyValid) {
        apiError(response, 'VALIDATION_ERROR', 'The requested project property is invalid.', 422);
        return;
      }

      if (fields.includes('name')) {
        next.name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
      }
      if (fields.includes('summary')) {
        next.summary = typeof input.summary === 'string'
          ? input.summary.trim().replace(/\r\n?/g, '\n')
          : '';
      }
      if (fields.includes('icon')) next.icon = input.icon;
      if (fields.includes('color')) {
        next.color = typeof input.color === 'string' ? input.color.trim().toUpperCase() : '';
      }
      if (fields.includes('overviewDocument')) next.overviewDocument = input.overviewDocument;
      if (fields.includes('resources')) {
        const resources = Array.isArray(input.resources) ? input.resources : [];
        const normalized = [];
        for (const resource of resources) {
          const label = typeof resource?.label === 'string' ? resource.label.trim() : '';
          const text = typeof resource?.url === 'string' ? resource.url.trim() : '';
          try {
            const parsed = new URL(text);
            if (label.length < 1 || label.length > 120 || text.length > 2048
              || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
              || parsed.username !== '' || parsed.password !== '') throw new Error('invalid resource');
            normalized.push({ label, url: parsed.toString() });
          } catch {
            apiError(response, 'VALIDATION_ERROR', 'The requested project resource is invalid.', 422);
            return;
          }
        }
        if (normalized.length > 50) {
          apiError(response, 'VALIDATION_ERROR', 'A project can have at most 50 resources.', 422);
          return;
        }
        next.resources = normalized.map((resource, index) => ({
          id: `51000000-0000-4000-8000-${String(index + 24).padStart(12, '0')}`,
          ...resource,
          position: (index + 1) * 100,
        }));
      }
      const contentValid = next.name.length >= 1 && next.name.length <= 80
        && next.summary.length <= 280
        && ['briefcase', 'layers', 'target', 'compass', 'rocket'].includes(next.icon)
        && /^#[0-9A-F]{6}$/.test(next.color)
        && next.overviewDocument?.version === 1
        && next.overviewDocument?.type === 'doc'
        && Array.isArray(next.overviewDocument?.content);
      if (!contentValid) {
        apiError(response, 'VALIDATION_ERROR', 'The requested project content is invalid.', 422);
        return;
      }
      const comparable = (value) => ({
        ...value,
        resources: value.resources.map(({ label, url }) => ({ label, url })),
        revision: 0,
        updatedAt: '',
      });
      if (JSON.stringify(comparable(next)) === JSON.stringify(comparable(current))) {
        apiError(response, 'VALIDATION_ERROR', 'No project changes to save.', 400);
        return;
      }
      projectInlineEditProject = {
        ...next,
        revision: current.revision + 1,
        updatedAt: timestamp,
      };
      json(response, projectInlineEditProject);
    });
    return true;
  }
  const issueInlinePropertyMatch = request.method === 'PATCH'
    && fixtureName(request) === 'issue-inline-properties'
    ? path.match(/\/issues\/([0-9a-f-]{36})$/i)
    : null;
  if (issueInlinePropertyMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Issue property payload is not valid JSON.', 400);
        return;
      }
      const requestedIssueId = issueInlinePropertyMatch[1]?.toLowerCase();
      const current = issueInlinePropertyIssue;
      if (requestedIssueId !== current.id) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The issue is not in this fixture.', 404);
        return;
      }
      if (input?.expectedRevision !== current.revision) {
        apiError(response, 'CONFLICT', 'Issue changed. Refresh and try again.', 409, {
          currentRevision: current.revision,
        });
        return;
      }
      const fields = Object.keys(input ?? {}).filter((field) => field !== 'expectedRevision').sort();
      const singleFields = new Set([
        'statusId',
        'priority',
        'assigneeUserId',
        'dueDate',
        'milestoneId',
        'labelIds',
      ]);
      const validShape = fields.length === 1 && singleFields.has(fields[0])
        || fields.length === 2
          && fields[0] === 'milestoneId'
          && fields[1] === 'projectId'
          && input.milestoneId === null;
      if (!validShape) {
        apiError(response, 'VALIDATION_ERROR', 'Submit exactly one inline issue property.', 422);
        return;
      }

      const availableProjects = [project, projectD, projectArchived];
      const availableMilestones = [milestone, milestoneD, milestoneArchived];
      const availableLabels = [label, labelB, labelC, labelArchived];
      const projectChanged = fields.includes('projectId');
      const milestoneChanged = fields.includes('milestoneId');
      const nextProjectId = projectChanged ? input.projectId : current.projectId;
      const nextMilestoneId = milestoneChanged ? input.milestoneId : current.milestoneId;
      const nextStatusId = fields[0] === 'statusId' ? input.statusId : current.statusId;
      const nextPriority = fields[0] === 'priority' ? input.priority : current.priority;
      const nextAssigneeUserId = fields[0] === 'assigneeUserId'
        ? input.assigneeUserId
        : current.assigneeUserId;
      const nextDueDate = fields[0] === 'dueDate' ? input.dueDate : current.dueDate;
      const currentLabelIds = current.labels.map((item) => item.id);
      const nextLabelIds = fields[0] === 'labelIds' ? input.labelIds : currentLabelIds;
      const parsedDate = typeof nextDueDate === 'string'
        ? new Date(`${nextDueDate}T00:00:00.000Z`)
        : null;
      const validDate = nextDueDate === null || (
        /^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)
        && !Number.isNaN(parsedDate.valueOf())
        && parsedDate.toISOString().slice(0, 10) === nextDueDate
      );
      const targetProject = nextProjectId === null
        ? null
        : availableProjects.find((item) => item.id === nextProjectId && item.teamId === current.teamId);
      const targetMilestone = nextMilestoneId === null
        ? null
        : availableMilestones.find((item) =>
          item.id === nextMilestoneId && item.projectId === nextProjectId);
      const labelsValid = Array.isArray(nextLabelIds)
        && nextLabelIds.length <= 50
        && new Set(nextLabelIds).size === nextLabelIds.length
        && nextLabelIds.every((labelId) => {
          const candidate = availableLabels.find((item) => item.id === labelId);
          return candidate !== undefined
            && (candidate.archivedAt === null || currentLabelIds.includes(candidate.id));
        });
      const assignmentValid = statuses.some((item) =>
        item.id === nextStatusId && item.teamId === current.teamId)
        && ['none', 'urgent', 'high', 'medium', 'low'].includes(nextPriority)
        && (nextAssigneeUserId === null || nextAssigneeUserId === membership.userId)
        && validDate
        && labelsValid
        && (nextProjectId === null
          ? nextMilestoneId === null
          : targetProject !== undefined
            && (!projectChanged || targetProject.archivedAt === null))
        && (nextMilestoneId === null
          || targetMilestone !== undefined
            && (!milestoneChanged || targetMilestone.archivedAt === null));
      if (!assignmentValid) {
        apiError(response, 'INVALID_ASSIGNMENT', 'The requested inline property is not valid for this issue.', 422);
        return;
      }
      const next = {
        ...current,
        statusId: nextStatusId,
        priority: nextPriority,
        assigneeUserId: nextAssigneeUserId,
        dueDate: nextDueDate,
        projectId: nextProjectId,
        milestoneId: nextMilestoneId,
        labels: nextLabelIds.map((labelId) => availableLabels.find((item) => item.id === labelId)),
      };
      const changed = ['statusId', 'priority', 'assigneeUserId', 'dueDate', 'projectId', 'milestoneId']
        .some((field) => next[field] !== current[field])
        || nextLabelIds.length !== currentLabelIds.length
        || nextLabelIds.some((labelId, index) => labelId !== currentLabelIds[index]);
      if (!changed) {
        apiError(response, 'VALIDATION_ERROR', 'Change at least one issue property.', 422);
        return;
      }
      issueInlinePropertyIssue = {
        ...next,
        revision: current.revision + 1,
        updatedAt: timestamp,
      };
      json(response, issueInlinePropertyIssue);
    });
    return true;
  }
  const issueBoardMoveMatch = request.method === 'PATCH'
    && fixtureName(request) === 'issue-board-move'
    ? path.match(/\/issues\/([0-9a-f-]{36})$/i)
    : null;
  if (issueBoardMoveMatch !== null) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Issue update payload is not valid JSON.', 400);
        return;
      }
      const issueId = issueBoardMoveMatch[1]?.toLowerCase();
      const index = issueBoardMoveIssues.findIndex((item) => item.id === issueId);
      const current = issueBoardMoveIssues[index];
      if (current === undefined) {
        apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The issue is not in this fixture.', 404);
        return;
      }
      if (input?.expectedRevision !== current.revision) {
        apiError(response, 'REVISION_CONFLICT', 'Issue changed. Refresh and try again.', 409);
        return;
      }
      const nextProjectId = input.projectId === undefined ? current.projectId : input.projectId;
      const nextMilestoneId = input.milestoneId === undefined
        ? (nextProjectId === current.projectId ? current.milestoneId : null)
        : input.milestoneId;
      const nextStatusId = input.statusId ?? current.statusId;
      const nextPriority = input.priority ?? current.priority;
      const nextAssigneeUserId = input.assigneeUserId === undefined
        ? current.assigneeUserId
        : input.assigneeUserId;
      const availableProjects = [project, projectD];
      const availableMilestones = [milestone, milestoneD];
      const targetProject = nextProjectId === null
        ? null
        : availableProjects.find((item) => item.id === nextProjectId && item.teamId === current.teamId && item.archivedAt === null);
      const targetMilestone = nextMilestoneId === null
        ? null
        : availableMilestones.find((item) => item.id === nextMilestoneId && item.projectId === nextProjectId && item.archivedAt === null);
      const valid = statuses.some((item) => item.id === nextStatusId && item.teamId === current.teamId)
        && ['none', 'urgent', 'high', 'medium', 'low'].includes(nextPriority)
        && (nextAssigneeUserId === null || nextAssigneeUserId === membership.userId)
        && ((nextProjectId === null && nextMilestoneId === null) || targetProject !== undefined)
        && (nextMilestoneId === null || targetMilestone !== undefined);
      if (!valid) {
        apiError(response, 'INVALID_ASSIGNMENT', 'The requested issue assignment is not valid for its team.', 422);
        return;
      }
      const next = {
        ...current,
        statusId: nextStatusId,
        priority: nextPriority,
        assigneeUserId: nextAssigneeUserId,
        projectId: nextProjectId,
        milestoneId: nextMilestoneId,
      };
      const changed = ['statusId', 'priority', 'assigneeUserId', 'projectId', 'milestoneId']
        .some((field) => next[field] !== current[field]);
      if (changed) {
        next.revision = current.revision + 1;
        next.updatedAt = timestamp;
      }
      issueBoardMoveIssues[index] = next;
      json(response, next);
    });
    return true;
  }
  if (request.method === 'POST'
    && path.endsWith('/issues/bulk')
    && fixtureName(request) === 'issue-bulk-edit') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Bulk issue payload is not valid JSON.', 400);
        return;
      }
      const items = Array.isArray(input?.items) ? input.items : [];
      const mutation = input?.mutation;
      const duplicateIds = new Set(items.map((item) => item?.id)).size !== items.length;
      const validMutation = mutation?.type === 'archive'
        || mutation?.type === 'restore'
        || (mutation?.type === 'labels'
          && (mutation.operation === 'add' || mutation.operation === 'remove')
          && Array.isArray(mutation.labelIds)
          && mutation.labelIds.length > 0
          && mutation.labelIds.length <= 50
          && new Set(mutation.labelIds).size === mutation.labelIds.length)
        || (mutation?.type === 'update'
          && mutation.patch !== null
          && typeof mutation.patch === 'object'
          && Object.keys(mutation.patch).length > 0);
      if (items.length === 0 || duplicateIds || !validMutation) {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Bulk issue selection or mutation is invalid.', 400);
        return;
      }
      const availableProjects = [project, projectD];
      const availableMilestones = [milestone, milestoneD];
      const availableLabels = [label, labelB, labelC];
      const results = items.map((item) => {
        const issueId = typeof item?.id === 'string' ? item.id.toLowerCase() : '';
        const index = issueBulkEditIssues.findIndex((candidate) => candidate.id === issueId);
        const current = issueBulkEditIssues[index];
        if (current === undefined) {
          return {
            id: issueId || String(item?.id ?? ''),
            status: 'failed',
            error: { code: 'FIXTURE_RECORD_NOT_FOUND', message: 'The issue is not in this fixture.' },
          };
        }
        if (item?.expectedRevision !== current.revision) {
          return {
            id: current.id,
            status: 'conflict',
            error: {
              code: 'CONFLICT',
              message: 'This issue changed. Refresh and try again.',
              currentRevision: current.revision,
            },
          };
        }
        if (mutation.type === 'archive' || mutation.type === 'restore') {
          const archivedAt = mutation.type === 'archive' ? timestamp : null;
          if (current.archivedAt === archivedAt || (mutation.type === 'archive' && current.archivedAt !== null)) {
            return {
              id: current.id,
              status: 'failed',
              error: { code: 'VALIDATION_ERROR', message: `Issue is already ${mutation.type === 'archive' ? 'archived' : 'active'}.` },
            };
          }
          const next = { ...current, archivedAt, revision: current.revision + 1, updatedAt: timestamp };
          issueBulkEditIssues[index] = next;
          return { id: current.id, status: 'updated', issue: next };
        }
        if (mutation.type === 'labels') {
          const requestedLabels = mutation.labelIds.map((labelId) =>
            availableLabels.find((candidate) => candidate.id === labelId && candidate.archivedAt === null));
          if (requestedLabels.some((candidate) => candidate === undefined)) {
            return {
              id: current.id,
              status: 'failed',
              error: { code: 'VALIDATION_ERROR', message: 'One or more labels are unavailable.' },
            };
          }
          const requestedIds = new Set(mutation.labelIds);
          const currentIds = new Set(current.labels.map((item) => item.id));
          const nextLabels = mutation.operation === 'add'
            ? [...current.labels, ...requestedLabels.filter((candidate) =>
                candidate !== undefined && !currentIds.has(candidate.id))]
            : current.labels.filter((candidate) => !requestedIds.has(candidate.id));
          if (nextLabels.length > 50) {
            return {
              id: current.id,
              status: 'failed',
              error: { code: 'VALIDATION_ERROR', message: 'An issue can have at most 50 labels.' },
            };
          }
          if (nextLabels.length === current.labels.length
            && nextLabels.every((candidate, labelIndex) => candidate.id === current.labels[labelIndex]?.id)) {
            return { id: current.id, status: 'updated', issue: current };
          }
          const next = {
            ...current,
            labels: nextLabels,
            revision: current.revision + 1,
            updatedAt: timestamp,
          };
          issueBulkEditIssues[index] = next;
          return { id: current.id, status: 'updated', issue: next };
        }
        const patch = mutation.patch;
        const supportedFields = new Set([
          'statusId',
          'priority',
          'assigneeUserId',
          'dueDate',
          'projectId',
          'milestoneId',
        ]);
        if (Object.keys(patch).some((field) => !supportedFields.has(field))) {
          return {
            id: current.id,
            status: 'failed',
            error: { code: 'VALIDATION_ERROR', message: 'The fixture does not support this bulk field.' },
          };
        }
        const nextProjectId = patch.projectId === undefined ? current.projectId : patch.projectId;
        const nextMilestoneId = patch.milestoneId === undefined
          ? (nextProjectId === current.projectId ? current.milestoneId : null)
          : patch.milestoneId;
        const nextStatusId = patch.statusId ?? current.statusId;
        const nextPriority = patch.priority ?? current.priority;
        const nextAssigneeUserId = patch.assigneeUserId === undefined
          ? current.assigneeUserId
          : patch.assigneeUserId;
        const nextDueDate = patch.dueDate === undefined ? current.dueDate : patch.dueDate;
        const targetProject = nextProjectId === null
          ? null
          : availableProjects.find((candidate) =>
            candidate.id === nextProjectId
            && candidate.teamId === current.teamId
            && candidate.archivedAt === null);
        const targetMilestone = nextMilestoneId === null
          ? null
          : availableMilestones.find((candidate) =>
            candidate.id === nextMilestoneId
            && candidate.projectId === nextProjectId
            && candidate.archivedAt === null);
        const validDate = nextDueDate === null || /^\d{4}-\d{2}-\d{2}$/.test(nextDueDate);
        const valid = statuses.some((candidate) => candidate.id === nextStatusId && candidate.teamId === current.teamId)
          && ['none', 'urgent', 'high', 'medium', 'low'].includes(nextPriority)
          && (nextAssigneeUserId === null || nextAssigneeUserId === membership.userId)
          && validDate
          && ((nextProjectId === null && nextMilestoneId === null) || targetProject !== undefined)
          && (nextMilestoneId === null || targetMilestone !== undefined);
        if (!valid) {
          return {
            id: current.id,
            status: 'failed',
            error: { code: 'INVALID_ASSIGNMENT', message: 'The requested bulk assignment is not valid.' },
          };
        }
        const next = {
          ...current,
          statusId: nextStatusId,
          priority: nextPriority,
          assigneeUserId: nextAssigneeUserId,
          dueDate: nextDueDate,
          projectId: nextProjectId,
          milestoneId: nextMilestoneId,
        };
        const changed = ['statusId', 'priority', 'assigneeUserId', 'dueDate', 'projectId', 'milestoneId']
          .some((field) => next[field] !== current[field]);
        if (!changed) {
          return {
            id: current.id,
            status: 'failed',
            error: { code: 'VALIDATION_ERROR', message: 'Change at least one issue field.' },
          };
        }
        next.revision = current.revision + 1;
        next.updatedAt = timestamp;
        issueBulkEditIssues[index] = next;
        return { id: current.id, status: 'updated', issue: next };
      });
      json(response, results);
    });
    return true;
  }
  if (request.method === 'POST' && path.endsWith('/issues') && fixtureName(request) === 'milestone-create') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Issue payload is not valid JSON.', 400);
        return;
      }
      if (input.milestoneId !== ids.milestone) {
        apiError(response, 'MILESTONE_CONTEXT_MISSING', 'The milestone context was not submitted.', 422);
        return;
      }
      json(response, { ...issues[0], title: input.title, milestoneId: input.milestoneId });
    });
    return true;
  }
  if (request.method === 'POST' && path.endsWith('/issues') && fixtureName(request) === 'issue-create') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Issue payload is not valid JSON.', 400);
        return;
      }
      const availableProjects = [project, projectD];
      const availableMilestones = [milestone, milestoneD];
      const availableLabels = [label, labelB];
      const targetProject = input?.projectId === null
        ? null
        : availableProjects.find((item) => item.id === input?.projectId && item.teamId === input?.teamId && item.archivedAt === null);
      const targetMilestone = input?.milestoneId === null
        ? null
        : availableMilestones.find((item) => item.id === input?.milestoneId && item.projectId === input?.projectId && item.archivedAt === null);
      const labelIds = Array.isArray(input?.labelIds) ? input.labelIds : [];
      const valid = input?.teamId === ids.team
        && statuses.some((item) => item.id === input?.statusId && item.teamId === input?.teamId)
        && typeof input?.title === 'string'
        && input.title.trim().length > 0
        && ['none', 'urgent', 'high', 'medium', 'low'].includes(input?.priority)
        && (input?.assigneeUserId === null || input?.assigneeUserId === ids.user)
        && (input?.dueDate === null || /^\d{4}-\d{2}-\d{2}$/.test(input?.dueDate))
        && ((input?.projectId === null && input?.milestoneId === null) || targetProject !== undefined)
        && (input?.milestoneId === null || targetMilestone !== undefined)
        && new Set(labelIds).size === labelIds.length
        && labelIds.every((id) => availableLabels.some((item) => item.id === id));
      if (!valid) {
        apiError(response, 'INVALID_ASSIGNMENT', 'The requested issue assignment is not valid.', 422);
        return;
      }
      const created = {
        ...issue(ids.issueCreated, 3, input.title.trim(), input.statusId, input.priority),
        descriptionDocument: input.descriptionDocument,
        assigneeUserId: input.assigneeUserId,
        dueDate: input.dueDate,
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        labels: labelIds.map((id) => availableLabels.find((item) => item.id === id)),
        resources: Array.isArray(input.resources) ? input.resources.map((resource, index) => ({
          id: `65000000-0000-4000-8000-${String(index + 24).padStart(12, '0')}`,
          label: resource.label,
          url: resource.url,
          position: (index + 1) * 100,
        })) : [],
        revision: 1,
      };
      issueCreateIssues = [...issues, created];
      json(response, created, 201);
    });
    return true;
  }
  if (request.method !== 'GET' && !(request.method === 'POST' && path.endsWith('/issues/query'))) {
    json(response, null, 405);
    return true;
  }
  if (path === '/health/ready') return plainJson(response, { status: 'ready' }), true;
  if (path === '/api/v1/setup') return json(response, {
    setupRequired: false,
    localAuthEnabled: true,
    oidcRequired: false,
    oidcEnabled: false,
  }), true;
  const guestReadOnly = fixtureName(request) === 'guest-readonly';
  const multiWorkspaceRoute = fixtureName(request) === 'workspace-route';
  const teamRoute = fixtureName(request) === 'team-route';
  const projectView = fixtureName(request) === 'project-view';
  const issueView = fixtureName(request) === 'issue-view';
  const milestoneDrag = fixtureName(request) === 'milestone-drag';
  const issueBoardMove = fixtureName(request) === 'issue-board-move';
  const issueBulkEdit = fixtureName(request) === 'issue-bulk-edit';
  const issueCreate = fixtureName(request) === 'issue-create';
  const issueInlineProperties = fixtureName(request) === 'issue-inline-properties';
  const projectInlineEdit = fixtureName(request) === 'project-inline-edit';
  const milestoneInlineEdit = fixtureName(request) === 'milestone-inline-edit';
  const commentInlineEdit = fixtureName(request) === 'comment-inline-edit';
  const issueRelationDirections = fixtureName(request) === 'issue-relation-directions';
  const labelInlineEdit = fixtureName(request) === 'label-inline-edit';
  const workflowStatusInlineEdit = fixtureName(request) === 'workflow-status-inline-edit';
  const workflowStatusReorder = fixtureName(request) === 'workflow-status-reorder';
  const workflowStatusRetire = fixtureName(request) === 'workflow-status-retire';
  const workflowStatusFixture = workflowStatusInlineEdit || workflowStatusReorder || workflowStatusRetire;
  if (path === '/api/v1/session') return json(response, {
    user: { id: ids.user, email: membership.email, displayName: membership.displayName, revision: 2 },
    workspaces: multiWorkspaceRoute
      ? [workspace, workspaceB]
      : [guestReadOnly ? { ...workspace, role: 'guest' } : workspace],
  }), true;
  if (path === '/api/v1/auth/oidc/identities') return json(response, []), true;
  const requestWorkspaceId = path.match(/\/workspaces\/([0-9a-f-]{36})(?:\/|$)/i)?.[1]?.toLowerCase();
  if (labelInlineEdit && requestWorkspaceId !== undefined && requestWorkspaceId !== ids.workspace) {
    return apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The label fixture is not in this workspace.', 404), true;
  }
  if (workflowStatusFixture && requestWorkspaceId !== undefined && requestWorkspaceId !== ids.workspace) {
    return apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The workflow status fixture is not in this workspace.', 404), true;
  }
  const secondaryWorkspaceRequest = multiWorkspaceRoute && requestWorkspaceId === ids.workspaceB;
  if (path.endsWith('/events')) {
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    response.write(': visual fixture\n\n');
    return true;
  }
  if (secondaryWorkspaceRequest) {
    if (path.endsWith('/teams')) return json(response, [teamB]), true;
    if (path.endsWith('/memberships')) return json(response, [membershipB]), true;
    if (path.endsWith('/statuses')) return json(response, statusesB), true;
    if (path.endsWith('/labels') || path.endsWith('/views') || path.endsWith('/milestones') || path.endsWith('/projects') || path.endsWith('/issues') || path.endsWith('/issues/query') || path.endsWith('/search')) return json(response, []), true;
    if (path.includes('/projects/') || path.includes('/issues/')) {
      return apiError(response, 'FIXTURE_RECORD_NOT_FOUND', 'The record is not in this workspace.', 404), true;
    }
  }
  if (path.endsWith('/teams')) return json(response, projectView || issueView || issueRelationDirections || workflowStatusFixture ? [team, teamC] : teamRoute ? [team, teamC] : [team]), true;
  if (path.endsWith('/memberships')) return json(response, [guestReadOnly ? { ...membership, role: 'guest' } : membership]), true;
  if (path.endsWith('/statuses')) return json(response,
    workflowStatusFixture
      ? [...(workflowStatusRetire
        ? workflowStatusRetirementStatuses
        : workflowStatusInlineEditStatuses)].sort((left, right) =>
        left.teamId.localeCompare(right.teamId)
        || left.position - right.position
        || left.id.localeCompare(right.id))
      : teamRoute || projectView || issueView || issueRelationDirections ? [...statuses, statusC] : statuses), true;
  if (path.endsWith('/labels')) return json(response,
    labelInlineEdit
      ? labelInlineEditLabels.filter((item) =>
        url.searchParams.get('includeArchived') === 'true' || item.archivedAt === null)
      : issueInlineProperties
      ? url.searchParams.get('includeArchived') === 'true'
        ? [label, labelB, labelC, labelArchived]
        : [label, labelB, labelC]
      : issueBulkEdit ? [label, labelB, labelC] : issueCreate ? [label, labelB] : [label]), true;
  if (path.endsWith('/views')) return json(response, teamRoute ? savedViews : []), true;
  if (/\/workspaces\/[0-9a-f-]{36}\/milestones$/i.test(path)) return json(response, milestoneInlineEdit
    ? milestoneInlineEditMilestones.filter((item) =>
      url.searchParams.get('includeArchived') === 'true' || item.archivedAt === null)
    : milestoneDrag ? milestoneDragMilestones
    : issueInlineProperties ? [milestone, milestoneD, milestoneArchived]
      : issueBoardMove || issueBulkEdit || issueCreate ? [milestone, milestoneD] : [milestone]), true;
  if (path.endsWith('/projects')) {
    const availableProjects = projectInlineEdit
      ? [projectInlineEditProject]
      : projectView
      ? [project, projectC, projectD]
      : issueInlineProperties ? [project, projectD, projectArchived]
        : issueBoardMove || issueBulkEdit || issueCreate ? [project, projectD]
      : teamRoute || issueView || issueRelationDirections ? [project, projectC] : [project];
    const teamId = url.searchParams.get('teamId');
    return json(response, teamId === null
      ? availableProjects
      : availableProjects.filter((item) => item.teamId === teamId)), true;
  }
  if (path.endsWith(`/projects/${ids.project}`)) return json(response,
    projectInlineEdit ? projectInlineEditProject : project), true;
  if (path.endsWith(`/projects/${ids.projectC}`) && (teamRoute || projectView || issueView || issueRelationDirections)) return json(response, projectC), true;
  if (path.endsWith(`/projects/${ids.projectD}`) && (projectView || issueBoardMove || issueBulkEdit || issueCreate || issueInlineProperties)) return json(response, projectD), true;
  if (path.endsWith(`/projects/${ids.projectArchived}`) && issueInlineProperties) return json(response, projectArchived), true;
  if (path.endsWith(`/projects/${ids.project}/milestones`)) return json(response, milestoneInlineEdit
    ? milestoneInlineEditMilestones.filter((item) =>
      url.searchParams.get('includeArchived') === 'true' || item.archivedAt === null)
    : milestoneDrag ? milestoneDragMilestones : [milestone]), true;
  if (path.endsWith(`/projects/${ids.project}/activity`)) return json(response, activities), true;
  if (path.endsWith(`/projects/${ids.projectC}/milestones`) && (teamRoute || projectView || issueView || issueRelationDirections)) return json(response, []), true;
  if (path.endsWith(`/projects/${ids.projectC}/activity`) && (teamRoute || projectView || issueView || issueRelationDirections)) return json(response, []), true;
  if (path.endsWith(`/projects/${ids.projectD}/milestones`) && (projectView || issueBoardMove || issueBulkEdit || issueCreate || issueInlineProperties)) return json(response, issueBoardMove || issueBulkEdit || issueCreate || issueInlineProperties ? [milestoneD] : []), true;
  if (path.endsWith(`/projects/${ids.projectD}/activity`) && (projectView || issueBoardMove || issueBulkEdit || issueCreate || issueInlineProperties)) return json(response, []), true;
  if (path.endsWith(`/projects/${ids.projectArchived}/milestones`) && issueInlineProperties) return json(response,
    url.searchParams.get('includeArchived') === 'true' ? [milestoneArchived] : []), true;
  if (path.endsWith(`/projects/${ids.projectArchived}/activity`) && issueInlineProperties) return json(response, []), true;
  if (request.method === 'POST' && path.endsWith('/issues/query') && (teamRoute || issueView || issueBoardMove || issueBulkEdit || issueCreate || issueInlineProperties || issueRelationDirections || workflowStatusRetire)) {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        apiError(response, 'INVALID_FIXTURE_REQUEST', 'Issue query payload is not valid JSON.', 400);
        return;
      }
      const teamId = issueFilterValue(input?.state?.filter?.root, 'teamId');
      const availableIssues = workflowStatusRetire
        ? workflowStatusRetirementIssues
        : issueBoardMove
        ? issueBoardMoveIssues
        : issueBulkEdit ? issueBulkEditIssues
          : issueCreate ? issueCreateIssues
            : issueInlineProperties ? [issueInlinePropertyIssue, issues[1]] : [...issues, issueC];
      json(response, teamId === null
        ? availableIssues
        : availableIssues.filter((item) => item.teamId === teamId));
    });
    return true;
  }
  if (path.endsWith('/issues/query')) return json(response, issues), true;
  if (path.endsWith('/issues')) {
    const availableIssues = workflowStatusRetire
      ? workflowStatusRetirementIssues
      : issueBoardMove
      ? issueBoardMoveIssues
      : issueBulkEdit ? issueBulkEditIssues
        : issueCreate ? issueCreateIssues
          : issueInlineProperties ? [issueInlinePropertyIssue, issues[1]]
          : teamRoute || issueView || issueRelationDirections ? [...issues, issueC] : issues;
    const teamId = url.searchParams.get('teamId');
    return json(response, teamId === null
      ? availableIssues
      : availableIssues.filter((item) => item.teamId === teamId)), true;
  }
  const issueId = path.match(/\/issues\/([0-9a-f-]{36})(?:\/|$)/i)?.[1];
  if (issueId) {
    if (path.endsWith('/relations')) return json(response,
      issueRelationDirections
        ? issueRelationDirectionRelations
          .filter((relation) => relation.sourceIssueId === issueId || relation.targetIssueId === issueId)
          .map((relation) => issueRelationFixtureRecord(relation, issueId))
        : []), true;
    if (path.endsWith('/comments')) return json(response,
      commentInlineEdit && issueId === ids.issueA
        ? commentInlineEditComments.filter((comment) =>
          url.searchParams.get('includeArchived') === 'true' || comment.archivedAt === null)
        : []), true;
    if (path.endsWith('/activity')) return json(response, activities), true;
    const availableIssues = workflowStatusRetire
      ? workflowStatusRetirementIssues
      : issueBoardMove
      ? issueBoardMoveIssues
      : issueBulkEdit ? issueBulkEditIssues
        : issueCreate ? issueCreateIssues
          : issueInlineProperties ? [issueInlinePropertyIssue, issues[1]]
          : teamRoute || issueView || issueRelationDirections ? [...issues, issueC] : issues;
    return json(response, availableIssues.find((item) => item.id === issueId) ?? null), true;
  }
  return false;
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

async function staticResponse(response, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const candidate = resolve(dist, normalize(requested));
  const target = candidate.startsWith(`${dist}/`) ? candidate : join(dist, 'index.html');
  let file = target;
  try {
    if (!(await lstat(file)).isFile()) file = join(dist, 'index.html');
  } catch {
    file = join(dist, 'index.html');
  }
  response.writeHead(200, {
    'content-type': contentTypes[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/health/')) {
    const serveApi = () => {
      if (!apiResponse(request, response, url)) json(response, null, 404);
    };
    const delay = loadingFixtureDelay(request, url.pathname);
    if (delay > 0) setTimeout(serveApi, delay);
    else serveApi();
    return;
  }
  void staticResponse(response, url.pathname).catch((error) => {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error.message);
  });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Visual fixture ready at http://127.0.0.1:${port}\n`);
});
