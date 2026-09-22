import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActivityEntry,
  Membership,
  Milestone,
  Project,
  ProjectProgress,
  ProjectResourceInput,
  Team,
  UpdateMilestoneRequest,
  UpdateProjectRequest,
  WorkflowStatus,
  Workspace,
} from '@basiclinear/contracts';
import { hasCapability } from '@basiclinear/domain';
import {
  Archive,
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  ExternalLink,
  FolderKanban,
  GripVertical,
  Layers3,
  Link2,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  Rocket,
  Rows3,
  Save,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { api, ApiError } from './api.js';
import { BufferedDateInput } from './buffered-date-input.js';
import { ArchiveActionNotice, Dialog, EmptyState, ErrorNotice, LoadingSkeleton, QueryErrorState, Spinner } from './components.js';
import { IssuesView, RichTextEditor, RichTextView } from './issues.js';
import { resolveMenuFocusIndex, resolveRecordKeyAction } from './local-keyboard-actions.js';
import {
  milestoneDragThresholdExceeded,
  milestoneDropEdge,
  milestonePositionAnnouncement,
  reorderMilestoneForDrop,
  reorderMilestoneForMove,
  type MilestoneDropEdge,
} from './milestone-interactions.js';
import {
  milestoneEditDraft,
  milestoneEditRequest,
  type MilestoneEditDraft,
} from './milestone-inline-edit.js';
import {
  readProjectDensity,
  writeProjectDensity,
  type ProjectDensity,
} from './project-density.js';
import {
  defaultProjectListRouteState,
  isPushedProjectRoute,
  projectNavigationUrl,
  projectRouteFromSearch,
  projectRouteHistoryState,
  type ProjectTab,
} from './project-navigation.js';
import { resolveRovingProjectId } from './project-roving-focus.js';
import {
  projectContentDraft,
  projectContentRequest,
  projectInlinePropertyRequest,
  projectLeadOptions,
  type ProjectContentDraft,
  type ProjectInlinePropertyChange,
} from './project-inline-edit.js';
import { milestoneIssueCountLabel } from './issue-scope.js';
import {
  groupProjects,
  projectGridTemplate,
  projectViewProperties,
  projectViewPropertyLabel,
  toggleProjectViewProperty,
  visibleGroupedProjectIds,
  type ProjectViewGrouping,
  type ProjectViewProperty,
} from './project-view-configuration.js';

type ProjectDialog = 'create' | null;

interface ProjectDraft {
  teamId: string;
  name: string;
  summary: string;
  status: Project['status'];
  priority: Project['priority'];
  leadUserId: string | null;
  startDate: string | null;
  targetDate: string | null;
  icon: Project['icon'];
  color: string;
  overviewDocument: Project['overviewDocument'];
  resources: ProjectResourceInput[];
}

type MilestoneDraft = MilestoneEditDraft;

interface MilestonePointerDrag {
  pointerId: number;
  sourceId: string;
  startX: number;
  startY: number;
  active: boolean;
  targetId: string | null;
  edge: MilestoneDropEdge | null;
}

interface ProjectNotice {
  tone: 'success' | 'error';
  message: string;
}

type ProjectArchiveTarget =
  | { kind: 'project'; record: Project }
  | { kind: 'milestone'; record: Milestone };

interface ProjectArchiveNotice {
  kind: ProjectArchiveTarget['kind'];
  tone: 'success' | 'error';
  message: string;
  undoTarget: ProjectArchiveTarget | null;
}

interface ProjectContentEdit {
  projectId: string;
  draft: ProjectContentDraft;
}

interface ProjectContentRecovery extends ProjectContentEdit {
  confirmedRevision: number;
}

interface MilestoneEdit {
  milestoneId: string;
  baseline: Milestone;
  draft: MilestoneEditDraft;
}

interface MilestoneEditRecovery {
  milestoneId: string;
  confirmedRevision: number;
}

interface MilestonePurgeTarget {
  milestone: Milestone;
  focusId: string | null;
}

function milestoneDraft(form: HTMLFormElement): MilestoneDraft {
  const data = new FormData(form);
  return {
    name: String(data.get('name')),
    description: String(data.get('description')),
    targetDate: String(data.get('targetDate')) || null,
  };
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function projectIcon(project: Pick<Project, 'icon' | 'color'>, size = 16) {
  const props = { size, 'aria-hidden': true } as const;
  const icon = project.icon === 'briefcase'
    ? <BriefcaseBusiness {...props} />
    : project.icon === 'target'
      ? <Target {...props} />
      : project.icon === 'compass'
        ? <Compass {...props} />
        : project.icon === 'rocket'
          ? <Rocket {...props} />
          : <Layers3 {...props} />;
  return <span className="project-icon" style={{ borderColor: project.color, color: project.color }}>{icon}</span>;
}

function Progress({ value, compact = false }: { value: ProjectProgress; compact?: boolean }) {
  const percent = Math.round(value.fraction * 100);
  return (
    <span className={`progress ${compact ? 'progress-compact' : ''}`}>
      <span
        className="progress-track"
        role="progressbar"
        aria-label={`${percent}% complete`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      ><span style={{ width: `${percent}%` }} /></span>
      <span className="progress-value">{percent}%</span>
    </span>
  );
}

function ProjectPropertyCell({
  project,
  property,
  teams,
  members,
}: {
  project: Project;
  property: ProjectViewProperty;
  teams: Team[];
  members: Membership[];
}) {
  const className = `project-property-cell project-property-${property}`;
  if (property === 'status') {
    return <span className={className} role="gridcell"><span className={`project-status status-${project.status}`}>{titleCase(project.status)}</span></span>;
  }
  if (property === 'priority') {
    return <span className={`${className} project-priority priority-${project.priority}`} role="gridcell">{project.priority === 'none' ? 'No priority' : titleCase(project.priority)}</span>;
  }
  if (property === 'lead') {
    return <span className={`${className} project-lead`} role="gridcell"><UserRound size={14} />{members.find((member) => member.userId === project.leadUserId)?.displayName ?? 'No lead'}</span>;
  }
  if (property === 'team') {
    return <span className={`${className} project-team`} role="gridcell"><Layers3 size={14} />{teams.find((team) => team.id === project.teamId)?.name ?? 'Unknown team'}</span>;
  }
  if (property === 'startDate') {
    return <span className={`${className} project-target`} role="gridcell">{project.startDate ?? 'Not set'}</span>;
  }
  if (property === 'targetDate') {
    return <span className={`${className} project-target`} role="gridcell">{project.targetDate ?? 'Not set'}</span>;
  }
  return <span className={className} role="gridcell"><Progress value={project.progress} compact /></span>;
}

function ProjectForm({
  teams,
  members,
  initial,
  lockTeam = false,
  pending,
  error,
  onSubmit,
}: {
  teams: Team[];
  members: Membership[];
  initial?: Project;
  lockTeam?: boolean;
  pending: boolean;
  error: unknown;
  onSubmit: (value: ProjectDraft) => void;
}) {
  const [resources, setResources] = useState<ProjectResourceInput[]>(
    initial?.resources.map(({ label, url }) => ({ label, url })) ?? [],
  );
  const [overviewDocument, setOverviewDocument] = useState<Project['overviewDocument']>(
    initial?.overviewDocument ?? { version: 1, type: 'doc', content: [] },
  );
  const updateResource = (index: number, field: keyof ProjectResourceInput, value: string) => {
    setResources((current) => current.map((resource, resourceIndex) =>
      resourceIndex === index ? { ...resource, [field]: value } : resource));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      teamId: lockTeam ? teams[0]?.id ?? '' : String(data.get('teamId')),
      name: String(data.get('name')),
      summary: String(data.get('summary')),
      status: String(data.get('status')) as Project['status'],
      priority: String(data.get('priority')) as Project['priority'],
      leadUserId: String(data.get('leadUserId')) || null,
      startDate: String(data.get('startDate')) || null,
      targetDate: String(data.get('targetDate')) || null,
      icon: String(data.get('icon')) as Project['icon'],
      color: String(data.get('color')),
      overviewDocument,
      resources,
    });
  };
  return (
    <form className="dialog-form project-form" onSubmit={submit}>
      {lockTeam ? (
        <label className="field"><span>Name</span><input name="name" defaultValue={initial?.name} maxLength={80} required /></label>
      ) : (
        <div className="field-grid field-grid-project-name">
          <label className="field"><span>Name</span><input name="name" defaultValue={initial?.name} maxLength={80} required /></label>
        <label className="field"><span>Team</span><select name="teamId" defaultValue={initial?.teamId ?? teams[0]?.id} disabled={lockTeam} required>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
        </div>
      )}
      <label className="field"><span>Summary</span><input name="summary" defaultValue={initial?.summary} maxLength={280} /></label>
      <details className="form-details" open={initial !== undefined}>
        <summary>Details</summary>
        <div className="form-details-content">
          <div className="field-grid">
            <label className="field"><span>Status</span><select name="status" defaultValue={initial?.status ?? 'planned'}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="canceled">Canceled</option></select></label>
            <label className="field"><span>Priority</span><select name="priority" defaultValue={initial?.priority ?? 'none'}><option value="none">No priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
          </div>
          <label className="field"><span>Lead</span><select name="leadUserId" defaultValue={initial?.leadUserId ?? ''}><option value="">No lead</option>{members.map((member) => <option value={member.userId} key={member.id}>{member.displayName}</option>)}</select></label>
          <div className="field-grid">
            <label className="field"><span>Start date</span><input name="startDate" type="date" defaultValue={initial?.startDate ?? ''} /></label>
            <label className="field"><span>Target date</span><input name="targetDate" type="date" defaultValue={initial?.targetDate ?? ''} /></label>
          </div>
          <div className="field-grid field-grid-icon-color">
            <label className="field"><span>Icon</span><select name="icon" defaultValue={initial?.icon ?? 'layers'}><option value="briefcase">Briefcase</option><option value="layers">Layers</option><option value="target">Target</option><option value="compass">Compass</option><option value="rocket">Rocket</option></select></label>
            <label className="field color-field"><span>Color</span><input name="color" type="color" defaultValue={initial?.color ?? '#5E6AD2'} /></label>
          </div>
          <label className="field editor-label"><span>Overview</span><RichTextEditor initial={overviewDocument} onChange={setOverviewDocument} label="Project overview" /></label>
          <fieldset className="resource-editor">
            <legend>Resources</legend>
            {resources.map((resource, index) => (
              <div className="resource-editor-row" key={index}>
                <label><span className="sr-only">Resource label</span><input value={resource.label} onChange={(event) => updateResource(index, 'label', event.target.value)} placeholder="Label" maxLength={120} required /></label>
                <label><span className="sr-only">Resource URL</span><input value={resource.url} onChange={(event) => updateResource(index, 'url', event.target.value)} placeholder="https://" type="url" maxLength={2048} required /></label>
                <button type="button" className="icon-button" aria-label={`Remove resource ${index + 1}`} title="Remove resource" onClick={() => setResources((current) => current.filter((_, resourceIndex) => resourceIndex !== index))}><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" className="button resource-add" onClick={() => setResources((current) => [...current, { label: '', url: '' }])}><Plus size={15} /> Add resource</button>
          </fieldset>
        </div>
      </details>
      <ErrorNotice error={error} />
      <button className="button primary" disabled={pending || teams.length === 0}>{pending ? <Spinner /> : initial ? <Check size={16} /> : <Plus size={16} />}{initial ? 'Save project' : 'Create project'}</button>
    </form>
  );
}

function ProjectPropertiesEditor({
  project,
  teams,
  members,
  hideTeam = false,
  canWrite,
  locked,
  pendingLabel,
  notice,
  error,
  onChange,
}: {
  project: Project;
  teams: Team[];
  members: Membership[];
  hideTeam?: boolean;
  canWrite: boolean;
  locked: boolean;
  pendingLabel: string | null;
  notice: ProjectNotice | null;
  error: unknown;
  onChange: (label: string, change: ProjectInlinePropertyChange) => void;
}) {
  const leadOptions = projectLeadOptions(project, members);
  const currentLeadAvailable = project.leadUserId === null
    || leadOptions.some((member) => member.userId === project.leadUserId);
  const controlsDisabled = !canWrite || project.archivedAt !== null || locked;
  return (
    <section className="project-properties" aria-labelledby="properties-title" aria-busy={pendingLabel !== null}>
      <div className="project-properties-heading">
        <h2 id="properties-title">Properties</h2>
        <div
          className={`project-property-feedback ${pendingLabel !== null ? 'pending' : notice?.tone ?? 'idle'}`}
          role={notice?.tone === 'error' ? 'alert' : 'status'}
          aria-live={notice?.tone === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {pendingLabel !== null
            ? <><Spinner />Updating {pendingLabel.toLowerCase()}...</>
            : notice?.message ?? <span aria-hidden="true">&nbsp;</span>}
        </div>
      </div>
      <dl>
        <div><dt>Status</dt><dd><select aria-label="Project status" value={project.status} disabled={controlsDisabled} onChange={(event) => onChange('Status', { field: 'status', value: event.target.value as Project['status'] })}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="canceled">Canceled</option></select></dd></div>
        <div><dt>Priority</dt><dd><select aria-label="Project priority" value={project.priority} disabled={controlsDisabled} onChange={(event) => onChange('Priority', { field: 'priority', value: event.target.value as Project['priority'] })}><option value="none">No priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></dd></div>
        <div><dt>Lead</dt><dd><select aria-label="Project lead" value={project.leadUserId ?? ''} disabled={controlsDisabled} onChange={(event) => onChange('Lead', { field: 'leadUserId', value: event.target.value || null })}><option value="">No lead</option>{!currentLeadAvailable && project.leadUserId !== null ? <option value={project.leadUserId} disabled>Current lead unavailable</option> : null}{leadOptions.map((member) => <option value={member.userId} key={member.userId}>{member.displayName}</option>)}</select></dd></div>
        {!hideTeam ? <div><dt>Team</dt><dd><span aria-label="Project team">{teams.find((team) => team.id === project.teamId)?.name ?? 'Unknown'}</span></dd></div> : null}
        <div><dt>Start</dt><dd><BufferedDateInput label="Project start date" value={project.startDate} disabled={controlsDisabled} onCommit={(value) => onChange('Start date', { field: 'startDate', value })} /></dd></div>
        <div><dt>Target</dt><dd><BufferedDateInput label="Project target date" value={project.targetDate} disabled={controlsDisabled} onCommit={(value) => onChange('Target date', { field: 'targetDate', value })} /></dd></div>
      </dl>
      <ErrorNotice error={error} />
    </section>
  );
}

function InlineMilestoneForm({
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  error: unknown;
  onSubmit: (value: MilestoneDraft) => void;
  onCancel: () => void;
}) {
  return (
    <form
      id="milestone-inline-editor"
      className="milestone-row milestone-inline-row"
      aria-label="New milestone"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(milestoneDraft(event.currentTarget));
      }}
      onKeyDown={(event) => {
        if (pending || event.key !== 'Escape' || event.defaultPrevented || event.nativeEvent.isComposing) return;
        event.preventDefault();
        onCancel();
      }}
    >
      <span className="milestone-marker"><Target size={15} /></span>
      <div className="milestone-copy milestone-inline-copy">
        <label>
          <span className="sr-only">Milestone name</span>
          <input name="name" placeholder="Milestone name" maxLength={80} autoFocus required />
        </label>
        <label>
          <span className="sr-only">Milestone description</span>
          <input name="description" placeholder="Description" maxLength={4000} />
        </label>
      </div>
      <span className="milestone-inline-progress">New</span>
      <label className="milestone-date milestone-inline-date">
        <CalendarDays size={13} />
        <span className="sr-only">Target date</span>
        <input name="targetDate" type="date" />
      </label>
      <span className="milestone-issues milestone-inline-issues">0 issues</span>
      <div className="row-actions">
        <button type="button" className="icon-button" aria-label="Cancel new milestone" title="Cancel" onClick={onCancel} disabled={pending}><X size={14} /></button>
        <button className="icon-button milestone-inline-submit" aria-label="Add milestone" title="Add milestone" disabled={pending}>{pending ? <Spinner /> : <Check size={14} />}</button>
      </div>
      {error ? <div className="milestone-inline-error"><ErrorNotice error={error} /></div> : null}
    </form>
  );
}

function InlineMilestoneEditForm({
  milestone,
  draft,
  pending,
  recovery,
  error,
  onDraftChange,
  onSubmit,
  onCancel,
  onRetry,
  onUseServer,
  onOpenIssues,
}: {
  milestone: Milestone;
  draft: MilestoneEditDraft;
  pending: boolean;
  recovery: MilestoneEditRecovery | null;
  error: unknown;
  onDraftChange: (patch: Partial<MilestoneEditDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onUseServer: () => void;
  onOpenIssues: () => void;
}) {
  const issueCountLabel = milestoneIssueCountLabel(milestone.progress.issueCount);
  return (
    <form
      id={`milestone-inline-editor-${milestone.id}`}
      className="milestone-row milestone-inline-row milestone-edit-row"
      data-milestone-id={milestone.id}
      data-milestone-editor={milestone.id}
      aria-label={`Edit ${milestone.name}`}
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      onKeyDown={(event) => {
        if (pending || event.key !== 'Escape' || event.defaultPrevented || event.nativeEvent.isComposing) return;
        event.preventDefault();
        onCancel();
      }}
    >
      <span className="milestone-drag-handle disabled" aria-hidden="true"><Pencil size={14} /></span>
      <div className="milestone-copy milestone-inline-copy">
        <label>
          <span className="sr-only">Milestone name</span>
          <input name="name" value={draft.name} maxLength={80} autoFocus required disabled={pending || milestone.archivedAt !== null} onChange={(event) => onDraftChange({ name: event.target.value })} />
        </label>
        <label>
          <span className="sr-only">Milestone description</span>
          <input name="description" value={draft.description} maxLength={4000} disabled={pending || milestone.archivedAt !== null} onChange={(event) => onDraftChange({ description: event.target.value })} />
        </label>
      </div>
      <Progress value={milestone.progress} compact />
      <label className="milestone-date milestone-inline-date">
        <CalendarDays size={13} />
        <span className="sr-only">Milestone target date</span>
        <BufferedDateInput label="Milestone target date" name="targetDate" value={draft.targetDate} disabled={pending || milestone.archivedAt !== null} onCommit={(value) => onDraftChange({ targetDate: value })} />
      </label>
      <button type="button" className="milestone-issues milestone-issue-link" aria-label={`Open ${issueCountLabel} for ${milestone.name}`} onClick={onOpenIssues}>{issueCountLabel}</button>
      <div className="row-actions">
        <button type="button" className="icon-button" aria-label="Cancel milestone edit" title="Cancel" onClick={onCancel} disabled={pending}><X size={14} /></button>
        <button className="icon-button milestone-inline-submit" aria-label="Save milestone" title="Save milestone" disabled={pending || recovery !== null || milestone.archivedAt !== null}>{pending ? <Spinner /> : <Save size={14} />}</button>
      </div>
      {recovery !== null ? (
        <div className="milestone-edit-recovery" role="alert">
          <AlertCircle size={15} />
          <div><strong>Milestone changed</strong><p>Your draft is retained against server revision {recovery.confirmedRevision}. Retry it deliberately or replace it with the server values.</p></div>
          <div className="milestone-edit-recovery-actions">
            <button type="button" className="button" onClick={onRetry} disabled={pending || milestone.archivedAt !== null}><RefreshCcw size={14} />Retry draft</button>
            <button type="button" className="button" onClick={onUseServer} disabled={pending}>Use server values</button>
          </div>
        </div>
      ) : null}
      {error ? <div className="milestone-inline-error"><ErrorNotice error={error} /></div> : null}
    </form>
  );
}

function fieldLabel(value: string): string {
  const labels: Record<string, string> = {
    archivedAt: 'Archived',
    leadUserId: 'Lead',
    overviewDocument: 'Overview',
    projectId: 'Project',
    startDate: 'Start date',
    targetDate: 'Target date',
    teamId: 'Team',
  };
  return labels[value] ?? titleCase(value.replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
}

function displayValue(
  field: string,
  value: unknown,
  teams: Team[],
  members: Membership[],
  projectName: string,
): string {
  if (value === null || value === undefined || value === '') return 'None';
  if (field === 'teamId' && typeof value === 'string') {
    return teams.find((team) => team.id === value)?.name ?? 'Unknown team';
  }
  if (field === 'leadUserId' && typeof value === 'string') {
    return members.find((member) => member.userId === value)?.displayName ?? 'Unknown member';
  }
  if (field === 'projectId') return projectName;
  if (field === 'archivedAt' && typeof value === 'string') return new Date(value).toLocaleString();
  if (field === 'overviewDocument' && typeof value === 'object' && value !== null) {
    const summary = value as { nodes?: unknown; characters?: unknown };
    if (typeof summary.nodes === 'number' && typeof summary.characters === 'number') {
      return `${summary.nodes} nodes, ${summary.characters} characters`;
    }
    const content = 'content' in value && Array.isArray(value.content) ? value.content : [];
    return `${content.length} block${content.length === 1 ? '' : 's'}`;
  }
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return 'Content updated';
  const text = String(value);
  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

function ActivityList({ entries, teams, members, projectName, hideTeam = false }: {
  entries: ActivityEntry[];
  teams: Team[];
  members: Membership[];
  projectName: string;
  hideTeam?: boolean;
}) {
  if (entries.length === 0) return <EmptyState icon={<RefreshCcw size={22} />} title="No activity" />;
  return (
    <ol className="activity-list">
      {entries.map((entry) => {
        const fields = hideTeam ? entry.fields.filter((field) => field.field !== 'teamId') : entry.fields;
        return <li key={entry.id}>
          <span className="activity-marker" aria-hidden="true" />
          <div className="activity-heading">
            <strong>{entry.actor?.displayName ?? 'System'}</strong>
            <span>{entry.action.replaceAll('.', ' ')}</span>
            <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
          </div>
          {fields.length > 0 ? (
            <dl className="activity-fields">
              {fields.map((field, index) => (
                <div key={`${field.field}-${index}`}>
                  <dt>{fieldLabel(field.field)}</dt>
                  <dd><span>{displayValue(field.field, field.before, teams, members, projectName)}</span><span aria-hidden="true">→</span><strong>{displayValue(field.field, field.after, teams, members, projectName)}</strong></dd>
                </div>
              ))}
            </dl>
          ) : null}
        </li>
      })}
    </ol>
  );
}

export function ProjectsView({
  workspaceId,
  workspaceRole,
  teams,
  members,
  statuses,
  systemTeam,
  currentUserId,
  openProjectId,
  openProjectSignal = 0,
  onOpenProjectHandled,
}: {
  workspaceId: string;
  workspaceRole: Workspace['role'];
  teams: Team[];
  members: Membership[];
  statuses: WorkflowStatus[];
  systemTeam?: Pick<Team, 'id' | 'name'>;
  currentUserId?: string;
  openProjectId?: string | null;
  openProjectSignal?: number;
  onOpenProjectHandled?: () => void;
}) {
  const client = useQueryClient();
  const canWriteProjects = hasCapability(workspaceRole, 'project:write');
  const canPurgeProjects = hasCapability(workspaceRole, 'project:purge');
  const canPurgeMilestones = hasCapability(workspaceRole, 'milestone:purge');
  const initialRoute = useMemo(() => projectRouteFromSearch(
    window.location.search,
    defaultProjectListRouteState(readProjectDensity(localStorage)),
  ), []);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialRoute.projectId);
  const [tab, setTab] = useState<ProjectTab>(initialRoute.tab);
  const [milestoneIssueFilterId, setMilestoneIssueFilterId] = useState<string | null>(
    initialRoute.milestoneId,
  );
  const [dialog, setDialog] = useState<ProjectDialog>(null);
  const [projectPurgeOpen, setProjectPurgeOpen] = useState(false);
  const [projectPurgeNotice, setProjectPurgeNotice] = useState<string | null>(null);
  const [archiveNotice, setArchiveNotice] = useState<ProjectArchiveNotice | null>(null);
  const [milestoneEdit, setMilestoneEdit] = useState<MilestoneEdit | null>(null);
  const [milestoneEditRecovery, setMilestoneEditRecovery] = useState<MilestoneEditRecovery | null>(null);
  const [milestoneEditNotice, setMilestoneEditNotice] = useState<ProjectNotice | null>(null);
  const [milestonePurgeTarget, setMilestonePurgeTarget] = useState<MilestonePurgeTarget | null>(null);
  const [suppressedMilestoneEditError, setSuppressedMilestoneEditError] = useState<unknown>(null);
  const [projectContentEdit, setProjectContentEdit] = useState<ProjectContentEdit | null>(null);
  const [projectContentRecovery, setProjectContentRecovery] = useState<ProjectContentRecovery | null>(null);
  const [projectContentNotice, setProjectContentNotice] = useState<ProjectNotice | null>(null);
  const [projectPropertyNotice, setProjectPropertyNotice] = useState<ProjectNotice | null>(null);
  const [suppressedProjectContentError, setSuppressedProjectContentError] = useState<unknown>(null);
  const [projectContentEditorEpoch, setProjectContentEditorEpoch] = useState(0);
  const [searchDraft, setSearchDraft] = useState(initialRoute.list.query);
  const [query, setQuery] = useState(initialRoute.list.query);
  const [status, setStatus] = useState<'' | Project['status']>(initialRoute.list.status);
  const [priority, setPriority] = useState<'' | Project['priority']>(initialRoute.list.priority);
  const [archiveState, setArchiveState] = useState<'active' | 'archived'>(
    initialRoute.list.archiveState,
  );
  const [order, setOrder] = useState<'position' | 'name' | 'targetDate' | 'updatedAt'>(
    initialRoute.list.order,
  );
  const [direction, setDirection] = useState<'asc' | 'desc'>(initialRoute.list.direction);
  const [density, setDensity] = useState<ProjectDensity>(initialRoute.list.density);
  const [groupBy, setGroupBy] = useState<ProjectViewGrouping>(initialRoute.list.groupBy);
  const [visibleProperties, setVisibleProperties] = useState<ProjectViewProperty[]>(
    initialRoute.list.visibleProperties,
  );
  const effectiveGroupBy = systemTeam !== undefined && groupBy === 'team' ? 'none' : groupBy;
  const effectiveVisibleProperties = useMemo(
    () => systemTeam === undefined
      ? visibleProperties
      : visibleProperties.filter((property) => property !== 'team'),
    [systemTeam, visibleProperties],
  );
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(
    initialRoute.list.collapsedGroups,
  );
  const [includeArchivedMilestones, setIncludeArchivedMilestones] = useState(false);
  const [milestoneCreateOpen, setMilestoneCreateOpen] = useState(false);
  const [milestoneAnnouncement, setMilestoneAnnouncement] = useState('');
  const [milestoneDrag, setMilestoneDrag] = useState<MilestonePointerDrag | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [preferredFocusedProjectId, setPreferredFocusedProjectId] = useState<string | null>(null);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [bulkProjectResult, setBulkProjectResult] = useState<{ updated: number; failed: number } | null>(null);
  const projectTableRef = useRef<HTMLDivElement>(null);
  const milestoneListRef = useRef<HTMLOListElement>(null);
  const milestoneDragRef = useRef<MilestonePointerDrag | null>(null);
  const addMilestoneButtonRef = useRef<HTMLButtonElement>(null);
  const milestoneArchivedToggleRef = useRef<HTMLInputElement>(null);
  const projectSearchRef = useRef<HTMLInputElement>(null);
  const archiveUndoButtonRef = useRef<HTMLButtonElement>(null);
  const focusReturnProjectId = useRef<string | null>(null);
  const selectedProjectIdRef = useRef(selectedProjectId);
  const routeWorkspaceIdRef = useRef(workspaceId);
  selectedProjectIdRef.current = selectedProjectId;

  const setMilestoneDragState = (next: MilestonePointerDrag | null) => {
    milestoneDragRef.current = next;
    setMilestoneDrag(next);
  };

  useEffect(() => writeProjectDensity(localStorage, density), [density]);

  useEffect(() => {
    if (canWriteProjects) return;
    setDialog(null);
    setMilestoneEdit(null);
    setMilestoneEditRecovery(null);
    setMilestoneEditNotice(null);
    setSuppressedMilestoneEditError(null);
    setProjectContentEdit(null);
    setProjectContentRecovery(null);
    setProjectContentNotice(null);
    setProjectPropertyNotice(null);
    setSuppressedProjectContentError(null);
    setMilestoneCreateOpen(false);
    setMilestoneDragState(null);
    setSelectedProjectIds(new Set());
    setOpenProjectMenuId(null);
    setArchiveNotice(null);
  }, [canWriteProjects]);

  useEffect(() => {
    if (!canPurgeProjects) setProjectPurgeOpen(false);
  }, [canPurgeProjects]);

  useEffect(() => {
    if (!canPurgeMilestones) setMilestonePurgeTarget(null);
  }, [canPurgeMilestones]);

  useEffect(() => {
    setProjectPurgeOpen(false);
    setMilestonePurgeTarget(null);
  }, [selectedProjectId]);

  const listRouteState = useMemo(() => ({
    query,
    status,
    priority,
    archiveState,
    order,
    direction,
    density,
    groupBy: effectiveGroupBy,
    visibleProperties: effectiveVisibleProperties,
    collapsedGroups,
  }), [
    query,
    status,
    priority,
    archiveState,
    order,
    direction,
    density,
    effectiveGroupBy,
    effectiveVisibleProperties,
    collapsedGroups,
  ]);

  const focusProjectRecord = (projectId: string | null) => {
    if (projectId !== null) setPreferredFocusedProjectId(projectId);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = projectId === null
        ? null
        : projectTableRef.current?.querySelector<HTMLElement>(`[data-project-id="${projectId}"]`);
      (target ?? projectSearchRef.current)?.focus();
    }));
  };

  const focusArchiveUndo = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    archiveUndoButtonRef.current?.focus();
  }));

  function openProject(projectId: string) {
    focusReturnProjectId.current = projectId;
    setPreferredFocusedProjectId(projectId);
    setOpenProjectMenuId(null);
    selectedProjectIdRef.current = projectId;
    setSelectedProjectId(projectId);
    setTab('overview');
    setMilestoneIssueFilterId(null);
    const url = projectNavigationUrl(window.location.href, {
      list: listRouteState,
      projectId,
      tab: 'overview',
      milestoneId: null,
    });
    window.history.pushState(projectRouteHistoryState(window.history.state, projectId), '', url);
  }

  function closeProject() {
    const currentProjectId = selectedProjectIdRef.current;
    if (currentProjectId !== null && isPushedProjectRoute(window.history.state, currentProjectId)) {
      window.history.back();
      return;
    }
    const focusId = focusReturnProjectId.current ?? currentProjectId;
    focusReturnProjectId.current = null;
    selectedProjectIdRef.current = null;
    setSelectedProjectId(null);
    setTab('overview');
    setMilestoneIssueFilterId(null);
    const url = projectNavigationUrl(window.location.href, {
      list: listRouteState,
      projectId: null,
      tab: 'overview',
      milestoneId: null,
    });
    window.history.replaceState(projectRouteHistoryState(window.history.state, null), '', url);
    focusProjectRecord(focusId);
  }

  function closePurgedProject() {
    focusReturnProjectId.current = null;
    selectedProjectIdRef.current = null;
    setSelectedProjectId(null);
    setTab('overview');
    setMilestoneIssueFilterId(null);
    const url = projectNavigationUrl(window.location.href, {
      list: listRouteState,
      projectId: null,
      tab: 'overview',
      milestoneId: null,
    });
    window.history.replaceState(projectRouteHistoryState(window.history.state, null), '', url);
    focusProjectRecord(null);
  }

  function syncProjectRouteFromLocation() {
    if (new URLSearchParams(window.location.search).get('view') !== 'projects') return;
    const next = projectRouteFromSearch(
      window.location.search,
      defaultProjectListRouteState(readProjectDensity(localStorage)),
    );
    const previousProjectId = selectedProjectIdRef.current;
    selectedProjectIdRef.current = next.projectId;
    setSearchDraft(next.list.query);
    setQuery(next.list.query);
    setStatus(next.list.status);
    setPriority(next.list.priority);
    setArchiveState(next.list.archiveState);
    setOrder(next.list.order);
    setDirection(next.list.direction);
    setDensity(next.list.density);
    setGroupBy(next.list.groupBy);
    setVisibleProperties(next.list.visibleProperties);
    setCollapsedGroups(next.list.collapsedGroups);
    setSelectedProjectId(next.projectId);
    setTab(next.tab);
    setMilestoneIssueFilterId(next.milestoneId);
    setDialog(null);
    setMilestoneEdit(null);
    setMilestoneEditRecovery(null);
    setMilestoneEditNotice(null);
    setMilestonePurgeTarget(null);
    setSuppressedMilestoneEditError(null);
    setMilestoneCreateOpen(false);
    setOpenProjectMenuId(null);
    if (next.projectId !== null) {
      focusReturnProjectId.current = next.projectId;
      setPreferredFocusedProjectId(next.projectId);
    } else if (previousProjectId !== null) {
      const focusId = focusReturnProjectId.current ?? previousProjectId;
      focusReturnProjectId.current = null;
      focusProjectRecord(focusId);
    }
  }

  useEffect(() => {
    if (routeWorkspaceIdRef.current !== workspaceId) return;
    const pushed = selectedProjectId !== null
      && isPushedProjectRoute(window.history.state, selectedProjectId);
    const url = projectNavigationUrl(window.location.href, {
      list: listRouteState,
      projectId: selectedProjectId,
      tab,
      milestoneId: milestoneIssueFilterId,
    });
    window.history.replaceState(
      projectRouteHistoryState(window.history.state, pushed ? selectedProjectId : null),
      '',
      url,
    );
  }, [workspaceId, listRouteState, selectedProjectId, tab, milestoneIssueFilterId]);

  useEffect(() => {
    if (routeWorkspaceIdRef.current === workspaceId) return;
    routeWorkspaceIdRef.current = workspaceId;
    setSelectedProjectId(null);
    setTab('overview');
    setMilestoneIssueFilterId(null);
    setSelectedProjectIds(new Set());
    setPreferredFocusedProjectId(null);
    setOpenProjectMenuId(null);
    setBulkProjectResult(null);
    setArchiveNotice(null);
    setMilestoneCreateOpen(false);
    setMilestoneAnnouncement('');
    setMilestoneDragState(null);
    setMilestoneEdit(null);
    setMilestoneEditRecovery(null);
    setMilestoneEditNotice(null);
    setMilestonePurgeTarget(null);
    setSuppressedMilestoneEditError(null);
    focusReturnProjectId.current = null;
    const url = projectNavigationUrl(window.location.href, {
      list: listRouteState,
      projectId: null,
      tab: 'overview',
      milestoneId: null,
    });
    window.history.replaceState(projectRouteHistoryState(window.history.state, null), '', url);
  }, [workspaceId]);

  useEffect(() => {
    setMilestoneCreateOpen(false);
    setMilestoneAnnouncement('');
    setMilestoneDragState(null);
    setMilestoneEdit(null);
    setMilestoneEditRecovery(null);
    setMilestoneEditNotice(null);
    setSuppressedMilestoneEditError(null);
    setProjectContentEdit(null);
    setProjectContentRecovery(null);
    setProjectContentNotice(null);
    setProjectPropertyNotice(null);
    setSuppressedProjectContentError(null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (openProjectSignal <= 0) return;
    if (openProjectId) openProject(openProjectId);
    else syncProjectRouteFromLocation();
    onOpenProjectHandled?.();
  }, [openProjectId, openProjectSignal, onOpenProjectHandled]);

  useEffect(() => {
    window.addEventListener('popstate', syncProjectRouteFromLocation);
    return () => window.removeEventListener('popstate', syncProjectRouteFromLocation);
  }, []);

  const filters = useMemo(() => ({
    ...(systemTeam === undefined ? {} : { teamId: systemTeam.id }),
    ...(query === '' ? {} : { query }),
    ...(status === '' ? {} : { status }),
    ...(priority === '' ? {} : { priority }),
    archiveState,
    order,
    direction,
  }), [systemTeam, query, status, priority, archiveState, order, direction]);
  const projects = useQuery({
    queryKey: ['projects', workspaceId, filters],
    queryFn: () => api.projects(workspaceId, filters),
    enabled: workspaceId !== '',
  });
  const project = useQuery({
    queryKey: ['project', workspaceId, selectedProjectId],
    queryFn: () => api.project(workspaceId, selectedProjectId ?? ''),
    enabled: selectedProjectId !== null,
  });
  const selectedProjectInScope = systemTeam === undefined
    || project.data === undefined
    || project.data.teamId === systemTeam.id;
  const milestones = useQuery({
    queryKey: ['milestones', workspaceId, selectedProjectId, includeArchivedMilestones],
    queryFn: () => api.milestones(workspaceId, selectedProjectId ?? '', includeArchivedMilestones),
    enabled: selectedProjectId !== null && selectedProjectInScope,
  });
  const activity = useQuery({
    queryKey: ['project-activity', workspaceId, selectedProjectId],
    queryFn: () => api.projectActivity(workspaceId, selectedProjectId ?? ''),
    enabled: selectedProjectId !== null && selectedProjectInScope && tab === 'activity',
  });

  useEffect(() => {
    if (selectedProjectId === null || project.data === undefined || selectedProjectInScope) return;
    focusReturnProjectId.current = null;
    selectedProjectIdRef.current = null;
    setSelectedProjectId(null);
    setTab('overview');
    setMilestoneIssueFilterId(null);
    const url = projectNavigationUrl(window.location.href, {
      list: listRouteState,
      projectId: null,
      tab: 'overview',
      milestoneId: null,
    });
    window.history.replaceState(projectRouteHistoryState(null, null), '', url);
  }, [selectedProjectId, project.data, selectedProjectInScope, listRouteState]);
  const projectGroups = useMemo(
    () => groupProjects(projects.data ?? [], effectiveGroupBy, teams, members),
    [projects.data, effectiveGroupBy, teams, members],
  );
  const visibleProjectIds = useMemo(
    () => visibleGroupedProjectIds(projectGroups, collapsedGroups),
    [projectGroups, collapsedGroups],
  );
  const visibleProjects = useMemo(() => {
    const projectsById = new Map((projects.data ?? []).map((item) => [item.id, item]));
    return visibleProjectIds.flatMap((projectId) => {
      const item = projectsById.get(projectId);
      return item === undefined ? [] : [item];
    });
  }, [projects.data, visibleProjectIds]);
  const visibleProjectIndex = useMemo(
    () => new Map(visibleProjectIds.map((projectId, index) => [projectId, index])),
    [visibleProjectIds],
  );
  const rovingProjectId = resolveRovingProjectId(visibleProjectIds, preferredFocusedProjectId);
  const selectedProjects = useMemo(
    () => (projects.data ?? []).filter((item) => selectedProjectIds.has(item.id)),
    [projects.data, selectedProjectIds],
  );

  useEffect(() => {
    if (projects.data === undefined) return;
    const visibleIds = new Set(projects.data.map((item) => item.id));
    setSelectedProjectIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
    setOpenProjectMenuId((current) => current !== null && !visibleIds.has(current) ? null : current);
  }, [projects.data]);

  const refreshProjects = async (projectId?: string) => {
    const tasks = [client.invalidateQueries({ queryKey: ['projects', workspaceId] })];
    if (projectId !== undefined) {
      tasks.push(client.invalidateQueries({ queryKey: ['project', workspaceId, projectId] }));
      tasks.push(client.invalidateQueries({ queryKey: ['project-activity', workspaceId, projectId] }));
    }
    await Promise.all(tasks);
  };
  const refreshMilestones = async (projectId: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['milestones', workspaceId, projectId] }),
      client.invalidateQueries({ queryKey: ['project', workspaceId, projectId] }),
      client.invalidateQueries({ queryKey: ['projects', workspaceId] }),
      client.invalidateQueries({ queryKey: ['project-activity', workspaceId, projectId] }),
    ]);
  };
  const cacheMilestoneReadback = (projectId: string, records: Milestone[]) => {
    client.setQueryData(['milestones', workspaceId, projectId, true], records);
    client.setQueryData(
      ['milestones', workspaceId, projectId, false],
      records.filter((milestone) => milestone.archivedAt === null),
    );
  };
  const refreshMilestoneContext = async (projectId: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['project', workspaceId, projectId] }),
      client.invalidateQueries({ queryKey: ['projects', workspaceId] }),
      client.invalidateQueries({ queryKey: ['project-activity', workspaceId, projectId] }),
    ]);
  };

  const createProject = useMutation({
    mutationFn: (draft: ProjectDraft) => api.createProject(workspaceId, draft),
    onSuccess: async (created) => {
      setDialog(null);
      openProject(created.id);
      await refreshProjects(created.id);
    },
  });
  const updateProjectContent = useMutation({
    mutationFn: ({ projectId, input }: {
      projectId: string;
      input: UpdateProjectRequest;
      draft: ProjectContentDraft;
    }) => api.updateProject(workspaceId, projectId, input),
    onMutate: () => {
      setProjectContentNotice(null);
      setSuppressedProjectContentError(null);
      setProjectContentRecovery(null);
    },
    onSuccess: async (updated) => {
      setProjectContentEdit(null);
      setProjectContentRecovery(null);
      setSuppressedProjectContentError(null);
      setProjectContentNotice({
        tone: 'success',
        message: `Project content saved. Revision ${updated.revision}.`,
      });
      client.setQueryData(['project', workspaceId, updated.id], updated);
      await refreshProjects(updated.id);
    },
    onError: async (error, variables) => {
      try {
        const confirmed = await api.project(workspaceId, variables.projectId);
        client.setQueryData(['project', workspaceId, variables.projectId], confirmed);
        if (error instanceof ApiError && error.code === 'CONFLICT') {
          setSuppressedProjectContentError(error);
          setProjectContentRecovery({
            projectId: variables.projectId,
            confirmedRevision: confirmed.revision,
            draft: variables.draft,
          });
          setProjectContentNotice({
            tone: 'error',
            message: `Project content was not saved because the project changed. Server values restored at revision ${confirmed.revision}.`,
          });
        } else {
          setProjectContentNotice({
            tone: 'error',
            message: `Project content was not saved. Server values restored at revision ${confirmed.revision}.`,
          });
        }
        await client.invalidateQueries({ queryKey: ['projects', workspaceId] });
      } catch {
        setProjectContentNotice({
          tone: 'error',
          message: 'Project content was not saved and the current server revision could not be confirmed.',
        });
        await client.invalidateQueries({ queryKey: ['project', workspaceId, variables.projectId] });
      }
    },
  });
  const inlineProjectUpdate = useMutation({
    mutationFn: ({ projectId, input }: {
      projectId: string;
      label: string;
      input: UpdateProjectRequest;
    }) => api.updateProject(workspaceId, projectId, input),
    onMutate: () => {
      setProjectPropertyNotice(null);
    },
    onSuccess: async (updated, { label }) => {
      client.setQueryData(['project', workspaceId, updated.id], updated);
      setProjectPropertyNotice({
        tone: 'success',
        message: `${label} updated. Revision ${updated.revision}.`,
      });
      await refreshProjects(updated.id);
    },
    onError: async (error, { projectId, label }) => {
      try {
        const confirmed = await api.project(workspaceId, projectId);
        client.setQueryData(['project', workspaceId, projectId], confirmed);
        setProjectPropertyNotice({
          tone: 'error',
          message: error instanceof ApiError && error.code === 'CONFLICT'
            ? `${label} was not applied because the project changed. Server values restored at revision ${confirmed.revision}.`
            : `${label} was not applied. Server values restored at revision ${confirmed.revision}.`,
        });
        await client.invalidateQueries({ queryKey: ['projects', workspaceId] });
      } catch {
        setProjectPropertyNotice({
          tone: 'error',
          message: `${label} was not applied and the current server revision could not be confirmed.`,
        });
        await client.invalidateQueries({ queryKey: ['project', workspaceId, projectId] });
      }
    },
  });
  const setProjectArchive = useMutation({
    mutationFn: ({ current }: { current: Project; source: 'direct' | 'undo' }) =>
      current.archivedAt === null
        ? api.archiveProject(workspaceId, current.id, current.revision)
        : api.restoreProject(workspaceId, current.id, current.revision),
    onMutate: ({ source }) => {
      if (source === 'direct') setArchiveNotice(null);
      setProjectPurgeNotice(null);
    },
    onSuccess: async (updated) => {
      setProjectContentEdit(null);
      setProjectContentRecovery(null);
      setProjectContentNotice(null);
      setProjectPropertyNotice(null);
      const archived = updated.archivedAt !== null;
      setArchiveNotice({
        kind: 'project',
        tone: 'success',
        message: `${updated.name} ${archived ? 'archived' : 'restored'}.`,
        undoTarget: archived ? { kind: 'project', record: updated } : null,
      });
      const hiddenByCurrentList = (updated.archivedAt !== null && archiveState === 'active')
        || (updated.archivedAt === null && archiveState === 'archived');
      if (hiddenByCurrentList && selectedProjectIdRef.current === updated.id) closeProject();
      await refreshProjects(updated.id);
      if (archived) focusArchiveUndo();
      else focusProjectRecord(updated.id);
    },
    onError: async (_error, { current, source }) => {
      if (source !== 'undo') return;
      setArchiveNotice({
        kind: 'project',
        tone: 'error',
        message: `${current.name} could not be restored. It remains in Archive, where you can retry.`,
        undoTarget: null,
      });
      try {
        await refreshProjects(current.id);
      } finally {
        focusProjectRecord(null);
      }
    },
  });
  const purgeProject = useMutation({
    mutationFn: ({ current, confirmation }: { current: Project; confirmation: string }) =>
      api.purgeProject(workspaceId, current.id, current.revision, confirmation),
    onMutate: () => {
      setProjectPurgeNotice(null);
      setArchiveNotice(null);
    },
    onSuccess: async (receipt) => {
      setProjectPurgeOpen(false);
      setProjectContentEdit(null);
      setProjectContentRecovery(null);
      setProjectContentNotice(null);
      setProjectPropertyNotice(null);
      setMilestoneEdit(null);
      setMilestoneEditRecovery(null);
      setMilestoneEditNotice(null);
      setMilestonePurgeTarget(null);
      setMilestoneCreateOpen(false);
      setProjectPurgeNotice(
        `${receipt.name} purged. ${receipt.detachedIssueCount} ${receipt.detachedIssueCount === 1 ? 'issue was' : 'issues were'} preserved and moved to no project; ${receipt.removedMilestoneCount} ${receipt.removedMilestoneCount === 1 ? 'milestone was' : 'milestones were'} removed.`,
      );
      closePurgedProject();
      await Promise.all([
        client.invalidateQueries({ queryKey: ['projects', workspaceId] }),
        client.invalidateQueries({ queryKey: ['issues', workspaceId] }),
        client.invalidateQueries({ queryKey: ['workspace-milestones', workspaceId] }),
        client.invalidateQueries({ queryKey: ['milestones', workspaceId] }),
        client.invalidateQueries({ queryKey: ['issue-activity', workspaceId] }),
      ]);
    },
  });
  const setSelectedProjectArchive = useMutation({
    mutationFn: async (current: Project[]) => {
      const results = await Promise.all(current.map(async (item) => {
        try {
          if (item.archivedAt === null) {
            await api.archiveProject(workspaceId, item.id, item.revision);
          } else {
            await api.restoreProject(workspaceId, item.id, item.revision);
          }
          return { id: item.id, updated: true };
        } catch {
          return { id: item.id, updated: false };
        }
      }));
      return results;
    },
    onSuccess: async (results) => {
      const failedIds = new Set(results.filter((result) => !result.updated).map((result) => result.id));
      setSelectedProjectIds(failedIds);
      setBulkProjectResult({
        updated: results.length - failedIds.size,
        failed: failedIds.size,
      });
      await refreshProjects();
    },
  });
  const reorderProjects = useMutation({
    mutationFn: (ordered: Project[]) => api.reorderProjects(workspaceId, ordered),
    onSuccess: async (ordered) => {
      client.setQueryData(['projects', workspaceId, filters], ordered);
      await client.invalidateQueries({ queryKey: ['project-activity', workspaceId] });
    },
  });
  const createMilestone = useMutation({
    mutationFn: ({ projectId, draft }: { projectId: string; draft: MilestoneDraft }) =>
      api.createMilestone(workspaceId, projectId, draft),
    onSuccess: async (created) => {
      setMilestoneCreateOpen(false);
      await refreshMilestones(created.projectId);
      const refreshed = client.getQueryData<Milestone[]>([
        'milestones',
        workspaceId,
        created.projectId,
        includeArchivedMilestones,
      ]) ?? [];
      const active = refreshed.filter((milestone) => milestone.archivedAt === null);
      const createdIndex = active.findIndex((milestone) => milestone.id === created.id);
      setMilestoneAnnouncement(createdIndex < 0
        ? `${created.name} added.`
        : `${created.name} added at position ${createdIndex + 1} of ${active.length}.`);
      requestAnimationFrame(() => milestoneListRef.current
        ?.querySelector<HTMLElement>(`[data-milestone-id="${created.id}"]`)
        ?.focus());
    },
  });
  const updateMilestone = useMutation({
    mutationFn: ({ projectId, milestoneId, input }: {
      projectId: string;
      milestoneId: string;
      input: UpdateMilestoneRequest;
      draft: MilestoneEditDraft;
    }) => api.updateMilestone(workspaceId, projectId, milestoneId, input),
    onMutate: () => {
      setMilestoneEditNotice(null);
      setMilestoneEditRecovery(null);
      setSuppressedMilestoneEditError(null);
    },
    onSuccess: async (updated) => {
      setMilestoneEdit(null);
      setMilestoneEditRecovery(null);
      setSuppressedMilestoneEditError(null);
      setMilestoneEditNotice({
        tone: 'success',
        message: `${updated.name} saved. Revision ${updated.revision}.`,
      });
      await refreshMilestones(updated.projectId);
      requestAnimationFrame(() => requestAnimationFrame(() => milestoneListRef.current
        ?.querySelector<HTMLButtonElement>(`[data-milestone-edit="${updated.id}"]`)
        ?.focus()));
    },
    onError: async (error, variables) => {
      try {
        const records = await api.milestones(workspaceId, variables.projectId, true);
        const confirmed = records.find((milestone) => milestone.id === variables.milestoneId);
        if (confirmed === undefined) throw new Error('Milestone readback did not include the edited record.');
        cacheMilestoneReadback(variables.projectId, records);
        if (confirmed.archivedAt !== null) setIncludeArchivedMilestones(true);
        setMilestoneEdit({
          milestoneId: variables.milestoneId,
          baseline: confirmed,
          draft: variables.draft,
        });
        setMilestoneEditRecovery({
          milestoneId: variables.milestoneId,
          confirmedRevision: confirmed.revision,
        });
        const conflict = error instanceof ApiError
          && (error.code === 'CONFLICT' || error.code === 'REVISION_CONFLICT');
        setSuppressedMilestoneEditError(conflict ? error : null);
        setMilestoneEditNotice({
          tone: 'error',
          message: conflict
            ? `Milestone was not saved because it changed. Server values restored at revision ${confirmed.revision}.`
            : `Milestone was not saved. Server values restored at revision ${confirmed.revision}.`,
        });
        await refreshMilestoneContext(variables.projectId);
      } catch {
        setMilestoneEditNotice({
          tone: 'error',
          message: 'Milestone was not saved and the current server revision could not be confirmed.',
        });
        await client.invalidateQueries({
          queryKey: ['milestones', workspaceId, variables.projectId],
        });
      }
    },
  });
  const setMilestoneArchive = useMutation({
    mutationFn: ({ current }: { current: Milestone; source: 'direct' | 'undo' }) =>
      current.archivedAt === null
        ? api.archiveMilestone(workspaceId, current.projectId, current.id, current.revision)
        : api.restoreMilestone(workspaceId, current.projectId, current.id, current.revision),
    onMutate: ({ source }) => {
      if (source === 'direct') setArchiveNotice(null);
      setProjectPurgeNotice(null);
    },
    onSuccess: async (updated) => {
      const archived = updated.archivedAt !== null;
      setArchiveNotice({
        kind: 'milestone',
        tone: 'success',
        message: `${updated.name} ${archived ? 'archived' : 'restored'}.`,
        undoTarget: archived ? { kind: 'milestone', record: updated } : null,
      });
      await refreshMilestones(updated.projectId);
      if (archived) {
        focusArchiveUndo();
      } else {
        requestAnimationFrame(() => requestAnimationFrame(() => milestoneListRef.current
          ?.querySelector<HTMLButtonElement>(`[data-milestone-archive="${updated.id}"]`)
          ?.focus()));
      }
    },
    onError: async (_error, { current, source }) => {
      if (source !== 'undo') return;
      setArchiveNotice({
        kind: 'milestone',
        tone: 'error',
        message: `${current.name} could not be restored. It remains in Archive, where you can retry.`,
        undoTarget: null,
      });
      try {
        await refreshMilestones(current.projectId);
      } finally {
        requestAnimationFrame(() => milestoneArchivedToggleRef.current?.focus());
      }
    },
  });
  const purgeMilestone = useMutation({
    mutationFn: ({ milestone, confirmation }: {
      milestone: Milestone;
      confirmation: string;
      focusId: string | null;
    }) => api.purgeMilestone(
      workspaceId,
      milestone.projectId,
      milestone.id,
      milestone.revision,
      confirmation,
    ),
    onMutate: () => {
      setMilestoneEditNotice(null);
      setArchiveNotice(null);
    },
    onSuccess: async (receipt, variables) => {
      setMilestonePurgeTarget(null);
      setMilestoneEdit(null);
      setMilestoneEditRecovery(null);
      setMilestoneCreateOpen(false);
      if (milestoneIssueFilterId === receipt.id) setMilestoneIssueFilterId(null);
      const issueLabel = receipt.detachedIssueCount === 1 ? 'issue was' : 'issues were';
      setMilestoneEditNotice({
        tone: 'success',
        message: `${receipt.name} purged. ${receipt.detachedIssueCount} ${issueLabel} preserved in this project and moved to no milestone.`,
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['milestones', workspaceId, receipt.projectId] }),
        client.invalidateQueries({ queryKey: ['workspace-milestones', workspaceId] }),
        client.invalidateQueries({ queryKey: ['issues', workspaceId] }),
        client.invalidateQueries({ queryKey: ['issue-activity', workspaceId] }),
        client.invalidateQueries({ queryKey: ['project', workspaceId, receipt.projectId] }),
        client.invalidateQueries({ queryKey: ['projects', workspaceId] }),
        client.invalidateQueries({ queryKey: ['project-activity', workspaceId, receipt.projectId] }),
      ]);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const target = variables.focusId === null
          ? null
          : milestoneListRef.current
            ?.querySelector<HTMLElement>(`[data-milestone-id="${variables.focusId}"]`);
        (target ?? milestoneArchivedToggleRef.current)?.focus();
      }));
    },
  });
  const reorderMilestones = useMutation({
    mutationFn: ({ projectId, ordered }: {
      projectId: string;
      ordered: Milestone[];
      movedId: string;
      movedName: string;
      direction: 'up' | 'down' | 'drag';
    }) =>
      api.reorderMilestones(workspaceId, projectId, ordered),
    onMutate: (variables) => setMilestoneAnnouncement(
      variables.direction === 'drag' ? `Moving ${variables.movedName}.` : '',
    ),
    onSuccess: async (ordered, variables) => {
      const moved = ordered.find((milestone) => milestone.id === variables.movedId);
      setMilestoneAnnouncement(moved === undefined
        ? 'Milestone order updated.'
        : milestonePositionAnnouncement(moved.name, ordered, moved.id) ?? 'Milestone order updated.');
      await refreshMilestones(variables.projectId);
      requestAnimationFrame(() => {
        const row = milestoneListRef.current
          ?.querySelector<HTMLElement>(`[data-milestone-id="${variables.movedId}"]`);
        if (variables.direction === 'drag') {
          row?.focus();
          return;
        }
        const control = row?.querySelector<HTMLButtonElement>(
          `[data-milestone-move="${variables.direction}"]:not(:disabled)`,
        );
        (control ?? row)?.focus();
      });
    },
    onError: (_error, variables) => {
      setMilestoneAnnouncement(
        `${variables.movedName} could not be moved. The previous order is unchanged.`,
      );
      requestAnimationFrame(() => milestoneListRef.current
        ?.querySelector<HTMLElement>(`[data-milestone-id="${variables.movedId}"]`)
        ?.focus());
    },
  });

  const canReorderProjects = canWriteProjects && query === '' && status === '' && priority === ''
    && archiveState === 'active' && order === 'position' && direction === 'asc'
    && effectiveGroupBy === 'none';
  const projectTableStyle = {
    '--project-grid-template': projectGridTemplate(effectiveVisibleProperties),
  } as CSSProperties;
  const moveProject = (index: number, offset: -1 | 1) => {
    const current = projects.data ?? [];
    const destination = index + offset;
    if (!canReorderProjects || destination < 0 || destination >= current.length) return;
    const ordered = [...current];
    const item = ordered[index];
    const target = ordered[destination];
    if (!item || !target) return;
    ordered[index] = target;
    ordered[destination] = item;
    reorderProjects.mutate(ordered);
  };
  const toggleProjectGroup = (groupKey: string) => {
    setOpenProjectMenuId(null);
    setCollapsedGroups((current) => current.includes(groupKey)
      ? current.filter((key) => key !== groupKey)
      : [...current, groupKey].slice(0, 32));
  };
  const toggleProjectSelection = (projectId: string) => {
    if (!canWriteProjects) return;
    setBulkProjectResult(null);
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };
  const focusProjectRow = (index: number) => {
    const current = visibleProjects;
    if (current.length === 0) return;
    const bounded = Math.max(0, Math.min(index, current.length - 1));
    const target = current[bounded];
    if (target === undefined) return;
    setPreferredFocusedProjectId(target.id);
    requestAnimationFrame(() => projectTableRef.current?.querySelector<HTMLElement>(`[data-project-id="${target.id}"]`)?.focus());
  };
  const openProjectMenu = (projectId: string) => {
    setPreferredFocusedProjectId(projectId);
    setOpenProjectMenuId(projectId);
    requestAnimationFrame(() => document.getElementById(`project-menu-${projectId}`)?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus());
  };
  const closeProjectMenu = (projectId: string, restoreFocus = true) => {
    setOpenProjectMenuId(null);
    if (restoreFocus) {
      requestAnimationFrame(() => projectTableRef.current?.querySelector<HTMLElement>(`[data-project-id="${projectId}"]`)?.focus());
    }
  };
  const projectMenuKey = (event: KeyboardEvent<HTMLDivElement>, projectId: string) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeProjectMenu(projectId);
      return;
    }
    if (event.key === 'Tab') {
      setOpenProjectMenuId(null);
      return;
    }
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')];
    if (items.length === 0) return;
    const currentIndex = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
    const nextIndex = resolveMenuFocusIndex(event.key, currentIndex, items.length);
    if (nextIndex === null) return;
    event.preventDefault();
    items[nextIndex]?.focus();
  };
  const rowKey = (event: KeyboardEvent<HTMLDivElement>, index: number, projectId: string) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const action = resolveRecordKeyAction({
      key: event.key,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      repeat: event.repeat,
      isComposing: event.nativeEvent.isComposing,
      defaultPrevented: event.defaultPrevented,
      withinExcludedTarget: Boolean(target?.closest('button, input, select, textarea, a, [contenteditable="true"]')),
      selectionEnabled: canWriteProjects,
      menuEnabled: true,
    });
    if (action === null) return;
    event.preventDefault();
    if (action === 'open') {
      openProject(projectId);
    } else if (action === 'toggle-selection') {
      toggleProjectSelection(projectId);
    } else if (action === 'next') {
      focusProjectRow(index + 1);
    } else if (action === 'previous') {
      focusProjectRow(index - 1);
    } else if (action === 'open-menu') {
      openProjectMenu(projectId);
    }
  };
  const closeMilestoneCreate = (restoreFocus = true) => {
    createMilestone.reset();
    setMilestoneCreateOpen(false);
    if (restoreFocus) requestAnimationFrame(() => addMilestoneButtonRef.current?.focus());
  };
  const undoArchiveAction = () => {
    const target = archiveNotice?.undoTarget;
    if (target === null || target === undefined) return;
    if (target.kind === 'project') {
      setProjectArchive.mutate({ current: target.record, source: 'undo' });
    } else {
      setMilestoneArchive.mutate({ current: target.record, source: 'undo' });
    }
  };
  const dismissArchiveNotice = () => {
    const kind = archiveNotice?.kind;
    setArchiveNotice(null);
    if (kind === 'milestone') {
      requestAnimationFrame(() => milestoneArchivedToggleRef.current?.focus());
    } else {
      focusProjectRecord(null);
    }
  };
  const archiveActionFeedback = archiveNotice === null ? null : (
    <ArchiveActionNotice
      message={archiveNotice.message}
      tone={archiveNotice.tone}
      undoAvailable={archiveNotice.undoTarget !== null}
      pending={archiveNotice.undoTarget?.kind === 'project'
        ? setProjectArchive.isPending
        : archiveNotice.undoTarget?.kind === 'milestone' && setMilestoneArchive.isPending}
      undoLabel={archiveNotice.undoTarget === null
        ? 'Undo archive'
        : `Undo archive for ${archiveNotice.undoTarget.record.name}`}
      undoButtonRef={archiveUndoButtonRef}
      onUndo={undoArchiveAction}
      onDismiss={dismissArchiveNotice}
    />
  );

  if (selectedProjectId !== null) {
    const current = selectedProjectInScope ? project.data : undefined;
    const projectBlockingError = project.data === undefined ? project.error : null;
    const activeProjectContentEdit = current !== undefined && projectContentEdit?.projectId === current.id
      ? projectContentEdit
      : null;
    const activeProjectContentRecovery = current !== undefined
      && projectContentRecovery?.projectId === current.id
      ? projectContentRecovery
      : null;
    const projectContentFormId = current === undefined ? undefined : `project-content-form-${current.id}`;
    const projectRevisionMutationPending = updateProjectContent.isPending
      || inlineProjectUpdate.isPending
      || setProjectArchive.isPending
      || purgeProject.isPending
      || purgeMilestone.isPending;
    const activeMilestoneEdit = current !== undefined
      && milestoneEdit?.baseline.projectId === current.id
      ? milestoneEdit
      : null;
    const activeMilestoneEditRecovery = activeMilestoneEdit !== null
      && milestoneEditRecovery?.milestoneId === activeMilestoneEdit.milestoneId
      ? milestoneEditRecovery
      : null;
    const milestoneRevisionMutationPending = updateMilestone.isPending
      || setMilestoneArchive.isPending
      || purgeMilestone.isPending
      || reorderMilestones.isPending;
    const milestoneMutationPending = createMilestone.isPending
      || milestoneRevisionMutationPending;
    const milestoneInteractionLocked = milestoneMutationPending
      || milestoneCreateOpen
      || activeMilestoneEdit !== null
      || milestonePurgeTarget !== null;
    const openProjectContentEditor = (value: Project) => {
      updateProjectContent.reset();
      setSuppressedProjectContentError(null);
      setProjectContentRecovery(null);
      setProjectContentNotice(null);
      setProjectContentEdit({ projectId: value.id, draft: projectContentDraft(value) });
    };
    const updateProjectContentDraft = (patch: Partial<ProjectContentDraft>) => {
      if (current === undefined) return;
      setProjectContentEdit((value) => value?.projectId === current.id
        ? { ...value, draft: { ...value.draft, ...patch } }
        : value);
      setProjectContentRecovery(null);
      setProjectContentNotice(null);
    };
    const submitProjectContent = (value: Project, draft: ProjectContentDraft) => {
      if (projectRevisionMutationPending) return;
      const input = projectContentRequest(value, draft);
      if (input === null) {
        setProjectContentNotice({
          tone: 'error',
          message: 'Project content was not saved because it is unchanged or contains an invalid value.',
        });
        return;
      }
      updateProjectContent.mutate({ projectId: value.id, input, draft });
    };
    const submitProjectProperty = (label: string, change: ProjectInlinePropertyChange) => {
      if (current === undefined || projectRevisionMutationPending) return;
      const input = projectInlinePropertyRequest(current, change, members);
      if (input === null) {
        setProjectPropertyNotice({
          tone: 'error',
          message: `${label} was not applied because the selected value is unchanged or unavailable.`,
        });
        return;
      }
      inlineProjectUpdate.mutate({ projectId: current.id, label, input });
    };
    const focusMilestoneEditControl = (milestoneId: string) => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const row = milestoneListRef.current
          ?.querySelector<HTMLElement>(`[data-milestone-id="${milestoneId}"]`);
        (row?.querySelector<HTMLButtonElement>(`[data-milestone-edit="${milestoneId}"]`) ?? row)
          ?.focus();
      }));
    };
    const focusMilestoneEditor = (milestoneId: string) => {
      requestAnimationFrame(() => requestAnimationFrame(() => milestoneListRef.current
        ?.querySelector<HTMLInputElement>(`[data-milestone-editor="${milestoneId}"] input[name="name"]`)
        ?.focus()));
    };
    const openMilestoneEditor = (value: Milestone) => {
      if (milestoneMutationPending || value.archivedAt !== null) return;
      updateMilestone.reset();
      setMilestoneEditRecovery(null);
      setMilestoneEditNotice(null);
      setSuppressedMilestoneEditError(null);
      setMilestoneCreateOpen(false);
      setMilestoneEdit({
        milestoneId: value.id,
        baseline: value,
        draft: milestoneEditDraft(value),
      });
    };
    const updateMilestoneEditDraft = (patch: Partial<MilestoneEditDraft>) => {
      if (activeMilestoneEdit === null || updateMilestone.isPending) return;
      setMilestoneEdit((value) => value?.milestoneId === activeMilestoneEdit.milestoneId
        ? { ...value, draft: { ...value.draft, ...patch } }
        : value);
      setMilestoneEditRecovery(null);
      setMilestoneEditNotice(null);
      setSuppressedMilestoneEditError(null);
      updateMilestone.reset();
    };
    const submitMilestoneEdit = (edit: MilestoneEdit) => {
      if (milestoneRevisionMutationPending) return;
      const input = milestoneEditRequest(edit.baseline, edit.draft);
      if (input === null) {
        setMilestoneEditNotice({
          tone: 'error',
          message: 'Milestone was not saved because it is unchanged or contains an invalid value.',
        });
        return;
      }
      updateMilestone.mutate({
        projectId: edit.baseline.projectId,
        milestoneId: edit.milestoneId,
        input,
        draft: edit.draft,
      });
    };
    const closeMilestoneEditor = (milestoneId: string, restoreFocus = true) => {
      updateMilestone.reset();
      setMilestoneEdit(null);
      setMilestoneEditRecovery(null);
      setMilestoneEditNotice(null);
      setSuppressedMilestoneEditError(null);
      if (restoreFocus) focusMilestoneEditControl(milestoneId);
    };
    const useMilestoneServerValues = (value: Milestone) => {
      setMilestoneEdit({
        milestoneId: value.id,
        baseline: value,
        draft: milestoneEditDraft(value),
      });
      setMilestoneEditRecovery(null);
      setSuppressedMilestoneEditError(null);
      updateMilestone.reset();
      setMilestoneEditNotice({
        tone: 'success',
        message: `Server values loaded at revision ${value.revision}.`,
      });
      focusMilestoneEditor(value.id);
    };
    const activeMilestones = (milestones.data ?? []).filter((milestone) => milestone.archivedAt === null);
    const milestoneBlockingError = milestones.data === undefined ? milestones.error : null;
    const activityBlockingError = activity.data === undefined ? activity.error : null;
    const openMilestoneCreate = () => {
      createMilestone.reset();
      setMilestoneAnnouncement('');
      setMilestoneEditNotice(null);
      setMilestoneCreateOpen(true);
    };
    const milestoneIssueFilter = milestoneIssueFilterId === null
      ? null
      : (milestones.data ?? []).find((milestone) => milestone.id === milestoneIssueFilterId)
        ?? { id: milestoneIssueFilterId, name: 'Selected milestone' };
    const moveMilestone = (milestoneId: string, offset: -1 | 1) => {
      if (milestoneInteractionLocked) return;
      const ordered = reorderMilestoneForMove(activeMilestones, milestoneId, offset);
      if (ordered === null || current === undefined) return;
      const moved = activeMilestones.find((milestone) => milestone.id === milestoneId);
      if (moved === undefined) return;
      reorderMilestones.mutate({
        projectId: current.id,
        ordered,
        movedId: milestoneId,
        movedName: moved.name,
        direction: offset < 0 ? 'up' : 'down',
      });
    };
    const beginMilestoneDrag = (
      event: ReactPointerEvent<HTMLSpanElement>,
      milestone: Milestone,
    ) => {
      if (
        (event.pointerType === 'mouse' && event.button !== 0)
        || !canWriteProjects
        || current === undefined
        || current.archivedAt !== null
        || milestone.archivedAt !== null
        || activeMilestones.length < 2
        || milestoneInteractionLocked
      ) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setMilestoneAnnouncement('');
      setMilestoneDragState({
        pointerId: event.pointerId,
        sourceId: milestone.id,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        targetId: null,
        edge: null,
      });
    };
    const moveMilestoneDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
      const drag = milestoneDragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      if (!drag.active && !milestoneDragThresholdExceeded(
        drag.startX,
        drag.startY,
        event.clientX,
        event.clientY,
      )) return;
      event.preventDefault();
      const source = activeMilestones.find((milestone) => milestone.id === drag.sourceId);
      if (source === undefined) {
        setMilestoneDragState(null);
        return;
      }
      const targetRow = document.elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-milestone-drop-id]') ?? null;
      const targetId = targetRow?.dataset.milestoneDropId ?? null;
      if (targetRow === null || targetId === null || targetId === drag.sourceId) {
        if (!drag.active) setMilestoneAnnouncement(`${source.name} picked up.`);
        setMilestoneDragState({ ...drag, active: true, targetId: null, edge: null });
        return;
      }
      const edge = milestoneDropEdge(
        event.clientY,
        targetRow.getBoundingClientRect().top,
        targetRow.getBoundingClientRect().height,
      );
      const target = activeMilestones.find((milestone) => milestone.id === targetId);
      if (edge === null || target === undefined) {
        setMilestoneDragState({ ...drag, active: true, targetId: null, edge: null });
        return;
      }
      if (!drag.active || drag.targetId !== targetId || drag.edge !== edge) {
        setMilestoneAnnouncement(
          `${!drag.active ? `${source.name} picked up. ` : ''}${source.name} will move ${edge} ${target.name}.`,
        );
      }
      setMilestoneDragState({ ...drag, active: true, targetId, edge });
    };
    const finishMilestoneDrag = (
      event: ReactPointerEvent<HTMLSpanElement>,
      canceled = false,
    ) => {
      const drag = milestoneDragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      setMilestoneDragState(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (!drag.active) return;
      const source = activeMilestones.find((milestone) => milestone.id === drag.sourceId);
      if (source === undefined || current === undefined) return;
      if (canceled || drag.targetId === null || drag.edge === null) {
        setMilestoneAnnouncement(`${source.name} move canceled.`);
        milestoneListRef.current
          ?.querySelector<HTMLElement>(`[data-milestone-id="${source.id}"]`)
          ?.focus();
        return;
      }
      const ordered = reorderMilestoneForDrop(
        activeMilestones,
        source.id,
        drag.targetId,
        drag.edge,
      );
      if (ordered === null) {
        setMilestoneAnnouncement(`${source.name} order is unchanged.`);
        milestoneListRef.current
          ?.querySelector<HTMLElement>(`[data-milestone-id="${source.id}"]`)
          ?.focus();
        return;
      }
      if (milestoneInteractionLocked) {
        setMilestoneAnnouncement(`${source.name} move canceled because another milestone change is pending.`);
        return;
      }
      reorderMilestones.mutate({
        projectId: current.id,
        ordered,
        movedId: source.id,
        movedName: source.name,
        direction: 'drag',
      });
    };
    return (
      <section className={`project-detail project-detail-${tab}`} aria-labelledby={current ? 'project-title' : undefined} aria-label={current ? undefined : 'Project details'}>
        <button className="back-button" onClick={closeProject}><ArrowLeft size={15} /> Projects</button>
        {archiveActionFeedback}
        {project.isLoading ? <LoadingSkeleton variant="project" label="Loading project details" /> : projectBlockingError !== null ? (
          <QueryErrorState
            title="Could not load this project"
            error={projectBlockingError}
            retrying={project.isFetching}
            onRetry={() => { void project.refetch(); }}
          />
        ) : current ? (
          <>
            <ErrorNotice error={project.error} />
            <header className="project-hero">
              {activeProjectContentEdit === null ? (
                <div className="project-hero-title">
                  {projectIcon(current, 20)}
                  <div><h1 id="project-title">{current.name}</h1><p>{current.summary || 'No summary'}</p></div>
                </div>
              ) : (
                <form
                  id={projectContentFormId}
                  className="project-hero-editor"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitProjectContent(current, activeProjectContentEdit.draft);
                  }}
                >
                  <h1 id="project-title" className="sr-only">Edit {current.name}</h1>
                  <div className="project-identity-editor">
                    {projectIcon({ ...current, icon: activeProjectContentEdit.draft.icon, color: activeProjectContentEdit.draft.color }, 20)}
                    <label><span className="sr-only">Project icon</span><select aria-label="Project icon" value={activeProjectContentEdit.draft.icon} disabled={projectRevisionMutationPending} onChange={(event) => updateProjectContentDraft({ icon: event.target.value as Project['icon'] })}><option value="briefcase">Briefcase</option><option value="layers">Layers</option><option value="target">Target</option><option value="compass">Compass</option><option value="rocket">Rocket</option></select></label>
                    <label className="project-color-editor"><span className="sr-only">Project color</span><input aria-label="Project color" type="color" value={activeProjectContentEdit.draft.color} disabled={projectRevisionMutationPending} onChange={(event) => updateProjectContentDraft({ color: event.target.value })} /></label>
                  </div>
                  <div className="project-hero-copy-editor">
                    <label><span className="sr-only">Project name</span><input name="name" aria-label="Project name" value={activeProjectContentEdit.draft.name} maxLength={80} required disabled={projectRevisionMutationPending} onChange={(event) => updateProjectContentDraft({ name: event.target.value })} /></label>
                    <label><span className="sr-only">Project summary</span><textarea name="summary" aria-label="Project summary" value={activeProjectContentEdit.draft.summary} rows={2} maxLength={280} disabled={projectRevisionMutationPending} onChange={(event) => updateProjectContentDraft({ summary: event.target.value })} /></label>
                  </div>
                </form>
              )}
              <div className="project-actions">
                <span className={`project-status status-${current.status}`}>{titleCase(current.status)}</span>
                {activeProjectContentEdit === null ? (
                  <button className="icon-button" aria-label={`Edit ${current.name}`} title="Edit project content" onClick={() => openProjectContentEditor(current)} disabled={!canWriteProjects || current.archivedAt !== null || projectRevisionMutationPending}><Pencil size={15} /></button>
                ) : <>
                  <button type="button" className="button" onClick={() => { setProjectContentEdit(null); setProjectContentRecovery(null); setProjectContentNotice(null); updateProjectContent.reset(); }} disabled={projectRevisionMutationPending}>Cancel</button>
                  <button type="submit" className="button primary" form={projectContentFormId} disabled={projectRevisionMutationPending || activeProjectContentRecovery !== null}>{updateProjectContent.isPending ? <Spinner /> : <Save size={14} />}Save project content</button>
                </>}
                <button className="icon-button" aria-label={current.archivedAt === null ? `Archive ${current.name}` : `Restore ${current.name}`} title={current.archivedAt === null ? 'Archive project' : 'Restore project'} onClick={() => setProjectArchive.mutate({ current, source: 'direct' })} disabled={!canWriteProjects || projectRevisionMutationPending || activeProjectContentEdit !== null}>{current.archivedAt === null ? <Archive size={15} /> : <RefreshCcw size={15} />}</button>
                {canPurgeProjects && current.archivedAt !== null ? <button type="button" className="icon-button danger" data-project-purge aria-label={`Purge ${current.name}`} title="Purge project" onClick={() => { purgeProject.reset(); setProjectPurgeOpen(true); }} disabled={projectRevisionMutationPending || activeProjectContentEdit !== null}><Trash2 size={15} /></button> : null}
              </div>
            </header>
            <div
              className={`project-content-feedback ${updateProjectContent.isPending ? 'pending' : projectContentNotice?.tone ?? 'idle'}`}
              role={projectContentNotice?.tone === 'error' ? 'alert' : 'status'}
              aria-live={projectContentNotice?.tone === 'error' ? 'assertive' : 'polite'}
              aria-atomic="true"
            >
              {updateProjectContent.isPending ? <><Spinner />Saving project content...</> : projectContentNotice?.message ?? <span aria-hidden="true">&nbsp;</span>}
            </div>
            {activeProjectContentRecovery !== null && activeProjectContentEdit !== null ? (
              <div className="project-content-recovery" role="alert" aria-live="assertive" aria-atomic="true">
                <AlertCircle size={17} aria-hidden="true" />
                <div><strong>Project changed</strong><p>Your content draft is retained. Review it against server revision {activeProjectContentRecovery.confirmedRevision}, then retry or use the server values.</p></div>
                <div className="project-content-actions">
                  <button type="button" className="button" onClick={() => submitProjectContent(current, activeProjectContentEdit.draft)} disabled={projectRevisionMutationPending}><RefreshCcw size={14} />Retry draft</button>
                  <button type="button" className="button" onClick={() => {
                    setProjectContentEdit({ projectId: current.id, draft: projectContentDraft(current) });
                    setProjectContentRecovery(null);
                    setSuppressedProjectContentError(null);
                    setProjectContentEditorEpoch((value) => value + 1);
                    setProjectContentNotice({ tone: 'success', message: `Server values loaded at revision ${current.revision}.` });
                  }}>Use server values</button>
                </div>
              </div>
            ) : null}
            <ErrorNotice error={updateProjectContent.error === suppressedProjectContentError ? null : updateProjectContent.error} />
            <ErrorNotice error={setProjectArchive.variables?.source === 'undo' ? null : setProjectArchive.error} />
            <nav className="segmented-tabs" aria-label="Project sections">
              {(['overview', 'issues', 'activity'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} aria-current={tab === item ? 'page' : undefined} onClick={() => { setTab(item); setMilestoneIssueFilterId(null); }}>{titleCase(item)}</button>)}
            </nav>

            {tab === 'overview' ? (
              <div className="project-overview">
                <ProjectPropertiesEditor
                  project={current}
                  teams={teams}
                  members={members}
                  hideTeam={systemTeam !== undefined}
                  canWrite={canWriteProjects}
                  locked={projectRevisionMutationPending}
                  pendingLabel={inlineProjectUpdate.isPending ? inlineProjectUpdate.variables?.label ?? 'Property' : null}
                  notice={projectPropertyNotice}
                  error={inlineProjectUpdate.error}
                  onChange={submitProjectProperty}
                />
                <section className="project-progress-section" aria-labelledby="progress-title">
                  <div><h2 id="progress-title">Progress</h2><span>{current.progress.completedCount} of {current.progress.eligibleCount} complete</span></div>
                  <Progress value={current.progress} />
                </section>
                <div className="project-document-grid">
                  <section className="project-document" aria-labelledby="overview-content-title">
                    <h2 id="overview-content-title">Overview</h2>
                    {activeProjectContentEdit === null
                      ? <RichTextView document={current.overviewDocument} empty="No overview yet" />
                      : <RichTextEditor
                          key={`${current.id}-${projectContentEditorEpoch}`}
                          initial={activeProjectContentEdit.draft.overviewDocument}
                          onChange={(overviewDocument) => updateProjectContentDraft({ overviewDocument })}
                          label="Project overview"
                        />}
                  </section>
                  <section className="project-resources" aria-labelledby="resources-title">
                    <h2 id="resources-title">Resources</h2>
                    {activeProjectContentEdit === null ? (
                      current.resources.length > 0 ? <ul>{current.resources.map((resource) => <li key={resource.id}><Link2 size={14} /><a href={resource.url} target="_blank" rel="noreferrer">{resource.label}<ExternalLink size={12} /></a></li>)}</ul> : <p className="muted-copy">No resources</p>
                    ) : (
                      <fieldset className="resource-editor project-resource-editor" disabled={projectRevisionMutationPending}>
                        <legend className="sr-only">Project resources</legend>
                        {activeProjectContentEdit.draft.resources.map((resource, index) => (
                          <div className="resource-editor-row" key={index}>
                            <label><span className="sr-only">Resource label</span><input form={projectContentFormId} value={resource.label} onChange={(event) => updateProjectContentDraft({ resources: activeProjectContentEdit.draft.resources.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} placeholder="Label" maxLength={120} required /></label>
                            <label><span className="sr-only">Resource URL</span><input form={projectContentFormId} value={resource.url} onChange={(event) => updateProjectContentDraft({ resources: activeProjectContentEdit.draft.resources.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item) })} placeholder="https://" type="url" maxLength={2048} required /></label>
                            <button type="button" className="icon-button" aria-label={`Remove resource ${index + 1}`} title="Remove resource" onClick={() => updateProjectContentDraft({ resources: activeProjectContentEdit.draft.resources.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={14} /></button>
                          </div>
                        ))}
                        <button type="button" className="button resource-add" onClick={() => updateProjectContentDraft({ resources: [...activeProjectContentEdit.draft.resources, { label: '', url: '' }] })} disabled={activeProjectContentEdit.draft.resources.length >= 50}><Plus size={15} /> Add resource</button>
                      </fieldset>
                    )}
                  </section>
                </div>
                <section className="milestone-section" aria-labelledby="milestones-title">
                  <header>
                    <div><h2 id="milestones-title">Milestones</h2>{milestones.isLoading ? <span className="skeleton-block skeleton-inline-count" aria-hidden="true" /> : milestoneBlockingError !== null ? <span className="skeleton-block skeleton-inline-count" aria-hidden="true" /> : <span>{activeMilestones.length} active</span>}</div>
                    <div className="milestone-controls">
                      <label className="checkbox-control"><input ref={milestoneArchivedToggleRef} type="checkbox" checked={includeArchivedMilestones} onChange={(event) => setIncludeArchivedMilestones(event.target.checked)} disabled={milestoneInteractionLocked} /> Archived</label>
                      <button
                        ref={addMilestoneButtonRef}
                        className="button"
                        aria-expanded={milestoneCreateOpen}
                        aria-controls={milestoneCreateOpen ? 'milestone-inline-editor' : undefined}
                        onClick={openMilestoneCreate}
                        disabled={!canWriteProjects || current.archivedAt !== null || milestoneInteractionLocked}
                      ><Plus size={15} /> Add milestone</button>
                    </div>
                  </header>
                  <ErrorNotice error={(setMilestoneArchive.variables?.source === 'undo' ? null : setMilestoneArchive.error) ?? reorderMilestones.error ?? (milestones.data === undefined ? null : milestones.error)} />
                  <div
                    className={`milestone-edit-feedback ${updateMilestone.isPending ? 'pending' : milestoneEditNotice?.tone ?? 'idle'}`}
                    role={milestoneEditNotice?.tone === 'error' ? 'alert' : 'status'}
                    aria-live={milestoneEditNotice?.tone === 'error' ? 'assertive' : 'polite'}
                    aria-atomic="true"
                  >
                    {updateMilestone.isPending
                      ? <><Spinner />Saving milestone...</>
                      : milestoneEditNotice?.message ?? <span aria-hidden="true">&nbsp;</span>}
                  </div>
                  <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{milestoneAnnouncement}</p>
                  {milestoneBlockingError !== null ? (
                    <QueryErrorState
                      title="Could not load project milestones"
                      error={milestoneBlockingError}
                      retrying={milestones.isFetching}
                      onRetry={() => { void milestones.refetch(); }}
                    />
                  ) : milestones.isLoading ? <LoadingSkeleton variant="milestones" label="Loading project milestones" /> : milestones.data?.length || milestoneCreateOpen ? (
                    <div className="milestone-list">
                      {milestoneCreateOpen ? (
                        <InlineMilestoneForm
                          pending={createMilestone.isPending}
                          error={createMilestone.error}
                          onSubmit={(draft) => createMilestone.mutate({ projectId: current.id, draft })}
                          onCancel={() => closeMilestoneCreate()}
                        />
                      ) : null}
                      <ol ref={milestoneListRef} className="milestone-order" aria-label={`${current.name} milestones`}>
                        {(milestones.data ?? []).map((milestone) => {
                          if (activeMilestoneEdit?.milestoneId === milestone.id) {
                            return (
                              <li className="milestone-edit-item" key={milestone.id}>
                                <InlineMilestoneEditForm
                                  milestone={milestone}
                                  draft={activeMilestoneEdit.draft}
                                  pending={updateMilestone.isPending}
                                  recovery={activeMilestoneEditRecovery}
                                  error={updateMilestone.error === suppressedMilestoneEditError ? null : updateMilestone.error}
                                  onDraftChange={updateMilestoneEditDraft}
                                  onSubmit={() => submitMilestoneEdit(activeMilestoneEdit)}
                                  onCancel={() => closeMilestoneEditor(milestone.id)}
                                  onRetry={() => submitMilestoneEdit(activeMilestoneEdit)}
                                  onUseServer={() => useMilestoneServerValues(milestone)}
                                  onOpenIssues={() => { setMilestoneIssueFilterId(milestone.id); setTab('issues'); }}
                                />
                              </li>
                            );
                          }
                          const activeIndex = activeMilestones.findIndex((item) => item.id === milestone.id);
                          const issueCountLabel = milestoneIssueCountLabel(milestone.progress.issueCount);
                          const dragEnabled = canWriteProjects
                            && current.archivedAt === null
                            && milestone.archivedAt === null
                            && activeMilestones.length > 1
                            && !milestoneInteractionLocked;
                          const dragSource = milestoneDrag?.active
                            && milestoneDrag.sourceId === milestone.id;
                          const dropEdge = milestoneDrag?.active
                            && milestoneDrag.targetId === milestone.id
                            ? milestoneDrag.edge
                            : null;
                          return (
                            <li
                              className={`milestone-row ${milestone.archivedAt === null ? '' : 'archived'} ${dragSource ? 'dragging' : ''} ${dropEdge === null ? '' : `drop-${dropEdge}`}`}
                              data-milestone-id={milestone.id}
                              data-milestone-drop-id={milestone.archivedAt === null ? milestone.id : undefined}
                              tabIndex={-1}
                              key={milestone.id}
                            >
                              <span
                                className={`milestone-drag-handle ${dragEnabled ? '' : 'disabled'}`}
                                data-milestone-drag-handle
                                aria-hidden="true"
                                title={dragEnabled ? `Drag ${milestone.name} to reorder` : undefined}
                                onPointerDown={(event) => beginMilestoneDrag(event, milestone)}
                                onPointerMove={moveMilestoneDrag}
                                onPointerUp={(event) => finishMilestoneDrag(event)}
                                onPointerCancel={(event) => finishMilestoneDrag(event, true)}
                                onLostPointerCapture={(event) => finishMilestoneDrag(event, true)}
                              ><GripVertical size={15} /></span>
                              <div className="milestone-copy"><strong>{milestone.name}</strong><p>{milestone.description || 'No description'}</p></div>
                              <Progress value={milestone.progress} compact />
                              <span className="milestone-date"><CalendarDays size={13} />{milestone.targetDate ?? 'No target'}</span>
                              <button type="button" className="milestone-issues milestone-issue-link" aria-label={`Open ${issueCountLabel} for ${milestone.name}`} onClick={() => { setMilestoneIssueFilterId(milestone.id); setTab('issues'); }}>{issueCountLabel}</button>
                              <div className="row-actions">
                                {milestone.archivedAt === null ? <>
                                  <button className="icon-button" data-milestone-move="up" aria-label={`Move ${milestone.name} up`} title="Move up" onClick={() => moveMilestone(milestone.id, -1)} disabled={!canWriteProjects || activeIndex <= 0 || milestoneInteractionLocked}><ArrowUp size={14} /></button>
                                  <button className="icon-button" data-milestone-move="down" aria-label={`Move ${milestone.name} down`} title="Move down" onClick={() => moveMilestone(milestone.id, 1)} disabled={!canWriteProjects || activeIndex < 0 || activeIndex >= activeMilestones.length - 1 || milestoneInteractionLocked}><ArrowDown size={14} /></button>
                                  <button className="icon-button" data-milestone-edit={milestone.id} aria-label={`Edit ${milestone.name}`} title="Edit milestone" onClick={() => openMilestoneEditor(milestone)} disabled={!canWriteProjects || current.archivedAt !== null || milestoneInteractionLocked}><Pencil size={14} /></button>
                                </> : null}
                                <button className="icon-button" data-milestone-archive={milestone.id} aria-label={milestone.archivedAt === null ? `Archive ${milestone.name}` : `Restore ${milestone.name}`} title={milestone.archivedAt === null ? 'Archive milestone' : 'Restore milestone'} onClick={() => setMilestoneArchive.mutate({ current: milestone, source: 'direct' })} disabled={!canWriteProjects || current.archivedAt !== null || milestoneInteractionLocked}>{milestone.archivedAt === null ? <Archive size={14} /> : <RefreshCcw size={14} />}</button>
                                {canPurgeMilestones && milestone.archivedAt !== null ? (
                                  <button
                                    type="button"
                                    className="icon-button danger"
                                    data-milestone-purge={milestone.id}
                                    aria-label={`Purge ${milestone.name}`}
                                    title="Purge milestone"
                                    onClick={() => {
                                      const records = milestones.data ?? [];
                                      const index = records.findIndex((item) => item.id === milestone.id);
                                      const focusId = records[index + 1]?.id ?? records[index - 1]?.id ?? null;
                                      purgeMilestone.reset();
                                      setMilestoneEditNotice(null);
                                      setProjectPurgeOpen(false);
                                      setMilestonePurgeTarget({ milestone, focusId });
                                    }}
                                    disabled={milestoneInteractionLocked}
                                  ><Trash2 size={14} /></button>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ) : <EmptyState
                    icon={<Target size={22} />}
                    title="No milestones"
                    action={canWriteProjects && current.archivedAt === null ? (
                      <button type="button" className="button" onClick={openMilestoneCreate}><Plus size={15} />Add milestone</button>
                    ) : undefined}
                  />}
                </section>
              </div>
            ) : null}
            {tab === 'issues' ? <IssuesView workspaceId={workspaceId} workspaceRole={workspaceRole} teams={teams} statuses={statuses} members={members} ownerMode={systemTeam !== undefined} {...(currentUserId === undefined ? {} : { currentUserId })} {...(systemTeam === undefined ? {} : { systemTeam })} contextProject={current} {...(milestoneIssueFilter === null ? {} : { contextMilestone: milestoneIssueFilter })} contextMilestones={milestones.data ?? []} onClearContextMilestone={() => setMilestoneIssueFilterId(null)} embedded /> : null}
            {tab === 'activity' ? (
              <section className="activity-section" aria-labelledby="activity-title">
                <h2 id="activity-title">Activity</h2>
                {activityBlockingError !== null ? (
                  <QueryErrorState
                    title="Could not load project activity"
                    error={activityBlockingError}
                    retrying={activity.isFetching}
                    onRetry={() => { void activity.refetch(); }}
                  />
                ) : <>
                  <ErrorNotice error={activity.error} />
                  {activity.isLoading ? <LoadingSkeleton variant="activity" label="Loading project activity" /> : <ActivityList entries={activity.data ?? []} teams={teams} members={members} projectName={current.name} hideTeam={systemTeam !== undefined} />}
                </>}
              </section>
            ) : null}
            <Dialog
              title={milestonePurgeTarget === null ? 'Purge milestone' : `Purge ${milestonePurgeTarget.milestone.name}`}
              open={milestonePurgeTarget !== null
                && canPurgeMilestones
                && milestonePurgeTarget.milestone.projectId === current.id
                && milestonePurgeTarget.milestone.archivedAt !== null}
              onClose={() => {
                if (!purgeMilestone.isPending) setMilestonePurgeTarget(null);
              }}
            >
              {milestonePurgeTarget === null ? null : (
                <form className="dialog-form milestone-purge-form" onSubmit={(event) => {
                  event.preventDefault();
                  if (purgeMilestone.isPending) return;
                  const confirmation = String(new FormData(event.currentTarget).get('confirmation') ?? '');
                  purgeMilestone.mutate({
                    milestone: milestonePurgeTarget.milestone,
                    confirmation,
                    focusId: milestonePurgeTarget.focusId,
                  });
                }}>
                  <p>This permanently removes the milestone. Linked issues are preserved in this project and moved to no milestone.</p>
                  <label className="field"><span>Type <strong>{milestonePurgeTarget.milestone.name}</strong> to confirm</span><input name="confirmation" autoComplete="off" maxLength={80} required /></label>
                  <ErrorNotice error={purgeMilestone.error} />
                  <button className="button danger-button" disabled={purgeMilestone.isPending}>{purgeMilestone.isPending ? <Spinner /> : <Trash2 size={14} />}Purge milestone</button>
                </form>
              )}
            </Dialog>
            <Dialog
              title={`Purge ${current.name}`}
              open={projectPurgeOpen && canPurgeProjects && current.archivedAt !== null}
              onClose={() => { if (!purgeProject.isPending) setProjectPurgeOpen(false); }}
            >
              <form className="dialog-form project-purge-form" onSubmit={(event) => {
                event.preventDefault();
                if (purgeProject.isPending) return;
                const confirmation = String(new FormData(event.currentTarget).get('confirmation') ?? '');
                purgeProject.mutate({ current, confirmation });
              }}>
                <p>This permanently removes the project, its milestones, and its resources. Issues are preserved and moved to no project.</p>
                <label className="field"><span>Type <strong>{current.name}</strong> to confirm</span><input name="confirmation" autoComplete="off" maxLength={80} required /></label>
                <ErrorNotice error={purgeProject.error} />
                <button className="button danger-button" disabled={purgeProject.isPending}>{purgeProject.isPending ? <Spinner /> : <Trash2 size={14} />}Purge project</button>
              </form>
            </Dialog>
          </>
        ) : null}

      </section>
    );
  }

  const openProjectCreate = () => {
    createProject.reset();
    setDialog('create');
  };
  const projectFiltersActive = query !== '' || status !== '' || priority !== '';
  const projectListBlockingError = projects.data === undefined ? projects.error : null;
  const canCreateProject = canWriteProjects && (systemTeam !== undefined || teams.length > 0);
  const clearProjectFilters = () => {
    setSearchDraft('');
    setQuery('');
    setStatus('');
    setPriority('');
  };
  const projectEmptyTitle = projectFiltersActive
    ? 'No matching projects'
    : archiveState === 'archived'
      ? 'Archive is empty'
      : 'No projects';
  const projectEmptyAction = projectFiltersActive ? (
    <button type="button" className="button" onClick={clearProjectFilters}>Clear filters</button>
  ) : archiveState === 'archived' ? (
    <button type="button" className="button" onClick={() => setArchiveState('active')}>View active</button>
  ) : canCreateProject ? (
    <button type="button" className="button" onClick={openProjectCreate}><Plus size={15} />New project</button>
  ) : undefined;

  return (
    <section aria-labelledby="projects-title">
      <div className="section-heading projects-heading">
        <div><h1 id="projects-title">Projects</h1><p>{projects.isLoading ? <span className="skeleton-block skeleton-inline-count" aria-hidden="true" /> : projectListBlockingError !== null ? <span className="skeleton-block skeleton-inline-count" aria-hidden="true" /> : `${projects.data?.length ?? 0} ${archiveState === 'active' ? 'active' : 'archived'}`}</p></div>
        <button className="button primary" onClick={openProjectCreate} disabled={!canWriteProjects || (systemTeam === undefined ? teams.length === 0 : false)}><Plus size={16} /> New project</button>
      </div>
      <div className="project-toolbar">
        <form className="project-search" role="search" onSubmit={(event) => { event.preventDefault(); setQuery(searchDraft.trim()); }}>
          <Search size={15} aria-hidden="true" />
          <label><span className="sr-only">Search projects</span><input ref={projectSearchRef} value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search projects" maxLength={200} /></label>
        </form>
        <span className="toolbar-divider" aria-hidden="true" />
        <label className="toolbar-select"><ListFilter size={14} /><span className="sr-only">Status</span><select value={status} onChange={(event) => setStatus(event.target.value as '' | Project['status'])}><option value="">All statuses</option><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="canceled">Canceled</option></select></label>
        <label className="toolbar-select"><span className="sr-only">Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as '' | Project['priority'])}><option value="">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="none">No priority</option></select></label>
        <label className="toolbar-select"><span>Group</span><select value={effectiveGroupBy} onChange={(event) => { setGroupBy(event.target.value as ProjectViewGrouping); setCollapsedGroups([]); }}><option value="none">None</option><option value="status">Status</option><option value="priority">Priority</option><option value="lead">Lead</option>{systemTeam === undefined ? <option value="team">Team</option> : null}</select></label>
        <label className="toolbar-select"><span className="sr-only">Order projects</span><select value={order} onChange={(event) => setOrder(event.target.value as typeof order)}><option value="position">Manual order</option><option value="name">Name</option><option value="targetDate">Target date</option><option value="updatedAt">Updated</option></select></label>
        <button className="icon-button" aria-label={`Sort ${direction === 'asc' ? 'descending' : 'ascending'}`} title={`Sort ${direction === 'asc' ? 'descending' : 'ascending'}`} onClick={() => setDirection((current) => current === 'asc' ? 'desc' : 'asc')}>{direction === 'asc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}</button>
        <label className="toolbar-select project-density-select"><Rows3 size={14} aria-hidden="true" /><span className="sr-only">Project density</span><select value={density} onChange={(event) => setDensity(event.target.value as ProjectDensity)}><option value="compact">Compact</option><option value="default">Default</option><option value="comfortable">Comfortable</option></select></label>
        <details className="toolbar-menu properties-menu"><summary aria-label="Visible project properties" title="Visible properties"><SlidersHorizontal size={14} /> Properties</summary><div>{projectViewProperties.filter((property) => systemTeam === undefined || property !== 'team').map((property) => <label key={property}><input type="checkbox" checked={effectiveVisibleProperties.includes(property)} onChange={() => setVisibleProperties((current) => toggleProjectViewProperty(current, property))} />{projectViewPropertyLabel(property)}</label>)}</div></details>
        <span className="toolbar-divider" aria-hidden="true" />
        <button className={`archive-toggle ${archiveState === 'archived' ? 'active' : ''}`} onClick={() => setArchiveState((current) => current === 'active' ? 'archived' : 'active')}><Archive size={14} /> {archiveState === 'active' ? 'Archive' : 'Active'}</button>
      </div>
      {selectedProjects.length > 0 ? (
        <div className="bulk-toolbar project-bulk-toolbar" role="region" aria-label="Bulk project actions">
          <strong role="status" aria-live="polite">{selectedProjects.length} selected</strong>
          <button
            className="button"
            disabled={!canWriteProjects || setSelectedProjectArchive.isPending}
            onClick={() => {
              setBulkProjectResult(null);
              setSelectedProjectArchive.mutate(selectedProjects);
            }}
          >
            {setSelectedProjectArchive.isPending ? <Spinner /> : archiveState === 'archived' ? <RefreshCcw size={14} /> : <Archive size={14} />}
            {archiveState === 'archived' ? 'Restore' : 'Archive'}
          </button>
          <button className="icon-button" aria-label="Clear project selection" title="Clear selection" onClick={() => { setSelectedProjectIds(new Set()); setBulkProjectResult(null); }}><X size={14} /></button>
        </div>
      ) : null}
      {bulkProjectResult ? <div className="bulk-result" role="status">{bulkProjectResult.updated} updated, {bulkProjectResult.failed} failed</div> : null}
      {projectPurgeNotice ? <div className="project-purge-feedback" role="status" aria-live="polite" aria-atomic="true">{projectPurgeNotice}</div> : null}
      {archiveActionFeedback}
      <ErrorNotice error={reorderProjects.error ?? (setProjectArchive.variables?.source === 'undo' ? null : setProjectArchive.error) ?? (projects.data === undefined ? null : projects.error)} />
      {projectListBlockingError !== null ? (
        <QueryErrorState
          title="Could not load projects"
          error={projectListBlockingError}
          retrying={projects.isFetching}
          onRetry={() => { void projects.refetch(); }}
        />
      ) : projects.isLoading ? <LoadingSkeleton variant="table" tableKind="projects" tableDensity={density} tableColumnCount={2 + effectiveVisibleProperties.length} tableGridTemplate={projectGridTemplate(effectiveVisibleProperties)} label="Loading projects" /> : projects.data?.length ? (
        <div ref={projectTableRef} className={`project-table project-density-${density}`} style={projectTableStyle} role="grid" aria-label="Projects" aria-multiselectable={canWriteProjects || undefined}>
          <div role="rowgroup">
            <div className="project-row project-row-header" role="row">
              <span role="columnheader">Project</span>
              {effectiveVisibleProperties.map((property) => <span className={`project-property-header project-property-${property}`} role="columnheader" key={property}>{projectViewPropertyLabel(property)}</span>)}
              <span className="sr-only" role="columnheader">Actions</span>
            </div>
          </div>
          {projectGroups.map((group) => {
            const collapsed = collapsedGroups.includes(group.key);
            return (
              <div className="project-group" role="rowgroup" key={group.key}>
                {effectiveGroupBy !== 'none' ? (
                  <div className="project-group-row" role="row">
                    <span className="project-group-cell" role="rowheader" aria-colspan={2 + effectiveVisibleProperties.length}>
                      <button type="button" aria-expanded={!collapsed} onClick={() => toggleProjectGroup(group.key)}>
                        <span className="project-group-chevron">{collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</span>
                        <strong>{group.label}</strong>
                        <span>{group.projects.length}</span>
                      </button>
                    </span>
                  </div>
                ) : null}
                {collapsed ? null : group.projects.map((item) => {
                  const index = visibleProjectIndex.get(item.id) ?? 0;
                  return (
                    <div
                      className={`project-row ${selectedProjectIds.has(item.id) ? 'selected' : ''}`}
                      role="row"
                      tabIndex={rovingProjectId === item.id ? 0 : -1}
                      aria-selected={canWriteProjects ? selectedProjectIds.has(item.id) : undefined}
                      aria-keyshortcuts={canWriteProjects ? 'Enter Space ArrowUp ArrowDown J K Shift+F10' : 'Enter ArrowUp ArrowDown J K Shift+F10'}
                      data-project-row
                      data-project-id={item.id}
                      key={item.id}
                      onFocus={(event) => {
                        if (event.target === event.currentTarget) setPreferredFocusedProjectId(item.id);
                      }}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest('button, input, a, [role="menu"]')) return;
                        openProject(item.id);
                      }}
                      onContextMenu={(event) => {
                        if ((event.target as HTMLElement).closest('input, a')) return;
                        event.preventDefault();
                        openProjectMenu(item.id);
                      }}
                      onKeyDown={(event) => rowKey(event, index, item.id)}
                    >
                      <span className="project-name-cell" role="gridcell">
                        <span className="project-row-leading">
                          {projectIcon(item)}
                          <input
                            className="project-row-select"
                            type="checkbox"
                            tabIndex={-1}
                            aria-label={`${selectedProjectIds.has(item.id) ? 'Deselect' : 'Select'} ${item.name}`}
                            checked={selectedProjectIds.has(item.id)}
                            disabled={!canWriteProjects}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleProjectSelection(item.id)}
                          />
                        </span>
                        <span><strong>{item.name}</strong><small>{item.summary || 'No summary'}</small></span>
                      </span>
                      {effectiveVisibleProperties.map((property) => <ProjectPropertyCell project={item} property={property} teams={teams} members={members} key={property} />)}
                      <span className="row-actions project-row-actions" role="gridcell" onClick={(event) => event.stopPropagation()}>
                        <button
                          className="icon-button"
                          tabIndex={-1}
                          aria-label={`Actions for ${item.name}`}
                          title="Project actions"
                          aria-haspopup="menu"
                          aria-expanded={openProjectMenuId === item.id}
                          aria-controls={openProjectMenuId === item.id ? `project-menu-${item.id}` : undefined}
                          onClick={() => openProjectMenuId === item.id ? closeProjectMenu(item.id) : openProjectMenu(item.id)}
                        ><MoreHorizontal size={15} /></button>
                        {openProjectMenuId === item.id ? (
                          <div
                            id={`project-menu-${item.id}`}
                            className={`project-row-menu ${index >= visibleProjects.length - 2 ? 'project-row-menu-up' : ''}`}
                            role="menu"
                            aria-label={`Actions for ${item.name}`}
                            onKeyDown={(event) => projectMenuKey(event, item.id)}
                            onBlur={(event) => {
                              if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                                setOpenProjectMenuId(null);
                              }
                            }}
                          >
                            <button type="button" role="menuitem" tabIndex={-1} onClick={() => openProject(item.id)}><ExternalLink size={14} /> Open project</button>
                            {canWriteProjects && item.archivedAt === null ? <>
                              <button type="button" role="menuitem" tabIndex={-1} onClick={() => { closeProjectMenu(item.id); moveProject(index, -1); }} disabled={!canReorderProjects || index === 0 || reorderProjects.isPending}><ArrowUp size={14} /> Move up</button>
                              <button type="button" role="menuitem" tabIndex={-1} onClick={() => { closeProjectMenu(item.id); moveProject(index, 1); }} disabled={!canReorderProjects || index === visibleProjects.length - 1 || reorderProjects.isPending}><ArrowDown size={14} /> Move down</button>
                            </> : null}
                            {canWriteProjects ? <button type="button" role="menuitem" tabIndex={-1} onClick={() => { setOpenProjectMenuId(null); setProjectArchive.mutate({ current: item, source: 'direct' }); }} disabled={setProjectArchive.isPending}>{item.archivedAt === null ? <Archive size={14} /> : <RefreshCcw size={14} />}{item.archivedAt === null ? 'Archive' : 'Restore'}</button> : null}
                          </div>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : <EmptyState icon={<FolderKanban size={22} />} title={projectEmptyTitle} action={projectEmptyAction} />}

      <Dialog title="New project" open={dialog === 'create' && canWriteProjects} onClose={() => setDialog(null)} wide>
        {dialog === 'create' ? <ProjectForm teams={systemTeam === undefined ? teams : teams.filter((team) => team.id === systemTeam.id)} members={members} lockTeam={systemTeam !== undefined} pending={createProject.isPending} error={createProject.error} onSubmit={(draft) => createProject.mutate(draft)} /> : null}
      </Dialog>
    </section>
  );
}
