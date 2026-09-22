import { BrandMark } from './brand-mark.js';
import { isBillingReturn } from './homepage-entry.js';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  Bell,
  Activity,
  AlertCircle,
  CalendarDays,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Command,
  ExternalLink,
  Eye,
  FolderKanban,
  GitBranch,
  Home,
  Inbox,
  LayoutList,
  Link2,
  ListFilter,
  Menu,
  Minus,
  Paperclip,
  Plus,
  Search,
  Settings,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SlidersHorizontal,
  SquarePen,
  UserRound,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import {
  assignHostedIssue,
  bootstrapHostedWorkspaceConfiguration,
  createHostedComment,
  createHostedIssue,
  createHostedMilestone,
  createHostedProject,
  createHostedSavedView,
  createHostedTeam,
  createHostedWorkflowStatus,
  deleteHostedComment,
  editHostedComment,
  getHostedIssueObservation,
  HostedApiError,
  joinHostedTeam,
  leaveHostedTeam,
  listHostedComments,
  listHostedIssueActivity,
  listHostedIssues,
  listHostedMembers,
  listHostedNotifications,
  listHostedMilestones,
  listHostedProjects,
  listHostedSavedViews,
  listHostedTeamMemberships,
  listHostedTeams,
  listHostedWorkflowStatuses,
  markHostedIssueNotificationsRead,
  removeHostedMember,
  setHostedIssueSubscription,
  updateHostedIssue,
  updateHostedMilestone,
  updateHostedProject,
  updateHostedTeam,
  updateHostedWorkflowStatus,
  type HostedCollaborationMember,
  type HostedComment,
  type HostedIssue,
  type HostedIssueActivity,
  type HostedIssueNotification,
  type HostedIssueObservation,
  type HostedIssuePriority,
  type HostedIssueResource,
  type HostedIssueStatus,
  type HostedMilestone,
  type HostedProject,
  type HostedProjectStatus,
  type HostedSavedView,
  type HostedSavedViewPredicate,
  type HostedSavedViewType,
  type HostedTeam,
  type HostedTeamMembership,
  type HostedWorkflowStatus,
  type HostedWorkflowStatusCategory,
  type HostedWorkflowStatusIcon,
} from './hosted-api.js';
import {signOutHostedUser} from './hosted-auth.js';
import {readHostedBrowserEnvironment} from './hosted-environment.js';
import {AiMcpGuide} from './ai-mcp-guide.js';

type WorkspaceView = 'inbox' | 'my_issues' | 'workspace_view' | 'home' | 'issues' | 'projects' | 'views' | 'settings';
type NavigationScope = 'workspace' | 'team';
type SettingsTab = 'general' | 'teams' | 'workflow' | 'people' | 'billing' | 'automation';
type CreateModal = 'issue' | 'project' | 'team' | 'team_edit' | 'status' | 'status_edit' | 'view' | 'invite' | null;
type IssueGrouping = 'status' | 'priority' | 'none';
type SavedViewId = HostedSavedViewPredicate;
type TeamHomeTab = 'overview' | 'documents' | 'members';
type ProjectStatusFilter = 'all' | HostedProjectStatus;
type ProjectSort = 'updated' | 'name' | 'progress';
type ProjectSavedPredicate = 'all' | 'active' | 'completed';

const priorityLabels: Record<HostedIssuePriority, string> = {
  no_priority: 'No priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const projectStatusLabels: Record<HostedProjectStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  paused: 'Paused',
  completed: 'Completed',
  canceled: 'Canceled',
};

const workflowStatusIconLabels: Record<HostedWorkflowStatusIcon, string> = {
  circle: 'Circle',
  'circle-dashed': 'Dashed circle',
  'circle-dot': 'Dotted circle',
  'circle-check': 'Checked circle',
  'circle-x': 'Canceled circle',
};

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {numeric: 'auto'});
const dateFormatter = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
});

function mutationKey(storageKey: string): string {
  const existing = sessionStorage.getItem(storageKey);
  if (existing !== null) return existing;
  const value = crypto.randomUUID();
  sessionStorage.setItem(storageKey, value);
  return value;
}

function clearMutationKey(storageKey: string): void {
  sessionStorage.removeItem(storageKey);
}

function safeMessage(error: unknown): string {
  return error instanceof HostedApiError
    ? error.message
    : 'The workspace could not complete that request. Please try again.';
}

function issueKey(issue: HostedIssue): string {
  return `OL-${issue.number}`;
}

function shortMemberId(userId: string): string {
  return userId.length <= 9 ? userId : `${userId.slice(0, 4)}…${userId.slice(-4)}`;
}

function relativeTime(value: string): string {
  const days = Math.round((Date.parse(value) - Date.now()) / 86_400_000);
  if (Math.abs(days) >= 1) return relativeFormatter.format(days, 'day');
  const hours = Math.round((Date.parse(value) - Date.now()) / 3_600_000);
  return relativeFormatter.format(hours, 'hour');
}

function activityCopy(action: string): string {
  const field = action.match(/^issue\.(.+)\.changed$/u)?.[1];
  if (action === 'issue.created') return 'created the issue';
  if (action === 'issue.assigned') return 'changed the assignee';
  if (field === 'title') return 'updated the title';
  if (field === 'description') return 'updated the description';
  if (field === 'status') return 'changed the status';
  if (field === 'priority') return 'changed the priority';
  if (field === 'projectId') return 'moved the issue to a project';
  if (field === 'milestoneId') return 'changed the milestone';
  if (field === 'parentIssueId') return 'changed the parent issue';
  if (field === 'resources') return 'updated resources';
  if (field === 'dueAt') return 'changed the due time';
  if (action === 'issue.due') return 'Task is due';
  if (action === 'comment.created') return 'added a comment';
  if (action === 'comment.edited') return 'edited a comment';
  if (action === 'comment.deleted') return 'deleted a comment';
  return action.replaceAll('.', ' ');
}

function localDateTimeValue(value: string | null): string {
  if (value === null) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const part = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}

function canonicalDueAt(value: string): string | null {
  if (value === '') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function WorkspaceMark() {
  return <BrandMark className="ol-workspace-mark" />;
}

function IssueStatusIcon({status, size = 15}: {status: HostedIssueStatus; size?: number}) {
  if (status === 'done') return <CircleCheck size={size} aria-hidden="true" />;
  if (status === 'in_progress') return <CircleDot size={size} aria-hidden="true" />;
  return <CircleDashed size={size} aria-hidden="true" />;
}

function WorkflowStatusIcon({
  status,
  size = 15,
}: {
  status: Pick<HostedWorkflowStatus, 'icon' | 'color'>;
  size?: number;
}) {
  const style = {color: status.color};
  if (status.icon === 'circle-check') return <CircleCheck size={size} style={style} aria-hidden="true" />;
  if (status.icon === 'circle-dot') return <CircleDot size={size} style={style} aria-hidden="true" />;
  if (status.icon === 'circle-x') return <CircleX size={size} style={style} aria-hidden="true" />;
  if (status.icon === 'circle-dashed') return <CircleDashed size={size} style={style} aria-hidden="true" />;
  return <Circle size={size} style={style} aria-hidden="true" />;
}

function PriorityIcon({priority, size = 15}: {priority: HostedIssuePriority; size?: number}) {
  if (priority === 'urgent') return <AlertCircle size={size} aria-hidden="true" />;
  if (priority === 'high') return <SignalHigh size={size} aria-hidden="true" />;
  if (priority === 'medium') return <SignalMedium size={size} aria-hidden="true" />;
  if (priority === 'low') return <SignalLow size={size} aria-hidden="true" />;
  return <Minus size={size} aria-hidden="true" />;
}

function MemberAvatar({label}: {label: string}) {
  const initial = label.trim().charAt(0).toUpperCase() || 'M';
  return <span className="ol-member-avatar" aria-hidden="true">{initial}</span>;
}

interface MenuOption<Value extends string> {
  value: Value;
  label: string;
  icon?: ReactNode;
}

function LinearMenu<Value extends string>({
  ariaLabel,
  value,
  options,
  disabled = false,
  onChange,
}: {
  ariaLabel: string;
  value: Value;
  options: MenuOption<Value>[];
  disabled?: boolean;
  onChange: (value: Value) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (rootRef.current !== null && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
    window.requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
  }, [open, options, value]);

  return (
    <div className={`ol-linear-menu ${open ? 'open' : ''}`} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="ol-linear-menu-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="ol-linear-menu-value">{selected?.icon}{selected?.label ?? value}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open ? (
        <div className="ol-linear-menu-popover" id={id} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              ref={(node) => { optionRefs.current[options.indexOf(option)] = node; }}
              role="option"
              aria-selected={option.value === value}
              onKeyDown={(event) => {
                const index = options.indexOf(option);
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  optionRefs.current[(index + 1) % options.length]?.focus();
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  optionRefs.current[(index - 1 + options.length) % options.length]?.focus();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setOpen(false);
                  triggerRef.current?.focus();
                }
              }}
              onClick={() => {
                setOpen(false);
                if (option.value !== value) onChange(option.value);
                window.requestAnimationFrame(() => triggerRef.current?.focus());
              }}
            >
              <span>{option.icon}{option.label}</span>
              {option.value === value ? <Check size={13} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface HostedWorkspaceApplicationProps {
  idToken: string;
  workspaceId: string;
  workspaceName: string;
  role: 'owner' | 'member';
  currentUserId: string;
  userEmail: string;
  displayName: string | null;
  availableWorkspaces?: readonly {id: string; name: string; role: 'owner' | 'member'}[];
  onWorkspaceChange?: (workspaceId: string) => void;
  trial?: {startedAt: string; endsAt: string};
  peoplePanel?: ReactNode;
  billingPanel?: ReactNode;
  automationPanel?: ReactNode;
}

export function HostedWorkspaceApplication({
  idToken,
  workspaceId,
  workspaceName,
  role,
  currentUserId,
  userEmail,
  displayName,
  availableWorkspaces = [],
  onWorkspaceChange,
  trial,
  peoplePanel,
  billingPanel,
  automationPanel,
}: HostedWorkspaceApplicationProps) {
  const environment = readHostedBrowserEnvironment();
  const billingReturn = role === 'owner' && isBillingReturn(window.location.search);
  const [view, setView] = useState<WorkspaceView>(billingReturn ? 'settings' : 'issues');
  const [navigationScope, setNavigationScope] = useState<NavigationScope>(billingReturn ? 'workspace' : 'team');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(billingReturn ? 'billing' : 'general');
  const [issues, setIssues] = useState<HostedIssue[]>([]);
  const [projects, setProjects] = useState<HostedProject[]>([]);
  const [milestones, setMilestones] = useState<HostedMilestone[]>([]);
  const [members, setMembers] = useState<HostedCollaborationMember[]>([]);
  const [teams, setTeams] = useState<HostedTeam[]>([]);
  const [teamMemberships, setTeamMemberships] = useState<HostedTeamMembership[]>([]);
  const [workflowStatuses, setWorkflowStatuses] = useState<HostedWorkflowStatus[]>([]);
  const [workspaceSavedViews, setWorkspaceSavedViews] = useState<HostedSavedView[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [expandedTeamIds, setExpandedTeamIds] = useState<string[]>([]);
  const [teamHomeTab, setTeamHomeTab] = useState<TeamHomeTab>('overview');
  const [projectStatusFilter, setProjectStatusFilter] = useState<ProjectStatusFilter>('all');
  const [projectSort, setProjectSort] = useState<ProjectSort>('updated');
  const [projectSavedPredicate, setProjectSavedPredicate] = useState<ProjectSavedPredicate>('all');
  const [newViewType, setNewViewType] = useState<HostedSavedViewType>('issues');
  const [comments, setComments] = useState<HostedComment[]>([]);
  const [activity, setActivity] = useState<HostedIssueActivity[]>([]);
  const [observation, setObservation] = useState<HostedIssueObservation | null>(null);
  const [notifications, setNotifications] = useState<HostedIssueNotification[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [modal, setModal] = useState<CreateModal>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [newIssueTeamId, setNewIssueTeamId] = useState('');
  const [newIssueProjectId, setNewIssueProjectId] = useState('');
  const [newIssueParentId, setNewIssueParentId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [workspaceComponentsExpanded, setWorkspaceComponentsExpanded] = useState(true);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [collapsedIssueGroupIds, setCollapsedIssueGroupIds] = useState<string[]>([]);
  const [collapsedDetailSectionIds, setCollapsedDetailSectionIds] = useState<string[]>([]);
  const [issueGrouping, setIssueGrouping] = useState<IssueGrouping>('status');
  const [activeSavedView, setActiveSavedView] = useState<SavedViewId>('all');
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [pendingMemberUserId, setPendingMemberUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [addingResource, setAddingResource] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) ?? null;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const editingTeam = teams.find((team) => team.id === editingTeamId) ?? null;
  const editingStatus = workflowStatuses.find((status) => status.id === editingStatusId) ?? null;
  const selectedProjectMilestones = milestones.filter((milestone) => milestone.projectId === selectedProjectId);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null;
  const selectedIssueStatus = workflowStatuses.find((status) => status.id === selectedIssue?.statusId) ?? null;
  const selectedTeamStatuses = workflowStatuses
    .filter((status) => status.teamId === selectedTeam?.id)
    .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name));

  const memberLabel = (userId: string | null) => {
    if (userId === null) return 'Unassigned';
    if (userId === currentUserId) return displayName?.trim() || userEmail;
    const member = members.find((candidate) => candidate.userId === userId);
    return member !== undefined
      ? member.displayName?.trim() || `Team member ${shortMemberId(userId)}`
      : `Removed member ${shortMemberId(userId)}`;
  };

  const replaceWorkspaceHash = (issueId: string | null) => {
    const url = new URL(window.location.href);
    url.hash = issueId === null ? '' : `issue=${encodeURIComponent(issueId)}`;
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const refreshCore = async (selectFirst = false) => {
    const [nextIssues, nextProjects, nextMembers] = await Promise.all([
      listHostedIssues(idToken, workspaceId),
      listHostedProjects(idToken, workspaceId),
      listHostedMembers(idToken, workspaceId),
    ]);
    const nextMilestones = (await Promise.all(
      nextProjects.map((project) => listHostedMilestones(idToken, workspaceId, project.id)),
    )).flat();
    setIssues(nextIssues);
    setProjects(nextProjects);
    setMembers(nextMembers);
    setMilestones(nextMilestones);
    if (selectFirst) setSelectedIssueId(nextIssues[0]?.id ?? null);
    else {
      setSelectedIssueId((current) => current !== null && nextIssues.some((issue) => issue.id === current) ? current : null);
      setSelectedProjectId((current) => current !== null && nextProjects.some((project) => project.id === current) ? current : null);
    }
  };

  const refreshConfiguration = async () => {
    if (role === 'owner') {
      const storageKey = `basiclinear.hosted.configuration.bootstrap.${workspaceId}`;
      await bootstrapHostedWorkspaceConfiguration(
        idToken,
        workspaceId,
        mutationKey(storageKey),
      );
      clearMutationKey(storageKey);
    }
    const [nextTeams, nextStatuses, nextViews] = await Promise.all([
      listHostedTeams(idToken, workspaceId),
      listHostedWorkflowStatuses(idToken, workspaceId),
      listHostedSavedViews(idToken, workspaceId),
    ]);
    const nextTeamMemberships = (await Promise.all(nextTeams.map((team) => (
      listHostedTeamMemberships(idToken, workspaceId, team.id)
    )))).flat();
    setTeams(nextTeams);
    setTeamMemberships(nextTeamMemberships);
    setWorkflowStatuses(nextStatuses);
    setWorkspaceSavedViews(nextViews);
    setSelectedTeamId((current) => (
      current !== null && nextTeams.some((team) => team.id === current)
        ? current
        : nextTeams[0]?.id ?? null
    ));
    setExpandedTeamIds((current) => {
      const kept = current.filter((id) => nextTeams.some((team) => team.id === id));
      return kept.length > 0 ? kept : nextTeams[0] === undefined ? [] : [nextTeams[0].id];
    });
  };

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
    document.body.classList.add('hosted-application-active');
    return () => { document.body.classList.remove('hosted-application-active'); };
  }, []);

  useEffect(() => {
    if (modal !== 'issue') return;
    const parent = issues.find((issue) => issue.id === newIssueParentId);
    setNewIssueTeamId(parent?.teamId ?? selectedTeam?.id ?? teams[0]?.id ?? '');
    setNewIssueProjectId(parent?.projectId ?? selectedProject?.id ?? '');
  }, [issues, modal, newIssueParentId, selectedProject?.id, selectedTeam?.id, teams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      listHostedIssues(idToken, workspaceId),
      listHostedProjects(idToken, workspaceId),
      listHostedMembers(idToken, workspaceId),
      listHostedNotifications(idToken, workspaceId),
      refreshConfiguration(),
    ]).then(async ([nextIssues, nextProjects, nextMembers, nextNotifications]) => {
      const nextMilestones = (await Promise.all(
        nextProjects.map((project) => listHostedMilestones(idToken, workspaceId, project.id)),
      )).flat();
      if (!active) return;
      setIssues(nextIssues);
      setProjects(nextProjects);
      setMembers(nextMembers);
      setNotifications(nextNotifications);
      setMilestones(nextMilestones);
      const requestedIssueId = new URLSearchParams(window.location.hash.slice(1)).get('issue');
      const initialIssue = requestedIssueId !== null
        ? nextIssues.find((issue) => issue.id === requestedIssueId) ?? null
        : nextIssues[0] ?? null;
      setSelectedIssueId(initialIssue?.id ?? null);
      if (requestedIssueId !== null && initialIssue === null) replaceWorkspaceHash(null);
      else if (requestedIssueId === null && window.location.hash !== '') replaceWorkspaceHash(null);
      setLoading(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setNotice(safeMessage(error));
      setLoading(false);
    });
    return () => { active = false; };
  }, [idToken, workspaceId]);

  useEffect(() => {
    if (selectedIssueId === null) {
      setComments([]);
      setActivity([]);
      setObservation(null);
      return;
    }
    let active = true;
    void Promise.all([
      listHostedComments(idToken, workspaceId, selectedIssueId),
      listHostedIssueActivity(idToken, workspaceId, selectedIssueId),
      getHostedIssueObservation(idToken, workspaceId, selectedIssueId),
    ]).then(([nextComments, nextActivity, nextObservation]) => {
      if (!active) return;
      setComments(nextComments);
      setActivity(nextActivity);
      setObservation(nextObservation);
    }).catch((error: unknown) => {
      if (active) setNotice(safeMessage(error));
    });
    return () => { active = false; };
  }, [idToken, selectedIssueId, workspaceId]);

  useEffect(() => {
    if (selectedIssue === null) return;
    if (teams.some((team) => team.id === selectedIssue.teamId)) setSelectedTeamId(selectedIssue.teamId);
    setDescriptionDraft(selectedIssue.description);
    setEditingDescription(false);
    setAddingResource(false);
  }, [selectedIssue?.id, selectedIssue?.revision, selectedIssue?.teamId, teams]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModal(null);
        setAccountOpen(false);
        setWorkspaceMenuOpen(false);
        setViewOptionsOpen(false);
        setMobileOpen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  useEffect(() => {
    const refreshMembers = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail !== workspaceId) return;
      void refreshCore().catch((error: unknown) => setNotice(safeMessage(error)));
    };
    window.addEventListener('basiclinear:members-changed', refreshMembers);
    return () => window.removeEventListener('basiclinear:members-changed', refreshMembers);
  }, [idToken, workspaceId]);

  const sortedIssues = useMemo(() => [...issues].sort((left, right) => (
    right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id)
  )), [issues]);
  const selectedTeamIssues = selectedTeam === null
    ? []
    : sortedIssues.filter((issue) => issue.teamId === selectedTeam.id);

  const visibleIssues = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    let values = sortedIssues;
    if (view === 'my_issues') values = values.filter((issue) => issue.assigneeUserId === currentUserId);
    if (navigationScope === 'team' && view !== 'my_issues' && view !== 'inbox' && selectedTeam !== null) {
      values = values.filter((issue) => issue.teamId === selectedTeam.id);
    }
    if (view === 'issues' || view === 'workspace_view') {
      if (activeSavedView === 'active') values = values.filter((issue) => issue.status !== 'done');
      if (activeSavedView === 'backlog') values = values.filter((issue) => (
        workflowStatuses.find((status) => status.id === issue.statusId)?.category === 'backlog'
      ));
      if (activeSavedView === 'my_open') values = values.filter((issue) => issue.assigneeUserId === currentUserId && issue.status !== 'done');
      if (activeSavedView === 'unassigned') values = values.filter((issue) => issue.assigneeUserId === null && issue.status !== 'done');
      if (activeSavedView === 'high_priority') values = values.filter((issue) => ['high', 'urgent'].includes(issue.priority) && issue.status !== 'done');
      if (activeSavedView === 'completed') values = values.filter((issue) => issue.status === 'done');
    }
    if (normalized !== '') {
      values = values.filter((issue) => {
        const project = projects.find((candidate) => candidate.id === issue.projectId);
        return issue.title.toLocaleLowerCase().includes(normalized)
          || issueKey(issue).toLocaleLowerCase().includes(normalized)
          || project?.name.toLocaleLowerCase().includes(normalized);
      });
    }
    return values;
  }, [activeSavedView, currentUserId, navigationScope, projects, query, selectedTeam, sortedIssues, view, workflowStatuses]);

  const refreshNotifications = async () => {
    setNotifications(await listHostedNotifications(idToken, workspaceId));
  };

  useEffect(() => {
    const dueTimes = issues.filter((issue) => issue.status !== 'done' && issue.dueAt !== null)
      .map((issue) => Date.parse(issue.dueAt as string))
      .filter((value) => Number.isFinite(value) && value > Date.now())
      .sort((left, right) => left - right);
    const nextDueTime = dueTimes[0];
    if (nextDueTime === undefined) return;
    let timer = 0;
    let active = true;
    const schedule = () => {
      const remaining = nextDueTime - Date.now();
      if (remaining <= 0) {
        void listHostedNotifications(idToken, workspaceId).then((values) => {
          if (active) setNotifications(values);
        }).catch((error: unknown) => {
          if (active) setNotice(safeMessage(error));
        });
        return;
      }
      timer = window.setTimeout(schedule, Math.min(remaining + 50, 2_147_000_000));
    };
    schedule();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [idToken, issues, workspaceId]);

  const changeTeamMembership = async (team: HostedTeam, joining: boolean) => {
    const storageKey = `basiclinear.hosted.team-membership.${joining ? 'join' : 'leave'}.${team.id}`;
    clearMutationKey(storageKey);
    setPendingTeamId(team.id);
    try {
      if (joining) {
        await joinHostedTeam(idToken, workspaceId, team.id, mutationKey(storageKey));
      } else {
        await leaveHostedTeam(idToken, workspaceId, team.id, mutationKey(storageKey));
      }
      clearMutationKey(storageKey);
      await refreshConfiguration();
      setNotice(joining ? `Joined ${team.name}` : `Left ${team.name}`);
    } catch (error) {
      await refreshConfiguration().catch(() => undefined);
      setNotice(safeMessage(error));
    } finally {
      setPendingTeamId(null);
    }
  };

  const removeOrganizationMember = async (member: HostedCollaborationMember) => {
    if (role !== 'owner' || member.role !== 'member') return;
    if (!window.confirm(`Remove ${memberLabel(member.userId)} from ${workspaceName}? They will lose organization access immediately.`)) return;
    const storageKey = `basiclinear.hosted.member.remove.${workspaceId}.${member.userId}`;
    clearMutationKey(storageKey);
    setPendingMemberUserId(member.userId);
    try {
      await removeHostedMember(idToken, workspaceId, member.userId, mutationKey(storageKey));
      clearMutationKey(storageKey);
      await Promise.all([refreshCore(), refreshConfiguration()]);
      window.dispatchEvent(new CustomEvent('basiclinear:members-changed', {detail: workspaceId}));
      setNotice(`${memberLabel(member.userId)} was removed from the organization`);
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPendingMemberUserId(null);
    }
  };

  const go = (next: WorkspaceView, scope: NavigationScope = 'workspace') => {
    setView(next);
    setNavigationScope(scope);
    if (next === 'projects') {
      setProjectSavedPredicate('all');
      setProjectStatusFilter('all');
    }
    setMobileOpen(false);
    setAccountOpen(false);
    setWorkspaceMenuOpen(false);
    setViewOptionsOpen(false);
    setSelectedIssueId(null);
    setSelectedProjectId(null);
    replaceWorkspaceHash(null);
    if (next === 'inbox') void refreshNotifications().catch((error: unknown) => setNotice(safeMessage(error)));
  };

  const goToTeam = (teamId: string, next: WorkspaceView = 'home') => {
    setSelectedTeamId(teamId);
    setActiveSavedView(next === 'issues' ? 'active' : 'all');
    setTeamHomeTab('overview');
    go(next, 'team');
  };

  const showCreateIssue = (parentIssue: HostedIssue | null = null) => {
    setNewIssueParentId(parentIssue?.id ?? null);
    setNewIssueTeamId(parentIssue?.teamId ?? selectedTeam?.id ?? teams[0]?.id ?? '');
    setNewIssueProjectId(parentIssue?.projectId ?? selectedProject?.id ?? '');
    setModal('issue');
  };

  const openIssue = (issue: HostedIssue) => {
    setView('issues');
    setNavigationScope('team');
    setSelectedTeamId(issue.teamId);
    setExpandedTeamIds((values) => values.includes(issue.teamId) ? values : [...values, issue.teamId]);
    setSelectedIssueId(issue.id);
    setSelectedProjectId(null);
    replaceWorkspaceHash(issue.id);
  };

  const openProject = (project: HostedProject) => {
    setView('projects');
    setSelectedProjectId(project.id);
    setSelectedIssueId(null);
    replaceWorkspaceHash(null);
  };

  const closeIssue = () => {
    setSelectedIssueId(null);
    replaceWorkspaceHash(null);
  };

  const patchIssue = async (patch: {
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
  }) => {
    if (selectedIssue === null) return;
    const storageKey = `basiclinear.hosted.issue.update.${selectedIssue.id}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      const updated = await updateHostedIssue(
        idToken, workspaceId, selectedIssue.id, selectedIssue.revision,
        patch, mutationKey(storageKey),
      );
      clearMutationKey(storageKey);
      setIssues((values) => values.map((issue) => issue.id === updated.id ? updated : issue));
      setActivity(await listHostedIssueActivity(idToken, workspaceId, selectedIssue.id));
      if (patch.dueAt !== undefined || patch.status !== undefined || patch.statusId !== undefined) {
        await refreshNotifications();
      }
      setNotice('Issue updated');
    } catch (error) {
      setNotice(error instanceof HostedApiError && error.code === 'COLLABORATION_CONFLICT'
        ? 'This issue changed elsewhere. The latest version has been restored.'
        : safeMessage(error));
      await refreshCore().catch(() => undefined);
    } finally {
      setPending(false);
    }
  };

  const assignIssue = async (assigneeUserId: string | null) => {
    if (selectedIssue === null) return;
    const storageKey = `basiclinear.hosted.issue.assign.${selectedIssue.id}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      const updated = await assignHostedIssue(
        idToken, workspaceId, selectedIssue.id, selectedIssue.revision,
        assigneeUserId, mutationKey(storageKey),
      );
      clearMutationKey(storageKey);
      setIssues((values) => values.map((issue) => issue.id === updated.id ? updated : issue));
      setActivity(await listHostedIssueActivity(idToken, workspaceId, selectedIssue.id));
      await refreshNotifications();
      setNotice(assigneeUserId === null ? 'Issue unassigned' : 'Assignee updated');
    } catch (error) {
      setNotice(safeMessage(error));
      await refreshCore().catch(() => undefined);
    } finally {
      setPending(false);
    }
  };

  const toggleIssueSubscription = async () => {
    if (selectedIssue === null || observation === null) return;
    const subscribed = !observation.subscribed;
    const storageKey = `basiclinear.hosted.issue.subscription.${selectedIssue.id}.${subscribed ? 'on' : 'off'}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      const next = await setHostedIssueSubscription(
        idToken,
        workspaceId,
        selectedIssue.id,
        subscribed,
        mutationKey(storageKey),
      );
      clearMutationKey(storageKey);
      setObservation(next);
      await refreshNotifications();
      setNotice(subscribed ? 'Subscribed to issue activity' : 'Unsubscribed from issue activity');
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const openNotification = async (notification: HostedIssueNotification) => {
    const issue = issues.find((candidate) => candidate.id === notification.issueId);
    if (issue === undefined) return;
    openIssue(issue);
    if (!notification.unread) return;
    const storageKey = `basiclinear.hosted.issue.notifications.read.${notification.issueId}`;
    clearMutationKey(storageKey);
    try {
      const next = await markHostedIssueNotificationsRead(
        idToken,
        workspaceId,
        notification.issueId,
        mutationKey(storageKey),
      );
      clearMutationKey(storageKey);
      setObservation(next);
      setNotifications((values) => values.map((value) => (
        value.issueId === notification.issueId ? {...value, unread: false} : value
      )));
    } catch (error) {
      setNotice(safeMessage(error));
    }
  };

  const createIssue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    const teamId = String(data.get('teamId') ?? '') || selectedTeam?.id;
    const statusId = String(data.get('statusId') ?? '') || selectedTeamStatuses.find((status) => (
      status.category === 'unstarted'
    ))?.id;
    const projectId = String(data.get('projectId') ?? '') || null;
    const milestoneId = String(data.get('milestoneId') ?? '') || null;
    const dueAt = canonicalDueAt(String(data.get('dueAt') ?? ''));
    const storageKey = `basiclinear.hosted.issue.create.${workspaceId}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      const issue = await createHostedIssue(
        idToken,
        workspaceId,
        {
          title,
          description,
          ...(teamId === undefined ? {} : {teamId}),
          ...(statusId === undefined ? {} : {statusId}),
          projectId,
          milestoneId,
          dueAt,
          parentIssueId: newIssueParentId,
        },
        mutationKey(storageKey),
      );
      clearMutationKey(storageKey);
      await refreshCore();
      setModal(null);
      setNewIssueParentId(null);
      setView('issues');
      setNavigationScope('team');
      setSelectedTeamId(issue.teamId);
      setExpandedTeamIds((values) => values.includes(issue.teamId) ? values : [...values, issue.teamId]);
      setSelectedIssueId(issue.id);
      replaceWorkspaceHash(issue.id);
      setNotice('Issue created');
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const storageKey = `basiclinear.hosted.project.create.${workspaceId}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      const project = await createHostedProject(idToken, workspaceId, {
        name: String(data.get('name') ?? '').trim(),
        summary: String(data.get('summary') ?? '').trim(),
        status: String(data.get('status') ?? 'planned') as HostedProjectStatus,
      }, mutationKey(storageKey));
      clearMutationKey(storageKey);
      await refreshCore();
      setModal(null);
      setView('projects');
      setSelectedProjectId(project.id);
      setNotice('Project created');
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const createTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const storageKey = `basiclinear.hosted.team.create.${workspaceId}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      const result = await createHostedTeam(idToken, workspaceId, {
        name: String(data.get('name') ?? '').trim(),
        key: String(data.get('key') ?? '').trim(),
        color: String(data.get('color') ?? '#5E6AD2'),
        description: String(data.get('description') ?? '').trim(),
      }, mutationKey(storageKey));
      clearMutationKey(storageKey);
      await refreshConfiguration();
      setSelectedTeamId(result.team.id);
      setExpandedTeamIds((values) => values.includes(result.team.id) ? values : [...values, result.team.id]);
      setModal(null);
      setView('home');
      setNavigationScope('team');
      setNotice(`${result.team.name} team created`);
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const saveTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingTeam === null) return;
    const data = new FormData(event.currentTarget);
    const storageKey = `basiclinear.hosted.team.update.${editingTeam.id}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      const team = await updateHostedTeam(idToken, workspaceId, editingTeam.id, editingTeam.revision, {
        name: String(data.get('name') ?? '').trim(),
        key: String(data.get('key') ?? '').trim(),
        color: String(data.get('color') ?? editingTeam.color),
        description: String(data.get('description') ?? '').trim(),
      }, mutationKey(storageKey));
      clearMutationKey(storageKey);
      await refreshConfiguration();
      setSelectedTeamId(team.id);
      setEditingTeamId(null);
      setModal(null);
      setSettingsTab('teams');
      setView('settings');
      setNavigationScope('workspace');
      setNotice(`${team.name} team updated`);
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const createWorkflowStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedTeam === null) return;
    const data = new FormData(event.currentTarget);
    const storageKey = `basiclinear.hosted.workflow-status.create.${selectedTeam.id}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      await createHostedWorkflowStatus(idToken, workspaceId, {
        teamId: selectedTeam.id,
        name: String(data.get('name') ?? '').trim(),
        category: String(data.get('category') ?? 'unstarted') as HostedWorkflowStatusCategory,
        color: String(data.get('color') ?? '#A3A3A3'),
        icon: String(data.get('icon') ?? 'circle-dot') as HostedWorkflowStatusIcon,
        position: selectedTeamStatuses.length,
      }, mutationKey(storageKey));
      clearMutationKey(storageKey);
      await refreshConfiguration();
      setModal(null);
      setSettingsTab('workflow');
      setView('settings');
      setNavigationScope('workspace');
      setNotice('Workflow status created');
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const saveWorkflowStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingStatus === null) return;
    const data = new FormData(event.currentTarget);
    const storageKey = `basiclinear.hosted.workflow-status.update.${editingStatus.id}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      const status = await updateHostedWorkflowStatus(
        idToken,
        workspaceId,
        editingStatus.id,
        editingStatus.revision,
        editingStatus.isDefault ? {
          icon: String(data.get('icon') ?? editingStatus.icon) as HostedWorkflowStatusIcon,
        } : {
          name: String(data.get('name') ?? '').trim(),
          category: String(data.get('category') ?? editingStatus.category) as HostedWorkflowStatusCategory,
          color: String(data.get('color') ?? editingStatus.color),
          icon: String(data.get('icon') ?? editingStatus.icon) as HostedWorkflowStatusIcon,
        },
        mutationKey(storageKey),
      );
      clearMutationKey(storageKey);
      await Promise.all([refreshConfiguration(), refreshCore(), refreshNotifications()]);
      setSelectedTeamId(status.teamId);
      setEditingStatusId(null);
      setModal(null);
      setSettingsTab('workflow');
      setView('settings');
      setNavigationScope('workspace');
      setNotice(`${status.name} status updated`);
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const moveWorkflowStatus = async (status: HostedWorkflowStatus, direction: -1 | 1) => {
    const siblings = selectedTeamStatuses.filter((candidate) => candidate.category === status.category);
    const index = siblings.findIndex((candidate) => candidate.id === status.id);
    const neighbor = siblings[index + direction];
    if (status.isDefault || neighbor === undefined || neighbor.isDefault) return;
    const statusStorageKey = `basiclinear.hosted.workflow-status.reorder.${status.id}`;
    const neighborStorageKey = `basiclinear.hosted.workflow-status.reorder.${neighbor.id}`;
    clearMutationKey(statusStorageKey);
    clearMutationKey(neighborStorageKey);
    setPending(true);
    try {
      await Promise.all([
        updateHostedWorkflowStatus(idToken, workspaceId, status.id, status.revision, {position: neighbor.position}, mutationKey(statusStorageKey)),
        updateHostedWorkflowStatus(idToken, workspaceId, neighbor.id, neighbor.revision, {position: status.position}, mutationKey(neighborStorageKey)),
      ]);
      clearMutationKey(statusStorageKey);
      clearMutationKey(neighborStorageKey);
      await refreshConfiguration();
      setNotice(`${status.name} moved ${direction < 0 ? 'up' : 'down'}`);
    } catch (error) {
      await refreshConfiguration().catch(() => undefined);
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const createSavedView = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const teamId = String(data.get('teamId') ?? selectedTeam?.id ?? '');
    if (!teams.some((team) => team.id === teamId)) return;
    const storageKey = `basiclinear.hosted.saved-view.create.${teamId}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      await createHostedSavedView(idToken, workspaceId, {
        teamId,
        name: String(data.get('name') ?? '').trim(),
        viewType: String(data.get('viewType') ?? 'issues') as HostedSavedViewType,
        predicate: String(data.get('predicate') ?? 'active') as HostedSavedViewPredicate,
      }, mutationKey(storageKey));
      clearMutationKey(storageKey);
      await refreshConfiguration();
      setSelectedTeamId(teamId);
      setModal(null);
      setView('views');
      setNotice('View saved');
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const saveProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedProject === null) return;
    const data = new FormData(event.currentTarget);
    const next = {
      name: String(data.get('name') ?? '').trim(),
      summary: String(data.get('summary') ?? '').trim(),
      status: String(data.get('status') ?? 'planned') as HostedProjectStatus,
    };
    if (next.name === selectedProject.name && next.summary === selectedProject.summary
      && next.status === selectedProject.status) {
      setNotice('No project changes to save');
      return;
    }
    const storageKey = `basiclinear.hosted.project.update.${selectedProject.id}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      const updated = await updateHostedProject(
        idToken, workspaceId, selectedProject.id, selectedProject.revision,
        next, mutationKey(storageKey),
      );
      clearMutationKey(storageKey);
      setProjects((values) => values.map((project) => project.id === updated.id ? updated : project));
      setNotice('Project updated');
    } catch (error) {
      setNotice(safeMessage(error));
      await refreshCore().catch(() => undefined);
    } finally {
      setPending(false);
    }
  };

  const createMilestone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedProject === null) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const storageKey = `basiclinear.hosted.milestone.create.${selectedProject.id}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      await createHostedMilestone(idToken, workspaceId, selectedProject.id, {
        name: String(data.get('name') ?? '').trim(),
        description: String(data.get('description') ?? '').trim(),
        targetDate: String(data.get('targetDate') ?? '') || null,
      }, mutationKey(storageKey));
      clearMutationKey(storageKey);
      form.reset();
      await refreshCore();
      setNotice('Milestone created');
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const updateMilestoneDate = async (milestone: HostedMilestone, targetDate: string | null) => {
    const storageKey = `basiclinear.hosted.milestone.update.${milestone.id}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      const updated = await updateHostedMilestone(
        idToken, workspaceId, milestone.id, milestone.revision,
        {targetDate}, mutationKey(storageKey),
      );
      clearMutationKey(storageKey);
      setMilestones((values) => values.map((value) => value.id === updated.id ? updated : value));
      setNotice('Milestone date updated');
    } catch (error) {
      setNotice(safeMessage(error));
      await refreshCore().catch(() => undefined);
    } finally {
      setPending(false);
    }
  };

  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedIssue === null) return;
    const storageKey = `basiclinear.hosted.comment.create.${selectedIssue.id}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      await createHostedComment(
        idToken, workspaceId, selectedIssue.id, commentDraft, mutationKey(storageKey),
      );
      clearMutationKey(storageKey);
      setCommentDraft('');
      const [nextComments, nextActivity] = await Promise.all([
        listHostedComments(idToken, workspaceId, selectedIssue.id),
        listHostedIssueActivity(idToken, workspaceId, selectedIssue.id),
      ]);
      setComments(nextComments);
      setActivity(nextActivity);
      setObservation(await getHostedIssueObservation(idToken, workspaceId, selectedIssue.id));
      setNotice('Comment added');
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const saveComment = async (comment: HostedComment) => {
    if (selectedIssue === null) return;
    const storageKey = `basiclinear.hosted.comment.edit.${comment.id}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      await editHostedComment(
        idToken, workspaceId, selectedIssue.id, comment.id, comment.revision,
        editingCommentBody, mutationKey(storageKey),
      );
      clearMutationKey(storageKey);
      setEditingCommentId(null);
      const [nextComments, nextActivity] = await Promise.all([
        listHostedComments(idToken, workspaceId, selectedIssue.id),
        listHostedIssueActivity(idToken, workspaceId, selectedIssue.id),
      ]);
      setComments(nextComments);
      setActivity(nextActivity);
      setNotice('Comment updated');
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const deleteComment = async (comment: HostedComment) => {
    if (selectedIssue === null || !window.confirm('Delete this comment? Its content-free history will remain.')) return;
    const storageKey = `basiclinear.hosted.comment.delete.${comment.id}`;
    clearMutationKey(storageKey);
    setPending(true);
    try {
      await deleteHostedComment(
        idToken, workspaceId, selectedIssue.id, comment.id, comment.revision, mutationKey(storageKey),
      );
      clearMutationKey(storageKey);
      const [nextComments, nextActivity] = await Promise.all([
        listHostedComments(idToken, workspaceId, selectedIssue.id),
        listHostedIssueActivity(idToken, workspaceId, selectedIssue.id),
      ]);
      setComments(nextComments);
      setActivity(nextActivity);
      setNotice('Comment deleted');
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setPending(false);
    }
  };

  const addResource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedIssue === null) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const label = String(data.get('label') ?? '').trim();
    const url = String(data.get('url') ?? '').trim();
    void patchIssue({resources: [...selectedIssue.resources, {label, url}]}).then(() => form.reset());
  };

  const removeResource = (resource: HostedIssueResource) => {
    if (selectedIssue === null) return;
    void patchIssue({
      resources: selectedIssue.resources.filter((candidate) => (
        candidate.label !== resource.label || candidate.url !== resource.url
      )),
    });
  };

  const savedViewLabels: Record<SavedViewId, string> = {
    all: 'All issues',
    active: 'Active issues',
    backlog: 'Backlog',
    my_open: 'My active issues',
    unassigned: 'Unassigned issues',
    high_priority: 'High priority',
    completed: 'Completed issues',
  };

  const titleForView = view === 'my_issues' ? 'My issues'
    : view === 'inbox' ? 'Inbox'
      : view === 'workspace_view' ? savedViewLabels[activeSavedView]
        : view === 'home' ? selectedTeam?.name ?? 'Team'
          : view === 'projects' ? 'Projects'
            : view === 'views' ? 'Views'
              : view === 'settings' ? 'Settings'
                : 'Issues';

  const issueGroupStatuses = (view === 'inbox' || view === 'my_issues' || view === 'workspace_view')
    ? workflowStatuses
    : selectedTeamStatuses;
  const issueGroups = issueGrouping === 'status'
    ? issueGroupStatuses.map((status) => ({
      id: status.id,
      label: status.name,
      issues: visibleIssues.filter((issue) => issue.statusId === status.id),
      icon: <WorkflowStatusIcon status={status} />,
    }))
    : issueGrouping === 'priority'
      ? (['urgent', 'high', 'medium', 'low', 'no_priority'] as HostedIssuePriority[]).map((priority) => ({
        id: priority,
        label: priorityLabels[priority],
        issues: visibleIssues.filter((issue) => issue.priority === priority),
        icon: <PriorityIcon priority={priority} size={15} />,
      }))
      : [{id: 'all', label: savedViewLabels[activeSavedView], issues: visibleIssues, icon: <LayoutList size={15} />}];

  const inboxView = (
    <div className="ol-inbox-view">
      <div className="ol-view-heading">
        <div><span className="ol-view-context">{workspaceName}</span><h1>Inbox</h1></div>
        <button className="ol-quiet-button" type="button" onClick={() => void refreshNotifications()}><Bell size={14} /> Refresh</button>
      </div>
      <div className="ol-inbox-note"><Bell size={16} /><div><strong>Issue activity you follow</strong><span>Assignments, comments, changes, and due-time reminders from subscribed issues appear here.</span></div></div>
      {notifications.length === 0 ? <div className="ol-empty-state"><Bell size={28} /><strong>You're all caught up</strong><span>Subscribe to an issue or join its conversation to observe future activity.</span></div>
        : <ul className="ol-notification-list">{notifications.map((notification) => <li key={notification.id} className={notification.unread ? 'unread' : ''}><button type="button" onClick={() => void openNotification(notification)}><span className="ol-notification-avatar">{notification.actorUserId === null ? <span className="ol-due-notification-icon"><CalendarClock size={15} /></span> : <MemberAvatar label={memberLabel(notification.actorUserId)} />}{notification.unread ? <i aria-label="Unread" /> : null}</span><span><strong>{notification.actorUserId === null ? activityCopy(notification.action) : `${memberLabel(notification.actorUserId)} ${activityCopy(notification.action)}`}</strong><small>{notification.issueTitle} · {relativeTime(notification.occurredAt)}</small></span><ChevronRight size={14} /></button></li>)}</ul>}
    </div>
  );

  const issueList = (
    <div className="ol-list-view">
      <div className="ol-view-heading">
        <div>
          <span className="ol-view-context">{navigationScope === 'team' ? selectedTeam?.name ?? 'Team' : workspaceName}</span>
          <h1>{titleForView}</h1>
        </div>
        <div className="ol-view-actions">
          <div className="ol-view-options">
            <button className="ol-icon-button" type="button" aria-label="View options" title="View options"
              aria-expanded={viewOptionsOpen} onClick={() => setViewOptionsOpen((open) => !open)}><SlidersHorizontal size={16} /></button>
            {viewOptionsOpen ? <div className="ol-view-options-menu" role="menu" aria-label="View options">
              <span>Group issues</span>
              {(['status', 'priority', 'none'] as IssueGrouping[]).map((grouping) => <button key={grouping} type="button" role="menuitemradio" aria-checked={issueGrouping === grouping}
                onClick={() => { setIssueGrouping(grouping); setViewOptionsOpen(false); }}><span>{grouping === 'none' ? 'No grouping' : `By ${grouping}`}</span>{issueGrouping === grouping ? <Check size={13} /> : null}</button>)}
              <span>Saved view</span>
              {(Object.entries(savedViewLabels) as Array<[SavedViewId, string]>).map(([id, label]) => <button key={id} type="button" role="menuitemradio" aria-checked={activeSavedView === id}
                onClick={() => { setActiveSavedView(id); setView('issues'); setViewOptionsOpen(false); }}><span>{label}</span>{activeSavedView === id ? <Check size={13} /> : null}</button>)}
            </div> : null}
          </div>
          <button className="ol-primary-button" type="button" onClick={() => showCreateIssue()}><Plus size={15} /> New issue</button>
        </div>
      </div>
      {view === 'issues' ? <div className="ol-issue-tabs" role="tablist" aria-label="Issue scope"><button type="button" role="tab" aria-selected={activeSavedView === 'active'} className={activeSavedView === 'active' ? 'active' : ''} onClick={() => setActiveSavedView('active')}>Active</button><button type="button" role="tab" aria-selected={activeSavedView === 'backlog'} className={activeSavedView === 'backlog' ? 'active' : ''} onClick={() => setActiveSavedView('backlog')}>Backlog</button><button type="button" role="tab" aria-selected={activeSavedView === 'all'} className={activeSavedView === 'all' ? 'active' : ''} onClick={() => setActiveSavedView('all')}>All</button></div> : null}
      {view === 'workspace_view' ? <div className="ol-inbox-note"><Eye size={16} /><div><strong>Workspace view</strong><span>This view spans every team in {workspaceName}.</span></div></div> : null}
      {view === 'inbox' ? (
        <div className="ol-inbox-note"><Bell size={16} /><div><strong>Recent workspace activity</strong><span>Issues are ordered by their latest durable update.</span></div></div>
      ) : null}
      <div className="ol-list-toolbar">
        <span>{visibleIssues.length} issue{visibleIssues.length === 1 ? '' : 's'}</span>
        <span>{savedViewLabels[activeSavedView]} · {issueGrouping === 'none' ? 'not grouped' : `grouped by ${issueGrouping}`}</span>
      </div>
      {loading ? <div className="ol-empty-state">Loading workspace…</div> : visibleIssues.length === 0 ? (
        <div className="ol-empty-state">
          <CircleDashed size={28} />
          <strong>{view === 'my_issues' ? 'No issues assigned to you' : 'No issues here yet'}</strong>
          <span>Create the first issue and put the workspace to work.</span>
          <button className="ol-secondary-button" type="button" onClick={() => showCreateIssue()}><Plus size={15} /> Create issue</button>
        </div>
      ) : issueGroups.map((group) => {
        if (group.issues.length === 0) return null;
        const collapsed = collapsedIssueGroupIds.includes(group.id);
        return (
          <section className="ol-issue-group" key={group.id} aria-labelledby={`group-${group.id}`}>
            <button className="ol-group-heading" type="button" aria-expanded={!collapsed} onClick={() => setCollapsedIssueGroupIds((ids) => (
              collapsed ? ids.filter((id) => id !== group.id) : [...ids, group.id]
            ))}>
              {group.icon}
              <strong id={`group-${group.id}`}>{group.label}</strong>
              <span>{group.issues.length}</span>
              <ChevronDown className={collapsed ? 'collapsed' : ''} size={14} />
            </button>
            {collapsed ? null : <ul>
              {group.issues.map((issue) => {
                const project = projects.find((candidate) => candidate.id === issue.projectId);
                return (
                  <li key={issue.id}>
                    <button type="button" onClick={() => openIssue(issue)}>
                      {workflowStatuses.find((status) => status.id === issue.statusId) === undefined
                        ? <IssueStatusIcon status={issue.status} />
                        : <WorkflowStatusIcon status={workflowStatuses.find((status) => status.id === issue.statusId) as HostedWorkflowStatus} />}
                      <span className="ol-issue-key">{issueKey(issue)}</span>
                      <strong>{issue.title}</strong>
                      {project === undefined ? null : <span className="ol-project-chip"><FolderKanban size={12} />{project.name}</span>}
                      <span className={`ol-priority priority-${issue.priority}`} title={priorityLabels[issue.priority]}><PriorityIcon priority={issue.priority} size={15} /></span>
                      {issue.assigneeUserId === null ? <span className="ol-assignee-empty"><UserRound size={15} /></span>
                        : <MemberAvatar label={memberLabel(issue.assigneeUserId)} />}
                      <ChevronRight size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>}
          </section>
        );
      })}
    </div>
  );

  const issueDetail = selectedIssue === null ? null : (
    <div className="ol-issue-detail">
      <div className="ol-detail-body">
        <div className="ol-detail-heading">
          <span className="ol-detail-key">{selectedIssueStatus === null
            ? <IssueStatusIcon status={selectedIssue.status} />
            : <WorkflowStatusIcon status={selectedIssueStatus} />} {issueKey(selectedIssue)}</span>
          <div className="ol-detail-tools">
            <button className="ol-icon-button" type="button" aria-label="Copy issue link" title="Copy issue link" onClick={() => {
              void navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#issue=${selectedIssue.id}`)
                .then(() => setNotice('Issue link copied'))
                .catch(() => setNotice('Could not copy the issue link'));
            }}><Link2 size={15} /></button>
            <button className="ol-icon-button" type="button" aria-label="Close issue" title="Back to issues" onClick={closeIssue}><X size={16} /></button>
          </div>
        </div>
        <div className="ol-title-editor">
          <textarea key={`${selectedIssue.id}:${selectedIssue.revision}`} name="title" required maxLength={200}
            defaultValue={selectedIssue.title} disabled={pending || (role === 'member' && selectedIssue.assigneeUserId !== currentUserId)}
            aria-label="Issue title"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                event.currentTarget.value = selectedIssue.title;
                event.currentTarget.blur();
              }
            }}
            onBlur={(event) => {
              const title = event.currentTarget.value.trim();
              if (title !== '' && title !== selectedIssue.title) void patchIssue({title});
            }} />
        </div>
        <section className="ol-description" aria-labelledby="ol-description-title">
          <div className="ol-record-section-heading">
            <div><h2 id="ol-description-title">Description</h2><span>Updated {relativeTime(selectedIssue.updatedAt)}</span></div>
            {!editingDescription ? <button className="ol-quiet-button" type="button" disabled={pending || (role === 'member' && selectedIssue.assigneeUserId !== currentUserId)} onClick={() => setEditingDescription(true)}>Edit</button> : null}
          </div>
          {editingDescription ? <form className="ol-description-editor" onSubmit={(event) => {
            event.preventDefault();
            if (descriptionDraft.trim() === selectedIssue.description) {
              setEditingDescription(false);
              return;
            }
            void patchIssue({description: descriptionDraft}).then(() => setEditingDescription(false));
          }}>
            <textarea autoFocus value={descriptionDraft} maxLength={10000} disabled={pending} aria-label="Issue description"
              placeholder="Add context, requirements, acceptance criteria, or implementation notes…"
              onChange={(event) => setDescriptionDraft(event.currentTarget.value)} />
            <div><span>{descriptionDraft.length}/10000</span><button className="ol-quiet-button" type="button" disabled={pending} onClick={() => { setDescriptionDraft(selectedIssue.description); setEditingDescription(false); }}>Cancel</button><button className="ol-secondary-button" type="submit" disabled={pending}>Save description</button></div>
          </form> : selectedIssue.description === '' ? <button className="ol-description-empty" type="button" onClick={() => setEditingDescription(true)}>Add a description…</button>
            : <p className="ol-description-copy">{selectedIssue.description}</p>}
        </section>
        <section className="ol-subissues" aria-labelledby="ol-subissues-title">
          <div className="ol-record-section-heading">
            <button className="ol-record-section-toggle" type="button" aria-expanded={!collapsedDetailSectionIds.includes('subissues')} onClick={() => setCollapsedDetailSectionIds((ids) => ids.includes('subissues') ? ids.filter((id) => id !== 'subissues') : [...ids, 'subissues'])}><ChevronDown className={collapsedDetailSectionIds.includes('subissues') ? 'collapsed' : ''} size={13} /><GitBranch size={15} /><h2 id="ol-subissues-title">Sub-issues</h2><span>{issues.filter((issue) => issue.parentIssueId === selectedIssue.id).length}</span></button>
            <button className="ol-quiet-button" type="button" onClick={() => showCreateIssue(selectedIssue)}><Plus size={13} /> Add sub-issue</button>
          </div>
          {collapsedDetailSectionIds.includes('subissues') ? null : issues.some((issue) => issue.parentIssueId === selectedIssue.id) ? <ul>
            {issues.filter((issue) => issue.parentIssueId === selectedIssue.id).map((issue) => <li key={issue.id}><button type="button" onClick={() => openIssue(issue)}><IssueStatusIcon status={issue.status} /><span>{issueKey(issue)}</span><strong>{issue.title}</strong><span>{memberLabel(issue.assigneeUserId)}</span><ChevronRight size={13} /></button></li>)}
          </ul> : <p className="ol-inline-empty">Break this work into smaller issues with their own assignees and activity.</p>}
        </section>
        <section className="ol-resources" aria-labelledby="ol-resources-title">
          <div className="ol-record-section-heading"><button className="ol-record-section-toggle" type="button" aria-expanded={!collapsedDetailSectionIds.includes('resources')} onClick={() => setCollapsedDetailSectionIds((ids) => ids.includes('resources') ? ids.filter((id) => id !== 'resources') : [...ids, 'resources'])}><ChevronDown className={collapsedDetailSectionIds.includes('resources') ? 'collapsed' : ''} size={13} /><Paperclip size={15} /><h2 id="ol-resources-title">Resources</h2><span>{selectedIssue.resources.length}</span></button>{!addingResource ? <button className="ol-quiet-button" type="button" onClick={() => { setCollapsedDetailSectionIds((ids) => ids.filter((id) => id !== 'resources')); setAddingResource(true); }}><Plus size={13} /> Add</button> : null}</div>
          {collapsedDetailSectionIds.includes('resources') ? null : selectedIssue.resources.length > 0 ? <ul>{selectedIssue.resources.map((resource) => <li key={`${resource.label}:${resource.url}`}><Link2 size={14} /><a href={resource.url} target="_blank" rel="noreferrer">{resource.label}<ExternalLink size={12} /></a><button type="button" aria-label={`Remove ${resource.label}`} disabled={pending} onClick={() => removeResource(resource)}><X size={13} /></button></li>)}</ul> : null}
          {collapsedDetailSectionIds.includes('resources') ? null : addingResource ? <form className="ol-resource-form" onSubmit={(event) => { addResource(event); setAddingResource(false); }}>
            <label><span className="ol-sr-only">Resource label</span><input name="label" required maxLength={120} disabled={pending} placeholder="Resource name" /></label>
            <label><span className="ol-sr-only">Resource URL</span><input name="url" required type="url" maxLength={2048} disabled={pending} placeholder="https://" /></label>
            <button className="ol-quiet-button" type="button" disabled={pending} onClick={() => setAddingResource(false)}>Cancel</button><button className="ol-quiet-button" type="submit" disabled={pending || selectedIssue.resources.length >= 25}><Plus size={13} /> Add</button>
          </form> : null}
        </section>
        <section className="ol-activity" aria-labelledby="ol-activity-title">
          <div className="ol-record-section-heading"><button className="ol-record-section-toggle" type="button" aria-expanded={!collapsedDetailSectionIds.includes('activity')} onClick={() => setCollapsedDetailSectionIds((ids) => ids.includes('activity') ? ids.filter((id) => id !== 'activity') : [...ids, 'activity'])}><ChevronDown className={collapsedDetailSectionIds.includes('activity') ? 'collapsed' : ''} size={13} /><Activity size={15} /><h2 id="ol-activity-title">Activity</h2><span>{activity.filter((entry) => !entry.action.startsWith('comment.')).length + comments.length}</span></button><div className="ol-observation-controls"><div className="ol-subscriber-stack" aria-label={`${observation?.subscriberUserIds.length ?? 0} subscribers`}>{observation?.subscriberUserIds.slice(0, 4).map((userId) => <MemberAvatar key={userId} label={memberLabel(userId)} />)}</div><button className="ol-quiet-button" type="button" disabled={pending || observation === null} onClick={() => void toggleIssueSubscription()}><Bell size={13} />{observation?.subscribed ? 'Unsubscribe' : 'Subscribe'}</button><span>Created {dateFormatter.format(new Date(selectedIssue.createdAt))}</span></div></div>
          {collapsedDetailSectionIds.includes('activity') ? null : <><ol className="ol-event-list">
            {activity.filter((entry) => !entry.action.startsWith('comment.')).map((entry) => <li key={entry.id}><span className="ol-event-dot"><IssueStatusIcon status={entry.action === 'issue.created' ? 'todo' : selectedIssue.status} size={12} /></span><p><strong>{memberLabel(entry.actorUserId)}</strong> {activityCopy(entry.action)} <time dateTime={entry.occurredAt}>{relativeTime(entry.occurredAt)}</time></p></li>)}
          </ol>
          <ol className="ol-comment-list">
            {comments.map((comment) => (
              <li key={comment.id}>
                <MemberAvatar label={memberLabel(comment.authorUserId)} />
                <div>
                  <div className="ol-comment-meta">
                    <strong>{memberLabel(comment.authorUserId)}</strong>
                    <time dateTime={comment.createdAt}>{dateTimeFormatter.format(new Date(comment.createdAt))}</time>
                  </div>
                  {comment.deletedAt !== null ? <p className="ol-comment-deleted">Comment deleted · history preserved</p>
                    : editingCommentId === comment.id ? (
                      <div className="ol-inline-comment-edit">
                        <label htmlFor={`comment-${comment.id}`}>Edit comment</label>
                        <textarea id={`comment-${comment.id}`} autoFocus value={editingCommentBody} disabled={pending}
                          onChange={(event) => setEditingCommentBody(event.currentTarget.value)} />
                        <div>
                          <button className="ol-secondary-button" type="button" disabled={pending} onClick={() => void saveComment(comment)}>Save</button>
                          <button className="ol-quiet-button" type="button" disabled={pending} onClick={() => setEditingCommentId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : <p>{comment.body}</p>}
                  {comment.deletedAt === null && editingCommentId !== comment.id ? (
                    <div className="ol-comment-actions">
                      {comment.authorUserId === currentUserId ? <button type="button" onClick={() => {
                        setEditingCommentId(comment.id);
                        setEditingCommentBody(comment.body ?? '');
                      }}>Edit</button> : null}
                      {(role === 'owner' || comment.authorUserId === currentUserId) ? <button type="button" onClick={() => void deleteComment(comment)}>Delete</button> : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <form className="ol-comment-composer" onSubmit={(event) => void addComment(event)}>
            <MemberAvatar label={displayName || userEmail} />
            <div>
              <label htmlFor="ol-new-comment">Leave a comment</label>
              <textarea id="ol-new-comment" required maxLength={4000} value={commentDraft} disabled={pending}
                placeholder="Write an update, decision, or question…"
                onChange={(event) => setCommentDraft(event.currentTarget.value)} />
              <div><span>Markdown-style plain text · {commentDraft.length}/4000</span><button className="ol-primary-button" type="submit" disabled={pending || commentDraft.trim() === ''}>Comment</button></div>
            </div>
          </form>
          </>}
        </section>
      </div>
      <aside className="ol-properties" aria-label="Issue properties">
        <h2>Properties</h2>
        <div className="ol-property-primary" aria-label="Core properties">
        <div className="ol-property-row"><span className="ol-sr-only">Status</span>
          <LinearMenu ariaLabel="Status" value={selectedIssue.statusId}
            disabled={pending || (role === 'member' && selectedIssue.assigneeUserId !== currentUserId)}
            options={workflowStatuses.filter((status) => status.teamId === selectedIssue.teamId).map((status) => ({
              value: status.id,
              label: status.name,
              icon: <WorkflowStatusIcon status={status} size={13} />,
            }))}
            onChange={(value) => void patchIssue({statusId: value})} />
        </div>
        <div className="ol-property-row"><span className="ol-sr-only">Priority</span>
          <LinearMenu ariaLabel="Priority" value={selectedIssue.priority}
            disabled={pending || (role === 'member' && selectedIssue.assigneeUserId !== currentUserId)}
            options={(Object.entries(priorityLabels) as Array<[HostedIssuePriority, string]>).map(([value, label]) => ({value, label, icon: <PriorityIcon priority={value} size={13} />}))}
            onChange={(value) => void patchIssue({priority: value})} />
        </div>
        <div className="ol-property-row"><span className="ol-sr-only">Assignee</span>
          {role === 'owner' ? <LinearMenu ariaLabel="Assignee" value={selectedIssue.assigneeUserId ?? ''} disabled={pending}
            options={[
              {value: '', label: 'Unassigned', icon: <UserRound size={13} />},
              ...(selectedIssue.assigneeUserId !== null && !members.some((member) => member.userId === selectedIssue.assigneeUserId)
                ? [{value: selectedIssue.assigneeUserId, label: memberLabel(selectedIssue.assigneeUserId), icon: <UserRound size={13} />}] : []),
              ...members.map((member) => ({value: member.userId, label: `${memberLabel(member.userId)} · ${member.role}`, icon: <MemberAvatar label={memberLabel(member.userId)} />})),
            ]} onChange={(value) => void assignIssue(value || null)} />
            : <strong className="ol-property-static-value">{selectedIssue.assigneeUserId === null
              ? <UserRound size={13} /> : <MemberAvatar label={memberLabel(selectedIssue.assigneeUserId)} />}{memberLabel(selectedIssue.assigneeUserId)}</strong>}
        </div>
        </div>
        <section className="ol-property-section" aria-labelledby="ol-project-properties-title">
        <h3 id="ol-project-properties-title">Project</h3>
        <div className="ol-property-row"><span className="ol-sr-only">Project</span>
          <LinearMenu ariaLabel="Project" value={selectedIssue.projectId ?? ''}
            disabled={pending || (role === 'member' && selectedIssue.assigneeUserId !== currentUserId)}
            options={[{value: '', label: 'No project', icon: <FolderKanban size={13} />}, ...projects.map((project) => ({value: project.id, label: project.name, icon: <FolderKanban size={13} />}))]}
            onChange={(value) => void patchIssue({projectId: value || null, milestoneId: null})} />
        </div>
        <div className="ol-property-row"><span className="ol-sr-only">Milestone</span>
          <LinearMenu ariaLabel="Milestone" value={selectedIssue.milestoneId ?? ''}
            disabled={pending || selectedIssue.projectId === null || (role === 'member' && selectedIssue.assigneeUserId !== currentUserId)}
            options={[{value: '', label: 'No milestone', icon: <CalendarDays size={13} />}, ...milestones.filter((milestone) => milestone.projectId === selectedIssue.projectId).map((milestone) => ({value: milestone.id, label: milestone.name, icon: <CalendarDays size={13} />}))]}
            onChange={(value) => void patchIssue({milestoneId: value || null})} />
        </div>
        </section>
        <section className="ol-property-section" aria-labelledby="ol-team-properties-title">
        <h3 id="ol-team-properties-title">Team</h3>
        <div className="ol-property-row"><span className="ol-sr-only">Team</span>
          <LinearMenu ariaLabel="Team" value={selectedIssue.teamId}
            disabled={pending || (role === 'member' && selectedIssue.assigneeUserId !== currentUserId)}
            options={teams.map((team) => ({
              value: team.id,
              label: team.name,
              icon: <span className="ol-team-color" style={{backgroundColor: team.color}} />,
            }))}
            onChange={(value) => void patchIssue({teamId: value})} />
        </div>
        </section>
        <section className="ol-property-section" aria-labelledby="ol-schedule-properties-title">
        <h3 id="ol-schedule-properties-title">Schedule</h3>
        <label className="ol-due-time-control"><span className="ol-sr-only">Due time</span><CalendarClock size={13} />
          <input key={selectedIssue.dueAt ?? 'no-due-time'} type="datetime-local" aria-label="Due time" defaultValue={localDateTimeValue(selectedIssue.dueAt)}
            disabled={pending || (role === 'member' && selectedIssue.assigneeUserId !== currentUserId)}
            onBlur={(event) => { const dueAt = canonicalDueAt(event.currentTarget.value); if (dueAt !== selectedIssue.dueAt) void patchIssue({dueAt}); }} />
        </label>
        </section>
      </aside>
    </div>
  );

  const selectedTeamProjectIds = new Set(selectedTeamIssues.flatMap((issue) => (
    issue.projectId === null ? [] : [issue.projectId]
  )));
  const scopedProjects = navigationScope === 'team'
    ? projects.filter((project) => selectedTeamProjectIds.has(project.id))
    : projects;
  const scopedProjectIssues = navigationScope === 'team' ? selectedTeamIssues : issues;
  const projectMetrics = (project: HostedProject) => {
    const projectIssues = scopedProjectIssues.filter((issue) => issue.projectId === project.id);
    const completed = projectIssues.filter((issue) => issue.status === 'done').length;
    const progress = projectIssues.length === 0 ? 0 : Math.round((completed / projectIssues.length) * 100);
    const priorityOrder: HostedIssuePriority[] = ['urgent', 'high', 'medium', 'low', 'no_priority'];
    const priority = priorityOrder.find((candidate) => projectIssues.some((issue) => issue.priority === candidate)) ?? 'no_priority';
    const lead = [...projectIssues].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).find((issue) => issue.assigneeUserId !== null)?.assigneeUserId ?? null;
    return {projectIssues, progress, priority, lead};
  };
  const normalizedProjectQuery = query.trim().toLocaleLowerCase();
  const visibleProjects = [...scopedProjects].filter((project) => {
    if (projectStatusFilter !== 'all' && project.status !== projectStatusFilter) return false;
    if (projectSavedPredicate === 'active' && ['completed', 'canceled'].includes(project.status)) return false;
    if (projectSavedPredicate === 'completed' && project.status !== 'completed') return false;
    return normalizedProjectQuery === '' || project.name.toLocaleLowerCase().includes(normalizedProjectQuery)
      || project.summary.toLocaleLowerCase().includes(normalizedProjectQuery);
  }).sort((left, right) => {
    if (projectSort === 'name') return left.name.localeCompare(right.name);
    if (projectSort === 'progress') return projectMetrics(right).progress - projectMetrics(left).progress || left.name.localeCompare(right.name);
    return right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name);
  });

  const projectsView = selectedProject === null ? (
    <div className="ol-projects-view">
      <div className="ol-view-heading">
        <div><span className="ol-view-context">{navigationScope === 'team' ? selectedTeam?.name ?? 'Team' : workspaceName}</span><h1>Projects</h1></div>
        <button className="ol-primary-button" type="button" onClick={() => setModal('project')}><Plus size={15} /> New project</button>
      </div>
      <div className="ol-projects-toolbar"><span>{visibleProjects.length} project{visibleProjects.length === 1 ? '' : 's'} · {projectSavedPredicate === 'all' ? 'All projects' : projectSavedPredicate === 'active' ? 'Active projects' : 'Completed projects'}</span><div className="ol-project-controls"><label>Status<select aria-label="Filter projects by status" value={projectStatusFilter} onChange={(event) => setProjectStatusFilter(event.currentTarget.value as ProjectStatusFilter)}><option value="all">All statuses</option>{Object.entries(projectStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Sort<select aria-label="Sort projects" value={projectSort} onChange={(event) => setProjectSort(event.currentTarget.value as ProjectSort)}><option value="updated">Recently updated</option><option value="name">Name</option><option value="progress">Progress</option></select></label></div></div>
      {visibleProjects.length === 0 ? (
        <div className="ol-empty-state"><FolderKanban size={30} /><strong>{scopedProjects.length > 0 ? 'No matching projects' : navigationScope === 'team' ? 'No team projects yet' : 'No projects yet'}</strong><span>{scopedProjects.length > 0 ? 'Adjust the status filter or workspace search.' : navigationScope === 'team' ? 'Projects appear here when this team has an issue in them.' : 'Create a project, add milestones, and place issues inside it.'}</span><button className="ol-secondary-button" type="button" onClick={() => setModal('project')}><Plus size={15} /> Create project</button></div>
      ) : <div className="ol-project-table"><div className="ol-project-table-head"><span>Project</span><span>Status</span><span>Progress</span><span>Priority</span><span>Lead</span><span>Issues</span><span>Target</span></div>{visibleProjects.map((project, index) => {
        const {projectIssues, progress, priority, lead} = projectMetrics(project);
        const nextMilestone = milestones.find((milestone) => milestone.projectId === project.id && milestone.targetDate !== null);
        return (
          <button key={project.id} className={`ol-project-row project-color-${index % 5}`} type="button" onClick={() => openProject(project)}>
            <span className="ol-project-row-name"><span className="ol-project-symbol"><FolderKanban size={16} /></span><span><strong>{project.name}</strong><small>{project.summary || 'No summary yet.'}</small></span></span>
            <span className={`ol-project-status status-${project.status}`}>{projectStatusLabels[project.status]}</span>
            <span className="ol-progress"><span><i style={{width: `${progress}%`}} /></span><strong>{progress}%</strong></span>
            <span className="ol-project-priority"><PriorityIcon priority={priority} size={14} />{priorityLabels[priority]}</span>
            <span className="ol-project-lead">{lead === null ? <><UserRound size={14} />Unassigned</> : <><MemberAvatar label={memberLabel(lead)} />{memberLabel(lead)}</>}</span>
            <span>{projectIssues.length}</span>
            <span>{nextMilestone?.targetDate === null || nextMilestone === undefined ? '—' : dateFormatter.format(new Date(`${nextMilestone.targetDate}T00:00:00.000Z`))}</span>
            <ChevronRight size={14} />
          </button>
        );
      })}</div>}
    </div>
  ) : (
    <div className="ol-project-detail">
      <div className="ol-project-main">
        <button className="ol-back-link" type="button" onClick={() => setSelectedProjectId(null)}><ChevronLeft size={14} /> All projects</button>
        <form key={`${selectedProject.id}:${selectedProject.revision}`} className="ol-project-edit" onSubmit={(event) => void saveProject(event)}>
          <div className="ol-project-title-row"><span className="ol-project-symbol"><FolderKanban size={19} /></span><input name="name" defaultValue={selectedProject.name} required maxLength={120} disabled={pending} aria-label="Project name" /></div>
          <textarea name="summary" defaultValue={selectedProject.summary} maxLength={280} disabled={pending} aria-label="Project summary" placeholder="What outcome will this project deliver?" />
          <div><label>Status<select name="status" defaultValue={selectedProject.status} disabled={pending}>{Object.entries(projectStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="ol-secondary-button" type="submit" disabled={pending}><Check size={14} /> Save project</button></div>
        </form>
        <section className="ol-project-issues">
          <div className="ol-section-title"><LayoutList size={16} /><h2>Issues</h2><span>{scopedProjectIssues.filter((issue) => issue.projectId === selectedProject.id).length}</span></div>
          <ul>{scopedProjectIssues.filter((issue) => issue.projectId === selectedProject.id).map((issue) => <li key={issue.id}><button type="button" onClick={() => openIssue(issue)}><IssueStatusIcon status={issue.status} /><span>{issueKey(issue)}</span><strong>{issue.title}</strong><span>{priorityLabels[issue.priority]}</span><ChevronRight size={14} /></button></li>)}</ul>
          {scopedProjectIssues.every((issue) => issue.projectId !== selectedProject.id) ? <p className="ol-inline-empty">No issues in this project yet. Create one and select this project.</p> : null}
          <button className="ol-quiet-button" type="button" onClick={() => showCreateIssue()}><Plus size={14} /> Add issue</button>
        </section>
      </div>
      <aside className="ol-milestones-panel">
        <div className="ol-section-title"><CalendarDays size={16} /><h2>Milestones</h2><span>{selectedProjectMilestones.length}</span></div>
        <ul>{selectedProjectMilestones.map((milestone) => <li key={milestone.id}><div><Circle size={13} /><strong>{milestone.name}</strong></div><p>{milestone.description || 'No description'}</p><label>Target date<input type="date" value={milestone.targetDate ?? ''} disabled={pending} onChange={(event) => void updateMilestoneDate(milestone, event.currentTarget.value || null)} /></label></li>)}</ul>
        <form className="ol-milestone-create" onSubmit={(event) => void createMilestone(event)}>
          <h3>Add milestone</h3>
          <label>Name<input name="name" required maxLength={120} disabled={pending} placeholder="Launch ready" /></label>
          <label>Description<textarea name="description" maxLength={4000} disabled={pending} placeholder="A clear acceptance boundary" /></label>
          <label>Target date<input name="targetDate" type="date" disabled={pending} /></label>
          <button className="ol-secondary-button" type="submit" disabled={pending}><Plus size={14} /> Add milestone</button>
        </form>
      </aside>
    </div>
  );

  const issuesMatchingSavedView = (values: HostedIssue[], predicate: SavedViewId) => values.filter((issue) => {
    if (predicate === 'active') return issue.status !== 'done';
    if (predicate === 'backlog') return workflowStatuses.find((status) => status.id === issue.statusId)?.category === 'backlog';
    if (predicate === 'my_open') return issue.assigneeUserId === currentUserId && issue.status !== 'done';
    if (predicate === 'unassigned') return issue.assigneeUserId === null && issue.status !== 'done';
    if (predicate === 'high_priority') return ['urgent', 'high'].includes(issue.priority) && issue.status !== 'done';
    if (predicate === 'completed') return issue.status === 'done';
    return true;
  });
  const savedViewScopeIssues = navigationScope === 'team' ? selectedTeamIssues : sortedIssues;
  const savedViewScopeLabel = navigationScope === 'team' ? selectedTeam?.name ?? 'this team' : workspaceName;
  const visibleSavedViewRecords = navigationScope === 'team'
    ? workspaceSavedViews.filter((savedView) => savedView.teamId === selectedTeam?.id)
    : workspaceSavedViews;
  const projectsMatchingSavedView = (teamId: string, predicate: SavedViewId) => {
    const projectIds = new Set(sortedIssues.filter((issue) => issue.teamId === teamId && issue.projectId !== null).map((issue) => issue.projectId));
    return projects.filter((project) => projectIds.has(project.id)).filter((project) => {
      if (predicate === 'active') return !['completed', 'canceled'].includes(project.status);
      if (predicate === 'completed') return project.status === 'completed';
      return true;
    });
  };
  const savedViews: Array<{id: string; predicate: SavedViewId; viewType: HostedSavedViewType; teamId: string | null; title: string; description: string; count: number; icon: ReactNode}> = [
    {id: 'all', predicate: 'all', viewType: 'issues', teamId: navigationScope === 'team' ? selectedTeam?.id ?? null : null, title: 'All issues', description: `Every issue in ${savedViewScopeLabel}.`, count: savedViewScopeIssues.length, icon: <LayoutList size={18} />},
    {id: 'active', predicate: 'active', viewType: 'issues', teamId: navigationScope === 'team' ? selectedTeam?.id ?? null : null, title: 'Active issues', description: 'All work that is not completed or canceled.', count: issuesMatchingSavedView(savedViewScopeIssues, 'active').length, icon: <CircleDot size={18} />},
    {id: 'backlog', predicate: 'backlog', viewType: 'issues', teamId: navigationScope === 'team' ? selectedTeam?.id ?? null : null, title: 'Backlog', description: 'Ideas and work not yet committed.', count: issuesMatchingSavedView(savedViewScopeIssues, 'backlog').length, icon: <CircleDashed size={18} />},
    {id: 'my_open', predicate: 'my_open', viewType: 'issues', teamId: navigationScope === 'team' ? selectedTeam?.id ?? null : null, title: 'My active issues', description: 'Open work assigned to you.', count: issuesMatchingSavedView(savedViewScopeIssues, 'my_open').length, icon: <UserRound size={18} />},
    {id: 'unassigned', predicate: 'unassigned', viewType: 'issues', teamId: navigationScope === 'team' ? selectedTeam?.id ?? null : null, title: 'Unassigned issues', description: 'Open work that still needs an owner.', count: issuesMatchingSavedView(savedViewScopeIssues, 'unassigned').length, icon: <Users size={18} />},
    {id: 'high_priority', predicate: 'high_priority', viewType: 'issues', teamId: navigationScope === 'team' ? selectedTeam?.id ?? null : null, title: 'High priority', description: 'Urgent and high-priority open work.', count: issuesMatchingSavedView(savedViewScopeIssues, 'high_priority').length, icon: <SignalHigh size={18} />},
    {id: 'completed', predicate: 'completed', viewType: 'issues', teamId: navigationScope === 'team' ? selectedTeam?.id ?? null : null, title: 'Completed issues', description: 'Delivered work and resolved decisions.', count: issuesMatchingSavedView(savedViewScopeIssues, 'completed').length, icon: <CircleCheck size={18} />},
    ...visibleSavedViewRecords.map((savedView) => ({
      id: savedView.id,
      predicate: savedView.predicate,
      viewType: savedView.viewType,
      teamId: savedView.teamId,
      title: savedView.name,
      description: `${teams.find((team) => team.id === savedView.teamId)?.name ?? 'Team'} · ${savedView.viewType === 'projects' ? savedView.predicate === 'active' ? 'Active projects' : savedView.predicate === 'completed' ? 'Completed projects' : 'All projects' : savedViewLabels[savedView.predicate]}`,
      count: savedView.viewType === 'issues'
        ? issuesMatchingSavedView(sortedIssues.filter((issue) => issue.teamId === savedView.teamId), savedView.predicate).length
        : projectsMatchingSavedView(savedView.teamId, savedView.predicate).length,
      icon: savedView.viewType === 'issues' ? <ListFilter size={18} /> : <FolderKanban size={18} />,
    })),
  ];

  const viewsView = (
    <div className="ol-views-page">
      <div className="ol-view-heading"><div><span className="ol-view-context">{navigationScope === 'team' ? selectedTeam?.name ?? 'Team' : workspaceName}</span><h1>Views</h1></div>{role === 'owner' ? <button className="ol-primary-button" type="button" onClick={() => setModal('view')}><Plus size={15} /> New view</button> : null}</div>
      <div className="ol-view-grid">{savedViews.map((savedView) => <button key={savedView.id} type="button" onClick={() => {
        if (savedView.viewType === 'projects' && savedView.teamId !== null) {
          goToTeam(savedView.teamId, 'projects');
          setProjectSavedPredicate(['active', 'completed'].includes(savedView.predicate) ? savedView.predicate as ProjectSavedPredicate : 'all');
          setProjectStatusFilter('all');
        } else {
          if (savedView.teamId === null) go('workspace_view', 'workspace');
          else goToTeam(savedView.teamId, 'issues');
          setActiveSavedView(savedView.predicate);
        }
      }}>
        <span className="ol-saved-view-icon">{savedView.icon}</span><div><strong>{savedView.title}</strong><p>{savedView.description}</p></div><span className="ol-saved-view-count">{savedView.count}</span><ChevronRight size={14} />
      </button>)}</div>
    </div>
  );

  const teamResources = selectedTeamIssues.flatMap((issue) => issue.resources.map((resource) => ({
    ...resource,
    issueId: issue.id,
  }))).filter((resource, index, values) => values.findIndex((candidate) => candidate.url === resource.url) === index);
  const selectedTeamMembers = members.filter((member) => {
    if (selectedTeam === null) return false;
    return teamMemberships.some((teamMembership) => teamMembership.teamId === selectedTeam.id
      && teamMembership.userId === member.userId);
  });
  const currentTeamMembership = selectedTeam === null ? null : teamMemberships.find((membership) => (
    membership.teamId === selectedTeam.id && membership.userId === currentUserId
  )) ?? null;

  const homeView = (
    <div className="ol-team-home">
      <div className="ol-view-heading"><div><span className="ol-view-context">Team</span><h1>{selectedTeam?.name ?? 'Team'}</h1><p>{selectedTeam?.description || 'Plan and deliver work with this team.'}</p></div><button className="ol-primary-button" type="button" onClick={() => showCreateIssue()}><Plus size={15} /> New issue</button></div>
      <div className="ol-team-home-tabs" role="tablist" aria-label="Team home sections">{(['overview', 'documents', 'members'] as TeamHomeTab[]).map((tab) => <button key={tab} type="button" role="tab" aria-selected={teamHomeTab === tab} className={teamHomeTab === tab ? 'active' : ''} onClick={() => setTeamHomeTab(tab)}>{tab[0]?.toUpperCase()}{tab.slice(1)}</button>)}</div>
      {teamHomeTab === 'overview' ? <>
        <section className="ol-team-overview"><header><h2>Overview</h2><p>{selectedTeam?.description || 'No team description yet.'}</p></header><div className="ol-team-go-links"><button type="button" onClick={() => { if (selectedTeam !== null) goToTeam(selectedTeam.id, 'issues'); }}><LayoutList size={16} /><span><strong>Issues</strong><small>{selectedTeamIssues.filter((issue) => issue.status !== 'done').length} active</small></span><ChevronRight size={14} /></button><button type="button" onClick={() => { if (selectedTeam !== null) goToTeam(selectedTeam.id, 'projects'); }}><FolderKanban size={16} /><span><strong>Projects</strong><small>{selectedTeamProjectIds.size} connected</small></span><ChevronRight size={14} /></button><button type="button" onClick={() => { if (selectedTeam !== null) goToTeam(selectedTeam.id, 'views'); }}><Eye size={16} /><span><strong>Views</strong><small>{workspaceSavedViews.filter((savedView) => savedView.teamId === selectedTeam?.id).length} saved</small></span><ChevronRight size={14} /></button></div></section>
        <section className="ol-home-section"><div className="ol-record-section-heading"><div><Activity size={15} /><h2>Recently updated</h2></div><button className="ol-quiet-button" type="button" onClick={() => { if (selectedTeam !== null) goToTeam(selectedTeam.id, 'issues'); }}>View all</button></div><ul>{selectedTeamIssues.slice(0, 6).map((issue) => <li key={issue.id}><button type="button" onClick={() => openIssue(issue)}>{workflowStatuses.find((status) => status.id === issue.statusId) === undefined ? <IssueStatusIcon status={issue.status} /> : <WorkflowStatusIcon status={workflowStatuses.find((status) => status.id === issue.statusId) as HostedWorkflowStatus} />}<span className="ol-home-issue-key">{issueKey(issue)}</span><strong>{issue.title}</strong><span>{relativeTime(issue.updatedAt)}</span><ChevronRight size={13} /></button></li>)}</ul></section>
      </> : teamHomeTab === 'documents' ? <section className="ol-team-documents"><header><h2>Documents & resources</h2><p>Links attached to this team’s issues stay discoverable here.</p></header>{teamResources.length === 0 ? <div className="ol-inline-empty">No team resources yet. Attach a resource to an issue to list it here.</div> : <ul>{teamResources.map((resource) => <li key={resource.url}><Link2 size={15} /><a href={resource.url} target="_blank" rel="noreferrer">{resource.label}</a><button type="button" onClick={() => openIssue(issues.find((issue) => issue.id === resource.issueId) as HostedIssue)}>Open issue <ChevronRight size={13} /></button></li>)}</ul>}</section>
        : <section className="ol-team-members"><header><div><h2>Members</h2><p>Everyone in the organization can see this team and choose whether to join it.</p></div>{selectedTeam === null ? null : <button className="ol-secondary-button" type="button" disabled={pendingTeamId === selectedTeam.id} onClick={() => void changeTeamMembership(selectedTeam, currentTeamMembership === null)}>{currentTeamMembership === null ? 'Join team' : 'Leave team'}</button>}</header>{selectedTeamMembers.length === 0 ? <div className="ol-inline-empty">No one has joined this team yet.</div> : <ul>{selectedTeamMembers.map((member) => <li key={member.userId}><MemberAvatar label={memberLabel(member.userId)} /><div><strong>{memberLabel(member.userId)}</strong><span>{member.role}</span></div></li>)}</ul>}{role === 'owner' ? <button className="ol-secondary-button" type="button" onClick={() => setModal('invite')}><Plus size={14} /> Invite people</button> : null}</section>}
    </div>
  );

  const settingsView = (
    <div className="ol-settings-view">
      <div className="ol-settings-nav">
        <div><span className="ol-view-context">{workspaceName}</span><h1>Settings</h1></div>
        <nav aria-label="Workspace settings">
          <button className={settingsTab === 'general' ? 'active' : ''} type="button" onClick={() => setSettingsTab('general')}><Settings size={15} /> General</button>
          <button className={settingsTab === 'teams' ? 'active' : ''} type="button" onClick={() => setSettingsTab('teams')}><Users size={15} /> Teams</button>
          <button className={settingsTab === 'workflow' ? 'active' : ''} type="button" onClick={() => setSettingsTab('workflow')}><Workflow size={15} /> Workflow</button>
          <button className={settingsTab === 'people' ? 'active' : ''} type="button" onClick={() => setSettingsTab('people')}><Users size={15} /> People</button>
          {role === 'owner' ? <button className={settingsTab === 'billing' ? 'active' : ''} type="button" onClick={() => setSettingsTab('billing')}><CircleDot size={15} /> Billing</button> : null}
          {role === 'owner' ? <button className={settingsTab === 'automation' ? 'active' : ''} type="button" onClick={() => setSettingsTab('automation')}><Command size={15} /> API & MCP</button> : null}
        </nav>
      </div>
      <div className="ol-settings-content">
        {settingsTab === 'general' ? <section className="ol-general-settings"><header><h2>Workspace</h2><p>Your account and hosted workspace authority.</p></header><dl><div><dt>Name</dt><dd>{workspaceName}</dd></div><div><dt>Account</dt><dd>{userEmail}</dd></div><div><dt>Role</dt><dd>{role}</dd></div><div><dt>Environment</dt><dd>{environment.label}</dd></div><div><dt>Authority</dt><dd>Firebase-hosted</dd></div>{trial === undefined ? null : <><div><dt>Pro trial started</dt><dd>{dateFormatter.format(new Date(trial.startedAt))}</dd></div><div><dt>Pro trial ends</dt><dd>{dateFormatter.format(new Date(trial.endsAt))}</dd></div></>}</dl><button className="ol-secondary-button" type="button" onClick={() => void signOutHostedUser().then(() => window.location.reload())}>Sign out</button></section> : null}
        {settingsTab === 'teams' ? <section className="ol-team-settings"><header><div><h2>Teams</h2><p>Every organization member can view every team, join several teams, or leave them independently.</p></div>{role === 'owner' ? <button className="ol-primary-button" type="button" onClick={() => setModal('team')}><Plus size={14} /> Create team</button> : null}</header><ul>{teams.map((team) => { const joined = teamMemberships.some((membership) => membership.teamId === team.id && membership.userId === currentUserId); return <li key={team.id}><span className="ol-team-color" style={{backgroundColor: team.color}} /><div><strong>{team.name}</strong><span>{team.key} · {team.description || 'No description'} · {joined ? 'Joined' : 'Not joined'}</span></div><div className="ol-settings-row-actions"><button className="ol-quiet-button" type="button" disabled={pendingTeamId === team.id} onClick={() => void changeTeamMembership(team, !joined)}>{joined ? 'Leave' : 'Join'}</button>{role === 'owner' ? <button className="ol-quiet-button" type="button" aria-label={`Edit ${team.name} team`} onClick={() => { setEditingTeamId(team.id); setModal('team_edit'); }}>Edit</button> : null}<button className="ol-quiet-button" type="button" onClick={() => goToTeam(team.id, 'home')}>Open team <ChevronRight size={13} /></button></div></li>; })}</ul></section> : null}
        {settingsTab === 'workflow' ? <section className="ol-workflow-settings"><header><div><h2>Workflow statuses</h2><p>Customize the states used by {selectedTeam?.name ?? 'this team'}.</p></div>{role === 'owner' && selectedTeam !== null ? <button className="ol-primary-button" type="button" onClick={() => setModal('status')}><Plus size={14} /> Add status</button> : null}</header><label className="ol-settings-team-select">Team<select value={selectedTeam?.id ?? ''} onChange={(event) => setSelectedTeamId(event.currentTarget.value)}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>{(['backlog', 'unstarted', 'started', 'completed', 'canceled'] as HostedWorkflowStatusCategory[]).map((category) => {
          const categoryStatuses = selectedTeamStatuses.filter((status) => status.category === category);
          return <div className="ol-status-category" key={category}><div><strong>{category[0]?.toUpperCase()}{category.slice(1)}</strong><span>{categoryStatuses.length}</span></div><ul>{categoryStatuses.map((status, index) => <li key={status.id}><WorkflowStatusIcon status={status} /><strong>{status.name}</strong><span>{status.isDefault ? 'System default · icon editable' : 'Custom'}</span>{role === 'owner' ? <div className="ol-status-actions"><button className="ol-icon-button" type="button" aria-label={`Move ${status.name} up`} disabled={pending || status.isDefault || index === 0 || categoryStatuses[index - 1]?.isDefault === true} onClick={() => void moveWorkflowStatus(status, -1)}><ChevronUp size={13} /></button><button className="ol-icon-button" type="button" aria-label={`Move ${status.name} down`} disabled={pending || status.isDefault || index === categoryStatuses.length - 1 || categoryStatuses[index + 1]?.isDefault === true} onClick={() => void moveWorkflowStatus(status, 1)}><ChevronDown size={13} /></button><button className="ol-quiet-button" type="button" aria-label={`Edit ${status.name} status`} onClick={() => { setEditingStatusId(status.id); setModal('status_edit'); }}>Edit</button></div> : null}</li>)}</ul></div>;
        })}</section> : null}
        {settingsTab === 'people' ? <div className="ol-people-settings"><section className="ol-member-roster"><header><h2>Organization members</h2><p>{members.length} active member{members.length === 1 ? '' : 's'} can view all teams.</p></header><ul>{members.map((member) => <li key={member.userId}><MemberAvatar label={memberLabel(member.userId)} /><div><strong>{memberLabel(member.userId)}</strong><span>{member.role}</span></div>{role === 'owner' && member.role === 'member' ? <button className="ol-quiet-button" type="button" disabled={pendingMemberUserId === member.userId} onClick={() => void removeOrganizationMember(member)}>Remove from organization</button> : null}</li>)}</ul></section>{role === 'owner' ? peoplePanel : null}</div> : null}
        {settingsTab === 'billing' && role === 'owner' ? billingPanel : null}
        {settingsTab === 'automation' && role === 'owner' ? automationPanel : null}
      </div>
    </div>
  );

  const modalTitle = modal === 'issue'
    ? newIssueParentId === null ? 'Create issue' : 'Create sub-issue'
    : modal === 'project' ? 'Create project'
      : modal === 'team' ? 'Create team'
        : modal === 'team_edit' ? 'Edit team'
          : modal === 'status' ? 'Add workflow status'
            : modal === 'status_edit' ? 'Edit workflow status'
              : modal === 'view' ? 'Create view'
                : 'Invite people';

  return (
    <div className="hosted-workspace-app" data-environment={environment.environment}>
      <button className="ol-mobile-menu" type="button" aria-label="Open workspace navigation" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
      {mobileOpen ? <button className="ol-sidebar-scrim" type="button" aria-label="Close workspace navigation" onClick={() => setMobileOpen(false)} /> : null}
      <aside className={`ol-sidebar ${mobileOpen ? 'open' : ''}`}>
        <button className="ol-workspace-switcher" type="button" aria-expanded={workspaceMenuOpen} onClick={() => setWorkspaceMenuOpen((open) => !open)}><WorkspaceMark /><strong>{workspaceName}</strong><ChevronDown size={14} /></button>
        {workspaceMenuOpen ? <div className="ol-workspace-menu"><strong>{workspaceName}</strong><span>{environment.label} workspace</span>{availableWorkspaces.length > 1 ? <div className="ol-workspace-menu-list" role="menu" aria-label="Switch workspace">{availableWorkspaces.map((workspace) => <button key={workspace.id} type="button" role="menuitemradio" aria-checked={workspace.id === workspaceId} onClick={() => { setWorkspaceMenuOpen(false); onWorkspaceChange?.(workspace.id); }}>{workspace.id === workspaceId ? <Check size={14} /> : <WorkspaceMark />}<span><strong>{workspace.name}</strong><small>{workspace.role}</small></span></button>)}</div> : null}<button type="button" onClick={() => go('settings')}><Settings size={14} /> Workspace settings</button><button type="button" onClick={() => void signOutHostedUser().then(() => window.location.reload())}>Sign out</button></div> : null}
        <nav className="ol-global-nav" aria-label="Global workspace navigation">
          <button className={view === 'inbox' ? 'active' : ''} type="button" onClick={() => go('inbox')}><Inbox size={15} /><span>Inbox</span><small>{notifications.filter((notification) => notification.unread).length}</small></button>
          <button className={view === 'my_issues' ? 'active' : ''} type="button" onClick={() => go('my_issues')}><UserRound size={15} /><span>My issues</span><small>{issues.filter((issue) => issue.assigneeUserId === currentUserId && issue.status !== 'done').length}</small></button>
        </nav>
        <div className="ol-sidebar-section">
          <span>Workspace</span>
          <nav aria-label="Workspace product navigation">
            <button className={navigationScope === 'workspace' && view === 'projects' ? 'active' : ''} type="button" onClick={() => go('projects')}><FolderKanban size={15} /><span>Projects</span></button>
            <button className={navigationScope === 'workspace' && (view === 'views' || view === 'workspace_view') ? 'active' : ''} type="button" onClick={() => go('views')}><Eye size={15} /><span>Views</span></button>
            {workspaceComponentsExpanded ? <>
              <button className={navigationScope === 'workspace' && view === 'settings' && settingsTab === 'general' ? 'active' : ''} type="button" onClick={() => { setSettingsTab('general'); go('settings'); }}><Settings size={15} /><span>Settings</span></button>
              <button className={navigationScope === 'workspace' && view === 'settings' && settingsTab === 'teams' ? 'active' : ''} type="button" onClick={() => { setSettingsTab('teams'); go('settings'); }}><Users size={15} /><span>Teams</span></button>
              <button className={navigationScope === 'workspace' && view === 'settings' && settingsTab === 'workflow' ? 'active' : ''} type="button" onClick={() => { setSettingsTab('workflow'); go('settings'); }}><Workflow size={15} /><span>Workflow</span></button>
              <button className={navigationScope === 'workspace' && view === 'settings' && settingsTab === 'people' ? 'active' : ''} type="button" onClick={() => { setSettingsTab('people'); go('settings'); }}><UserRound size={15} /><span>People</span></button>
              {role === 'owner' ? <button className={navigationScope === 'workspace' && view === 'settings' && settingsTab === 'billing' ? 'active' : ''} type="button" onClick={() => { setSettingsTab('billing'); go('settings'); }}><CircleDot size={15} /><span>Billing</span></button> : null}
              {role === 'owner' ? <button className={navigationScope === 'workspace' && view === 'settings' && settingsTab === 'automation' ? 'active' : ''} type="button" onClick={() => { setSettingsTab('automation'); go('settings'); }}><Command size={15} /><span>API & MCP</span></button> : null}
              <button className="ol-workspace-disclosure" type="button" aria-expanded="true" onClick={() => setWorkspaceComponentsExpanded(false)}><ChevronUp size={15} /><span>Show less</span></button>
            </> : <button className="ol-workspace-disclosure" type="button" aria-expanded="false" onClick={() => setWorkspaceComponentsExpanded(true)}><ChevronDown size={15} /><span>Show more</span></button>}
          </nav>
        </div>
        <div className="ol-sidebar-section ol-team-section">
          <div className="ol-sidebar-section-title"><span>Teams</span>{role === 'owner' ? <button type="button" aria-label="Create team" title="Create team" onClick={() => setModal('team')}><Plus size={13} /></button> : null}</div>
          {teams.map((team) => {
            const expanded = expandedTeamIds.includes(team.id);
            const activeTeam = selectedTeam?.id === team.id;
            return <div className="ol-team-navigation" key={team.id}>
              <button className={`ol-team-label ${activeTeam && navigationScope === 'team' ? 'active' : ''}`} type="button" aria-expanded={expanded} onClick={() => {
                setSelectedTeamId(team.id);
                setExpandedTeamIds((values) => expanded ? values.filter((id) => id !== team.id) : [...values, team.id]);
              }}><span className="ol-team-color" style={{backgroundColor: team.color}} /><strong>{team.name}</strong><ChevronDown className={expanded ? '' : 'collapsed'} size={13} /></button>
              {expanded ? <nav aria-label={`${team.name} team navigation`}>
                <button className={navigationScope === 'team' && activeTeam && view === 'home' ? 'active' : ''} type="button" onClick={() => goToTeam(team.id, 'home')}><Home size={15} /><span>Home</span></button>
                <button className={navigationScope === 'team' && activeTeam && view === 'issues' ? 'active' : ''} type="button" onClick={() => goToTeam(team.id, 'issues')}><LayoutList size={15} /><span>Issues</span></button>
                <button className={navigationScope === 'team' && activeTeam && view === 'projects' ? 'active' : ''} type="button" onClick={() => goToTeam(team.id, 'projects')}><FolderKanban size={15} /><span>Projects</span></button>
                <button className={navigationScope === 'team' && activeTeam && view === 'views' ? 'active' : ''} type="button" onClick={() => goToTeam(team.id, 'views')}><Eye size={15} /><span>Views</span></button>
              </nav> : null}
            </div>;
          })}
        </div>
        <div className="ol-sidebar-footer">
          <AiMcpGuide surface="hosted" serverUrl={`${window.location.origin}/mcp`} />
          {role === 'owner' ? <button type="button" onClick={() => setModal('invite')}><Plus size={15} /><span>Invite people</span></button> : null}
          <button className="ol-account-button" type="button" onClick={() => setAccountOpen((value) => !value)}><MemberAvatar label={displayName || userEmail} /><span><strong>{displayName || userEmail.split('@')[0]}</strong><small>{role} · {environment.label}</small></span><ChevronDown size={13} /></button>
          {accountOpen ? <div className="ol-account-menu"><strong>{userEmail}</strong><span>Firebase-hosted workspace</span><button type="button" onClick={() => void signOutHostedUser().then(() => window.location.reload())}>Sign out</button></div> : null}
        </div>
      </aside>
      <main className="ol-workspace-main">
        <header className="ol-topbar">
          <div className="ol-breadcrumb"><WorkspaceMark /><span>{workspaceName}</span><ChevronRight size={13} /><strong>{selectedIssue === null && selectedProject === null ? titleForView : selectedIssue !== null ? issueKey(selectedIssue) : selectedProject?.name}</strong></div>
          <div className="ol-topbar-actions">
            <label className="ol-search"><Search size={14} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search workspace" aria-label="Search workspace" /><kbd>⌘ K</kbd></label>
            <button className="ol-icon-button ol-notification-button" type="button" aria-label="Notifications" title="Notifications" onClick={() => go('inbox')}><Bell size={16} />{notifications.some((notification) => notification.unread) ? <i aria-hidden="true" /> : null}</button>
            <button className="ol-create-button" type="button" aria-label="Create issue" title="Create issue" onClick={() => showCreateIssue()}><SquarePen size={16} /></button>
          </div>
        </header>
        {environment.environment === 'development' ? <div className="ol-environment-strip">Development · isolated data and no-charge verification access</div> : null}
        <div className="ol-workspace-content">
          {view === 'settings' ? settingsView
            : view === 'projects' ? projectsView
              : view === 'views' ? viewsView
                : view === 'home' ? homeView
                  : view === 'inbox' ? inboxView
                    : selectedIssue === null ? issueList : issueDetail}
        </div>
      </main>
      {notice !== '' ? <div className="ol-toast" role="status"><Check size={15} /><span>{notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14} /></button></div> : null}
      {modal !== null ? <div className="ol-modal-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) { setModal(null); setEditingTeamId(null); setEditingStatusId(null); } }}>
        <section className={`ol-modal ${modal === 'invite' ? 'ol-invite-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="ol-modal-title">
          <header><div><span className="ol-view-context">{navigationScope === 'team' ? selectedTeam?.name ?? workspaceName : workspaceName}</span><h2 id="ol-modal-title">{modalTitle}</h2></div><button className="ol-icon-button" type="button" aria-label="Close" onClick={() => { setModal(null); setNewIssueParentId(null); setEditingTeamId(null); setEditingStatusId(null); }}><X size={17} /></button></header>
          {modal === 'issue' ? <form onSubmit={(event) => void createIssue(event)}>
            {newIssueParentId === null ? null : <div className="ol-parent-context"><GitBranch size={14} /><span>Sub-issue of</span><strong>{issues.find((issue) => issue.id === newIssueParentId)?.title ?? 'Current issue'}</strong></div>}
            <label>Issue title<textarea name="title" required autoFocus maxLength={200} disabled={pending} placeholder="What needs to be done?" /></label>
            <label>Description<textarea name="description" maxLength={10000} disabled={pending} placeholder="Add context and acceptance criteria…" /></label>
            <div className="ol-form-grid"><label>Team<select name="teamId" value={newIssueTeamId} disabled={pending || newIssueParentId !== null} onChange={(event) => setNewIssueTeamId(event.currentTarget.value)}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label>Status<select key={newIssueTeamId} name="statusId" defaultValue={workflowStatuses.find((status) => status.teamId === newIssueTeamId && status.category === 'unstarted')?.id ?? workflowStatuses.find((status) => status.teamId === newIssueTeamId)?.id ?? ''} disabled={pending}>{workflowStatuses.filter((status) => status.teamId === newIssueTeamId).map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label></div>
            <div className="ol-form-grid"><label>Project<select name="projectId" value={newIssueProjectId} disabled={pending} onChange={(event) => setNewIssueProjectId(event.currentTarget.value)}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Milestone<select key={newIssueProjectId} name="milestoneId" defaultValue="" disabled={pending || newIssueProjectId === ''}><option value="">No milestone</option>{milestones.filter((milestone) => milestone.projectId === newIssueProjectId).map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}</select></label></div>
            <label>Due time<input name="dueAt" type="datetime-local" disabled={pending} /></label>
            <footer><button className="ol-quiet-button" type="button" onClick={() => { setModal(null); setNewIssueParentId(null); }}>Cancel</button><button className="ol-primary-button" type="submit" disabled={pending}>{newIssueParentId === null ? 'Create issue' : 'Create sub-issue'}</button></footer>
          </form> : modal === 'project' ? <form onSubmit={(event) => void createProject(event)}>
            <label>Project name<input name="name" required autoFocus maxLength={120} disabled={pending} placeholder="Product launch" /></label>
            <label>Summary<textarea name="summary" maxLength={280} disabled={pending} placeholder="What outcome will this project deliver?" /></label>
            <label>Status<select name="status" defaultValue="planned" disabled={pending}>{Object.entries(projectStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <footer><button className="ol-quiet-button" type="button" onClick={() => setModal(null)}>Cancel</button><button className="ol-primary-button" type="submit" disabled={pending}>Create project</button></footer>
          </form> : modal === 'team' ? <form onSubmit={(event) => void createTeam(event)}>
            <label>Team name<input name="name" required autoFocus maxLength={80} disabled={pending} placeholder="Engineering" /></label>
            <div className="ol-form-grid"><label>Identifier<input name="key" required minLength={1} maxLength={10} pattern="[A-Za-z][A-Za-z0-9]{0,9}" disabled={pending} placeholder="ENG" /></label><label>Color<input name="color" type="color" defaultValue="#5E6AD2" disabled={pending} /></label></div>
            <label>Description<textarea name="description" maxLength={500} disabled={pending} placeholder="What this team owns and delivers." /></label>
            <footer><button className="ol-quiet-button" type="button" onClick={() => setModal(null)}>Cancel</button><button className="ol-primary-button" type="submit" disabled={pending}>Create team</button></footer>
          </form> : modal === 'team_edit' && editingTeam !== null ? <form key={`${editingTeam.id}:${editingTeam.revision}`} onSubmit={(event) => void saveTeam(event)}>
            <label>Team name<input name="name" required autoFocus maxLength={80} disabled={pending} defaultValue={editingTeam.name} /></label>
            <div className="ol-form-grid"><label>Identifier<input name="key" required minLength={1} maxLength={10} pattern="[A-Za-z][A-Za-z0-9]{0,9}" disabled={pending} defaultValue={editingTeam.key} /></label><label>Color<input name="color" type="color" defaultValue={editingTeam.color} disabled={pending} /></label></div>
            <label>Description<textarea name="description" maxLength={500} disabled={pending} defaultValue={editingTeam.description} /></label>
            <footer><button className="ol-quiet-button" type="button" onClick={() => { setEditingTeamId(null); setModal(null); }}>Cancel</button><button className="ol-primary-button" type="submit" disabled={pending}>Save team</button></footer>
          </form> : modal === 'status' ? <form onSubmit={(event) => void createWorkflowStatus(event)}>
            <label>Status name<input name="name" required autoFocus maxLength={60} disabled={pending} placeholder="In review" /></label>
            <div className="ol-form-grid"><label>Category<select name="category" defaultValue="started" disabled={pending}><option value="backlog">Backlog</option><option value="unstarted">Unstarted</option><option value="started">Started</option><option value="completed">Completed</option><option value="canceled">Canceled</option></select></label><label>Icon<select name="icon" defaultValue="circle-dot" disabled={pending}>{(Object.entries(workflowStatusIconLabels) as Array<[HostedWorkflowStatusIcon, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
            <label>Color<input name="color" type="color" defaultValue="#F2C94C" disabled={pending} /></label>
            <p className="ol-form-hint">The category controls completion semantics while the custom name stays visible everywhere.</p>
            <footer><button className="ol-quiet-button" type="button" onClick={() => setModal(null)}>Cancel</button><button className="ol-primary-button" type="submit" disabled={pending}>Add status</button></footer>
          </form> : modal === 'status_edit' && editingStatus !== null ? <form key={`${editingStatus.id}:${editingStatus.revision}`} onSubmit={(event) => void saveWorkflowStatus(event)}>
            <label>Status name<input name="name" required autoFocus maxLength={60} disabled={pending || editingStatus.isDefault} defaultValue={editingStatus.name} /></label>
            <div className="ol-form-grid"><label>Category<select name="category" defaultValue={editingStatus.category} disabled={pending || editingStatus.isDefault}><option value="backlog">Backlog</option><option value="unstarted">Unstarted</option><option value="started">Started</option><option value="completed">Completed</option><option value="canceled">Canceled</option></select></label><label>Icon<select name="icon" defaultValue={editingStatus.icon} disabled={pending}>{(Object.entries(workflowStatusIconLabels) as Array<[HostedWorkflowStatusIcon, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
            <label>Color<input name="color" type="color" defaultValue={editingStatus.color} disabled={pending || editingStatus.isDefault} /></label>
            <p className="ol-form-hint">{editingStatus.isDefault ? 'System-default names, categories, colors, ordering, and deletion are locked. You can change only the icon.' : 'Changes apply to every issue using this custom status.'}</p>
            <footer><button className="ol-quiet-button" type="button" onClick={() => { setEditingStatusId(null); setModal(null); }}>Cancel</button><button className="ol-primary-button" type="submit" disabled={pending}>Save status</button></footer>
          </form> : modal === 'view' ? <form onSubmit={(event) => void createSavedView(event)}>
            <label>View name<input name="name" required autoFocus maxLength={80} disabled={pending} placeholder="Launch blockers" /></label>
            <div className="ol-form-grid"><label>Team<select name="teamId" defaultValue={selectedTeam?.id ?? teams[0]?.id ?? ''} disabled={pending}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label>View type<select name="viewType" value={newViewType} disabled={pending} onChange={(event) => setNewViewType(event.currentTarget.value as HostedSavedViewType)}><option value="issues">Issues</option><option value="projects">Projects</option></select></label></div>
            <label>{newViewType === 'issues' ? 'Issue filter' : 'Project filter'}<select key={newViewType} name="predicate" defaultValue={newViewType === 'issues' ? 'active' : 'all'} disabled={pending}>{(newViewType === 'issues' ? Object.entries(savedViewLabels) : [['all', 'All projects'], ['active', 'Active projects'], ['completed', 'Completed projects']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <footer><button className="ol-quiet-button" type="button" onClick={() => setModal(null)}>Cancel</button><button className="ol-primary-button" type="submit" disabled={pending}>Create view</button></footer>
          </form> : <div className="ol-invite-modal-body">{peoplePanel}<button className="ol-quiet-button" type="button" onClick={() => { setModal(null); setSettingsTab('people'); go('settings'); }}>Manage members and invitations</button></div>}
        </section>
      </div> : null}
    </div>
  );
}
