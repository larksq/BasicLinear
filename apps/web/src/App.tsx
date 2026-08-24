import {
  Fragment,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SearchResult, Session, WorkflowStatus } from '@openlinear/contracts';
import { hasCapability } from '@openlinear/domain';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bookmark,
  Check,
  CircleDot,
  FolderKanban,
  GripVertical,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Sun,
  Trash2,
  UserRound,
  Workflow,
  X,
} from 'lucide-react';
import { api, ApiError } from './api.js';
import { ConnectionBanner, Dialog, ErrorNotice, LoadingSkeleton, QueryErrorState, Spinner } from './components.js';
import { resolveGlobalShortcutAction } from './global-shortcuts.js';
import { createLocalServiceRecovery } from './local-service-recovery.js';
import {
  addRecentSearchResult,
  readWorkspaceRecentSearch,
  writeWorkspaceRecentSearch,
} from './search-recents.js';
import {
  navigationRailDefaultCollapsed,
  readNavigationRailPreference,
  writeNavigationRailCollapsed,
} from './layout-preferences.js';
import {
  APPEARANCE_PREFERENCES,
  APPEARANCE_THEME_COLORS,
  appearanceLabel,
  appearanceMenuIndex,
  readAppearancePreference,
  resolveAppearance,
  writeAppearancePreference,
  type AppearancePreference,
} from './appearance-preferences.js';
import {
  clampCommandIndex,
  commandNavigationIndex,
  commandOptionCount,
  commandOptionId,
  commandResultSummary,
  searchHighlightSegments,
} from './command-palette.js';
import {
  isIssueWorkspaceView,
  ownerWorkspaceUrl,
  savedViewNavigationUrl,
  workspaceNavigationUrl,
  workspaceViewFromSearch,
  workspaceViewLabel,
  type WorkspaceView,
} from './workspace-navigation.js';
import {
  nextWorkflowStatusPosition,
  workflowStatusEditDraft,
  workflowStatusEditRequest,
  type WorkflowStatusEditDraft,
} from './workflow-status-inline-edit.js';
import {
  reorderWorkflowStatusForDrop,
  reorderWorkflowStatusForMove,
  workflowStatusDragThresholdExceeded,
  workflowStatusDropEdge,
  workflowStatusPositionAnnouncement,
  type WorkflowStatusDropEdge,
} from './workflow-status-reorder.js';
import {
  workflowStatusRetirementDraft,
  workflowStatusRetireRequest,
  type WorkflowStatusRetirementDraft,
} from './workflow-status-retire.js';

const ProjectsView = lazy(async () => ({ default: (await import('./projects.js')).ProjectsView }));
const IssuesView = lazy(async () => ({ default: (await import('./issues.js')).IssuesView }));
const SavedViewsView = lazy(async () => ({ default: (await import('./saved-views.js')).SavedViewsView }));
const LOCAL_SERVICE_READY_INTERVAL_MS = 15_000;
const LOCAL_SERVICE_RETRY_INTERVAL_MS = 3_000;
const LOCAL_SERVICE_RECONNECTED_DURATION_MS = 3_000;

type DialogName = 'status';

interface ActiveWorkflowStatusEdit {
  statusId: string;
  baseline: WorkflowStatus;
  draft: WorkflowStatusEditDraft;
}

interface WorkflowStatusEditRecovery {
  statusId: string;
  confirmedRevision: number;
}

interface WorkflowStatusNotice {
  statusId: string | null;
  tone: 'success' | 'error';
  message: string;
}

interface WorkflowStatusDragState {
  pointerId: number;
  teamId: string;
  sourceId: string;
  startX: number;
  startY: number;
  active: boolean;
  targetId: string | null;
  edge: WorkflowStatusDropEdge | null;
  baseline: WorkflowStatus[];
}

function Mark() {
  return <span className="mark" aria-hidden="true"><span /><span /></span>;
}

function HighlightedSearchText({ value, query }: { value: string; query: string }) {
  return searchHighlightSegments(value, query).map((segment, index) => segment.highlighted
    ? <mark key={index}>{segment.text}</mark>
    : <Fragment key={index}>{segment.text}</Fragment>);
}

function CommandOption({
  listboxId,
  index,
  selected,
  onHighlight,
  onSelect,
  disabled = false,
  children,
}: {
  listboxId: string;
  index: number;
  selected: boolean;
  onHighlight: (index: number) => void;
  onSelect: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      id={commandOptionId(listboxId, index)}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      disabled={disabled}
      tabIndex={-1}
      data-command-index={index}
      className={selected ? 'active' : ''}
      onMouseEnter={() => { if (!disabled) onHighlight(index); }}
      onClick={() => { if (!disabled) onSelect(); }}
    >
      {children}
    </button>
  );
}

function LoadingScreen() {
  return (
    <main className="gate gate-loading">
      <LoadingSkeleton variant="gate" label="Loading application" />
    </main>
  );
}

function GateFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="gate">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-brand"><Mark /><strong>OpenLinear</strong></div>
        <h1 id="auth-title">{title}</h1>
        {children}
      </section>
      <footer className="gate-footer">Local workspace</footer>
    </main>
  );
}

function LocalOwnerGate({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const started = useRef(false);
  const mutation = useMutation({
    mutationFn: api.localOwnerSession,
    onSuccess: onAuthenticated,
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutation.mutate();
  }, []);

  return (
    <GateFrame title="Starting OpenLinear">
      {mutation.isPending || mutation.isIdle ? <LoadingSkeleton variant="gate" label="Preparing local workspace" /> : null}
      <ErrorNotice error={mutation.error} />
      {mutation.isError ? <button className="button primary wide" onClick={() => mutation.mutate()}>
        Retry
      </button> : null}
    </GateFrame>
  );
}

function AppearanceMenu({
  value,
  onChange,
}: {
  value: AppearancePreference;
  onChange: (next: AppearancePreference) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const selectedIndex = APPEARANCE_PREFERENCES.indexOf(value);
  const CurrentIcon = value === 'light' ? Sun : value === 'dark' ? Moon : Monitor;

  const closeAndRestoreFocus = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open, selectedIndex]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    const activeIndex = optionRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = appearanceMenuIndex(activeIndex < 0 ? selectedIndex : activeIndex, event.key);
    if (nextIndex === null) return;
    event.preventDefault();
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="appearance-menu" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-button"
        aria-label={`Appearance: ${appearanceLabel(value)}`}
        title={`Appearance: ${appearanceLabel(value)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <CurrentIcon size={15} />
      </button>
      {open ? <div id={menuId} className="appearance-popover" role="menu" aria-label="Appearance" onKeyDown={handleMenuKeyDown}>
        {APPEARANCE_PREFERENCES.map((preference, index) => {
          const Icon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor;
          return <button
            key={preference}
            ref={(node) => { optionRefs.current[index] = node; }}
            type="button"
            role="menuitemradio"
            aria-checked={preference === value}
            tabIndex={-1}
            onClick={() => {
              onChange(preference);
              closeAndRestoreFocus();
            }}
          >
            <Icon size={14} />
            <span>{appearanceLabel(preference)}</span>
            <Check className="appearance-check" data-selected={preference === value} size={14} aria-hidden="true" />
          </button>;
        })}
      </div> : null}
    </div>
  );
}

function WorkspaceApp({
  session,
  appearance,
  onAppearanceChange,
  serviceError,
  serviceChecking,
  serviceReconnected,
  serviceRecoveryError,
  serviceRecovering,
  serviceSessionEpoch,
  onRetryService,
}: {
  session: Session;
  appearance: AppearancePreference;
  onAppearanceChange: (next: AppearancePreference) => void;
  serviceError: unknown | null;
  serviceChecking: boolean;
  serviceReconnected: boolean;
  serviceRecoveryError: unknown | null;
  serviceRecovering: boolean;
  serviceSessionEpoch: number;
  onRetryService: () => void;
}) {
  const client = useQueryClient();
  const workspace = session.workspaces.length === 1 && session.workspaces[0]?.role === 'owner'
    ? session.workspaces[0]
    : undefined;
  const workspaceId = workspace?.id ?? '';
  const [view, setView] = useState<WorkspaceView>(() => workspaceViewFromSearch(window.location.search));
  const [workspaceRouteEpoch, setWorkspaceRouteEpoch] = useState(0);
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [statusEdit, setStatusEdit] = useState<ActiveWorkflowStatusEdit | null>(null);
  const [statusEditRecovery, setStatusEditRecovery] = useState<WorkflowStatusEditRecovery | null>(null);
  const [statusNotice, setStatusNotice] = useState<WorkflowStatusNotice | null>(null);
  const [suppressedStatusEditError, setSuppressedStatusEditError] = useState<unknown>(null);
  const [statusRetirement, setStatusRetirement] = useState<WorkflowStatusRetirementDraft | null>(null);
  const [statusDrag, setStatusDrag] = useState<WorkflowStatusDragState | null>(null);
  const statusDragRef = useRef<WorkflowStatusDragState | null>(null);
  const statusCreateButtonRef = useRef<HTMLButtonElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [railPreference, setRailPreference] = useState(() => readNavigationRailPreference(localStorage));
  const [tabletRailDefault, setTabletRailDefault] = useState(() => navigationRailDefaultCollapsed(window.innerWidth));
  const railCollapsed = railPreference ?? tabletRailDefault;
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [issueCreateSignal, setIssueCreateSignal] = useState(0);
  const [issueOpenRequest, setIssueOpenRequest] = useState<{ id: string | null; signal: number }>({
    id: null,
    signal: 0,
  });
  const [projectOpenRequest, setProjectOpenRequest] = useState<{ id: string | null; signal: number }>({
    id: null,
    signal: 0,
  });
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const commandListId = useId();
  const commandListRef = useRef<HTMLDivElement>(null);
  const [recentResults, setRecentResults] = useState(() => ({
    workspaceId,
    results: readWorkspaceRecentSearch(localStorage, workspaceId),
  }));
  const canManageStatuses = workspace ? hasCapability(workspace.role, 'status:manage') : false;
  const canWriteIssues = workspace ? hasCapability(workspace.role, 'issue:write') : false;
  const firstCommandIndex = canWriteIssues ? 0 : 1;
  const setStatusDragState = (next: WorkflowStatusDragState | null) => {
    statusDragRef.current = next;
    setStatusDrag(next);
  };

  const closeMobileNavigation = useCallback(() => {
    setMobileOpen(false);
    window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    const updateTabletRailDefault = () => setTabletRailDefault(navigationRailDefaultCollapsed(window.innerWidth));
    window.addEventListener('resize', updateTabletRailDefault);
    return () => window.removeEventListener('resize', updateTabletRailDefault);
  }, []);

  const toggleNavigationRail = () => setRailPreference((current) => {
    const next = !(current ?? tabletRailDefault);
    writeNavigationRailCollapsed(localStorage, next);
    return next;
  });

  const navigate = useCallback((next: WorkspaceView, options: { reset?: boolean } = {}) => {
    setView(next);
    if (mobileOpen) closeMobileNavigation();
    else setMobileOpen(false);
    const url = workspaceNavigationUrl(window.location.href, next, view, options);
    window.history.pushState(null, '', url);
    if (options.reset === true) {
      setIssueCreateSignal(0);
      setIssueOpenRequest((current) => ({ id: null, signal: current.signal + 1 }));
      setProjectOpenRequest((current) => ({ id: null, signal: current.signal + 1 }));
    }
  }, [closeMobileNavigation, mobileOpen, view]);

  useEffect(() => {
    const syncLocation = () => {
      const canonical = ownerWorkspaceUrl(window.location.href);
      const resetSurface = canonical.href !== window.location.href;
      if (canonical.href !== window.location.href) {
        window.history.replaceState(null, '', canonical);
      }
      if (resetSurface) {
        setWorkspaceRouteEpoch((current) => current + 1);
        setIssueCreateSignal(0);
        setIssueOpenRequest((current) => ({ id: null, signal: current.signal + 1 }));
        setProjectOpenRequest((current) => ({ id: null, signal: current.signal + 1 }));
      }
      setView(workspaceViewFromSearch(canonical.search));
    };
    syncLocation();
    window.addEventListener('popstate', syncLocation);
    return () => window.removeEventListener('popstate', syncLocation);
  }, []);

  useEffect(() => {
    setCommandOpen(false);
    setCommandQuery('');
    setCommandIndex(firstCommandIndex);
    setDialog(null);
    setStatusEdit(null);
    setStatusEditRecovery(null);
    setStatusNotice(null);
    setSuppressedStatusEditError(null);
    setStatusRetirement(null);
    setStatusDragState(null);
    setIssueCreateSignal(0);
    setIssueOpenRequest({ id: null, signal: 0 });
    setProjectOpenRequest({ id: null, signal: 0 });
    setRecentResults({
      workspaceId,
      results: readWorkspaceRecentSearch(localStorage, workspaceId),
    });
  }, [workspaceId, firstCommandIndex]);

  useEffect(() => {
    const unauthorized = dialog === 'status' && !canManageStatuses;
    if (unauthorized) setDialog(null);
    if (canManageStatuses) return;
    setStatusDragState(null);
    setStatusEdit(null);
    setStatusEditRecovery(null);
    setStatusNotice(null);
    setSuppressedStatusEditError(null);
    setStatusRetirement(null);
  }, [dialog, canManageStatuses]);

  useEffect(() => {
    if (workspaceId === '') return undefined;
    const events = new EventSource(`/api/v1/workspaces/${workspaceId}/events`);
    const refresh = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as { workspaceId?: unknown };
        if (event.workspaceId !== workspaceId) return;
        void client.invalidateQueries({
          predicate: (query) => query.queryKey.some((part) => part === workspaceId),
        });
      } catch {
        // Ignore malformed hints; authoritative query state remains unchanged.
      }
    };
    events.addEventListener('change', refresh as EventListener);
    return () => events.close();
  }, [client, workspaceId, serviceSessionEpoch]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeMobileNavigation();
    };
    window.addEventListener('keydown', close, { capture: true });
    return () => window.removeEventListener('keydown', close, { capture: true });
  }, [mobileOpen]);

  const teams = useQuery({
    queryKey: ['teams', workspaceId],
    queryFn: () => api.teams(workspaceId),
    enabled: workspaceId !== '',
  });
  const memberships = useQuery({
    queryKey: ['memberships', workspaceId],
    queryFn: () => api.memberships(workspaceId),
    enabled: workspaceId !== '',
  });
  const statuses = useQuery({
    queryKey: ['statuses', workspaceId],
    queryFn: () => api.statuses(workspaceId),
    enabled: workspaceId !== '',
  });
  const commandResults = useQuery({
    queryKey: ['workspace-search', workspaceId, commandQuery.trim()],
    queryFn: () => api.search(workspaceId, commandQuery.trim(), 30),
    enabled: commandOpen && workspaceId !== '' && commandQuery.trim() !== '',
  });
  const ownerContextLoading = teams.isLoading || memberships.isLoading || statuses.isLoading;
  const ownerContextBlockingError = (teams.data === undefined ? teams.error : null)
    ?? (memberships.data === undefined ? memberships.error : null)
    ?? (statuses.data === undefined ? statuses.error : null);
  const ownerContextStaleError = (teams.data === undefined ? null : teams.error)
    ?? (memberships.data === undefined ? null : memberships.error)
    ?? (statuses.data === undefined ? null : statuses.error);
  const systemTeam = teams.data?.[0];
  const ownerMemberships = (memberships.data ?? []).filter(
    (membership) => membership.userId === session.user.id,
  );
  const ownerStatuses = systemTeam === undefined
    ? []
    : (statuses.data ?? []).filter((status) => status.teamId === systemTeam.id);
  const ownerContextUnavailable = !ownerContextLoading
    && ownerContextBlockingError === null
    && (systemTeam === undefined || ownerMemberships.length === 0 || ownerStatuses.length === 0);
  const retryFailedOwnerContext = () => {
    const retries: Promise<unknown>[] = [];
    if (teams.data === undefined && teams.error !== null) retries.push(teams.refetch());
    if (memberships.data === undefined && memberships.error !== null) retries.push(memberships.refetch());
    if (statuses.data === undefined && statuses.error !== null) retries.push(statuses.refetch());
    void Promise.all(retries);
  };

  const openIssueCreate = useCallback(() => {
    navigate('issues');
    setIssueCreateSignal((value) => value + 1);
  }, [navigate]);

  useEffect(() => {
    const shortcuts = (event: globalThis.KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const action = resolveGlobalShortcutAction({
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        repeat: event.repeat,
        isComposing: event.isComposing,
        defaultPrevented: event.defaultPrevented,
        withinEditable: Boolean(target?.closest('input, textarea, select, [contenteditable="true"]')),
        withinDialog: Boolean(target?.closest('dialog')),
        withinCommandDialog: Boolean(target?.closest('.command-palette')),
      });
      if (action === null) return;
      event.preventDefault();
      if (action === 'toggle-command') {
        setCommandOpen((current) => !current);
        setCommandIndex(firstCommandIndex);
        return;
      }
      if (action !== 'create-issue' || !canWriteIssues) return;
      openIssueCreate();
    };
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, [canWriteIssues, firstCommandIndex, openIssueCreate]);

  const setCachedStatuses = (records: WorkflowStatus[]) => {
    client.setQueryData(['statuses', workspaceId], [...records].sort((left, right) =>
      left.teamId.localeCompare(right.teamId)
      || left.position - right.position
      || left.id.localeCompare(right.id)));
  };
  const setCachedTeamStatuses = (teamId: string, records: WorkflowStatus[]) => {
    const cached = client.getQueryData<WorkflowStatus[]>(['statuses', workspaceId]) ?? [];
    setCachedStatuses([
      ...cached.filter((status) => status.teamId !== teamId),
      ...records,
    ]);
  };
  const restoreAuthoritativeStatuses = async (): Promise<WorkflowStatus[]> => {
    const confirmed = await api.statuses(workspaceId);
    setCachedStatuses(confirmed);
    return confirmed;
  };
  const focusStatusControl = (statusId: string) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const control = document.querySelector<HTMLButtonElement>(`[data-status-edit="${statusId}"]:not([disabled])`)
      ?? statusCreateButtonRef.current;
    control?.focus();
  }));
  const focusStatusEditor = (statusId: string) => requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelector<HTMLInputElement>(`[data-status-editor="${statusId}"] input[name="statusEditName"]`)
      ?.focus();
  }));
  const focusStatusOrderControl = (
    statusId: string,
    direction: 'up' | 'down' | 'drag',
  ) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const row = document.querySelector<HTMLElement>(`[data-status-row="${statusId}"]`);
    if (direction === 'drag') {
      row?.focus();
      return;
    }
    const control = row?.querySelector<HTMLButtonElement>(
      `[data-status-move="${direction}"]:not([disabled])`,
    );
    (control ?? row)?.focus();
  }));
  const focusStatusRetireControl = (statusId: string) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const control = document.querySelector<HTMLButtonElement>(
      `[data-status-retire="${statusId}"]:not([disabled])`,
    ) ?? statusCreateButtonRef.current;
    control?.focus();
  }));
  const focusStatusRetirementSelect = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelector<HTMLSelectElement>('[data-status-retirement-replacement]')?.focus();
  }));
  const createStatus = useMutation({
    mutationFn: (input: {
      teamId: string;
      name: string;
      category: WorkflowStatus['category'];
      color: string;
    }) => {
      const position = nextWorkflowStatusPosition(statuses.data ?? [], {
        workspaceId,
        teamId: input.teamId,
      });
      if (position === null) throw new Error('The status order is unavailable. Refresh and try again.');
      return api.createStatus(workspaceId, { ...input, position });
    },
    onMutate: () => {
      setStatusNotice(null);
    },
    onSuccess: async (created) => {
      const cached = client.getQueryData<WorkflowStatus[]>(['statuses', workspaceId]) ?? [];
      setCachedStatuses([...cached.filter((status) => status.id !== created.id), created]);
      setDialog(null);
      try {
        const confirmed = await restoreAuthoritativeStatuses();
        const current = confirmed.find((status) => status.id === created.id) ?? created;
        setStatusNotice({
          statusId: current.id,
          tone: 'success',
          message: `Status created. Revision ${current.revision}.`,
        });
      } catch {
        setStatusNotice({
          statusId: created.id,
          tone: 'error',
          message: `Status was created at revision ${created.revision}, but the workflow could not be confirmed.`,
        });
      }
      statusCreateButtonRef.current?.focus();
    },
    onError: async () => {
      try {
        await restoreAuthoritativeStatuses();
        setStatusNotice({
          statusId: null,
          tone: 'error',
          message: 'Status was not created. Current server workflow restored.',
        });
      } catch {
        setStatusNotice({
          statusId: null,
          tone: 'error',
          message: 'Status was not created and the current server workflow could not be confirmed.',
        });
      }
    },
  });
  const editStatus = useMutation({
    mutationFn: ({ statusId, input }: {
      statusId: string;
      draft: WorkflowStatusEditDraft;
      input: NonNullable<ReturnType<typeof workflowStatusEditRequest>>;
    }) => api.updateStatus(workspaceId, statusId, input),
    onMutate: () => {
      setStatusEditRecovery(null);
      setStatusNotice(null);
      setSuppressedStatusEditError(null);
    },
    onSuccess: async (updated) => {
      const cached = client.getQueryData<WorkflowStatus[]>(['statuses', workspaceId]) ?? [];
      setCachedStatuses(cached.map((status) => status.id === updated.id ? updated : status));
      setStatusEdit(null);
      setStatusEditRecovery(null);
      setSuppressedStatusEditError(null);
      try {
        const confirmed = await restoreAuthoritativeStatuses();
        const current = confirmed.find((status) => status.id === updated.id) ?? updated;
        setStatusNotice({
          statusId: updated.id,
          tone: 'success',
          message: `Status saved. Revision ${current.revision}.`,
        });
      } catch {
        setStatusNotice({
          statusId: updated.id,
          tone: 'error',
          message: `Status was saved at revision ${updated.revision}, but the workflow could not be confirmed.`,
        });
      }
      focusStatusControl(updated.id);
    },
    onError: async (error, variables) => {
      try {
        const confirmedStatuses = await restoreAuthoritativeStatuses();
        const confirmed = confirmedStatuses.find((status) => status.id === variables.statusId);
        setSuppressedStatusEditError(error);
        if (confirmed === undefined) {
          setStatusNotice({
            statusId: variables.statusId,
            tone: 'error',
            message: 'Status was not saved. Your draft is retained, but the status is no longer available from the server.',
          });
          return;
        }
        setStatusEdit((active) => active?.statusId === variables.statusId ? {
          statusId: variables.statusId,
          baseline: confirmed,
          draft: variables.draft,
        } : active);
        setStatusEditRecovery({
          statusId: variables.statusId,
          confirmedRevision: confirmed.revision,
        });
        setStatusNotice({
          statusId: variables.statusId,
          tone: 'error',
          message: error instanceof ApiError && error.code === 'CONFLICT'
            ? `Status was not saved. Server revision ${confirmed.revision} confirmed; your draft is retained.`
            : `Status was rejected. Server revision ${confirmed.revision} confirmed; your draft is retained.`,
        });
      } catch {
        setStatusNotice({
          statusId: variables.statusId,
          tone: 'error',
          message: 'Status was not saved and the current server revision could not be confirmed. Your draft is retained.',
        });
        await client.invalidateQueries({ queryKey: ['statuses', workspaceId] });
      }
      focusStatusEditor(variables.statusId);
    },
  });
  const reorderStatuses = useMutation({
    mutationFn: ({ teamId, ordered }: {
      teamId: string;
      ordered: WorkflowStatus[];
      movedId: string;
      movedName: string;
      direction: 'up' | 'down' | 'drag';
    }) => api.reorderStatuses(workspaceId, teamId, ordered),
    onMutate: () => {
      setStatusEditRecovery(null);
      setStatusNotice(null);
      setSuppressedStatusEditError(null);
    },
    onSuccess: async (ordered, variables) => {
      setCachedTeamStatuses(variables.teamId, ordered);
      try {
        const confirmed = await restoreAuthoritativeStatuses();
        const teamOrder = confirmed.filter((status) => status.teamId === variables.teamId);
        const moved = teamOrder.find((status) => status.id === variables.movedId);
        if (moved === undefined) throw new Error('Moved status is unavailable after readback.');
        setStatusNotice({
          statusId: moved.id,
          tone: 'success',
          message: `${workflowStatusPositionAnnouncement(moved.name, teamOrder, moved.id) ?? 'Workflow order updated.'} Revision ${moved.revision}.`,
        });
      } catch {
        const moved = ordered.find((status) => status.id === variables.movedId);
        setStatusNotice({
          statusId: variables.movedId,
          tone: 'error',
          message: moved === undefined
            ? 'Workflow order was saved, but the moved status could not be confirmed.'
            : `Workflow order was saved at revision ${moved.revision}, but the current order could not be confirmed.`,
        });
      }
      focusStatusOrderControl(variables.movedId, variables.direction);
    },
    onError: async (error, variables) => {
      try {
        const confirmed = await restoreAuthoritativeStatuses();
        const moved = confirmed.find((status) => status.id === variables.movedId);
        setStatusNotice({
          statusId: variables.movedId,
          tone: 'error',
          message: moved === undefined
            ? `${variables.movedName} was not moved and is no longer available from the server.`
            : error instanceof ApiError && error.code === 'CONFLICT'
              ? `${variables.movedName} was not moved because the workflow changed. Server order restored at revision ${moved.revision}.`
              : `${variables.movedName} was not moved. Server order restored at revision ${moved.revision}.`,
        });
      } catch {
        setStatusNotice({
          statusId: variables.movedId,
          tone: 'error',
          message: `${variables.movedName} was not moved and the current server order could not be confirmed.`,
        });
        await client.invalidateQueries({ queryKey: ['statuses', workspaceId] });
      }
      focusStatusOrderControl(variables.movedId, variables.direction);
    },
  });
  const retireStatus = useMutation({
    mutationFn: ({ draft }: { draft: WorkflowStatusRetirementDraft }) => {
      const input = workflowStatusRetireRequest(draft, {
        workspaceId,
        teamId: draft.source.teamId,
      });
      if (input === null) {
        throw new Error('The status or replacement is unavailable. Refresh and try again.');
      }
      return api.retireStatus(workspaceId, draft.source.id, input);
    },
    onMutate: () => {
      setStatusEditRecovery(null);
      setStatusNotice(null);
      setSuppressedStatusEditError(null);
    },
    onSuccess: async (receipt, variables) => {
      setCachedTeamStatuses(variables.draft.source.teamId, receipt.statuses);
      setStatusRetirement(null);
      await client.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== 'statuses'
          && query.queryKey.some((part) => part === workspaceId),
      });
      const replacementFromReceipt = receipt.statuses.find(
        (status) => status.id === receipt.replacementStatusId,
      );
      try {
        const confirmed = await restoreAuthoritativeStatuses();
        const replacement = confirmed.find((status) => status.id === receipt.replacementStatusId);
        if (replacement === undefined) throw new Error('Replacement status is unavailable after readback.');
        setStatusNotice({
          statusId: replacement.id,
          tone: 'success',
          message: `${variables.draft.source.name} retired. ${receipt.reassignedIssueCount} ${receipt.reassignedIssueCount === 1 ? 'issue' : 'issues'} moved to ${replacement.name}.`,
        });
      } catch {
        setStatusNotice({
          statusId: receipt.replacementStatusId,
          tone: 'error',
          message: `${variables.draft.source.name} was retired and ${receipt.reassignedIssueCount} ${receipt.reassignedIssueCount === 1 ? 'issue was' : 'issues were'} reassigned, but the workflow could not be confirmed.`,
        });
      }
      focusStatusControl(replacementFromReceipt?.id ?? receipt.replacementStatusId);
    },
    onError: async (error, variables) => {
      try {
        const confirmed = await restoreAuthoritativeStatuses();
        const source = confirmed.find((status) => status.id === variables.draft.source.id);
        if (source === undefined) {
          setStatusRetirement(null);
          setStatusNotice({
            statusId: null,
            tone: 'error',
            message: `${variables.draft.source.name} was not retired by this request and is no longer available from the server.`,
          });
          focusStatusControl(variables.draft.replacementStatusId);
          return;
        }
        const refreshed = workflowStatusRetirementDraft(
          source,
          confirmed.filter((status) => status.teamId === source.teamId),
          { workspaceId, teamId: source.teamId },
        );
        if (refreshed === null) {
          setStatusRetirement(null);
          setStatusNotice({
            statusId: source.id,
            tone: 'error',
            message: `${source.name} was not retired. The team must keep its remaining workflow status.`,
          });
          focusStatusControl(source.id);
          return;
        }
        const replacementStatusId = refreshed.candidates.some(
          (status) => status.id === variables.draft.replacementStatusId,
        ) ? variables.draft.replacementStatusId : refreshed.replacementStatusId;
        setStatusRetirement({ ...refreshed, replacementStatusId });
        const replacement = refreshed.candidates.find((status) => status.id === replacementStatusId);
        setStatusNotice({
          statusId: source.id,
          tone: 'error',
          message: error instanceof ApiError && error.code === 'CONFLICT'
            ? `Status retirement was not applied. Server revisions ${source.revision} and ${replacement?.revision ?? 'unknown'} are now the retry baseline.`
            : 'Status retirement was rejected. Current server workflow restored for review.',
        });
      } catch {
        setStatusNotice({
          statusId: variables.draft.source.id,
          tone: 'error',
          message: 'Status retirement was not confirmed and the current server workflow could not be read. The opening choice is retained.',
        });
        await client.invalidateQueries({ queryKey: ['statuses', workspaceId] });
      }
      focusStatusRetirementSelect();
    },
  });
  const statusGroups = useMemo(() => {
    const map = new Map<string, WorkflowStatus[]>();
    for (const status of ownerStatuses) {
      const existing = map.get(status.teamId) ?? [];
      existing.push(status);
      map.set(status.teamId, existing);
    }
    return map;
  }, [ownerStatuses]);
  const statusMutationPending = createStatus.isPending
    || editStatus.isPending
    || reorderStatuses.isPending
    || retireStatus.isPending;
  const beginStatusEdit = (status: WorkflowStatus) => {
    if (
      !canManageStatuses
      || statusMutationPending
      || statusEdit !== null
      || statusRetirement !== null
      || statusDrag !== null
      || status.workspaceId !== workspaceId
    ) return;
    createStatus.reset();
    editStatus.reset();
    setDialog(null);
    setStatusEditRecovery(null);
    setStatusNotice(null);
    setSuppressedStatusEditError(null);
    setStatusEdit({
      statusId: status.id,
      baseline: status,
      draft: workflowStatusEditDraft(status),
    });
    focusStatusEditor(status.id);
  };
  const updateStatusEditDraft = (patch: Partial<WorkflowStatusEditDraft>) => {
    if (statusMutationPending) return;
    setStatusEdit((current) => current === null
      ? null
      : { ...current, draft: { ...current.draft, ...patch } });
    setStatusEditRecovery(null);
    setStatusNotice(null);
    setSuppressedStatusEditError(null);
    editStatus.reset();
  };
  const submitStatusEdit = () => {
    if (statusEdit === null || statusMutationPending) return;
    const input = workflowStatusEditRequest(statusEdit.baseline, statusEdit.draft, {
      workspaceId,
      teamId: statusEdit.baseline.teamId,
    });
    if (input === null) {
      setStatusNotice({
        statusId: statusEdit.statusId,
        tone: 'error',
        message: 'Status was not saved because its name, category, or color is invalid or unchanged.',
      });
      focusStatusEditor(statusEdit.statusId);
      return;
    }
    editStatus.mutate({
      statusId: statusEdit.statusId,
      input,
      draft: statusEdit.draft,
    });
  };
  const cancelStatusEdit = () => {
    const statusId = statusEdit?.statusId;
    editStatus.reset();
    setStatusEdit(null);
    setStatusEditRecovery(null);
    setStatusNotice(null);
    setSuppressedStatusEditError(null);
    if (statusId !== undefined) focusStatusControl(statusId);
  };
  const useStatusServerValues = () => {
    if (statusEdit === null || statusMutationPending) return;
    const { statusId, baseline } = statusEdit;
    editStatus.reset();
    setStatusEditRecovery(null);
    setSuppressedStatusEditError(null);
    setStatusEdit({ ...statusEdit, draft: workflowStatusEditDraft(baseline) });
    setStatusNotice({
      statusId,
      tone: 'success',
      message: `Server values restored at revision ${baseline.revision}.`,
    });
    focusStatusEditor(statusId);
  };
  const beginStatusRetirement = (status: WorkflowStatus) => {
    const teamOrder = statusGroups.get(status.teamId) ?? [];
    if (
      !canManageStatuses
      || statusMutationPending
      || statusEdit !== null
      || statusRetirement !== null
      || statusDrag !== null
      || status.workspaceId !== workspaceId
    ) return;
    const draft = workflowStatusRetirementDraft(status, teamOrder, {
      workspaceId,
      teamId: status.teamId,
    });
    if (draft === null) {
      setStatusNotice({
        statusId: status.id,
        tone: 'error',
        message: `${status.name} cannot be retired because the team must keep one valid workflow status.`,
      });
      focusStatusRetireControl(status.id);
      return;
    }
    createStatus.reset();
    editStatus.reset();
    retireStatus.reset();
    setDialog(null);
    setStatusEditRecovery(null);
    setSuppressedStatusEditError(null);
    setStatusNotice(null);
    setStatusRetirement(draft);
  };
  const cancelStatusRetirement = () => {
    if (retireStatus.isPending) return;
    const statusId = statusRetirement?.source.id;
    retireStatus.reset();
    setStatusRetirement(null);
    setStatusNotice(null);
    if (statusId !== undefined) focusStatusRetireControl(statusId);
  };
  const moveWorkflowStatus = (status: WorkflowStatus, offset: -1 | 1) => {
    if (!canManageStatuses || statusMutationPending || statusEdit !== null || statusRetirement !== null || statusDrag !== null) return;
    const teamOrder = statusGroups.get(status.teamId) ?? [];
    const ordered = reorderWorkflowStatusForMove(teamOrder, status.id, offset, {
      workspaceId,
      teamId: status.teamId,
    });
    if (ordered === null) return;
    reorderStatuses.mutate({
      teamId: status.teamId,
      ordered,
      movedId: status.id,
      movedName: status.name,
      direction: offset < 0 ? 'up' : 'down',
    });
  };
  const beginWorkflowStatusDrag = (
    event: ReactPointerEvent<HTMLSpanElement>,
    status: WorkflowStatus,
  ) => {
    const teamOrder = statusGroups.get(status.teamId) ?? [];
    if (
      (event.pointerType === 'mouse' && event.button !== 0)
      || !canManageStatuses
      || status.workspaceId !== workspaceId
      || teamOrder.length < 2
      || statusMutationPending
      || statusEdit !== null
      || statusRetirement !== null
      || statusDragRef.current !== null
    ) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setStatusNotice(null);
    setStatusDragState({
      pointerId: event.pointerId,
      teamId: status.teamId,
      sourceId: status.id,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      targetId: null,
      edge: null,
      baseline: teamOrder,
    });
  };
  const moveWorkflowStatusDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const drag = statusDragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    if (!drag.active && !workflowStatusDragThresholdExceeded(
      drag.startX,
      drag.startY,
      event.clientX,
      event.clientY,
    )) return;
    event.preventDefault();
    const teamOrder = drag.baseline;
    const source = teamOrder.find((status) => status.id === drag.sourceId);
    if (source === undefined) {
      setStatusDragState(null);
      return;
    }
    const targetRow = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-status-drop-id]') ?? null;
    const targetId = targetRow?.dataset.statusDropId ?? null;
    const targetTeamId = targetRow?.dataset.statusDropTeam ?? null;
    if (
      targetRow === null
      || targetId === null
      || targetTeamId !== drag.teamId
      || targetId === drag.sourceId
    ) {
      if (!drag.active) {
        setStatusNotice({ statusId: source.id, tone: 'success', message: `${source.name} picked up.` });
      }
      setStatusDragState({ ...drag, active: true, targetId: null, edge: null });
      return;
    }
    const edge = workflowStatusDropEdge(
      event.clientY,
      targetRow.getBoundingClientRect().top,
      targetRow.getBoundingClientRect().height,
    );
    const target = teamOrder.find((status) => status.id === targetId);
    if (edge === null || target === undefined) {
      setStatusDragState({ ...drag, active: true, targetId: null, edge: null });
      return;
    }
    if (!drag.active || drag.targetId !== targetId || drag.edge !== edge) {
      setStatusNotice({
        statusId: source.id,
        tone: 'success',
        message: `${!drag.active ? `${source.name} picked up. ` : ''}${source.name} will move ${edge} ${target.name}.`,
      });
    }
    setStatusDragState({ ...drag, active: true, targetId, edge });
  };
  const finishWorkflowStatusDrag = (
    event: ReactPointerEvent<HTMLSpanElement>,
    canceled = false,
  ) => {
    const drag = statusDragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    setStatusDragState(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag.active) return;
    const teamOrder = drag.baseline;
    const source = teamOrder.find((status) => status.id === drag.sourceId);
    if (source === undefined) return;
    if (canceled || drag.targetId === null || drag.edge === null) {
      setStatusNotice({ statusId: source.id, tone: 'success', message: `${source.name} move canceled.` });
      focusStatusOrderControl(source.id, 'drag');
      return;
    }
    const ordered = reorderWorkflowStatusForDrop(
      teamOrder,
      source.id,
      drag.targetId,
      drag.edge,
      { workspaceId, teamId: drag.teamId },
    );
    if (ordered === null) {
      setStatusNotice({ statusId: source.id, tone: 'success', message: `${source.name} order is unchanged.` });
      focusStatusOrderControl(source.id, 'drag');
      return;
    }
    if (createStatus.isPending || editStatus.isPending || reorderStatuses.isPending || retireStatus.isPending || statusEdit !== null || statusRetirement !== null) {
      setStatusNotice({
        statusId: source.id,
        tone: 'error',
        message: `${source.name} move canceled because another workflow change is pending.`,
      });
      focusStatusOrderControl(source.id, 'drag');
      return;
    }
    reorderStatuses.mutate({
      teamId: drag.teamId,
      ordered,
      movedId: source.id,
      movedName: source.name,
      direction: 'drag',
    });
  };
  const statusPendingMessage = reorderStatuses.isPending
    ? 'Reordering statuses...'
    : retireStatus.isPending
      ? 'Retiring status...'
    : editStatus.isPending
      ? 'Saving status...'
      : createStatus.isPending ? 'Creating status...' : null;

  const openSavedView = (savedViewId: string | null) => {
    setView('issues');
    if (mobileOpen) closeMobileNavigation();
    else setMobileOpen(false);
    const url = savedViewNavigationUrl(window.location.href, savedViewId);
    window.history.pushState(null, '', url);
  };

  const rememberResult = (result: SearchResult) => {
    setRecentResults((current) => {
      const currentWorkspaceResults = current.workspaceId === workspaceId ? current.results : [];
      const next = addRecentSearchResult(currentWorkspaceResults, result);
      writeWorkspaceRecentSearch(localStorage, workspaceId, next);
      return { workspaceId, results: next };
    });
  };
  const openSearchResult = (result: SearchResult) => {
    rememberResult(result);
    setCommandOpen(false);
    setCommandQuery('');
    if (result.kind === 'issue') {
      navigate('issues', { reset: true });
      setIssueOpenRequest((current) => ({ id: result.id, signal: current.signal + 1 }));
    } else {
      navigate('projects', { reset: true });
      setProjectOpenRequest((current) => ({ id: result.id, signal: current.signal + 1 }));
    }
  };
  const visibleCommandResults = commandQuery.trim() === ''
    ? recentResults.workspaceId === workspaceId ? recentResults.results : []
    : commandResults.data ?? [];
  const commandOptionTotal = commandOptionCount(visibleCommandResults.length);
  const activeCommandIndex = clampCommandIndex(commandIndex, commandOptionTotal);
  const activeCommandOptionId = commandOptionId(commandListId, activeCommandIndex);
  const commandQueryText = commandQuery.trim();
  const commandResultPhase = commandQueryText === ''
    ? 'ready'
    : commandResults.isFetching
      ? 'loading'
      : commandResults.error
        ? 'error'
        : 'ready';
  const commandResultLabel = commandResultSummary(
    commandQueryText,
    visibleCommandResults.length,
    commandResultPhase,
  );
  const moveCommandSelection = (key: string) => {
    const next = commandNavigationIndex(
      activeCommandIndex,
      key,
      commandOptionTotal,
      canWriteIssues ? [] : [0],
    );
    if (next === null) return false;
    setCommandIndex(next);
    return true;
  };

  useEffect(() => {
    setCommandIndex((current) => clampCommandIndex(current, commandOptionTotal));
  }, [commandOptionTotal]);

  useEffect(() => {
    if (!commandOpen) return;
    commandListRef.current
      ?.querySelector<HTMLElement>(`[data-command-index="${activeCommandIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeCommandIndex, commandOpen, commandOptionTotal]);

  const runCommand = (index: number) => {
    if (index === 0) {
      if (!canWriteIssues) return;
      setCommandOpen(false);
      openIssueCreate();
    } else if (index === 1) {
      setCommandOpen(false);
      navigate('my-work');
    } else if (index === 2) {
      setCommandOpen(false);
      navigate('issues', { reset: true });
    } else if (index === 3) {
      setCommandOpen(false);
      navigate('projects', { reset: true });
    } else {
      const result = visibleCommandResults[index - 4];
      if (result) openSearchResult(result);
    }
  };

  if (!workspace) return <GateFrame title="Local workspace unavailable"><ErrorNotice error={new Error('The local owner context is missing.')} /></GateFrame>;

  return (
    <div className={`app-shell ${railCollapsed ? 'rail-collapsed' : ''}`} data-workspace-id={workspaceId}>
      <button
        ref={mobileMenuButtonRef}
        className="mobile-menu icon-button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        title="Open navigation"
      ><Menu size={18} /></button>
      {mobileOpen ? <button className="sidebar-scrim" aria-label="Close navigation" onClick={closeMobileNavigation} /> : null}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="owner-brand">
          <Mark />
          <strong>OpenLinear</strong>
        </div>
        <div className="sidebar-scroll">
          <nav className="nav-list" aria-label="Primary navigation">
            <button className={view === 'my-work' ? 'active' : ''} aria-label="My work" aria-current={view === 'my-work' ? 'page' : undefined} title="My work" onClick={() => navigate('my-work')}>
              <UserRound size={16} /><span>My work</span>
            </button>
            <button className={view === 'projects' ? 'active' : ''} aria-label="Projects" aria-current={view === 'projects' ? 'page' : undefined} title="Projects" onClick={() => navigate('projects', { reset: true })}>
              <FolderKanban size={16} /><span>Projects</span>
            </button>
            <button className={view === 'issues' ? 'active' : ''} aria-label="Issues" aria-current={view === 'issues' ? 'page' : undefined} title="Issues" onClick={() => navigate('issues', { reset: true })}>
              <CircleDot size={16} /><span>Issues</span>
            </button>
            <button className={view === 'views' ? 'active' : ''} aria-label="Views" aria-current={view === 'views' ? 'page' : undefined} title="Views" onClick={() => navigate('views')}>
              <Bookmark size={16} /><span>Views</span>
            </button>
            <button className={view === 'workflow' ? 'active' : ''} aria-label="Workflow" aria-current={view === 'workflow' ? 'page' : undefined} title="Workflow" onClick={() => navigate('workflow')}>
              <Workflow size={16} /><span>Workflow</span>
            </button>
          </nav>
        </div>
        <div className="sidebar-footer">
          <button className="sidebar-collapse" aria-label={railCollapsed ? 'Expand navigation' : 'Collapse navigation'} title={railCollapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={toggleNavigationRail}>
            {railCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}<span>{railCollapsed ? 'Expand navigation' : 'Collapse navigation'}</span>
          </button>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="topbar">
          <div className="topbar-context"><strong>{workspaceViewLabel(view)}</strong></div>
          <div className="topbar-actions">
            <AppearanceMenu value={appearance} onChange={onAppearanceChange} />
            <button className="icon-button" aria-label="Search and commands" title="Search and commands" onClick={() => { setCommandOpen(true); setCommandIndex(firstCommandIndex); }}><Search size={15} /></button>
          </div>
        </header>
        <ConnectionBanner
          error={serviceError}
          recoveryError={serviceRecoveryError}
          checking={serviceChecking}
          recovering={serviceRecovering}
          reconnected={serviceReconnected}
          onRetry={onRetryService}
        />
        <div className={`content ${view === 'projects' || isIssueWorkspaceView(view) || view === 'views' ? 'content-projects' : ''}`}>
          <Suspense fallback={<LoadingSkeleton variant="table" tableKind={view === 'projects' ? 'projects' : 'issues'} label={`Loading ${view === 'projects' ? 'projects' : view === 'views' ? 'saved views' : view === 'my-work' ? 'my work' : 'issues'}`} />}>
          {ownerContextLoading ? (
            <LoadingSkeleton variant={view === 'workflow' ? 'workflow' : 'table'} tableKind={view === 'projects' ? 'projects' : 'issues'} label="Loading local owner context" />
          ) : ownerContextBlockingError !== null ? (
            <QueryErrorState
              title="Could not load the local workspace"
              error={ownerContextBlockingError}
              retrying={teams.isFetching || memberships.isFetching || statuses.isFetching}
              onRetry={retryFailedOwnerContext}
            />
          ) : ownerContextUnavailable || systemTeam === undefined ? (
            <ErrorNotice error={new Error('The single-owner local context is unavailable. Complete the local migration before continuing.')} />
          ) : <>
          <ErrorNotice error={ownerContextStaleError} />
          {view === 'projects' ? (
            <ProjectsView
              key={`${workspaceId}:${workspaceRouteEpoch}`}
              workspaceId={workspaceId}
              workspaceRole={workspace.role}
              teams={[systemTeam]}
              members={ownerMemberships}
              statuses={ownerStatuses}
              currentUserId={session.user.id}
              systemTeam={systemTeam}
              openProjectId={projectOpenRequest.id}
              openProjectSignal={projectOpenRequest.signal}
              onOpenProjectHandled={() => setProjectOpenRequest({ id: null, signal: 0 })}
            />
          ) : null}
          {isIssueWorkspaceView(view) ? (
            <IssuesView
              key={`${workspaceId}:${view}:${workspaceRouteEpoch}`}
              workspaceId={workspaceId}
              workspaceRole={workspace.role}
              teams={[systemTeam]}
              members={ownerMemberships}
              statuses={ownerStatuses}
              currentUserId={session.user.id}
              routeView={view}
              viewTitle={workspaceViewLabel(view)}
              ownerMode
              systemTeam={systemTeam}
              {...(view === 'my-work' ? { systemAssignee: {
                userId: session.user.id,
                displayName: session.user.displayName,
              } } : {})}
              createSignal={issueCreateSignal}
              openIssueId={issueOpenRequest.id}
              openIssueSignal={issueOpenRequest.signal}
              onOpenIssueHandled={() => setIssueOpenRequest((current) => ({ ...current, id: null }))}
            />
          ) : null}
          {view === 'views' ? (
            <SavedViewsView
              key={`${workspaceId}:${workspaceRouteEpoch}`}
              workspaceId={workspaceId}
              workspaceRole={workspace.role}
              currentUserId={session.user.id}
              onOpenView={(savedViewId) => openSavedView(savedViewId)}
              onBuildView={() => openSavedView(null)}
            />
          ) : null}
          {view === 'workflow' ? (
            <section aria-labelledby="workflow-title">
              <div className="section-heading">
                <div><h1 id="workflow-title">Workflow</h1><p>Status definitions</p></div>
                <button
                  ref={statusCreateButtonRef}
                  className="button primary"
                  onClick={() => {
                    createStatus.reset();
                    editStatus.reset();
                    setStatusNotice(null);
                    setSuppressedStatusEditError(null);
                    setDialog('status');
                  }}
                  disabled={!canManageStatuses || systemTeam === undefined || statusMutationPending || statusEdit !== null || statusRetirement !== null || statusDrag !== null}
                >
                  <Plus size={16} /> New status
                </button>
              </div>
              <div
                className={`workflow-status-edit-feedback ${statusNotice?.tone ?? ''}`}
                role={statusNotice?.tone === 'error' ? 'alert' : 'status'}
                aria-live={statusNotice?.tone === 'error' ? 'assertive' : 'polite'}
                aria-atomic="true"
              >
                {statusPendingMessage !== null ? <><Spinner />{statusPendingMessage}</> : statusNotice !== null ? <>{statusNotice.tone === 'error' ? <AlertCircle size={14} /> : <CircleDot size={14} />}{statusNotice.message}</> : null}
              </div>
              <ErrorNotice error={editStatus.error === suppressedStatusEditError ? null : editStatus.error} />
              {[systemTeam].map((team) => {
                const teamOrder = statusGroups.get(team.id) ?? [];
                return (
                  <section className="status-group" key={team.id}>
                    <ol className="status-list workflow-status-order">
                      {teamOrder.map((status, index) => {
                        const activeEdit = statusEdit?.statusId === status.id ? statusEdit : null;
                        const activeRecovery = statusEditRecovery?.statusId === status.id
                          ? statusEditRecovery
                          : null;
                        const dragEnabled = canManageStatuses
                          && teamOrder.length > 1
                          && !statusMutationPending
                          && statusEdit === null
                          && statusRetirement === null
                          && (statusDrag === null || statusDrag.sourceId === status.id);
                        const dragSource = statusDrag?.active === true && statusDrag.sourceId === status.id;
                        const dropEdge = statusDrag?.active === true && statusDrag.targetId === status.id
                          ? statusDrag.edge
                          : null;
                        return (
                          <li
                            className={`workflow-status-order-item ${dragSource ? 'dragging' : ''} ${dropEdge === null ? '' : `drop-${dropEdge}`}`}
                            data-status-row={status.id}
                            data-status-drop-id={activeEdit === null ? status.id : undefined}
                            data-status-drop-team={activeEdit === null ? team.id : undefined}
                            tabIndex={-1}
                            key={status.id}
                          >
                            {activeEdit === null ? (
                              <div className="status-row">
                                <span
                                  className={`workflow-status-drag-handle ${dragEnabled ? '' : 'disabled'}`}
                                  data-status-drag-handle
                                  aria-hidden="true"
                                  title={dragEnabled ? `Drag ${status.name} to reorder` : undefined}
                                  onPointerDown={(event) => beginWorkflowStatusDrag(event, status)}
                                  onPointerMove={moveWorkflowStatusDrag}
                                  onPointerUp={(event) => finishWorkflowStatusDrag(event)}
                                  onPointerCancel={(event) => finishWorkflowStatusDrag(event, true)}
                                  onLostPointerCapture={(event) => finishWorkflowStatusDrag(event, true)}
                                ><GripVertical size={15} /></span>
                                <span className="status-dot" style={{ background: status.color }} />
                                <strong>{status.name}</strong>
                                <span className="category-label">{status.category}</span>
                                {status.isDefault ? <span className="default-label">Default</span> : <span className="status-placeholder" aria-hidden="true" />}
                                <div className="row-actions workflow-status-row-actions">
                                  <button type="button" className="icon-button" data-status-move="up" aria-label={`Move ${status.name} up`} title="Move up" onClick={() => moveWorkflowStatus(status, -1)} disabled={!canManageStatuses || index <= 0 || statusMutationPending || statusEdit !== null || statusRetirement !== null || statusDrag !== null}><ArrowUp size={14} /></button>
                                  <button type="button" className="icon-button" data-status-move="down" aria-label={`Move ${status.name} down`} title="Move down" onClick={() => moveWorkflowStatus(status, 1)} disabled={!canManageStatuses || index >= teamOrder.length - 1 || statusMutationPending || statusEdit !== null || statusRetirement !== null || statusDrag !== null}><ArrowDown size={14} /></button>
                                  <button
                                    type="button"
                                    className="icon-button"
                                    data-status-edit={status.id}
                                    aria-label={`Edit ${status.name}`}
                                    title={`Edit ${status.name}`}
                                    disabled={!canManageStatuses || statusMutationPending || statusEdit !== null || statusRetirement !== null || statusDrag !== null}
                                    onClick={() => beginStatusEdit(status)}
                                  ><Pencil size={14} /></button>
                                  <button
                                    type="button"
                                    className="icon-button danger"
                                    data-status-retire={status.id}
                                    aria-label={`Retire ${status.name}`}
                                    title={teamOrder.length <= 1 ? 'The workflow must keep one status' : `Retire ${status.name}`}
                                    disabled={!canManageStatuses || teamOrder.length <= 1 || statusMutationPending || statusEdit !== null || statusRetirement !== null || statusDrag !== null}
                                    onClick={() => beginStatusRetirement(status)}
                                  ><Trash2 size={14} /></button>
                                </div>
                              </div>
                            ) : (
                              <form
                                className="status-row workflow-status-edit-row"
                                data-status-editor={status.id}
                                onSubmit={(event) => { event.preventDefault(); submitStatusEdit(); }}
                              >
                                <span className="workflow-status-drag-handle disabled" aria-hidden="true"><GripVertical size={15} /></span>
                                <input
                                  name="statusEditColor"
                                  className="workflow-status-edit-color"
                                  type="color"
                                  aria-label={`Color for ${activeEdit.baseline.name}`}
                                  value={activeEdit.draft.color}
                                  onChange={(event) => updateStatusEditDraft({ color: event.target.value })}
                                  disabled={statusMutationPending}
                                />
                                <input
                                  name="statusEditName"
                                  aria-label={`Name for ${activeEdit.baseline.name}`}
                                  value={activeEdit.draft.name}
                                  onChange={(event) => updateStatusEditDraft({ name: event.target.value })}
                                  maxLength={80}
                                  disabled={statusMutationPending}
                                  required
                                />
                                <select
                                  name="statusEditCategory"
                                  aria-label={`Category for ${activeEdit.baseline.name}`}
                                  value={activeEdit.draft.category}
                                  onChange={(event) => updateStatusEditDraft({
                                    category: event.target.value as WorkflowStatus['category'],
                                  })}
                                  disabled={statusMutationPending}
                                >
                                  <option value="backlog">Backlog</option>
                                  <option value="unstarted">Unstarted</option>
                                  <option value="started">Started</option>
                                  <option value="completed">Completed</option>
                                  <option value="canceled">Canceled</option>
                                </select>
                                {status.isDefault ? <span className="default-label">Default</span> : <span className="status-placeholder" aria-hidden="true" />}
                                <div className="workflow-status-edit-actions">
                                  <button type="submit" className="icon-button" aria-label="Save status" title="Save status" disabled={statusMutationPending}><Check size={14} /></button>
                                  <button type="button" className="icon-button" aria-label="Cancel status edit" title="Cancel" onClick={cancelStatusEdit} disabled={statusMutationPending}><X size={14} /></button>
                                </div>
                                {activeRecovery !== null ? <div className="workflow-status-edit-recovery">
                                  <span>Server revision {activeRecovery.confirmedRevision} is now authoritative.</span>
                                  <button type="button" className="button" onClick={submitStatusEdit} disabled={statusMutationPending}>Retry draft</button>
                                  <button type="button" className="button" onClick={useStatusServerValues} disabled={statusMutationPending}>Use server values</button>
                                </div> : null}
                              </form>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                );
              })}
              {statusEdit !== null && !ownerStatuses.some((status) => status.id === statusEdit.statusId) ? <div className="workflow-status-edit-unavailable" role="alert">
                <span>The edited status is no longer available. Your draft remains in memory until it is dismissed.</span>
                <button type="button" className="button" onClick={cancelStatusEdit}>Dismiss draft</button>
              </div> : null}
            </section>
          ) : null}
          </>}
          </Suspense>
        </div>
      </main>

      <Dialog title="Search" open={commandOpen} onClose={() => { setCommandOpen(false); setCommandQuery(''); }} wide>
        <div className="dialog-form command-palette">
          <label className="command-search">
            <Search size={16} />
            <span className="sr-only">Search</span>
            <input
              role="combobox"
              aria-autocomplete="list"
              aria-controls={commandListId}
              aria-expanded={commandOpen}
              aria-activedescendant={commandOpen ? activeCommandOptionId : undefined}
              value={commandQuery}
              onChange={(event) => { setCommandQuery(event.target.value); setCommandIndex(firstCommandIndex); }}
              onKeyDown={(event) => {
                if (moveCommandSelection(event.key)) {
                  event.preventDefault();
                  return;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  runCommand(activeCommandIndex);
                }
              }}
              placeholder="Search issues and projects"
              maxLength={200}
            />
          </label>
          <div className="command-result-meta">
            <span>{commandQueryText === '' ? 'Recent' : 'Results'}</span>
            <span role="status" aria-live="polite" aria-atomic="true">{commandResultLabel}</span>
          </div>
          <div
            ref={commandListRef}
            id={commandListId}
            className="command-list"
            role="listbox"
            aria-label="Commands and results"
          >
            <CommandOption listboxId={commandListId} index={0} selected={activeCommandIndex === 0} onHighlight={setCommandIndex} onSelect={() => runCommand(0)} disabled={!canWriteIssues}>
              <Plus size={15} /><span><strong>New issue</strong><small>Create issue</small></span>
            </CommandOption>
            <CommandOption listboxId={commandListId} index={1} selected={activeCommandIndex === 1} onHighlight={setCommandIndex} onSelect={() => runCommand(1)}>
              <UserRound size={15} /><span><strong>My work</strong><small>Open issues assigned to you</small></span>
            </CommandOption>
            <CommandOption listboxId={commandListId} index={2} selected={activeCommandIndex === 2} onHighlight={setCommandIndex} onSelect={() => runCommand(2)}>
              <CircleDot size={15} /><span><strong>Issues</strong><small>Open issue views</small></span>
            </CommandOption>
            <CommandOption listboxId={commandListId} index={3} selected={activeCommandIndex === 3} onHighlight={setCommandIndex} onSelect={() => runCommand(3)}>
              <FolderKanban size={15} /><span><strong>Projects</strong><small>Open projects</small></span>
            </CommandOption>
            {visibleCommandResults.map((result, index) => {
              const optionIndex = index + 4;
              return (
                <CommandOption
                  key={`${result.kind}-${result.id}`}
                  listboxId={commandListId}
                  index={optionIndex}
                  selected={activeCommandIndex === optionIndex}
                  onHighlight={setCommandIndex}
                  onSelect={() => openSearchResult(result)}
                >
                  {result.kind === 'issue' ? <CircleDot size={15} /> : <FolderKanban size={15} />}
                  <span>
                    <strong><HighlightedSearchText value={result.identifier ? `${result.identifier} ${result.title}` : result.title} query={commandQueryText} /></strong>
                    <small><HighlightedSearchText value={result.subtitle} query={commandQueryText} /></small>
                  </span>
                </CommandOption>
              );
            })}
          </div>
          {commandResults.isFetching ? <LoadingSkeleton variant="command" label="Loading search results" /> : null}
          {commandResults.error !== null && commandResults.data === undefined ? (
            <QueryErrorState
              compact
              title="Could not search this workspace"
              error={commandResults.error}
              retrying={commandResults.isFetching}
              onRetry={() => { void commandResults.refetch(); }}
            />
          ) : <ErrorNotice error={commandResults.error} />}
        </div>
      </Dialog>
      <Dialog title="New status" open={dialog === 'status' && canManageStatuses && statusEdit === null && statusRetirement === null} onClose={() => { if (!statusMutationPending) setDialog(null); }}>
        <StatusForm
          teamId={systemTeam?.id ?? ''}
          pending={createStatus.isPending}
          error={createStatus.error}
          onSubmit={(input) => { if (!statusMutationPending && statusEdit === null) createStatus.mutate(input); }}
        />
      </Dialog>
      <Dialog
        title={statusRetirement === null ? 'Retire status' : `Retire ${statusRetirement.source.name}`}
        open={statusRetirement !== null && canManageStatuses}
        onClose={cancelStatusRetirement}
      >
        {statusRetirement === null ? null : <form className="dialog-form workflow-status-retire-form" onSubmit={(event) => {
          event.preventDefault();
          if (!statusMutationPending) retireStatus.mutate({ draft: statusRetirement });
        }}>
          <p>Issues using <strong>{statusRetirement.source.name}</strong>, including archived issues, will move to the replacement status.</p>
          <label className="field">
            <span>Replacement status</span>
            <select
              data-status-retirement-replacement
              value={statusRetirement.replacementStatusId}
              onChange={(event) => {
                setStatusRetirement((current) => current === null
                  ? null
                  : { ...current, replacementStatusId: event.target.value });
                setStatusNotice(null);
                retireStatus.reset();
              }}
              disabled={statusMutationPending}
            >
              {statusRetirement.candidates.map((status) => <option value={status.id} key={status.id}>{status.name}</option>)}
            </select>
          </label>
          <div className={`workflow-status-retire-feedback ${statusNotice?.tone ?? ''}`} role={statusNotice?.tone === 'error' ? 'alert' : 'status'} aria-live={statusNotice?.tone === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
            {retireStatus.isPending ? <><Spinner />Reassigning issues and retiring status...</> : statusNotice?.statusId === statusRetirement.source.id ? statusNotice.message : null}
          </div>
          <div className="workflow-status-retire-actions">
            <button type="button" className="button" onClick={cancelStatusRetirement} disabled={statusMutationPending}>Cancel</button>
            <button type="submit" className="button danger-button" disabled={statusMutationPending}><Trash2 size={15} />Retire status</button>
          </div>
        </form>}
      </Dialog>
    </div>
  );
}

function StatusForm({
  teamId,
  pending,
  error,
  onSubmit,
}: {
  teamId: string;
  pending: boolean;
  error: unknown;
  onSubmit: (input: {
    teamId: string;
    name: string;
    category: WorkflowStatus['category'];
    color: string;
  }) => void;
}) {
  return (
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      onSubmit({
        teamId,
        name: String(data.get('name')),
        category: String(data.get('category')) as WorkflowStatus['category'],
        color: String(data.get('color')),
      });
    }}>
      <label className="field"><span>Name</span><input name="name" maxLength={80} autoFocus disabled={pending} required /></label>
      <label className="field"><span>Category</span><select name="category" defaultValue="unstarted" disabled={pending}><option value="backlog">Backlog</option><option value="unstarted">Unstarted</option><option value="started">Started</option><option value="completed">Completed</option><option value="canceled">Canceled</option></select></label>
      <label className="field color-field"><span>Color</span><input name="color" type="color" defaultValue="#6279C6" disabled={pending} /></label>
      <ErrorNotice error={error} />
      <button className="button primary" disabled={pending || teamId === ''}>{pending ? <Spinner /> : <Plus size={16} />}Create status</button>
    </form>
  );
}

export function App() {
  const client = useQueryClient();
  const [appearance, setAppearance] = useState<AppearancePreference>(() => readAppearancePreference(localStorage));
  const session = useQuery({ queryKey: ['session'], queryFn: api.session, retry: false });
  const serviceHealth = useQuery({
    queryKey: ['local-service-health'],
    queryFn: api.health,
    retry: false,
    networkMode: 'always',
    staleTime: 0,
    refetchInterval: (query) => query.state.error === null
      ? LOCAL_SERVICE_READY_INTERVAL_MS
      : LOCAL_SERVICE_RETRY_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
  const serviceWasUnavailable = useRef(false);
  const serviceRecoveryUiInFlight = useRef(false);
  const serviceReconnectTimeout = useRef<number | null>(null);
  const [serviceReconnected, setServiceReconnected] = useState(false);
  const [serviceRecoveryError, setServiceRecoveryError] = useState<unknown | null>(null);
  const [serviceRecovering, setServiceRecovering] = useState(false);
  const [serviceSessionEpoch, setServiceSessionEpoch] = useState(0);
  const authenticated = useCallback((value: Session) => {
    client.setQueryData(['session'], value);
  }, [client]);
  const serviceRecovery = useMemo(() => createLocalServiceRecovery({
    renewSession: api.localOwnerSession,
    cacheSession: authenticated,
    refreshActiveQueries: () => client.invalidateQueries({
      predicate: (query) => query.queryKey[0] !== 'local-service-health',
      refetchType: 'active',
    }),
  }), [authenticated, client]);
  const recoverServiceSession = useCallback(async () => {
    if (serviceRecoveryUiInFlight.current) return;
    serviceRecoveryUiInFlight.current = true;
    setServiceRecovering(true);
    setServiceRecoveryError(null);
    setServiceReconnected(false);
    try {
      await serviceRecovery.recover();
      setServiceSessionEpoch((current) => current + 1);
      setServiceReconnected(true);
      if (serviceReconnectTimeout.current !== null) {
        window.clearTimeout(serviceReconnectTimeout.current);
      }
      serviceReconnectTimeout.current = window.setTimeout(() => {
        serviceReconnectTimeout.current = null;
        setServiceReconnected(false);
      }, LOCAL_SERVICE_RECONNECTED_DURATION_MS);
    } catch (error) {
      setServiceRecoveryError(error);
    } finally {
      serviceRecoveryUiInFlight.current = false;
      setServiceRecovering(false);
    }
  }, [serviceRecovery]);

  useEffect(() => {
    if (serviceHealth.error !== null) {
      serviceWasUnavailable.current = true;
      setServiceRecoveryError(null);
      setServiceReconnected(false);
      if (serviceReconnectTimeout.current !== null) {
        window.clearTimeout(serviceReconnectTimeout.current);
        serviceReconnectTimeout.current = null;
      }
      return;
    }
    if (serviceHealth.data?.status !== 'ready' || !serviceWasUnavailable.current) return;
    serviceWasUnavailable.current = false;
    void recoverServiceSession();
  }, [recoverServiceSession, serviceHealth.data?.status, serviceHealth.error]);

  useEffect(() => () => {
    if (serviceReconnectTimeout.current !== null) {
      window.clearTimeout(serviceReconnectTimeout.current);
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      if (appearance === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.dataset.theme = appearance;
      const resolved = resolveAppearance(appearance, media.matches);
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.setAttribute('content', APPEARANCE_THEME_COLORS[resolved]);
    };
    apply();
    if (appearance !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [appearance]);

  const changeAppearance = useCallback((next: AppearancePreference) => {
    writeAppearancePreference(localStorage, next);
    setAppearance(next);
  }, []);

  if (session.data) return <WorkspaceApp
    session={session.data}
    appearance={appearance}
    onAppearanceChange={changeAppearance}
    serviceError={serviceHealth.error}
    serviceChecking={serviceHealth.isFetching}
    serviceReconnected={serviceReconnected}
    serviceRecoveryError={serviceRecoveryError}
    serviceRecovering={serviceRecovering}
    serviceSessionEpoch={serviceSessionEpoch}
    onRetryService={() => {
      if (serviceHealth.error !== null) void serviceHealth.refetch();
      else void recoverServiceSession();
    }}
  />;
  if (session.isLoading || serviceHealth.isLoading) return <LoadingScreen />;
  if (serviceHealth.error !== null) return (
    <GateFrame title="OpenLinear is unavailable">
      <QueryErrorState
        compact
        title="Could not reach the local service"
        error={serviceHealth.error}
        retrying={serviceHealth.isFetching}
        onRetry={() => { void serviceHealth.refetch(); }}
      />
    </GateFrame>
  );
  if (session.error instanceof ApiError && session.error.code === 'AUTHENTICATION_REQUIRED') {
    return <LocalOwnerGate onAuthenticated={authenticated} />;
  }
  if (session.error !== null) return (
    <GateFrame title="OpenLinear could not start">
      <QueryErrorState
        compact
        title="Could not load the local session"
        error={session.error}
        retrying={session.isFetching}
        onRetry={() => { void session.refetch(); }}
      />
    </GateFrame>
  );
  return <LocalOwnerGate onAuthenticated={authenticated} />;
}
