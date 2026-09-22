import type {
  Membership,
  Project,
  ProjectResourceInput,
  UpdateProjectRequest,
} from '@basiclinear/contracts';

interface ProjectEditSource extends Pick<Project,
  'workspaceId' | 'revision' | 'status' | 'priority' | 'leadUserId' | 'startDate' |
  'targetDate' | 'name' | 'summary' | 'icon' | 'color' | 'overviewDocument' | 'resources' |
  'archivedAt'> {}

export interface ProjectContentDraft {
  name: string;
  summary: string;
  icon: Project['icon'];
  color: string;
  overviewDocument: Project['overviewDocument'];
  resources: ProjectResourceInput[];
}

export type ProjectInlinePropertyChange =
  | { field: 'status'; value: Project['status'] }
  | { field: 'priority'; value: Project['priority'] }
  | { field: 'leadUserId'; value: string | null }
  | { field: 'startDate'; value: string | null }
  | { field: 'targetDate'; value: string | null };

const statuses = new Set<Project['status']>([
  'planned',
  'in_progress',
  'paused',
  'completed',
  'canceled',
]);
const priorities = new Set<Project['priority']>(['none', 'urgent', 'high', 'medium', 'low']);
const icons = new Set<Project['icon']>(['briefcase', 'layers', 'target', 'compass', 'rocket']);

function identityCounts<T>(records: readonly T[], identity: (record: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const id = identity(record);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizedName(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length >= 1 && normalized.length <= 80 ? normalized : null;
}

function normalizedSummary(value: string): string | null {
  const normalized = value.trim().replace(/\r\n?/g, '\n');
  return normalized.length <= 280 ? normalized : null;
}

function normalizedColor(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : null;
}

function normalizedResources(resources: readonly ProjectResourceInput[]): ProjectResourceInput[] | null {
  if (resources.length > 50) return null;
  const normalized: ProjectResourceInput[] = [];
  for (const resource of resources) {
    const label = resource.label.trim().replace(/\r\n?/g, '\n');
    if (label.length < 1 || label.length > 120) return null;
    const text = resource.url.trim();
    if (text.length < 1 || text.length > 2048) return null;
    try {
      const url = new URL(text);
      if ((url.protocol !== 'http:' && url.protocol !== 'https:')
        || url.username !== '' || url.password !== '') return null;
      normalized.push({ label, url: url.toString() });
    } catch {
      return null;
    }
  }
  return normalized;
}

function currentResourceInputs(project: Pick<ProjectEditSource, 'resources'>): ProjectResourceInput[] {
  return project.resources.map(({ label, url }) => ({ label, url }));
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function projectLeadOptions<T extends Pick<Membership, 'workspaceId' | 'userId'>>(
  project: Pick<ProjectEditSource, 'workspaceId'>,
  members: readonly T[],
): T[] {
  const counts = identityCounts(members, (member) => member.userId);
  return members.filter((member) =>
    member.workspaceId === project.workspaceId && counts.get(member.userId) === 1);
}

export function projectContentDraft(project: ProjectEditSource): ProjectContentDraft {
  return {
    name: project.name,
    summary: project.summary,
    icon: project.icon,
    color: project.color,
    overviewDocument: project.overviewDocument,
    resources: currentResourceInputs(project),
  };
}

export function projectContentRequest(
  project: ProjectEditSource,
  draft: ProjectContentDraft,
): UpdateProjectRequest | null {
  if (project.archivedAt !== null) return null;
  const name = normalizedName(draft.name);
  const summary = normalizedSummary(draft.summary);
  const color = normalizedColor(draft.color);
  const resources = normalizedResources(draft.resources);
  if (name === null || summary === null || color === null || resources === null
    || !icons.has(draft.icon)) return null;

  const request: UpdateProjectRequest = { expectedRevision: project.revision };
  if (name !== project.name) request.name = name;
  if (summary !== project.summary) request.summary = summary;
  if (draft.icon !== project.icon) request.icon = draft.icon;
  if (color !== project.color.toUpperCase()) request.color = color;
  if (!equalJson(draft.overviewDocument, project.overviewDocument)) {
    request.overviewDocument = draft.overviewDocument;
  }
  if (!equalJson(resources, currentResourceInputs(project))) request.resources = resources;
  return Object.keys(request).length > 1 ? request : null;
}

export function projectInlinePropertyRequest(
  project: ProjectEditSource,
  change: ProjectInlinePropertyChange,
  members: readonly Pick<Membership, 'workspaceId' | 'userId'>[],
): UpdateProjectRequest | null {
  if (project.archivedAt !== null) return null;
  const expectedRevision = project.revision;

  if (change.field === 'status') {
    if (change.value === project.status || !statuses.has(change.value)) return null;
    return { expectedRevision, status: change.value };
  }
  if (change.field === 'priority') {
    if (change.value === project.priority || !priorities.has(change.value)) return null;
    return { expectedRevision, priority: change.value };
  }
  if (change.field === 'leadUserId') {
    if (change.value === project.leadUserId) return null;
    if (change.value === null) return { expectedRevision, leadUserId: null };
    const options = projectLeadOptions(project, members);
    const lead = options.find((member) => member.userId === change.value);
    return lead === undefined ? null : { expectedRevision, leadUserId: lead.userId };
  }

  if (change.value !== null && !validDate(change.value)) return null;
  if (change.field === 'startDate') {
    if (change.value === project.startDate) return null;
    if (change.value !== null && project.targetDate !== null && change.value > project.targetDate) return null;
    return { expectedRevision, startDate: change.value };
  }
  if (change.value === project.targetDate) return null;
  if (change.value !== null && project.startDate !== null && change.value < project.startDate) return null;
  return { expectedRevision, targetDate: change.value };
}
