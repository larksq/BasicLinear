import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  ActivityEntry,
  BulkIssueMutationResult,
  Comment,
  Issue,
  IssueFilterField,
  IssueFilterNode,
  IssueFilterOperator,
  IssuePriority,
  IssueRelation,
  IssueResourceInput,
  IssueRichTextDocument,
  IssueViewDensity,
  IssueViewGrouping,
  IssueViewOrderField,
  IssueViewProperty,
  IssueViewState,
  Label,
  Membership,
  Milestone,
  Project,
  SavedView,
  Team,
  UpdateCommentRequest,
  UpdateIssueRequest,
  WorkflowStatus,
  Workspace,
} from '@basiclinear/contracts';
import { hasCapability } from '@basiclinear/domain';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bold,
  CalendarDays,
  Circle,
  CircleDot,
  ChevronDown,
  ChevronRight,
  Columns3,
  Code2,
  CornerDownRight,
  Filter,
  GitBranch,
  GripVertical,
  ExternalLink,
  Flag,
  FolderKanban,
  Italic,
  Link2,
  List,
  ListFilter,
  ListOrdered,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Quote,
  RefreshCcw,
  Save,
  Search,
  SlidersHorizontal,
  Rows3,
  Strikethrough,
  Tag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { api, ApiError } from './api.js';
import { BufferedDateInput } from './buffered-date-input.js';
import { ArchiveActionNotice, Dialog, EmptyState, ErrorNotice, Field, LoadingSkeleton, QueryErrorState, Spinner } from './components.js';
import { fitTextareaHeight } from './textarea-autosize.js';
import { commentEditDraft, commentEditRequest } from './comment-inline-edit.js';
import {
  labelEditDraft,
  labelEditRequest,
  type LabelEditDraft,
} from './label-inline-edit.js';
import {
  issueDetailPresentation,
  issueRouteHistoryState,
  readIssueRoute,
  type IssueDetailMode,
} from './issue-detail-route.js';
import {
  issuePropertiesInspectorDesktopQuery,
  issuePropertiesInspectorInitialOpen,
  issuePropertiesInspectorState,
} from './issue-properties-inspector.js';
import {
  clearIssueCommentDraft,
  clearIssueContentDraft,
  clearIssueDetailDraft,
  issueCommentDraftHasContent,
  issueContentDraftDirty,
  issueContentDraftFromIssue,
  retainIssueCommentDraft,
  retainIssueContentDraft,
  type IssueContentDraft,
  type IssueDetailDraft,
  type IssueDetailDraftRegistry,
} from './issue-detail-drafts.js';
import {
  issueBoardDragThresholdExceeded,
  issueBoardMoveRequest,
} from './issue-board-move.js';
import {
  emptyIssueBulkDraft,
  issueBulkClearValue,
  issueBulkLabelRequest,
  issueBulkLabels,
  issueBulkMilestones,
  issueBulkProjects,
  issueBulkResultSummary,
  issueBulkStatuses,
  issueBulkUnassignedValue,
  issueBulkUpdateRequest,
  reconcileIssueBulkDraft,
  type IssueBulkDraft,
  type IssueBulkLabelOperation,
} from './issue-bulk-actions.js';
import {
  createIssueEditConflictRecovery,
  issueEditRecoveryMessage,
  reapplyIssueEditDraft,
  type IssueEditConflictRecovery,
} from './issue-edit-conflict.js';
import {
  issueHierarchyCreateDirections,
  issuePeerCreateDirections,
  issueRelationCandidates,
  issueRelationCreateCommand,
  issueRelationDirectionLabel,
  type IssueRelationCreateCommand,
  type IssueRelationCreateDraft,
} from './issue-relation-create.js';
import {
  issueDetailLabelOptions,
  issueDetailMembers,
  issueDetailMilestoneOptions,
  issueDetailProjectOptions,
  issueDetailStatuses,
  issueInlinePropertyRequest,
  type IssueInlinePropertyChange,
} from './issue-inline-properties.js';
import {
  createIssueNavigationScrollState,
  issueNavigationOriginForOpen,
  issueNavigationScrollStateForContext,
  recordIssueBoardColumnScroll,
  recordIssueBoardScroll,
  recordIssueListScroll,
} from './issue-navigation-context.js';
import { groupIssueRelations } from './issue-relation-groups.js';
import { resolveRovingIssueId } from './issue-roving-focus.js';
import {
  collapsedIssueGroupsFromParam,
  collapsedIssueGroupsParam,
  defaultIssueViewProperties,
  issueGridTemplate,
  issueViewProperties,
  issueViewPropertiesFromParam,
  issueViewPropertiesParam,
  normalizeIssueViewConfiguration,
  ownerIssueViewConfiguration,
  toggleIssueViewProperty,
} from './issue-view-configuration.js';
import {
  resolveIssueViewKeyAction,
  resolveMenuFocusIndex,
  resolveRecordKeyAction,
} from './local-keyboard-actions.js';
import {
  issueActionMenuWidth,
  issueQuickEditRequest,
  positionIssueActionMenu,
  type IssueActionMenuAnchor,
  type IssueQuickEditValues,
} from './issue-row-actions.js';
import {
  scopeIssueViewState,
  withoutIssueQueryScope,
  type IssueQueryScope,
} from './issue-scope.js';
import {
  contextualIssueCreateMilestoneId,
  defaultIssueCreateStatusId,
  issueCreateMilestones,
  reconcileIssueCreateMilestoneId,
  reconcileIssueCreateStatusId,
} from './issue-create.js';
import {
  issueMilestoneLabel,
  milestoneViewOptions,
} from './issue-view-milestones.js';
import { parseIssueUrlFilter } from './issue-url-state.js';
import {
  issuePanelWidthForKey,
  issuePanelWidthForPointer,
  readIssuePanelWidth,
  writeIssuePanelWidth,
} from './layout-preferences.js';
import type { IssueWorkspaceView } from './workspace-navigation.js';

interface RichNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

type IssueFilterCondition = Extract<IssueFilterNode, { type: 'condition' }>;

type ActiveIssueEditRecovery = IssueEditConflictRecovery<IssueContentDraft> & { issueId: string };

interface ArchiveNotice<T> {
  tone: 'success' | 'error';
  message: string;
  undoTarget: T | null;
}

interface RowIssueArchiveTarget {
  targetWorkspaceId: string;
  issue: Issue;
}

const emptyDocument: IssueRichTextDocument = { version: 1, type: 'doc', content: [] };
const initialIssueViewState: IssueViewState = {
  version: 1,
  layout: 'list',
  groupBy: 'status',
  order: { field: 'updatedAt', direction: 'desc' },
  visibleProperties: [...defaultIssueViewProperties],
  density: 'default',
  filter: { version: 1, root: { type: 'group', operator: 'and', children: [] } },
  searchQuery: '',
  archiveState: 'active',
  collapsedGroups: [],
};
const editorNodeTypes = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'hardBreak',
  'horizontalRule',
  'text',
]);
const editorMarkTypes = new Set(['bold', 'italic', 'strike', 'code', 'link']);

function serializeEditorDocument(value: { content?: unknown[] }): IssueRichTextDocument {
  const serializeNode = (candidate: unknown): RichNode | null => {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return null;
    const source = candidate as RichNode;
    if (!editorNodeTypes.has(source.type)) return null;
    if (source.type === 'text') {
      const marks = (source.marks ?? []).flatMap((mark) => {
        if (!editorMarkTypes.has(mark.type)) return [];
        if (mark.type !== 'link') return [{ type: mark.type }];
        return typeof mark.attrs?.href === 'string'
          ? [{ type: 'link', attrs: { href: mark.attrs.href } }]
          : [];
      });
      return {
        type: 'text',
        text: source.text ?? '',
        ...(marks.length === 0 ? {} : { marks }),
      };
    }
    if (source.type === 'hardBreak' || source.type === 'horizontalRule') return { type: source.type };
    const content = (source.content ?? []).flatMap((child) => {
      const serialized = serializeNode(child);
      return serialized === null ? [] : [serialized];
    });
    if (source.type === 'heading') {
      return { type: source.type, attrs: { level: Number(source.attrs?.level ?? 2) }, content };
    }
    if (source.type === 'orderedList') {
      return { type: source.type, attrs: { start: Number(source.attrs?.start ?? 1) }, content };
    }
    if (source.type === 'codeBlock') {
      const language = source.attrs?.language;
      return {
        type: source.type,
        attrs: { language: typeof language === 'string' ? language : null },
        content,
      };
    }
    return { type: source.type, content };
  };
  return {
    version: 1,
    type: 'doc',
    content: (value.content ?? []).flatMap((node) => {
      const serialized = serializeNode(node);
      return serialized === null ? [] : [serialized];
    }) as IssueRichTextDocument['content'],
  };
}

function titleCase(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'None';
  if (Array.isArray(value)) return value.length === 0 ? 'None' : value.join(', ');
  if (typeof value === 'object') {
    const summary = value as { nodes?: unknown; characters?: unknown };
    if (typeof summary.nodes === 'number' && typeof summary.characters === 'number') {
      return `${summary.nodes} nodes, ${summary.characters} characters`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function issueResourceInputs(resources: Issue['resources']): IssueResourceInput[] {
  return resources.map(({ label, url }) => ({ label, url }));
}

function issueResourcesEqual(
  left: readonly IssueResourceInput[],
  right: readonly IssueResourceInput[],
): boolean {
  return left.length === right.length && left.every((resource, index) => (
    resource.label === right[index]?.label && resource.url === right[index]?.url
  ));
}

function IssueResourceEditor({
  resources,
  onChange,
  hideLegend = false,
}: {
  resources: IssueResourceInput[];
  onChange: (resources: IssueResourceInput[]) => void;
  hideLegend?: boolean;
}) {
  const updateResource = (index: number, field: keyof IssueResourceInput, value: string) => {
    onChange(resources.map((resource, resourceIndex) => (
      resourceIndex === index ? { ...resource, [field]: value } : resource
    )));
  };
  return (
    <fieldset className="resource-editor issue-resource-editor">
      <legend className={hideLegend ? 'sr-only' : undefined}>Resources</legend>
      {resources.map((resource, index) => (
        <div className="resource-editor-row" key={index}>
          <label><span className="sr-only">Resource label</span><input value={resource.label} onChange={(event) => updateResource(index, 'label', event.target.value)} placeholder="Label" maxLength={120} required /></label>
          <label><span className="sr-only">Resource URL</span><input value={resource.url} onChange={(event) => updateResource(index, 'url', event.target.value)} placeholder="https://" type="url" maxLength={2048} required /></label>
          <button type="button" className="icon-button" aria-label={`Remove resource ${index + 1}`} title="Remove resource" onClick={() => onChange(resources.filter((_, resourceIndex) => resourceIndex !== index))}><X size={14} /></button>
        </div>
      ))}
      <button type="button" className="button" onClick={() => onChange([...resources, { label: '', url: '' }])} disabled={resources.length >= 50}><Plus size={14} />Add resource</button>
    </fieldset>
  );
}

function safeHref(value: unknown): string | undefined {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : undefined;
}

function markedText(node: RichNode, key: string): ReactNode {
  let content: ReactNode = node.text ?? '';
  for (const [index, mark] of (node.marks ?? []).entries()) {
    const markKey = `${key}-mark-${index}`;
    if (mark.type === 'bold') content = <strong key={markKey}>{content}</strong>;
    if (mark.type === 'italic') content = <em key={markKey}>{content}</em>;
    if (mark.type === 'strike') content = <s key={markKey}>{content}</s>;
    if (mark.type === 'code') content = <code key={markKey}>{content}</code>;
    if (mark.type === 'link') {
      const href = safeHref(mark.attrs?.href);
      content = href === undefined
        ? <Fragment key={markKey}>{content}</Fragment>
        : <a key={markKey} href={href} target="_blank" rel="noopener noreferrer nofollow">{content}</a>;
    }
  }
  return content;
}

function renderNode(node: RichNode, key: string): ReactNode {
  if (node.type === 'text') return <Fragment key={key}>{markedText(node, key)}</Fragment>;
  if (node.type === 'hardBreak') return <br key={key} />;
  if (node.type === 'horizontalRule') return <hr key={key} />;
  const children = (node.content ?? []).map((child, index) => renderNode(child, `${key}-${index}`));
  if (node.type === 'paragraph') return <p key={key}>{children.length ? children : <br />}</p>;
  if (node.type === 'heading') {
    const level = Number(node.attrs?.level ?? 2);
    if (level === 1) return <h2 key={key}>{children}</h2>;
    if (level === 2) return <h3 key={key}>{children}</h3>;
    return <h4 key={key}>{children}</h4>;
  }
  if (node.type === 'bulletList') return <ul key={key}>{children}</ul>;
  if (node.type === 'orderedList') return <ol key={key} start={Number(node.attrs?.start ?? 1)}>{children}</ol>;
  if (node.type === 'listItem') return <li key={key}>{children}</li>;
  if (node.type === 'blockquote') return <blockquote key={key}>{children}</blockquote>;
  if (node.type === 'codeBlock') return <pre key={key}><code>{children}</code></pre>;
  return null;
}

export function RichTextView({ document, empty = 'No description' }: {
  document: IssueRichTextDocument;
  empty?: string;
}) {
  const content = document.content as RichNode[];
  if (content.length === 0) return <p className="muted-copy">{empty}</p>;
  return <div className="rich-text-view">{content.map((node, index) => renderNode(node, `node-${index}`))}</div>;
}

export function RichTextEditor({ initial, onChange, label, disabled = false }: {
  initial: IssueRichTextDocument;
  onChange: (document: IssueRichTextDocument) => void;
  label: string;
  disabled?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        defaultProtocol: 'https',
        protocols: ['http', 'https'],
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
      },
    })],
    content: { type: 'doc', content: initial.content as RichNode[] },
    onUpdate: ({ editor: current }) => {
      onChange(serializeEditorDocument(current.getJSON()));
    },
    editorProps: { attributes: { role: 'textbox', 'aria-label': label, 'aria-multiline': 'true', class: 'rich-editor-content' } },
  });
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  if (!editor) return <LoadingSkeleton variant="editor" label="Loading rich text editor" />;
  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Link URL', previous ?? 'https://');
    if (href === null) return;
    if (href.trim() === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
  };
  const tool = (name: string, active: boolean, action: () => void, icon: ReactNode) => (
    <button
      type="button"
      className={`editor-tool ${active ? 'active' : ''}`}
      aria-label={name}
      aria-pressed={active}
      title={name}
      onClick={action}
      disabled={disabled}
    >{icon}</button>
  );
  return (
    <div className="rich-editor">
      <div className="rich-editor-toolbar" role="toolbar" aria-label={`${label} formatting`}>
        {tool('Bold', editor.isActive('bold'), () => { editor.chain().focus().toggleBold().run(); }, <Bold size={14} />)}
        {tool('Italic', editor.isActive('italic'), () => { editor.chain().focus().toggleItalic().run(); }, <Italic size={14} />)}
        {tool('Strikethrough', editor.isActive('strike'), () => { editor.chain().focus().toggleStrike().run(); }, <Strikethrough size={14} />)}
        {tool('Inline code', editor.isActive('code'), () => { editor.chain().focus().toggleCode().run(); }, <Code2 size={14} />)}
        <span className="editor-divider" />
        {tool('Bullet list', editor.isActive('bulletList'), () => { editor.chain().focus().toggleBulletList().run(); }, <List size={14} />)}
        {tool('Numbered list', editor.isActive('orderedList'), () => { editor.chain().focus().toggleOrderedList().run(); }, <ListOrdered size={14} />)}
        {tool('Quote', editor.isActive('blockquote'), () => { editor.chain().focus().toggleBlockquote().run(); }, <Quote size={14} />)}
        {tool('Link', editor.isActive('link'), setLink, <Link2 size={14} />)}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function statusFor(statuses: WorkflowStatus[], issue: Issue): WorkflowStatus | undefined {
  return statuses.find((status) => status.id === issue.statusId);
}

function priorityIcon(priority: IssuePriority) {
  if (priority === 'urgent') return <AlertCircle size={14} />;
  if (priority === 'none') return <Circle size={13} />;
  const bars = priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
  return <span className={`priority-bars priority-${priority}`} aria-hidden="true">{Array.from({ length: 3 }, (_, index) => <i key={index} className={index < bars ? 'filled' : ''} />)}</span>;
}

interface IssueGroup {
  key: string;
  label: string;
  issues: Issue[];
  order: number;
}

type VirtualIssueItem =
  | { type: 'group'; group: IssueGroup }
  | { type: 'issue'; issue: Issue; groupKey: string };

const issueRowHeights: Record<IssueViewDensity, number> = {
  compact: 32,
  default: 36,
  comfortable: 44,
};

const issueBoardItemHeights: Record<IssueViewDensity, number> = {
  compact: 96,
  default: 108,
  comfortable: 120,
};

interface IssueActionMenuState {
  issueId: string;
  anchor: IssueActionMenuAnchor;
}

interface IssueBoardPointerDrag {
  pointerId: number;
  source: Issue;
  startX: number;
  startY: number;
  active: boolean;
  targetGroupKey: string | null;
  targetGroupLabel: string | null;
}

function IssueActionMenu({
  issue,
  anchor,
  canWrite,
  pending,
  onOpen,
  onEdit,
  onToggleArchive,
  onClose,
}: {
  issue: Issue;
  anchor: IssueActionMenuAnchor;
  canWrite: boolean;
  pending: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleArchive: () => void;
  onClose: (restoreFocus: boolean) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() => positionIssueActionMenu(anchor, {
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu === null) return;
    setPosition(positionIssueActionMenu(anchor, {
      width: window.innerWidth,
      height: window.innerHeight,
    }, {
      width: menu.offsetWidth,
      height: menu.offsetHeight,
    }));
    menu.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [anchor, canWrite, issue.archivedAt]);
  useEffect(() => {
    const dismiss = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target === null || menuRef.current?.contains(target) || target.closest('[data-issue-menu-trigger]')) return;
      onClose(false);
    };
    const dismissForViewportChange = () => onClose(false);
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('scroll', dismissForViewportChange, true);
    window.addEventListener('resize', dismissForViewportChange);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('scroll', dismissForViewportChange, true);
      window.removeEventListener('resize', dismissForViewportChange);
    };
  }, [onClose]);
  return (
    <div
      ref={menuRef}
      id={`issue-action-menu-${issue.id}`}
      className="issue-action-menu"
      role="menu"
      aria-label={`Actions for ${issue.identifier}`}
      style={{ left: position.left, top: position.top }}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          onClose(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || event.key === 'Tab') {
          event.preventDefault();
          onClose(true);
          return;
        }
        const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')];
        if (items.length === 0) return;
        const currentIndex = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
        const nextIndex = resolveMenuFocusIndex(event.key, currentIndex, items.length);
        if (nextIndex === null) return;
        event.preventDefault();
        items[nextIndex]?.focus();
      }}
    >
      <button type="button" role="menuitem" tabIndex={-1} onClick={onOpen}><ExternalLink size={14} /> Open issue</button>
      {canWrite && issue.archivedAt === null ? <button type="button" role="menuitem" tabIndex={-1} onClick={onEdit}><Pencil size={14} /> Edit properties</button> : null}
      {canWrite ? <button type="button" role="menuitem" tabIndex={-1} disabled={pending} onClick={onToggleArchive}>{pending ? <Spinner /> : issue.archivedAt === null ? <Archive size={14} /> : <ArchiveRestore size={14} />}{issue.archivedAt === null ? 'Archive' : 'Restore'}</button> : null}
    </div>
  );
}

function IssueQuickEditForm({
  issue,
  statuses,
  members,
  ownerMode,
  ownerDisplayName,
  projects,
  milestones,
  pending,
  error,
  onSubmit,
}: {
  issue: Issue;
  statuses: WorkflowStatus[];
  members: Membership[];
  ownerMode: boolean;
  ownerDisplayName: string;
  projects: Project[];
  milestones: Milestone[];
  pending: boolean;
  error: unknown;
  onSubmit: (values: IssueQuickEditValues) => void;
}) {
  const statusOptions = statuses.filter((status) =>
    status.teamId === issue.teamId || status.id === issue.statusId);
  const projectOptions = projects.filter((project) =>
    project.teamId === issue.teamId && (project.archivedAt === null || project.id === issue.projectId));
  const [selectedProjectId, setSelectedProjectId] = useState(issue.projectId ?? '');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(issue.milestoneId ?? '');
  const milestoneOptions = milestones.filter((milestone) =>
    milestone.projectId === selectedProjectId
    && (milestone.archivedAt === null || milestone.id === issue.milestoneId));
  return (
    <form className="dialog-form issue-quick-edit-form" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      onSubmit({
        statusId: String(data.get('statusId')),
        priority: String(data.get('priority')) as IssuePriority,
        assigneeUserId: ownerMode
          ? issue.assigneeUserId
          : String(data.get('assigneeUserId')) || null,
        projectId: String(data.get('projectId')) || null,
        milestoneId: String(data.get('milestoneId')) || null,
      });
    }}>
      <label className="field"><span>Status</span><select name="statusId" defaultValue={issue.statusId} disabled={pending}>{statusOptions.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label>
      <label className="field"><span>Priority</span><select name="priority" defaultValue={issue.priority} disabled={pending}><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="none">No priority</option></select></label>
      {ownerMode ? <div className="field issue-owner-field"><span>Owner</span><strong><UserRound size={14} />{ownerDisplayName}</strong></div> : <label className="field"><span>Assignee</span><select name="assigneeUserId" defaultValue={issue.assigneeUserId ?? ''} disabled={pending}><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}</select></label>}
      <label className="field"><span>Project</span><select name="projectId" value={selectedProjectId} disabled={pending} onChange={(event) => {
        const projectId = event.currentTarget.value;
        setSelectedProjectId(projectId);
        setSelectedMilestoneId((current) => milestones.some((milestone) =>
          milestone.id === current && milestone.projectId === projectId && milestone.archivedAt === null) ? current : '');
      }}><option value="">No project</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}{project.archivedAt === null ? '' : ' (archived)'}</option>)}</select></label>
      <label className="field"><span>Milestone</span><select name="milestoneId" value={selectedMilestoneId} disabled={pending || selectedProjectId === ''} onChange={(event) => setSelectedMilestoneId(event.currentTarget.value)}><option value="">No milestone</option>{milestoneOptions.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}{milestone.archivedAt === null ? '' : ' (archived)'}</option>)}</select></label>
      <ErrorNotice error={error} />
      <button className="button primary" disabled={pending}>{pending ? <Spinner /> : <Save size={14} />}Save properties</button>
    </form>
  );
}

function issueStatusLabel(status: WorkflowStatus, statuses: WorkflowStatus[], teams: Team[]): string {
  const multipleTeams = new Set(statuses.map((candidate) => candidate.teamId)).size > 1;
  return multipleTeams
    ? `${teams.find((team) => team.id === status.teamId)?.name ?? 'Team'} / ${status.name}`
    : status.name;
}

function groupIssues(
  issues: Issue[],
  groupBy: IssueViewGrouping,
  statuses: WorkflowStatus[],
  teams: Team[],
  members: Membership[],
  projects: Project[],
  milestones: Milestone[],
  includeEmpty = false,
): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  const activeTeamIds = new Set(issues.map((issue) => issue.teamId));
  const teamOrder = new Map(
    [...teams]
      .sort((left, right) => Number(!activeTeamIds.has(left.id)) - Number(!activeTeamIds.has(right.id)))
      .map((team, index) => [team.id, index]),
  );
  const statusOrder = new Map(statuses.map((status, index) => [
    status.id,
    (teamOrder.get(status.teamId) ?? teams.length) * 1_000 + status.position + index / 10_000,
  ]));
  const priorityOrder: Record<IssuePriority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
  const milestoneOptions = milestoneViewOptions(milestones, projects);
  const milestoneOrder = new Map(milestoneOptions.map((milestone, index) => [milestone.value, index]));
  if (includeEmpty) {
    if (groupBy === 'status') {
      for (const status of statuses) {
        groups.set(status.id, { key: status.id, label: issueStatusLabel(status, statuses, teams), issues: [], order: statusOrder.get(status.id) ?? 999 });
      }
    } else if (groupBy === 'priority') {
      for (const priority of ['urgent', 'high', 'medium', 'low', 'none'] as IssuePriority[]) {
        groups.set(priority, { key: priority, label: priority === 'none' ? 'No priority' : titleCase(priority), issues: [], order: priorityOrder[priority] });
      }
    } else if (groupBy === 'assignee') {
      for (const [index, member] of members.entries()) {
        groups.set(member.userId, { key: member.userId, label: member.displayName, issues: [], order: index });
      }
      groups.set('unassigned', { key: 'unassigned', label: 'Unassigned', issues: [], order: 999 });
    } else if (groupBy === 'project') {
      for (const [index, project] of projects.filter((item) => item.archivedAt === null).entries()) {
        groups.set(project.id, { key: project.id, label: project.name, issues: [], order: index });
      }
      groups.set('no-project', { key: 'no-project', label: 'No project', issues: [], order: 999 });
    } else if (groupBy === 'milestone') {
      for (const [index, milestone] of milestoneOptions.filter((item) => !item.archived).entries()) {
        groups.set(milestone.value, {
          key: milestone.value,
          label: milestone.label,
          issues: [],
          order: index,
        });
      }
      groups.set('no-milestone', { key: 'no-milestone', label: 'No milestone', issues: [], order: 999 });
    } else {
      groups.set('all', { key: 'all', label: 'All issues', issues: [], order: 0 });
    }
  }
  for (const issue of issues) {
    let key = 'all';
    let label = 'All issues';
    let order = 0;
    if (groupBy === 'status') {
      const status = statusFor(statuses, issue);
      key = status?.id ?? 'unknown';
      label = status === undefined ? 'Unknown status' : issueStatusLabel(status, statuses, teams);
      order = statusOrder.get(key) ?? 999;
    } else if (groupBy === 'priority') {
      key = issue.priority;
      label = issue.priority === 'none' ? 'No priority' : titleCase(issue.priority);
      order = priorityOrder[issue.priority];
    } else if (groupBy === 'assignee') {
      const member = members.find((candidate) => candidate.userId === issue.assigneeUserId);
      key = member?.userId ?? 'unassigned';
      label = member?.displayName ?? 'Unassigned';
      order = member === undefined ? 999 : 0;
    } else if (groupBy === 'project') {
      const project = projects.find((candidate) => candidate.id === issue.projectId);
      key = project?.id ?? 'no-project';
      label = project?.name ?? 'No project';
      order = project === undefined ? 999 : 0;
    } else if (groupBy === 'milestone') {
      key = issue.milestoneId ?? 'no-milestone';
      label = issueMilestoneLabel(issue, milestones, projects);
      order = milestoneOrder.get(key) ?? 999;
    }
    const current = groups.get(key);
    if (current) current.issues.push(issue);
    else groups.set(key, { key, label, issues: [issue], order });
  }
  return [...groups.values()].sort((left, right) =>
    left.order - right.order || left.label.localeCompare(right.label) || left.key.localeCompare(right.key));
}

function IssueRowCells({
  issue,
  statuses,
  members,
  projects,
  milestones,
  properties,
}: {
  issue: Issue;
  statuses: WorkflowStatus[];
  members: Membership[];
  projects: Project[];
  milestones: Milestone[];
  properties: IssueViewProperty[];
}) {
  const status = statusFor(statuses, issue);
  return (
    <>
      <span className="issue-status-cell" role="cell" title={status?.name ?? 'Unknown status'}>
        <span className="status-ring" style={{ borderColor: status?.color ?? '#8A8F98' }} />
        <span>{status?.name ?? 'Unknown'}</span>
      </span>
      <span className="issue-title-cell" role="cell"><code>{issue.identifier}</code><strong>{issue.title}</strong></span>
      {properties.includes('priority') ? <span className="issue-priority-cell" role="cell">{priorityIcon(issue.priority)}<span>{titleCase(issue.priority)}</span></span> : null}
      {properties.includes('assignee') ? <span className="issue-assignee-cell" role="cell"><UserRound size={13} />{members.find((member) => member.userId === issue.assigneeUserId)?.displayName ?? 'Unassigned'}</span> : null}
      {properties.includes('project') ? <span className="issue-project-cell" role="cell">{projects.find((project) => project.id === issue.projectId)?.name ?? 'No project'}</span> : null}
      {properties.includes('milestone') ? <span className="issue-milestone-cell" role="cell" title={issueMilestoneLabel(issue, milestones, projects)}>{issueMilestoneLabel(issue, milestones, projects)}</span> : null}
      {properties.includes('labels') ? <span className="issue-label-cell" role="cell">{issue.labels.length > 0 ? issue.labels.slice(0, 2).map((label) => <span className="label-chip" key={label.id}><i style={{ background: label.color }} />{label.name}</span>) : <span className="muted-copy">None</span>}</span> : null}
      {properties.includes('dueDate') ? <span className={`issue-due-cell ${issue.dueDate && issue.dueDate < new Date().toISOString().slice(0, 10) ? 'overdue' : ''}`} role="cell">{issue.dueDate ?? 'No due date'}</span> : null}
    </>
  );
}

function VirtualIssueList({
  issues,
  statuses,
  teams,
  members,
  projects,
  milestones,
  state,
  selectedIds,
  activeIssueId,
  onOpen,
  onToggleSelection,
  onToggleAll,
  onToggleGroup,
  openMenuIssueId,
  onRequestMenu,
  onCloseMenu,
  initialScrollTop,
  onScrollTopChange,
}: {
  issues: Issue[];
  statuses: WorkflowStatus[];
  teams: Team[];
  members: Membership[];
  projects: Project[];
  milestones: Milestone[];
  state: IssueViewState;
  selectedIds: Set<string>;
  activeIssueId: string | null;
  onOpen: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onToggleAll: () => void;
  onToggleGroup: (key: string) => void;
  openMenuIssueId: string | null;
  onRequestMenu: (id: string, anchor: IssueActionMenuAnchor) => void;
  onCloseMenu: (id: string, restoreFocus?: boolean) => void;
  initialScrollTop: number;
  onScrollTopChange: (scrollTop: number) => void;
}) {
  const groups = useMemo(
    () => groupIssues(issues, state.groupBy, statuses, teams, members, projects, milestones),
    [issues, state.groupBy, statuses, teams, members, projects, milestones],
  );
  const items = useMemo(() => groups.flatMap<VirtualIssueItem>((group) => [
    ...(state.groupBy === 'none' ? [] : [{ type: 'group' as const, group }]),
    ...(state.collapsedGroups.includes(group.key)
      ? []
      : group.issues.map((issue) => ({ type: 'issue' as const, issue, groupKey: group.key }))),
  ]), [groups, state.collapsedGroups]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [preferredFocusedIssueId, setPreferredFocusedIssueId] = useState<string | null>(() => activeIssueId);
  const rowHeight = issueRowHeights[state.density];
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => items[index]?.type === 'group' ? 32 : rowHeight,
    getItemKey: (index) => {
      const item = items[index];
      return item?.type === 'group' ? `group-${item.group.key}` : item?.issue.id ?? index;
    },
    overscan: 8,
  });
  useLayoutEffect(() => {
    if (scrollRef.current !== null && scrollRef.current.scrollTop !== initialScrollTop) {
      scrollRef.current.scrollTop = initialScrollTop;
    }
  }, [initialScrollTop]);
  const issueIndexes = useMemo(() => items.flatMap((item, index) => item.type === 'issue' ? [index] : []), [items]);
  const visibleIssueIds = useMemo(
    () => items.flatMap((item) => item.type === 'issue' ? [item.issue.id] : []),
    [items],
  );
  const rovingIssueId = resolveRovingIssueId(visibleIssueIds, preferredFocusedIssueId, activeIssueId);
  const focusIndex = (index: number) => {
    const bounded = Math.max(0, Math.min(index, items.length - 1));
    const item = items[bounded];
    if (item?.type !== 'issue') return;
    setPreferredFocusedIssueId(item.issue.id);
    virtualizer.scrollToIndex(bounded, { align: 'auto' });
    requestAnimationFrame(() => scrollRef.current?.querySelector<HTMLElement>(`[data-virtual-index="${bounded}"]`)?.focus());
  };
  const moveFocus = (current: number, delta: number) => {
    const position = issueIndexes.indexOf(current);
    focusIndex(issueIndexes[Math.max(0, Math.min(position + delta, issueIndexes.length - 1))] ?? current);
  };
  const headerStyle = { gridTemplateColumns: issueGridTemplate(state.visibleProperties) };
  return (
    <div className={`issue-table density-${state.density}`} role="table" aria-label="Issues">
      <div className="issue-row issue-row-header" role="row" style={headerStyle}>
        <span className="issue-select-cell" role="columnheader"><input type="checkbox" aria-label="Select all visible issues" checked={issues.length > 0 && issues.every((issue) => selectedIds.has(issue.id))} onChange={onToggleAll} /></span>
        <span role="columnheader">Status</span><span role="columnheader">Issue</span>
        {state.visibleProperties.includes('priority') ? <span role="columnheader">Priority</span> : null}
        {state.visibleProperties.includes('assignee') ? <span role="columnheader">Assignee</span> : null}
        {state.visibleProperties.includes('project') ? <span role="columnheader">Project</span> : null}
        {state.visibleProperties.includes('milestone') ? <span role="columnheader">Milestone</span> : null}
        {state.visibleProperties.includes('labels') ? <span role="columnheader">Labels</span> : null}
        {state.visibleProperties.includes('dueDate') ? <span role="columnheader">Due</span> : null}
        <span className="issue-action-header sr-only" role="columnheader">Actions</span>
      </div>
      <div className="issue-list-scroll" role="rowgroup" ref={scrollRef} onScroll={(event) => onScrollTopChange(event.currentTarget.scrollTop)}>
        <div className="issue-list-spacer" role="presentation" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index];
            if (item === undefined) return null;
            if (item.type === 'group') {
              const collapsed = state.collapsedGroups.includes(item.group.key);
              return (
                <div
                  className="issue-group-row"
                  role="row"
                  key={virtualRow.key}
                  style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                >
                  <span className="issue-group-cell" role="rowheader" aria-colspan={4 + state.visibleProperties.length}>
                    <button
                      type="button"
                      onClick={() => onToggleGroup(item.group.key)}
                      aria-expanded={!collapsed}
                      aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${item.group.label} group`}
                    >
                      <span className="issue-group-chevron">{collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</span>
                      <strong>{item.group.label}</strong><span>{item.group.issues.length}</span>
                    </button>
                  </span>
                </div>
              );
            }
            const issue = item.issue;
            return (
              <div
                className={`issue-row issue-virtual-row ${issue.archivedAt === null ? '' : 'archived'} ${activeIssueId === issue.id ? 'active' : ''}`}
                role="row"
                tabIndex={rovingIssueId === issue.id ? 0 : -1}
                data-issue-row
                data-issue-id={issue.id}
                data-virtual-index={virtualRow.index}
                aria-keyshortcuts="Enter Space ArrowUp ArrowDown J K Shift+F10"
                key={virtualRow.key}
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                  gridTemplateColumns: issueGridTemplate(state.visibleProperties),
                }}
                onFocus={(event) => {
                  if (event.target === event.currentTarget) setPreferredFocusedIssueId(issue.id);
                }}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('button, input, select, a')) return;
                  onOpen(issue.id);
                }}
                onContextMenu={(event) => {
                  if ((event.target as HTMLElement).closest('button, input, select, textarea, a, [data-issue-drag-handle]')) return;
                  event.preventDefault();
                  onRequestMenu(issue.id, {
                    x: event.clientX,
                    aboveY: event.clientY,
                    belowY: event.clientY,
                  });
                }}
                onKeyDown={(event) => {
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
                    selectionEnabled: true,
                    menuEnabled: true,
                  });
                  if (action === null) return;
                  event.preventDefault();
                  if (action === 'open') {
                    onOpen(issue.id);
                  } else if (action === 'toggle-selection') {
                    onToggleSelection(issue.id);
                  } else if (action === 'next') {
                    moveFocus(virtualRow.index, 1);
                  } else if (action === 'previous') {
                    moveFocus(virtualRow.index, -1);
                  } else if (action === 'open-menu') {
                    const rect = event.currentTarget.getBoundingClientRect();
                    onRequestMenu(issue.id, {
                      x: rect.right - issueActionMenuWidth,
                      aboveY: rect.top,
                      belowY: rect.bottom,
                    });
                  }
                }}
              >
                <span className="issue-select-cell" role="cell"><input type="checkbox" aria-label={`Select ${issue.identifier}`} checked={selectedIds.has(issue.id)} onChange={() => onToggleSelection(issue.id)} /></span>
                <IssueRowCells issue={issue} statuses={statuses} members={members} projects={projects} milestones={milestones} properties={state.visibleProperties} />
                <span className="issue-action-cell" role="cell">
                  <button
                    type="button"
                    className="icon-button issue-menu-trigger"
                    tabIndex={-1}
                    data-issue-menu-trigger
                    aria-label={`Actions for ${issue.identifier}`}
                    title="Issue actions"
                    aria-haspopup="menu"
                    aria-expanded={openMenuIssueId === issue.id}
                    aria-controls={openMenuIssueId === issue.id ? `issue-action-menu-${issue.id}` : undefined}
                    onClick={(event) => {
                      if (openMenuIssueId === issue.id) {
                        onCloseMenu(issue.id);
                        return;
                      }
                      const rect = event.currentTarget.getBoundingClientRect();
                      onRequestMenu(issue.id, {
                        x: rect.right - issueActionMenuWidth,
                        aboveY: rect.top,
                        belowY: rect.bottom,
                      });
                    }}
                  ><MoreHorizontal size={15} /></button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function IssueBoardColumn({
  group,
  groupBy,
  density,
  selectedIds,
  activeIssueId,
  statuses,
  members,
  projects,
  milestones,
  properties,
  onOpen,
  onToggleSelection,
  openMenuIssueId,
  onRequestMenu,
  onCloseMenu,
  canMove,
  movePendingIssueId,
  pointerDrag,
  onBeginDrag,
  onMoveDrag,
  onEndDrag,
  onCancelDrag,
  focusRequestedIssueId,
  onFocusRequestHandled,
  initialScrollTop,
  onScrollTopChange,
}: {
  group: IssueGroup;
  groupBy: IssueViewGrouping;
  density: IssueViewDensity;
  selectedIds: Set<string>;
  activeIssueId: string | null;
  statuses: WorkflowStatus[];
  members: Membership[];
  projects: Project[];
  milestones: Milestone[];
  properties: IssueViewProperty[];
  onOpen: (id: string) => void;
  onToggleSelection: (id: string) => void;
  openMenuIssueId: string | null;
  onRequestMenu: (id: string, anchor: IssueActionMenuAnchor) => void;
  onCloseMenu: (id: string, restoreFocus?: boolean) => void;
  canMove: boolean;
  movePendingIssueId: string | null;
  pointerDrag: IssueBoardPointerDrag | null;
  onBeginDrag: (event: ReactPointerEvent<HTMLSpanElement>, issue: Issue) => void;
  onMoveDrag: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onEndDrag: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onCancelDrag: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  focusRequestedIssueId: string | null;
  onFocusRequestHandled: (issueId: string) => void;
  initialScrollTop: number;
  onScrollTopChange: (scrollTop: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [preferredFocusedIssueId, setPreferredFocusedIssueId] = useState<string | null>(() => activeIssueId);
  const visibleIssueIds = useMemo(() => group.issues.map((issue) => issue.id), [group.issues]);
  const rovingIssueId = resolveRovingIssueId(visibleIssueIds, preferredFocusedIssueId, activeIssueId);
  const height = issueBoardItemHeights[density];
  const virtualizer = useVirtualizer({
    count: group.issues.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => height,
    getItemKey: (index) => group.issues[index]?.id ?? index,
    overscan: 2,
  });
  useLayoutEffect(() => {
    if (scrollRef.current !== null && scrollRef.current.scrollTop !== initialScrollTop) {
      scrollRef.current.scrollTop = initialScrollTop;
    }
  }, [initialScrollTop]);
  const focusCard = (index: number) => {
    if (group.issues.length === 0) return;
    const bounded = Math.max(0, Math.min(index, group.issues.length - 1));
    const issue = group.issues[bounded];
    if (issue === undefined) return;
    setPreferredFocusedIssueId(issue.id);
    virtualizer.scrollToIndex(bounded, { align: 'auto' });
    requestAnimationFrame(() => scrollRef.current?.querySelector<HTMLElement>(`[data-board-index="${bounded}"]`)?.focus());
  };
  useLayoutEffect(() => {
    if (focusRequestedIssueId === null) return;
    const index = group.issues.findIndex((issue) => issue.id === focusRequestedIssueId);
    if (index < 0) return;
    setPreferredFocusedIssueId(focusRequestedIssueId);
    virtualizer.scrollToIndex(index, { align: 'auto' });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = scrollRef.current?.querySelector<HTMLElement>(`[data-issue-id="${focusRequestedIssueId}"]`);
      if (target !== null && target !== undefined) {
        target.focus();
        onFocusRequestHandled(focusRequestedIssueId);
      }
    }));
  }, [focusRequestedIssueId, group.issues, onFocusRequestHandled, virtualizer]);
  return (
    <section
      className={`issue-board-column density-${density} ${pointerDrag?.active && pointerDrag.targetGroupKey === group.key ? 'drop-target' : ''}`}
      aria-labelledby={`board-group-${group.key}`}
      data-board-group-key={group.key}
      data-board-group-label={group.label}
    >
      <header><h2 id={`board-group-${group.key}`}>{group.label}</h2><span>{group.issues.length}</span></header>
      <div className="issue-board-scroll" ref={scrollRef} onScroll={(event) => onScrollTopChange(event.currentTarget.scrollTop)}>
        <div className="issue-board-spacer" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualCard) => {
            const issue = group.issues[virtualCard.index];
            if (issue === undefined) return null;
            const dragSource = pointerDrag?.active && pointerDrag.source.id === issue.id;
            const movePending = movePendingIssueId === issue.id;
            const canDrag = canMove
              && groupBy !== 'none'
              && movePendingIssueId === null
              && issue.archivedAt === null;
            return (
              <article
                className={`issue-board-card ${activeIssueId === issue.id ? 'active' : ''} ${dragSource ? 'dragging' : ''} ${movePending ? 'moving' : ''}`}
                key={virtualCard.key}
                tabIndex={rovingIssueId === issue.id ? 0 : -1}
                data-issue-id={issue.id}
                data-board-index={virtualCard.index}
                aria-busy={movePending || undefined}
                aria-keyshortcuts="Enter Space ArrowUp ArrowDown J K Shift+F10"
                style={{ height: virtualCard.size - 6, transform: `translateY(${virtualCard.start}px)` }}
                onFocus={(event) => {
                  if (event.target === event.currentTarget) setPreferredFocusedIssueId(issue.id);
                }}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('input, button, a, [data-issue-drag-handle]')) return;
                  onOpen(issue.id);
                }}
                onContextMenu={(event) => {
                  if ((event.target as HTMLElement).closest('button, input, select, textarea, a')) return;
                  event.preventDefault();
                  onRequestMenu(issue.id, {
                    x: event.clientX,
                    aboveY: event.clientY,
                    belowY: event.clientY,
                  });
                }}
                onKeyDown={(event) => {
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
                    withinExcludedTarget: Boolean(target?.closest('input, button, a, select, textarea, [contenteditable="true"]')),
                    selectionEnabled: true,
                    menuEnabled: true,
                  });
                  if (action === null) return;
                  event.preventDefault();
                  if (action === 'open') {
                    onOpen(issue.id);
                  } else if (action === 'toggle-selection') {
                    onToggleSelection(issue.id);
                  } else if (action === 'next') {
                    focusCard(virtualCard.index + 1);
                  } else if (action === 'previous') {
                    focusCard(virtualCard.index - 1);
                  } else if (action === 'open-menu') {
                    const rect = event.currentTarget.getBoundingClientRect();
                    onRequestMenu(issue.id, {
                      x: rect.right - issueActionMenuWidth,
                      aboveY: rect.top,
                      belowY: rect.bottom,
                    });
                  }
                }}
              >
                <header><code>{issue.identifier}</code><span className="issue-board-card-actions"><span
                  className={`issue-board-drag-handle ${canDrag ? '' : 'disabled'}`}
                  data-issue-drag-handle
                  aria-hidden="true"
                  title={canDrag ? `Drag ${issue.identifier}` : 'Issue movement unavailable'}
                  onPointerDown={canDrag ? (event) => onBeginDrag(event, issue) : undefined}
                  onPointerMove={canDrag ? onMoveDrag : undefined}
                  onPointerUp={canDrag ? onEndDrag : undefined}
                  onPointerCancel={canDrag ? onCancelDrag : undefined}
                  onLostPointerCapture={canDrag ? onCancelDrag : undefined}
                ><GripVertical size={14} /></span><input type="checkbox" aria-label={`Select ${issue.identifier}`} checked={selectedIds.has(issue.id)} onChange={() => onToggleSelection(issue.id)} /><button
                  type="button"
                  className="icon-button issue-menu-trigger"
                  tabIndex={-1}
                  data-issue-menu-trigger
                  aria-label={`Actions for ${issue.identifier}`}
                  title="Issue actions"
                  aria-haspopup="menu"
                  aria-expanded={openMenuIssueId === issue.id}
                  aria-controls={openMenuIssueId === issue.id ? `issue-action-menu-${issue.id}` : undefined}
                  onClick={(event) => {
                    if (openMenuIssueId === issue.id) {
                      onCloseMenu(issue.id);
                      return;
                    }
                    const rect = event.currentTarget.getBoundingClientRect();
                    onRequestMenu(issue.id, {
                      x: rect.right - issueActionMenuWidth,
                      aboveY: rect.top,
                      belowY: rect.bottom,
                    });
                  }}
                ><MoreHorizontal size={14} /></button></span></header>
                <strong>{issue.title}</strong>
                <IssueBoardMetadata issue={issue} statuses={statuses} members={members} projects={projects} milestones={milestones} properties={properties} />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function IssueBoardMetadata({
  issue,
  statuses,
  members,
  projects,
  milestones,
  properties,
}: {
  issue: Issue;
  statuses: WorkflowStatus[];
  members: Membership[];
  projects: Project[];
  milestones: Milestone[];
  properties: IssueViewProperty[];
}) {
  const status = statusFor(statuses, issue);
  const assignee = members.find((member) => member.userId === issue.assigneeUserId)?.displayName ?? 'Unassigned';
  const project = projects.find((candidate) => candidate.id === issue.projectId)?.name ?? 'No project';
  const milestone = issueMilestoneLabel(issue, milestones, projects);
  const labels = issue.labels.length === 0 ? 'No labels' : issue.labels.map((label) => label.name).join(', ');
  const dueDate = issue.dueDate ?? 'No due date';
  return (
    <footer className="issue-board-metadata" role="group" aria-label={`Visible properties for ${issue.identifier}`}>
      <span title={`Status: ${status?.name ?? 'Unknown'}`}><span className="status-ring" aria-hidden="true" style={{ borderColor: status?.color ?? '#8A8F98' }} /><span className="sr-only">Status: </span><span>{status?.name ?? 'Unknown'}</span></span>
      {properties.includes('priority') ? <span title={`Priority: ${titleCase(issue.priority)}`}><span aria-hidden="true">{priorityIcon(issue.priority)}</span><span className="sr-only">Priority: </span><span>{titleCase(issue.priority)}</span></span> : null}
      {properties.includes('assignee') ? <span title={`Assignee: ${assignee}`}><UserRound size={12} aria-hidden="true" /><span className="sr-only">Assignee: </span><span>{assignee}</span></span> : null}
      {properties.includes('project') ? <span title={`Project: ${project}`}><FolderKanban size={12} aria-hidden="true" /><span className="sr-only">Project: </span><span>{project}</span></span> : null}
      {properties.includes('milestone') ? <span title={`Milestone: ${milestone}`}><Flag size={12} aria-hidden="true" /><span className="sr-only">Milestone: </span><span>{milestone}</span></span> : null}
      {properties.includes('labels') ? <span title={`Labels: ${labels}`}><Tag size={12} aria-hidden="true" /><span className="sr-only">Labels: </span><span>{labels}</span></span> : null}
      {properties.includes('dueDate') ? <span title={`Due date: ${dueDate}`}><CalendarDays size={12} aria-hidden="true" /><span className="sr-only">Due date: </span><span>{dueDate}</span></span> : null}
    </footer>
  );
}

function VirtualIssueBoard({
  issues,
  statuses,
  teams,
  members,
  projects,
  milestones,
  state,
  selectedIds,
  activeIssueId,
  onOpen,
  onToggleSelection,
  openMenuIssueId,
  onRequestMenu,
  onCloseMenu,
  canMove,
  movePendingIssueId,
  onMoveIssue,
  onAnnounce,
  focusRequestedIssueId,
  onFocusRequestHandled,
  initialScrollLeft,
  initialColumnScrollTops,
  onScrollLeftChange,
  onColumnScrollTopChange,
}: {
  issues: Issue[];
  statuses: WorkflowStatus[];
  teams: Team[];
  members: Membership[];
  projects: Project[];
  milestones: Milestone[];
  state: IssueViewState;
  selectedIds: Set<string>;
  activeIssueId: string | null;
  onOpen: (id: string) => void;
  onToggleSelection: (id: string) => void;
  openMenuIssueId: string | null;
  onRequestMenu: (id: string, anchor: IssueActionMenuAnchor) => void;
  onCloseMenu: (id: string, restoreFocus?: boolean) => void;
  canMove: boolean;
  movePendingIssueId: string | null;
  onMoveIssue: (issue: Issue, targetGroupKey: string, targetGroupLabel: string) => void;
  onAnnounce: (message: string) => void;
  focusRequestedIssueId: string | null;
  onFocusRequestHandled: (issueId: string) => void;
  initialScrollLeft: number;
  initialColumnScrollTops: Readonly<Record<string, number>>;
  onScrollLeftChange: (scrollLeft: number) => void;
  onColumnScrollTopChange: (groupKey: string, scrollTop: number) => void;
}) {
  const groups = useMemo(
    () => groupIssues(issues, state.groupBy, statuses, teams, members, projects, milestones, true),
    [issues, state.groupBy, statuses, teams, members, projects, milestones],
  );
  const boardRef = useRef<HTMLDivElement>(null);
  const [pointerDrag, setPointerDrag] = useState<IssueBoardPointerDrag | null>(null);
  const pointerDragRef = useRef<IssueBoardPointerDrag | null>(null);
  const updatePointerDrag = useCallback((next: IssueBoardPointerDrag | null) => {
    pointerDragRef.current = next;
    setPointerDrag(next);
  }, []);
  const beginPointerDrag = useCallback((event: ReactPointerEvent<HTMLSpanElement>, issue: Issue) => {
    if (
      !canMove
      || movePendingIssueId !== null
      || state.groupBy === 'none'
      || issue.archivedAt !== null
      || !event.isPrimary
      || (event.pointerType === 'mouse' && event.button !== 0)
    ) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePointerDrag({
      pointerId: event.pointerId,
      source: issue,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      targetGroupKey: null,
      targetGroupLabel: null,
    });
  }, [canMove, movePendingIssueId, state.groupBy, updatePointerDrag]);
  const movePointerDrag = useCallback((event: ReactPointerEvent<HTMLSpanElement>) => {
    const current = pointerDragRef.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (!current.active && !issueBoardDragThresholdExceeded(
      current.startX,
      current.startY,
      event.clientX,
      event.clientY,
    )) return;

    const hitColumn = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-board-group-key]');
    const hitGroupKey = hitColumn?.dataset.boardGroupKey ?? null;
    const targetGroup = hitGroupKey === null
      ? null
      : groups.find((group) => group.key === hitGroupKey) ?? null;
    const validTarget = targetGroup !== null && issueBoardMoveRequest(
      current.source,
      state.groupBy,
      targetGroup.key,
      statuses,
      members,
      projects,
      milestones,
    ) !== null ? targetGroup : null;
    const next: IssueBoardPointerDrag = {
      ...current,
      active: true,
      targetGroupKey: validTarget?.key ?? null,
      targetGroupLabel: validTarget?.label ?? null,
    };
    if (!current.active) {
      onAnnounce(validTarget === null
        ? `${current.source.identifier} picked up. No valid drop target.`
        : `${current.source.identifier} picked up. Target ${validTarget.label}. Release to move.`);
    } else if (next.targetGroupKey !== current.targetGroupKey) {
      onAnnounce(validTarget === null
        ? `${current.source.identifier} has no valid drop target.`
        : `${current.source.identifier} target ${validTarget.label}. Release to move.`);
    }
    updatePointerDrag(next);
  }, [groups, members, milestones, onAnnounce, projects, state.groupBy, statuses, updatePointerDrag]);
  const endPointerDrag = useCallback((event: ReactPointerEvent<HTMLSpanElement>) => {
    const current = pointerDragRef.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    updatePointerDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (
      current.active
      && current.targetGroupKey !== null
      && current.targetGroupLabel !== null
    ) {
      onAnnounce(`${current.source.identifier} moving to ${current.targetGroupLabel}.`);
      onMoveIssue(current.source, current.targetGroupKey, current.targetGroupLabel);
    } else if (current.active) {
      onAnnounce(`${current.source.identifier} move canceled.`);
    }
  }, [onAnnounce, onMoveIssue, updatePointerDrag]);
  const cancelPointerDrag = useCallback((event: ReactPointerEvent<HTMLSpanElement>) => {
    const current = pointerDragRef.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    updatePointerDrag(null);
    if (current.active) onAnnounce(`${current.source.identifier} move canceled.`);
  }, [onAnnounce, updatePointerDrag]);
  useLayoutEffect(() => {
    if (boardRef.current !== null && boardRef.current.scrollLeft !== initialScrollLeft) {
      boardRef.current.scrollLeft = initialScrollLeft;
    }
  }, [initialScrollLeft]);
  useLayoutEffect(() => {
    if (
      focusRequestedIssueId !== null
      && groups.every((group) => group.issues.every((issue) => issue.id !== focusRequestedIssueId))
    ) {
      boardRef.current?.focus();
      onFocusRequestHandled(focusRequestedIssueId);
    }
  }, [focusRequestedIssueId, groups, onFocusRequestHandled]);
  return (
    <div className="issue-board" role="region" aria-label="Issue board" tabIndex={-1} ref={boardRef} onScroll={(event) => onScrollLeftChange(event.currentTarget.scrollLeft)}>
      {groups.map((group) => <IssueBoardColumn key={group.key} group={group} groupBy={state.groupBy} density={state.density} selectedIds={selectedIds} activeIssueId={activeIssueId} statuses={statuses} members={members} projects={projects} milestones={milestones} properties={state.visibleProperties} onOpen={onOpen} onToggleSelection={onToggleSelection} openMenuIssueId={openMenuIssueId} onRequestMenu={onRequestMenu} onCloseMenu={onCloseMenu} canMove={canMove} movePendingIssueId={movePendingIssueId} pointerDrag={pointerDrag} onBeginDrag={beginPointerDrag} onMoveDrag={movePointerDrag} onEndDrag={endPointerDrag} onCancelDrag={cancelPointerDrag} focusRequestedIssueId={focusRequestedIssueId} onFocusRequestHandled={onFocusRequestHandled} initialScrollTop={initialColumnScrollTops[group.key] ?? 0} onScrollTopChange={(scrollTop) => onColumnScrollTopChange(group.key, scrollTop)} />)}
    </div>
  );
}

function IssueCreateForm({
  workspaceId,
  teams,
  statuses,
  members,
  projects,
  labels,
  contextTeam,
  contextProject,
  contextMilestone,
  contextMilestones,
  initialAssigneeUserId = '',
  ownerMode = false,
  pending,
  error,
  onSubmit,
}: {
  workspaceId: string;
  teams: Team[];
  statuses: WorkflowStatus[];
  members: Membership[];
  projects: Project[];
  labels: Label[];
  contextTeam?: Pick<Team, 'id' | 'name'>;
  contextProject?: Project;
  contextMilestone?: Pick<Milestone, 'id' | 'name'>;
  contextMilestones?: Milestone[];
  initialAssigneeUserId?: string;
  ownerMode?: boolean;
  pending: boolean;
  error: unknown;
  onSubmit: (input: {
    teamId: string;
    title: string;
    descriptionDocument: IssueRichTextDocument;
    statusId: string;
    priority: IssuePriority;
    assigneeUserId: string | null;
    dueDate: string | null;
    projectId: string | null;
    milestoneId: string | null;
    labelIds: string[];
    resources: IssueResourceInput[];
  }) => void;
}) {
  const initialTeamId = contextProject?.teamId ?? contextTeam?.id ?? teams[0]?.id ?? '';
  const [teamId, setTeamId] = useState(initialTeamId);
  const [projectId, setProjectId] = useState(contextProject?.id ?? '');
  const [statusId, setStatusId] = useState(() => defaultIssueCreateStatusId(initialTeamId, statuses));
  const [priority, setPriority] = useState<IssuePriority>('none');
  const [assigneeUserId, setAssigneeUserId] = useState(() =>
    members.some((member) => member.userId === initialAssigneeUserId) ? initialAssigneeUserId : '');
  const [dueDate, setDueDate] = useState('');
  const [document, setDocument] = useState<IssueRichTextDocument>(emptyDocument);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [resources, setResources] = useState<IssueResourceInput[]>([]);
  const fetchedMilestones = useQuery({
    queryKey: ['milestones', workspaceId, projectId, false],
    queryFn: () => api.milestones(workspaceId, projectId),
    enabled: contextProject === undefined && projectId !== '',
  });
  const milestoneSource = contextProject?.id === projectId ? contextMilestones : fetchedMilestones.data;
  const milestones = useMemo(
    () => issueCreateMilestones(projectId, milestoneSource ?? []),
    [projectId, milestoneSource],
  );
  const initialMilestoneId = contextualIssueCreateMilestoneId(contextMilestone, projectId, milestoneSource ?? []);
  const [milestoneId, setMilestoneId] = useState(initialMilestoneId);
  const contextMilestonePending = useRef(contextMilestone !== undefined && initialMilestoneId === '');
  const teamStatuses = statuses.filter((status) => status.teamId === teamId);
  const availableProjects = useMemo(
    () => projects.filter((project) => project.teamId === teamId && project.archivedAt === null),
    [projects, teamId],
  );
  const selectedTeam = teams.find((team) => team.id === teamId);
  const selectedStatus = teamStatuses.find((status) => status.id === statusId);
  const selectedAssignee = members.find((member) => member.userId === assigneeUserId);
  const selectedProject = availableProjects.find((project) => project.id === projectId) ?? contextProject;
  const selectedMilestone = milestones.find((milestone) => milestone.id === milestoneId);
  const milestoneLoading = contextProject === undefined && projectId !== '' && fetchedMilestones.isPending;

  useEffect(() => {
    setStatusId((current) => reconcileIssueCreateStatusId(current, teamId, statuses));
  }, [statuses, teamId]);
  useEffect(() => {
    if (contextProject !== undefined) return;
    if (projectId !== '' && !availableProjects.some((project) => project.id === projectId)) {
      setProjectId('');
      setMilestoneId('');
    }
  }, [availableProjects, contextProject, projectId]);
  useEffect(() => {
    setMilestoneId((current) => {
      const valid = reconcileIssueCreateMilestoneId(current, projectId, milestoneSource ?? []);
      if (valid !== '') return valid;
      if (!contextMilestonePending.current) return '';
      const contextual = contextualIssueCreateMilestoneId(contextMilestone, projectId, milestoneSource ?? []);
      if (contextual !== '') contextMilestonePending.current = false;
      return contextual;
    });
  }, [contextMilestone, milestoneSource, projectId]);
  const toggleLabel = (labelId: string) => {
    setSelectedLabels((current) => current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId]);
  };
  return (
    <form className="dialog-form issue-create-form" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      onSubmit({
        teamId,
        title: String(data.get('title')),
        descriptionDocument: document,
        statusId,
        priority,
        assigneeUserId: ownerMode ? initialAssigneeUserId || null : assigneeUserId || null,
        dueDate: dueDate || null,
        projectId: projectId || null,
        milestoneId: milestoneId || null,
        labelIds: selectedLabels,
        resources,
      });
    }}>
      <Field label="Title" name="title" maxLength={240} placeholder="Issue title" />
      <dl className="issue-create-defaults" aria-label="Issue defaults">
        {!ownerMode ? <div title="Team"><dt><Rows3 size={13} aria-hidden="true" /><span className="sr-only">Team</span></dt><dd>{selectedTeam?.name ?? 'No team'}</dd></div> : null}
        <div title="Status"><dt><CircleDot size={13} aria-hidden="true" /><span className="sr-only">Status</span></dt><dd>{selectedStatus?.name ?? 'No status'}</dd></div>
        <div title="Priority"><dt><Flag size={13} aria-hidden="true" /><span className="sr-only">Priority</span></dt><dd>{priority === 'none' ? 'No priority' : titleCase(priority)}</dd></div>
        {!ownerMode ? <div title="Assignee"><dt><UserRound size={13} aria-hidden="true" /><span className="sr-only">Assignee</span></dt><dd>{selectedAssignee?.displayName ?? 'Unassigned'}</dd></div> : null}
        <div title="Project"><dt><FolderKanban size={13} aria-hidden="true" /><span className="sr-only">Project</span></dt><dd>{selectedProject?.name ?? 'No project'}</dd></div>
        <div title="Milestone"><dt><CalendarDays size={13} aria-hidden="true" /><span className="sr-only">Milestone</span></dt><dd>{selectedMilestone?.name ?? 'No milestone'}</dd></div>
      </dl>
      <details className="form-details issue-create-details">
        <summary><ChevronRight size={14} aria-hidden="true" /><span>Details</span></summary>
        <div className="form-details-content">
          <div className="field-grid">
            {!ownerMode ? <label className="field"><span>Team</span><select value={teamId} disabled={contextProject !== undefined || contextTeam !== undefined} onChange={(event) => {
              const nextTeamId = event.target.value;
              setTeamId(nextTeamId);
              setStatusId(defaultIssueCreateStatusId(nextTeamId, statuses));
              setProjectId('');
              setMilestoneId('');
              contextMilestonePending.current = false;
            }}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label> : null}
            <label className="field"><span>Status</span><select name="statusId" value={statusId} onChange={(event) => setStatusId(event.target.value)} required>{teamStatuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label>
          </div>
          <div className="field-grid">
            <label className="field"><span>Priority</span><select name="priority" value={priority} onChange={(event) => setPriority(event.target.value as IssuePriority)}><option value="none">No priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
            {!ownerMode ? <label className="field"><span>Assignee</span><select name="assigneeUserId" value={assigneeUserId} onChange={(event) => setAssigneeUserId(event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}</select></label> : null}
          </div>
          <div className="field-grid">
            <label className="field"><span>Project</span><select value={projectId} disabled={contextProject !== undefined} onChange={(event) => {
              setProjectId(event.target.value);
              setMilestoneId('');
              contextMilestonePending.current = false;
            }}><option value="">No project</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label className="field"><span>Milestone</span><select name="milestoneId" value={milestoneId} disabled={projectId === '' || milestoneLoading} onChange={(event) => {
              setMilestoneId(event.target.value);
              contextMilestonePending.current = false;
            }}><option value="">{milestoneLoading ? 'Loading milestones' : 'No milestone'}</option>{milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}</select></label>
          </div>
          <label className="field"><span>Due date</span><input name="dueDate" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          <fieldset className="label-picker"><legend>Labels</legend>{labels.filter((label) => label.archivedAt === null).map((label) => <label key={label.id}><input type="checkbox" checked={selectedLabels.includes(label.id)} onChange={() => toggleLabel(label.id)} /><i style={{ background: label.color }} />{label.name}</label>)}</fieldset>
          <label className="editor-label"><span>Description</span><RichTextEditor initial={emptyDocument} onChange={setDocument} label="Issue description" /></label>
          <IssueResourceEditor resources={resources} onChange={setResources} />
        </div>
      </details>
      <ErrorNotice error={error} />
      <button type="submit" className="button primary" disabled={pending || teams.length === 0}>{pending ? <Spinner /> : <Plus size={15} />}Create issue</button>
    </form>
  );
}

interface ActiveLabelEdit {
  labelId: string;
  baseline: Label;
  draft: LabelEditDraft;
}

interface LabelEditRecovery {
  labelId: string;
  confirmedRevision: number;
}

interface LabelManagerNotice {
  tone: 'success' | 'error';
  message: string;
}

function LabelManager({ workspaceId, labels }: { workspaceId: string; labels: Label[] }) {
  const client = useQueryClient();
  const createNameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6279C6');
  const [edit, setEdit] = useState<ActiveLabelEdit | null>(null);
  const [recovery, setRecovery] = useState<LabelEditRecovery | null>(null);
  const [notice, setNotice] = useState<LabelManagerNotice | null>(null);
  const [suppressedUpdateError, setSuppressedUpdateError] = useState<unknown>(null);
  const setCachedLabels = (records: Label[]) => {
    client.setQueryData(['labels', workspaceId, true], records);
  };
  const restoreAuthoritativeLabels = async (): Promise<Label[]> => {
    const confirmed = await api.labels(workspaceId, true);
    setCachedLabels(confirmed);
    return confirmed;
  };
  const focusLabelControl = (labelId: string) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>(`[data-label-edit="${labelId}"]:not([disabled])`)
      ?? document.querySelector<HTMLElement>(`[data-label-archive="${labelId}"]:not([disabled])`)
      ?? createNameRef.current;
    target?.focus();
  }));
  const focusLabelEditor = (labelId: string) => requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelector<HTMLInputElement>(`[data-label-editor="${labelId}"] input[name="labelEditName"]`)?.focus();
  }));
  const create = useMutation({
    mutationFn: (input: { name: string; color: string }) => api.createLabel(workspaceId, input),
    onMutate: () => {
      setNotice(null);
    },
    onSuccess: async (created) => {
      setCachedLabels([...labels, created]);
      setName('');
      setColor('#6279C6');
      try {
        const confirmed = await restoreAuthoritativeLabels();
        const current = confirmed.find((label) => label.id === created.id) ?? created;
        setNotice({ tone: 'success', message: `Label created. Revision ${current.revision}.` });
      } catch {
        setNotice({
          tone: 'error',
          message: `Label was created at revision ${created.revision}, but the label collection could not be confirmed.`,
        });
      }
      createNameRef.current?.focus();
    },
    onError: async () => {
      try {
        await restoreAuthoritativeLabels();
        setNotice({ tone: 'error', message: 'Label was not created. Current server labels restored.' });
      } catch {
        setNotice({
          tone: 'error',
          message: 'Label was not created and the current server labels could not be confirmed.',
        });
      }
      createNameRef.current?.focus();
    },
  });
  const update = useMutation({
    mutationFn: ({ labelId, input }: {
      labelId: string;
      draft: LabelEditDraft;
      input: NonNullable<ReturnType<typeof labelEditRequest>>;
    }) => api.updateLabel(workspaceId, labelId, input),
    onMutate: () => {
      setRecovery(null);
      setNotice(null);
      setSuppressedUpdateError(null);
    },
    onSuccess: async (updated) => {
      setCachedLabels(labels.map((label) => label.id === updated.id ? updated : label));
      setEdit(null);
      setRecovery(null);
      setSuppressedUpdateError(null);
      try {
        const confirmed = await restoreAuthoritativeLabels();
        const current = confirmed.find((label) => label.id === updated.id) ?? updated;
        setNotice({ tone: 'success', message: `Label saved. Revision ${current.revision}.` });
      } catch {
        setNotice({
          tone: 'error',
          message: `Label was saved at revision ${updated.revision}, but the label collection could not be confirmed.`,
        });
      }
      focusLabelControl(updated.id);
    },
    onError: async (error, variables) => {
      try {
        const confirmedLabels = await restoreAuthoritativeLabels();
        const confirmed = confirmedLabels.find((label) => label.id === variables.labelId);
        if (confirmed === undefined) {
          setNotice({
            tone: 'error',
            message: 'Label was not saved. Your draft is retained, but the label is no longer available from the server.',
          });
          return;
        }
        setSuppressedUpdateError(error);
        setEdit((active) => active?.labelId === variables.labelId ? {
          labelId: variables.labelId,
          baseline: confirmed,
          draft: variables.draft,
        } : active);
        setRecovery({ labelId: variables.labelId, confirmedRevision: confirmed.revision });
        setNotice({
          tone: 'error',
          message: confirmed.archivedAt === null
            ? `Label was not saved. Server revision ${confirmed.revision} confirmed; your draft is retained.`
            : `Label was not saved because server revision ${confirmed.revision} is archived; your draft is retained.`,
        });
      } catch {
        setNotice({
          tone: 'error',
          message: 'Label was not saved and the current server revision could not be confirmed. Your draft is retained.',
        });
        await client.invalidateQueries({ queryKey: ['labels', workspaceId] });
      }
      focusLabelEditor(variables.labelId);
    },
  });
  const setArchive = useMutation({
    mutationFn: (label: Label) => label.archivedAt === null
      ? api.archiveLabel(workspaceId, label.id, label.revision)
      : api.restoreLabel(workspaceId, label.id, label.revision),
    onMutate: () => {
      setNotice(null);
    },
    onSuccess: async (updated) => {
      setCachedLabels(labels.map((label) => label.id === updated.id ? updated : label));
      try {
        const confirmedLabels = await restoreAuthoritativeLabels();
        const confirmed = confirmedLabels.find((label) => label.id === updated.id) ?? updated;
        setNotice({
          tone: 'success',
          message: `${confirmed.archivedAt === null ? 'Label restored' : 'Label archived'}. Revision ${confirmed.revision}.`,
        });
      } catch {
        setNotice({
          tone: 'error',
          message: `Label archive state changed at revision ${updated.revision}, but the label collection could not be confirmed.`,
        });
      }
      focusLabelControl(updated.id);
    },
    onError: async (_error, attempted) => {
      try {
        const confirmedLabels = await restoreAuthoritativeLabels();
        const confirmed = confirmedLabels.find((label) => label.id === attempted.id);
        setNotice({
          tone: 'error',
          message: confirmed === undefined
            ? 'Label archive state was not changed. Current server labels were restored.'
            : `Label archive state was not changed. Server revision ${confirmed.revision} was restored.`,
        });
      } catch {
        setNotice({
          tone: 'error',
          message: 'Label archive state was not changed and the server revision could not be confirmed.',
        });
        await client.invalidateQueries({ queryKey: ['labels', workspaceId] });
      }
      focusLabelControl(attempted.id);
    },
  });
  const labelMutationPending = create.isPending || update.isPending || setArchive.isPending;
  const activeRecovery = recovery?.labelId === edit?.labelId ? recovery : null;
  const beginEdit = (label: Label) => {
    if (labelMutationPending || edit !== null || label.archivedAt !== null) return;
    create.reset();
    update.reset();
    setArchive.reset();
    setRecovery(null);
    setNotice(null);
    setSuppressedUpdateError(null);
    setEdit({ labelId: label.id, baseline: label, draft: labelEditDraft(label) });
    focusLabelEditor(label.id);
  };
  const cancelEdit = () => {
    const labelId = edit?.labelId;
    update.reset();
    setEdit(null);
    setRecovery(null);
    setNotice(null);
    setSuppressedUpdateError(null);
    if (labelId !== undefined) focusLabelControl(labelId);
  };
  const submitEdit = () => {
    if (edit === null || labelMutationPending) return;
    const input = labelEditRequest(edit.baseline, edit.draft);
    if (input === null) {
      setNotice({
        tone: 'error',
        message: edit.baseline.archivedAt === null
          ? 'Label was not saved because the name or color is invalid or unchanged.'
          : 'Label was not saved because the confirmed server value is archived.',
      });
      focusLabelEditor(edit.labelId);
      return;
    }
    update.mutate({ labelId: edit.labelId, input, draft: edit.draft });
  };
  const useServerValues = () => {
    if (edit === null || labelMutationPending) return;
    const { labelId, baseline } = edit;
    update.reset();
    setRecovery(null);
    setSuppressedUpdateError(null);
    if (baseline.archivedAt !== null) {
      setEdit(null);
      setNotice({
        tone: 'success',
        message: `Server values restored at revision ${baseline.revision}. Restore the label before editing it.`,
      });
      focusLabelControl(labelId);
      return;
    }
    setEdit({ ...edit, draft: labelEditDraft(baseline) });
    setNotice({
      tone: 'success',
      message: `Server values restored at revision ${baseline.revision}.`,
    });
    focusLabelEditor(labelId);
  };
  const pendingMessage = update.isPending
    ? 'Saving label...'
    : setArchive.isPending ? 'Updating label archive state...'
      : create.isPending ? 'Creating label...' : null;
  return (
    <div className="dialog-form label-manager">
      <form className="label-create-row" onSubmit={(event) => {
        event.preventDefault();
        if (!labelMutationPending && edit === null) {
          update.reset();
          setArchive.reset();
          create.mutate({ name, color });
        }
      }}>
        <input ref={createNameRef} name="name" aria-label="Label name" placeholder="Label name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} disabled={labelMutationPending || edit !== null} required />
        <input name="color" aria-label="Label color" type="color" value={color} onChange={(event) => setColor(event.target.value)} disabled={labelMutationPending || edit !== null} />
        <button type="submit" className="icon-button" aria-label="Create label" title="Create label" disabled={labelMutationPending || edit !== null}><Plus size={15} /></button>
      </form>
      <div
        className={`label-edit-feedback ${notice?.tone ?? ''}`}
        role={notice?.tone === 'error' ? 'alert' : 'status'}
        aria-live={notice?.tone === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
      >
        {pendingMessage !== null ? <><Spinner />{pendingMessage}</> : notice !== null ? <>{notice.tone === 'error' ? <AlertCircle size={14} /> : <CircleDot size={14} />}{notice.message}</> : null}
      </div>
      <ErrorNotice error={create.error ?? (update.error === suppressedUpdateError ? null : update.error) ?? setArchive.error} />
      <div className="label-manager-list">
        {labels.length === 0 ? <p className="muted-copy">No labels yet</p> : labels.map((label) => {
          const activeEdit = edit?.labelId === label.id ? edit : null;
          return (
            <div key={label.id} className={`label-manager-row ${label.archivedAt === null ? '' : 'archived'}`}>
              {activeEdit === null ? <>
                <span className="label-chip" title={label.name}><i style={{ background: label.color }} />{label.name}</span>
                <div className="label-manager-actions">
                  {label.archivedAt === null ? <button type="button" className="icon-button" data-label-edit={label.id} aria-label={`Edit ${label.name}`} title="Edit label" onClick={() => beginEdit(label)} disabled={labelMutationPending || edit !== null}><Pencil size={14} /></button> : null}
                  <button type="button" className="icon-button" data-label-archive={label.id} aria-label={label.archivedAt === null ? `Archive ${label.name}` : `Restore ${label.name}`} title={label.archivedAt === null ? 'Archive label' : 'Restore label'} onClick={() => { if (!labelMutationPending && edit === null) { create.reset(); update.reset(); setArchive.mutate(label); } }} disabled={labelMutationPending || edit !== null}>{label.archivedAt === null ? <Archive size={14} /> : <RefreshCcw size={14} />}</button>
                </div>
              </> : <form data-label-editor={label.id} className="label-edit-row" onSubmit={(event) => { event.preventDefault(); submitEdit(); }}>
                <input name="labelEditName" aria-label={`Name for ${activeEdit.baseline.name}`} maxLength={60} value={activeEdit.draft.name} onChange={(event) => setEdit((current) => current?.labelId === label.id ? { ...current, draft: { ...current.draft, name: event.target.value } } : current)} disabled={labelMutationPending} required />
                <input name="labelEditColor" aria-label={`Color for ${activeEdit.baseline.name}`} type="color" value={activeEdit.draft.color} onChange={(event) => setEdit((current) => current?.labelId === label.id ? { ...current, draft: { ...current.draft, color: event.target.value } } : current)} disabled={labelMutationPending} />
                <div className="label-edit-actions">
                  <button type="submit" className="icon-button" aria-label="Save label" title="Save label" disabled={labelMutationPending}><Save size={14} /></button>
                  <button type="button" className="icon-button" aria-label="Cancel label edit" title="Cancel" onClick={cancelEdit} disabled={labelMutationPending}><X size={14} /></button>
                </div>
                {activeRecovery !== null ? <div className="label-edit-recovery">
                  <span>Server revision {activeRecovery.confirmedRevision} is now authoritative.</span>
                  <button type="button" className="button" onClick={submitEdit} disabled={labelMutationPending || activeEdit.baseline.archivedAt !== null}>Retry draft</button>
                  <button type="button" className="button" onClick={useServerValues} disabled={labelMutationPending}>Use server values</button>
                </div> : null}
              </form>}
            </div>
          );
        })}
        {edit !== null && !labels.some((label) => label.id === edit.labelId) ? <div className="label-edit-unavailable" role="alert">
          <span>The edited label is no longer available. Your draft remains in memory until this dialog closes.</span>
          <button type="button" className="button" onClick={cancelEdit}>Dismiss draft</button>
        </div> : null}
      </div>
    </div>
  );
}

function ActivityList({ entries, members, statuses, projects, milestones, labels, issues }: {
  entries: ActivityEntry[];
  members: Membership[];
  statuses: WorkflowStatus[];
  projects: Project[];
  milestones: Milestone[];
  labels: Label[];
  issues: Issue[];
}) {
  const fieldLabel = (field: string): string => ({
    assigneeUserId: 'Assignee',
    bodyDocument: 'Comment',
    descriptionDocument: 'Description',
    labelIds: 'Labels',
    milestoneId: 'Milestone',
    projectId: 'Project',
    resources: 'Resources',
    sourceIssueId: 'Source issue',
    statusId: 'Status',
    targetIssueId: 'Target issue',
  })[field] ?? titleCase(field);
  const actionLabel = (action: string): string => ({
    'comment.archived': 'archived comment',
    'comment.created': 'created comment',
    'comment.restored': 'restored comment',
    'comment.updated': 'updated comment',
    'issue.archived': 'archived issue',
    'issue.created': 'created issue',
    'issue.restored': 'restored issue',
    'issue.updated': 'updated issue',
    'issue_relation.created': 'created relation',
    'issue_relation.deleted': 'removed relation',
  })[action] ?? action.replaceAll('.', ' ').replaceAll('_', ' ');
  const resolve = (field: string, value: unknown): string => {
    if (field === 'statusId') return statuses.find((status) => status.id === value)?.name ?? displayValue(value);
    if (field === 'assigneeUserId') return members.find((member) => member.userId === value)?.displayName ?? displayValue(value);
    if (field === 'projectId') return projects.find((project) => project.id === value)?.name ?? displayValue(value);
    if (field === 'milestoneId') return milestones.find((milestone) => milestone.id === value)?.name ?? displayValue(value);
    if (field === 'sourceIssueId' || field === 'targetIssueId') {
      return issues.find((issue) => issue.id === value)?.identifier ?? displayValue(value);
    }
    if (field === 'labelIds' && Array.isArray(value)) return value.map((id) => labels.find((label) => label.id === id)?.name ?? id).join(', ') || 'None';
    if (field === 'resources' && Array.isArray(value)) {
      return value.map((resource) => {
        if (typeof resource !== 'object' || resource === null) return displayValue(resource);
        const item = resource as { label?: unknown; url?: unknown };
        return typeof item.label === 'string' ? item.label : displayValue(item.url);
      }).join(', ') || 'None';
    }
    if (field === 'priority' || field === 'type') return titleCase(displayValue(value));
    return displayValue(value);
  };
  if (entries.length === 0) return <p className="muted-copy">No activity yet</p>;
  return (
    <ol className="activity-list issue-activity-list">
      {entries.map((entry) => <li key={entry.id}><span className="activity-marker" /><div><div className="activity-heading"><strong>{entry.actor?.displayName ?? 'System'}</strong><span>{actionLabel(entry.action)}</span><time>{new Date(entry.createdAt).toLocaleString()}</time></div>{entry.fields.length > 0 ? <dl className="activity-fields">{entry.fields.map((field, index) => <div key={`${field.field}-${index}`}><dt>{fieldLabel(field.field)}</dt><dd><span>{resolve(field.field, field.before)}</span><CornerDownRight size={12} /><strong>{resolve(field.field, field.after)}</strong></dd></div>)}</dl> : null}</div></li>)}
    </ol>
  );
}

function IssueContentForm({
  issue,
  canWrite,
  draft,
  pending,
  locked,
  error,
  onChange,
  onSubmit,
}: {
  issue: Issue;
  canWrite: boolean;
  draft?: IssueContentDraft;
  pending: boolean;
  locked: boolean;
  error: unknown;
  onChange: (draft: IssueContentDraft) => void;
  onSubmit: (input: IssueContentDraft) => void;
}) {
  const editableDraft = draft ?? issueContentDraftFromIssue(issue);
  const editing = canWrite && issue.archivedAt === null;
  const title = editing ? editableDraft.title : issue.title;
  const titleEditorRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (titleEditorRef.current) fitTextareaHeight(titleEditorRef.current);
  }, [title]);
  useEffect(() => {
    const editor = titleEditorRef.current;
    if (!editor || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => fitTextareaHeight(editor));
    observer.observe(editor);
    return () => observer.disconnect();
  }, [issue.id]);
  return (
    <form id={`issue-edit-form-${issue.id}`} className="issue-detail-main issue-content-form" data-issue-edit-form={issue.id} onSubmit={(event) => {
      event.preventDefault();
      if (!canWrite || issue.archivedAt !== null || locked) return;
      onSubmit(editableDraft);
    }}>
      <label className="issue-title-editor"><span className="sr-only">Issue title</span><textarea ref={titleEditorRef} name="title" data-issue-title-editor value={editing ? editableDraft.title : issue.title} onChange={(event) => onChange({ ...editableDraft, title: event.target.value })} rows={2} maxLength={240} required readOnly={!canWrite || locked} disabled={issue.archivedAt !== null} /></label>
      <section className="issue-description-section" aria-labelledby="description-title"><h2 id="description-title">Description</h2>{editing ? <RichTextEditor initial={editableDraft.descriptionDocument} onChange={(descriptionDocument) => onChange({ ...editableDraft, descriptionDocument })} label="Issue description" disabled={locked} /> : <RichTextView document={issue.descriptionDocument} />}</section>
      <ErrorNotice error={error} />
      {canWrite && issue.archivedAt === null ? <button className="button primary issue-content-save" disabled={locked}>{pending ? <Spinner /> : <Save size={14} />}Save content</button> : null}
    </form>
  );
}

interface IssuePropertyNotice {
  tone: 'success' | 'error';
  message: string;
}

function IssueDueDateEditor({
  value,
  disabled,
  onCommit,
}: {
  value: string | null;
  disabled: boolean;
  onCommit: (value: string | null) => void;
}) {
  return (
    <span className="issue-due-date-control">
      <BufferedDateInput label="Issue due date" value={value} disabled={disabled} onCommit={onCommit} />
      <CalendarDays className="issue-due-date-icon" size={14} aria-hidden="true" />
    </span>
  );
}

function IssuePropertiesEditor({
  issue,
  statuses,
  members,
  ownerMode,
  ownerDisplayName,
  projects,
  milestones,
  labels,
  canWrite,
  locked,
  milestoneLoading,
  milestoneError,
  milestoneRetrying,
  pendingLabel,
  notice,
  error,
  onRetryMilestones,
  onChange,
}: {
  issue: Issue;
  statuses: WorkflowStatus[];
  members: Membership[];
  ownerMode: boolean;
  ownerDisplayName: string;
  projects: Project[];
  milestones: Milestone[];
  labels: Label[];
  canWrite: boolean;
  locked: boolean;
  milestoneLoading: boolean;
  milestoneError: unknown;
  milestoneRetrying: boolean;
  pendingLabel: string | null;
  notice: IssuePropertyNotice | null;
  error: unknown;
  onRetryMilestones: () => void;
  onChange: (label: string, change: IssueInlinePropertyChange) => void;
}) {
  const statusOptions = issueDetailStatuses(issue, statuses);
  const memberOptions = issueDetailMembers(issue, members);
  const projectOptions = issueDetailProjectOptions(issue, projects);
  const milestoneOptions = issueDetailMilestoneOptions(
    issue,
    issue.projectId ?? '',
    projects,
    milestones,
  );
  const labelOptions = issueDetailLabelOptions(issue, labels);
  const currentLabelIds = new Set(issue.labels.map((label) => label.id));
  const controlsDisabled = !canWrite || issue.archivedAt !== null || locked;
  const inspectorRequiresVisibility = pendingLabel !== null
    || notice?.tone === 'error'
    || error != null
    || milestoneError != null;
  const [inspectorOpen, setInspectorOpen] = useState(() => issuePropertiesInspectorInitialOpen(
    window.matchMedia(issuePropertiesInspectorDesktopQuery).matches,
  ));
  const inspectorVisible = inspectorOpen || inspectorRequiresVisibility;
  const inspectorRegionId = 'issue-properties-' + issue.id;
  const inspectorHeadingId = 'issue-properties-title-' + issue.id;
  const currentProjectAvailable = issue.projectId === null
    || projectOptions.some((project) => project.id === issue.projectId);
  const currentMilestoneAvailable = issue.milestoneId === null
    || milestoneOptions.some((milestone) => milestone.id === issue.milestoneId);
  useEffect(() => {
    const media = window.matchMedia(issuePropertiesInspectorDesktopQuery);
    const syncViewport = (event: MediaQueryListEvent) => setInspectorOpen((current) => (
      issuePropertiesInspectorState(current, { type: 'viewport', desktop: event.matches })
    ));
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, []);
  useEffect(() => {
    const desktop = window.matchMedia(issuePropertiesInspectorDesktopQuery).matches;
    setInspectorOpen((current) => issuePropertiesInspectorState(current, {
      type: 'issue',
      desktop,
    }));
  }, [issue.id]);
  useEffect(() => {
    if (!inspectorRequiresVisibility) return;
    setInspectorOpen((current) => issuePropertiesInspectorState(current, {
      type: 'require-visible',
    }));
  }, [inspectorRequiresVisibility]);
  return (
    <div className="issue-properties-inspector">
      <button
        type="button"
        className="issue-properties-inspector-toggle"
        aria-controls={inspectorRegionId}
        aria-expanded={inspectorVisible}
        aria-disabled={inspectorRequiresVisibility || undefined}
        onClick={() => {
          if (inspectorRequiresVisibility) return;
          setInspectorOpen((current) => issuePropertiesInspectorState(current, { type: 'toggle' }));
        }}
      >
        <SlidersHorizontal size={15} aria-hidden="true" />
        <span>Properties</span>
        <ChevronDown className="issue-properties-inspector-chevron" size={15} aria-hidden="true" />
      </button>
      <aside
        id={inspectorRegionId}
        className="issue-properties"
        aria-labelledby={inspectorHeadingId}
        aria-busy={pendingLabel !== null}
        hidden={!inspectorVisible}
      >
        <h2 id={inspectorHeadingId}>Properties</h2>
        <div
          className={`issue-property-feedback ${pendingLabel !== null ? 'pending' : notice?.tone ?? 'idle'}`}
          role={notice?.tone === 'error' ? 'alert' : 'status'}
          aria-live={notice?.tone === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {pendingLabel !== null ? <><Spinner />Updating {pendingLabel.toLowerCase()}...</> : notice?.message ?? <span aria-hidden="true">&nbsp;</span>}
        </div>
        <label><span>Status</span><select aria-label="Issue status" value={issue.statusId} disabled={controlsDisabled} onChange={(event) => onChange('Status', { field: 'statusId', value: event.target.value })}>{statusOptions.some((status) => status.id === issue.statusId) ? null : <option value={issue.statusId} disabled>Current status unavailable</option>}{statusOptions.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label>
        <label><span>Priority</span><select aria-label="Issue priority" value={issue.priority} disabled={controlsDisabled} onChange={(event) => onChange('Priority', { field: 'priority', value: event.target.value as IssuePriority })}><option value="none">No priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        {ownerMode ? <div className="issue-owner-property"><span>Owner</span><strong><UserRound size={13} /><span>{ownerDisplayName}</span></strong></div> : <label><span>Assignee</span><select aria-label="Issue assignee" value={issue.assigneeUserId ?? ''} disabled={controlsDisabled} onChange={(event) => onChange('Assignee', { field: 'assigneeUserId', value: event.target.value || null })}><option value="">Unassigned</option>{issue.assigneeUserId !== null && !memberOptions.some((member) => member.userId === issue.assigneeUserId) ? <option value={issue.assigneeUserId} disabled>Current assignee unavailable</option> : null}{memberOptions.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}</select></label>}
        <label><span>Due date</span><IssueDueDateEditor key={issue.id} value={issue.dueDate} disabled={controlsDisabled} onCommit={(value) => onChange('Due date', { field: 'dueDate', value })} /></label>
        <label><span>Project</span><select aria-label="Issue project" value={issue.projectId ?? ''} disabled={controlsDisabled} onChange={(event) => onChange('Project', { field: 'projectId', value: event.target.value || null })}><option value="">No project</option>{!currentProjectAvailable && issue.projectId !== null ? <option value={issue.projectId} disabled>Current project unavailable</option> : null}{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}{project.archivedAt === null ? '' : ' (archived)'}</option>)}</select></label>
        <label><span>Milestone</span><select aria-label="Issue milestone" value={issue.milestoneId ?? ''} onChange={(event) => onChange('Milestone', { field: 'milestoneId', value: event.target.value || null })} disabled={controlsDisabled || issue.projectId === null || milestoneLoading || milestoneError !== null}><option value="">{milestoneLoading ? 'Loading milestones...' : milestoneError === null ? 'No milestone' : 'Milestones unavailable'}</option>{!currentMilestoneAvailable && issue.milestoneId !== null ? <option value={issue.milestoneId} disabled>Current milestone unavailable</option> : null}{milestoneOptions.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}{milestone.archivedAt === null ? '' : ' (archived)'}</option>)}</select></label>
        <fieldset className="property-labels" disabled={controlsDisabled}><legend>Labels</legend>{labelOptions.map((label) => <label key={label.id}><input type="checkbox" checked={currentLabelIds.has(label.id)} onChange={(event) => onChange('Labels', { field: 'label', labelId: label.id, selected: event.target.checked })} /><i style={{ background: label.color }} />{label.name}{label.archivedAt === null ? '' : ' (archived)'}</label>)}</fieldset>
        <ErrorNotice error={error} />
        {milestoneError === null ? null : (
          <QueryErrorState
            compact
            title="Could not load issue milestones"
            error={milestoneError}
            retrying={milestoneRetrying}
            onRetry={onRetryMilestones}
          />
        )}
      </aside>
    </div>
  );
}

function IssueRelationSection({
  hierarchy = false,
  loading,
  relations,
  onOpenIssue,
  onRemove,
  removeDisabled,
  children,
}: {
  hierarchy?: boolean;
  loading: boolean;
  relations: IssueRelation[];
  onOpenIssue: (issueId: string) => void;
  onRemove: (relation: IssueRelation) => void;
  removeDisabled: boolean;
  children?: ReactNode;
}) {
  const title = hierarchy ? 'Sub-issues' : 'Relations';
  const headingId = hierarchy ? 'sub-issues-title' : 'relations-title';
  return (
    <section className="issue-secondary-section" aria-labelledby={headingId}>
      <header><div>{hierarchy ? <CornerDownRight size={15} /> : <GitBranch size={15} />}<h2 id={headingId}>{title}</h2>{loading ? <span className="skeleton-block skeleton-inline-count" aria-hidden="true" /> : <span>{relations.length}</span>}</div></header>
      {loading
        ? hierarchy
          ? <LoadingSkeleton variant="relations" label="Loading issue hierarchy" />
          : <LoadingSkeleton variant="relations" label="Loading issue relations" />
        : relations.length > 0
          ? <ul className="relation-list">{relations.map((relation) => <li key={relation.id}><span className="relation-kind">{issueRelationDirectionLabel(relation.direction)}</span><button onClick={() => onOpenIssue(relation.otherIssue.id)} title={relation.otherIssue.title}><code>{relation.otherIssue.identifier}</code><strong>{relation.otherIssue.title}</strong></button><button className="icon-button" data-relation-remove={relation.id} aria-label={`Remove relation to ${relation.otherIssue.identifier}`} title="Remove relation" onClick={() => onRemove(relation)} disabled={removeDisabled}><X size={14} /></button></li>)}</ul>
          : <p className="muted-copy">{hierarchy ? 'No parent or sub-issues' : 'No relations'}</p>}
      {children}
    </section>
  );
}

function IssueRelationCreateForm({
  section,
  issue,
  issues,
  pending,
  loading,
  onSubmit,
}: {
  section: 'hierarchy' | 'peer';
  issue: Issue;
  issues: Issue[];
  pending: boolean;
  loading: boolean;
  onSubmit: (draft: IssueRelationCreateDraft) => void;
}) {
  const hierarchy = section === 'hierarchy';
  const directions = hierarchy ? issueHierarchyCreateDirections : issuePeerCreateDirections;
  const [direction, setDirection] = useState<IssueRelationCreateDraft['direction']>(
    hierarchy ? 'sub_issue' : 'related',
  );
  const [otherIssueId, setOtherIssueId] = useState('');
  const candidates = issueRelationCandidates(issue, issues);
  const label = issueRelationDirectionLabel(direction);
  return (
    <form className="relation-create" data-relation-create={section} aria-label={hierarchy ? 'Add issue hierarchy' : 'Add issue relation'} onSubmit={(event) => {
      event.preventDefault();
      onSubmit({ direction, otherIssueId });
    }}>
      <select name="direction" aria-label={hierarchy ? 'Hierarchy direction' : 'Relation direction'} value={direction} disabled={pending || loading} onChange={(event) => setDirection(event.target.value as IssueRelationCreateDraft['direction'])}>{directions.map((value) => <option key={value} value={value}>{issueRelationDirectionLabel(value)}</option>)}</select>
      <select name="otherIssueId" aria-label={hierarchy ? 'Hierarchy issue' : 'Related issue'} required value={otherIssueId} disabled={pending || loading} onChange={(event) => setOtherIssueId(event.target.value)}><option value="" disabled>{loading ? 'Loading issues' : 'Select issue'}</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.identifier} · {candidate.title}</option>)}</select>
      <button className="icon-button" aria-label={`Add ${label.toLowerCase()}`} title={`Add ${label.toLowerCase()}`} disabled={pending || loading || otherIssueId === ''}>{pending ? <Spinner /> : <Plus size={14} />}</button>
    </form>
  );
}

interface IssueRelationNotice {
  tone: 'success' | 'error';
  message: string;
}

interface ActiveCommentEdit {
  commentId: string;
  baseline: Comment;
  draft: IssueRichTextDocument;
  editorEpoch: number;
}

interface CommentEditRecovery {
  commentId: string;
  confirmedRevision: number;
}

interface CommentEditNotice {
  tone: 'success' | 'error';
  message: string;
}

function InlineCommentEditForm({
  edit,
  recovery,
  pending,
  error,
  onChange,
  onSubmit,
  onCancel,
  onRetry,
  onUseServerValues,
}: {
  edit: ActiveCommentEdit;
  recovery: CommentEditRecovery | null;
  pending: boolean;
  error: unknown;
  onChange: (draft: IssueRichTextDocument) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onUseServerValues: () => void;
}) {
  return (
    <form
      className="comment-inline-edit"
      aria-label="Edit comment"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <RichTextEditor
        key={`${edit.commentId}-${edit.baseline.revision}-${edit.editorEpoch}`}
        initial={edit.draft}
        onChange={onChange}
        label="Edit comment"
      />
      {recovery !== null ? (
        <div className="comment-edit-recovery" role="alert" aria-live="assertive" aria-atomic="true">
          <AlertCircle size={16} aria-hidden="true" />
          <div>
            <strong>Comment changed</strong>
            <p>Your draft is retained. Server revision {recovery.confirmedRevision} is now the retry baseline.</p>
          </div>
          <div className="comment-edit-recovery-actions">
            <button type="button" className="button" onClick={onRetry} disabled={pending}><RefreshCcw size={14} />Retry draft</button>
            <button type="button" className="button" onClick={onUseServerValues} disabled={pending}>Use server values</button>
          </div>
        </div>
      ) : null}
      <ErrorNotice error={error} />
      <div className="comment-inline-edit-actions">
        <button type="button" className="button" onClick={onCancel} disabled={pending}><X size={14} />Cancel</button>
        <button type="submit" className="button primary" disabled={pending}>{pending ? <Spinner /> : <Save size={14} />}Save comment</button>
      </div>
    </form>
  );
}

function IssueDetail({
  workspaceId,
  workspaceRole,
  currentUserId,
  ownerMode = false,
  issueId,
  teams,
  statuses,
  members,
  projects,
  labels,
  detailDraft,
  onBack,
  onOpenIssue,
  onContentDraftChange,
  onCommentDraftChange,
  onClearContentDraft,
  onClearCommentDraft,
  onClearDetailDraft,
  panel = false,
}: {
  workspaceId: string;
  workspaceRole: Workspace['role'];
  currentUserId?: string;
  ownerMode?: boolean;
  issueId: string;
  teams: Team[];
  statuses: WorkflowStatus[];
  members: Membership[];
  projects: Project[];
  labels: Label[];
  detailDraft?: IssueDetailDraft;
  onBack: () => void;
  onOpenIssue: (issueId: string) => void;
  onContentDraftChange: (issue: Issue, draft: IssueContentDraft) => void;
  onCommentDraftChange: (issueId: string, draft: IssueRichTextDocument) => void;
  onClearContentDraft: (issueId: string) => void;
  onClearCommentDraft: (issueId: string) => void;
  onClearDetailDraft: (issueId: string) => void;
  panel?: boolean;
}) {
  const client = useQueryClient();
  const canWriteIssues = hasCapability(workspaceRole, 'issue:write');
  const canPurgeIssues = hasCapability(workspaceRole, 'issue:purge');
  const ownerDisplayName = members.find((member) => member.userId === currentUserId)?.displayName
    ?? 'Local owner';
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [archiveNotice, setArchiveNotice] = useState<ArchiveNotice<Issue> | null>(null);
  const [commentEdit, setCommentEdit] = useState<ActiveCommentEdit | null>(null);
  const [commentEditRecovery, setCommentEditRecovery] = useState<CommentEditRecovery | null>(null);
  const [commentEditNotice, setCommentEditNotice] = useState<CommentEditNotice | null>(null);
  const [suppressedCommentUpdateError, setSuppressedCommentUpdateError] = useState<unknown>(null);
  const [commentEditorKey, setCommentEditorKey] = useState(0);
  const [editRecovery, setEditRecovery] = useState<ActiveIssueEditRecovery | null>(null);
  const [suppressedUpdateError, setSuppressedUpdateError] = useState<unknown>(null);
  const [issuePropertyNotice, setIssuePropertyNotice] = useState<IssuePropertyNotice | null>(null);
  const [contentEditorEpoch, setContentEditorEpoch] = useState(0);
  const [resourceEditorIssueId, setResourceEditorIssueId] = useState<string | null>(null);
  const [relationCreateEpoch, setRelationCreateEpoch] = useState({ hierarchy: 0, peer: 0 });
  const [relationNotice, setRelationNotice] = useState<IssueRelationNotice | null>(null);
  const archiveUndoButtonRef = useRef<HTMLButtonElement>(null);
  const issue = useQuery({
    queryKey: ['issue', workspaceId, issueId],
    queryFn: () => api.issue(workspaceId, issueId),
  });
  const relations = useQuery({
    queryKey: ['issue-relations', workspaceId, issueId],
    queryFn: () => api.issueRelations(workspaceId, issueId),
  });
  const comments = useQuery({
    queryKey: ['comments', workspaceId, issueId, true],
    queryFn: () => api.comments(workspaceId, issueId, true),
  });
  const activity = useQuery({
    queryKey: ['issue-activity', workspaceId, issueId],
    queryFn: () => api.issueActivity(workspaceId, issueId),
  });
  const issueOptionFilters = {
    archiveState: 'active' as const,
    order: 'identifier' as const,
    direction: 'asc' as const,
  };
  const issueOptions = useQuery({
    queryKey: ['issues', workspaceId, issueOptionFilters],
    queryFn: () => api.issues(workspaceId, issueOptionFilters),
  });
  const issueMilestones = useQuery({
    queryKey: ['milestones', workspaceId, issue.data?.projectId ?? '', true],
    queryFn: () => api.milestones(workspaceId, issue.data?.projectId ?? '', true),
    enabled: issue.data?.projectId !== null && issue.data?.projectId !== undefined,
  });
  const issueBlockingError = issue.data === undefined ? issue.error : null;
  const relationBlockingError = (relations.data === undefined ? relations.error : null)
    ?? (issueOptions.data === undefined ? issueOptions.error : null);
  const commentsBlockingError = comments.data === undefined ? comments.error : null;
  const activityBlockingError = activity.data === undefined ? activity.error : null;
  const issueMilestonesBlockingError = issue.data?.projectId === null || issue.data?.projectId === undefined
    ? null
    : issueMilestones.data === undefined ? issueMilestones.error : null;
  const retryFailedRelationReads = () => {
    const tasks: Promise<unknown>[] = [];
    if (relations.data === undefined && relations.error !== null) tasks.push(relations.refetch());
    if (issueOptions.data === undefined && issueOptions.error !== null) tasks.push(issueOptions.refetch());
    void Promise.all(tasks);
  };
  const refreshIssue = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['issue', workspaceId, issueId] }),
      client.invalidateQueries({ queryKey: ['issues', workspaceId] }),
      client.invalidateQueries({ queryKey: ['issue-activity', workspaceId, issueId] }),
      client.invalidateQueries({ queryKey: ['projects', workspaceId] }),
      client.invalidateQueries({ queryKey: ['project', workspaceId] }),
      client.invalidateQueries({ queryKey: ['milestones', workspaceId] }),
    ]);
  };
  const focusArchiveAction = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelector<HTMLButtonElement>(
      `[data-issue-detail="${issueId}"] [data-issue-archive-action]:not([disabled])`,
    )?.focus();
  }));
  const focusArchiveUndo = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    archiveUndoButtonRef.current?.focus();
  }));
  const update = useMutation({
    mutationFn: (input: IssueContentDraft) => api.updateIssue(workspaceId, issueId, input),
    onMutate: () => {
      setSuppressedUpdateError(null);
    },
    onSuccess: async (updated) => {
      setEditRecovery(null);
      setSuppressedUpdateError(null);
      setContentEditorEpoch((value) => value + 1);
      setResourceEditorIssueId(null);
      onClearContentDraft(issueId);
      client.setQueryData(['issue', workspaceId, issueId], updated);
      await refreshIssue();
    },
    onError: async (error, draft) => {
      if (!(error instanceof ApiError) || error.code !== 'CONFLICT' || error.currentRevision === undefined) {
        return;
      }
      try {
        const confirmed = await api.issue(workspaceId, issueId);
        const recovery = createIssueEditConflictRecovery(error, confirmed.revision, draft);
        if (recovery === null) return;
        client.setQueryData(['issue', workspaceId, issueId], confirmed);
        setSuppressedUpdateError(error);
        setEditRecovery({ ...recovery, issueId });
        setResourceEditorIssueId(null);
        onContentDraftChange(confirmed, draft);
        await client.invalidateQueries({ queryKey: ['issues', workspaceId] });
      } catch {
        await client.invalidateQueries({ queryKey: ['issue', workspaceId, issueId] });
      }
    },
  });
  const inlineUpdate = useMutation({
    mutationFn: ({ input }: { label: string; input: UpdateIssueRequest }) =>
      api.updateIssue(workspaceId, issueId, input),
    onMutate: () => {
      setIssuePropertyNotice(null);
    },
    onSuccess: async (updated, { label }) => {
      client.setQueryData(['issue', workspaceId, issueId], updated);
      setIssuePropertyNotice({
        tone: 'success',
        message: `${label} updated. Revision ${updated.revision}.`,
      });
      await refreshIssue();
    },
    onError: async (error, { label }) => {
      try {
        const confirmed = await api.issue(workspaceId, issueId);
        client.setQueryData(['issue', workspaceId, issueId], confirmed);
        setIssuePropertyNotice({
          tone: 'error',
          message: error instanceof ApiError && error.code === 'CONFLICT'
            ? `${label} was not applied because the issue changed. Server values restored at revision ${confirmed.revision}.`
            : `${label} was not applied. Server values restored at revision ${confirmed.revision}.`,
        });
        await client.invalidateQueries({ queryKey: ['issues', workspaceId] });
      } catch {
        setIssuePropertyNotice({
          tone: 'error',
          message: `${label} was not applied and the current server revision could not be confirmed.`,
        });
        await client.invalidateQueries({ queryKey: ['issue', workspaceId, issueId] });
      }
    },
  });
  const setArchive = useMutation({
    mutationFn: ({ current }: { current: Issue; source: 'direct' | 'undo' }) =>
      current.archivedAt === null
        ? api.archiveIssue(workspaceId, current.id, current.revision)
        : api.restoreIssue(workspaceId, current.id, current.revision),
    onMutate: ({ source }) => {
      if (source === 'direct') setArchiveNotice(null);
    },
    onSuccess: async (updated) => {
      setResourceEditorIssueId(null);
      client.setQueryData(['issue', workspaceId, issueId], updated);
      const archived = updated.archivedAt !== null;
      setArchiveNotice({
        tone: 'success',
        message: `${updated.identifier} ${archived ? 'archived' : 'restored'}.`,
        undoTarget: archived ? updated : null,
      });
      await refreshIssue();
      if (archived) focusArchiveUndo();
      else focusArchiveAction();
    },
    onError: async (_error, { current, source }) => {
      if (source !== 'undo') return;
      setArchiveNotice({
        tone: 'error',
        message: `${current.identifier} could not be restored. It remains archived; use Restore here or in Archive to retry.`,
        undoTarget: null,
      });
      try {
        await refreshIssue();
      } finally {
        focusArchiveAction();
      }
    },
  });
  const purge = useMutation({
    mutationFn: ({ current, confirmation }: { current: Issue; confirmation: string }) =>
      api.purgeIssue(workspaceId, current.id, current.revision, confirmation),
    onMutate: () => {
      setArchiveNotice(null);
    },
    onSuccess: async () => {
      setPurgeOpen(false);
      onClearDetailDraft(issueId);
      await client.invalidateQueries({ queryKey: ['issues', workspaceId] });
      onBack();
    },
  });
  const focusRelationCreate = (section: 'hierarchy' | 'peer') => requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-issue-detail="${issueId}"] [data-relation-create="${section}"] select[name="direction"]`)?.focus();
  }));
  const focusRelationRemove = (relation: IssueRelation) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const detail = document.querySelector<HTMLElement>(`[data-issue-detail="${issueId}"]`);
    const section = relation.direction === 'parent' || relation.direction === 'sub_issue'
      ? 'hierarchy'
      : 'peer';
    const target = detail?.querySelector<HTMLElement>(`[data-relation-remove="${relation.id}"]:not([disabled])`)
      ?? detail?.querySelector<HTMLElement>(`[data-relation-create="${section}"] select[name="direction"]:not([disabled])`);
    target?.focus();
  }));
  const refreshRelationState = async (...otherIssueIds: string[]) => {
    const affectedIssueIds = new Set([issueId, ...otherIssueIds]);
    await Promise.all([...affectedIssueIds].flatMap((affectedIssueId) => [
      client.invalidateQueries({ queryKey: ['issue-relations', workspaceId, affectedIssueId] }),
      client.invalidateQueries({ queryKey: ['issue-activity', workspaceId, affectedIssueId] }),
    ]));
  };
  const restoreAuthoritativeRelations = async (): Promise<boolean> => {
    try {
      const confirmed = await api.issueRelations(workspaceId, issueId);
      client.setQueryData(['issue-relations', workspaceId, issueId], confirmed);
      return true;
    } catch {
      await client.invalidateQueries({ queryKey: ['issue-relations', workspaceId, issueId] });
      return false;
    }
  };
  const createRelation = useMutation({
    mutationFn: ({ command }: {
      command: IssueRelationCreateCommand;
      section: 'hierarchy' | 'peer';
    }) => api.createIssueRelation(workspaceId, command.sourceIssueId, command.input),
    onMutate: () => {
      setRelationNotice(null);
    },
    onSuccess: async (_created, { command, section }) => {
      await refreshRelationState(command.otherIssueId);
      setRelationCreateEpoch((value) => ({ ...value, [section]: value[section] + 1 }));
      setRelationNotice({
        tone: 'success',
        message: `${issueRelationDirectionLabel(command.direction)} relation added.`,
      });
      focusRelationCreate(section);
    },
    onError: async (_error, { section }) => {
      const restored = await restoreAuthoritativeRelations();
      setRelationNotice({
        tone: 'error',
        message: restored
          ? 'Relation was not added. Current server relations restored; your selection is retained.'
          : 'Relation was not added and current server relations could not be confirmed; your selection is retained.',
      });
      focusRelationCreate(section);
    },
  });
  const removeRelation = useMutation({
    mutationFn: ({ relation }: { relation: IssueRelation }) =>
      api.deleteIssueRelation(workspaceId, issueId, relation.id, relation.revision),
    onMutate: () => {
      setRelationNotice(null);
    },
    onSuccess: async (_removed, { relation }) => {
      await refreshRelationState(relation.otherIssue.id);
      setRelationNotice({
        tone: 'success',
        message: `${issueRelationDirectionLabel(relation.direction)} relation removed.`,
      });
      focusRelationCreate(relation.direction === 'parent' || relation.direction === 'sub_issue'
        ? 'hierarchy'
        : 'peer');
    },
    onError: async (_error, { relation }) => {
      const restored = await restoreAuthoritativeRelations();
      setRelationNotice({
        tone: 'error',
        message: restored
          ? 'Relation was not removed. Current server relations restored.'
          : 'Relation was not removed and current server relations could not be confirmed.',
      });
      focusRelationRemove(relation);
    },
  });
  const focusCommentControl = (commentId: string) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const detail = document.querySelector<HTMLElement>(`[data-issue-detail="${issueId}"]`);
    const target = detail?.querySelector<HTMLElement>(`[data-comment-edit="${commentId}"]:not([disabled])`)
      ?? detail?.querySelector<HTMLElement>(`[data-comment-archive="${commentId}"]:not([disabled])`)
      ?? detail?.querySelector<HTMLElement>('#comments-title');
    target?.focus();
  }));
  const focusCommentEditor = (commentId: string) => requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-comment-editor="${commentId}"] .rich-editor-content`)?.focus();
  }));
  const createComment = useMutation({
    mutationFn: () => api.createComment(workspaceId, issueId, {
      bodyDocument: detailDraft?.comment ?? emptyDocument,
    }),
    onMutate: () => {
      setCommentEditNotice(null);
    },
    onSuccess: async (created) => {
      client.setQueryData<Comment[]>(
        ['comments', workspaceId, issueId, true],
        (records) => records === undefined ? [created] : [...records, created],
      );
      onClearCommentDraft(issueId);
      setCommentEditorKey((value) => value + 1);
      setCommentEditNotice({
        tone: 'success',
        message: `Comment posted. Revision ${created.revision}.`,
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['comments', workspaceId, issueId] }),
        client.invalidateQueries({ queryKey: ['issue-activity', workspaceId, issueId] }),
      ]);
    },
  });
  const updateComment = useMutation({
    mutationFn: ({ commentId, input }: {
      commentId: string;
      input: UpdateCommentRequest;
      draft: IssueRichTextDocument;
    }) => api.updateComment(workspaceId, issueId, commentId, input),
    onMutate: () => {
      setCommentEditRecovery(null);
      setCommentEditNotice(null);
      setSuppressedCommentUpdateError(null);
    },
    onSuccess: async (updated, { commentId }) => {
      client.setQueryData<Comment[]>(
        ['comments', workspaceId, issueId, true],
        (records) => records?.map((record) => record.id === updated.id ? updated : record) ?? [updated],
      );
      setCommentEdit(null);
      setCommentEditRecovery(null);
      setSuppressedCommentUpdateError(null);
      setCommentEditNotice({
        tone: 'success',
        message: `Comment saved. Revision ${updated.revision}.`,
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['comments', workspaceId, issueId] }),
        client.invalidateQueries({ queryKey: ['issue-activity', workspaceId, issueId] }),
      ]);
      focusCommentControl(commentId);
    },
    onError: async (error, variables) => {
      try {
        const confirmedComments = await api.comments(workspaceId, issueId, true);
        const confirmed = confirmedComments.find((comment) => comment.id === variables.commentId);
        client.setQueryData(['comments', workspaceId, issueId, true], confirmedComments);
        if (confirmed === undefined) {
          setCommentEditNotice({
            tone: 'error',
            message: 'Comment was not saved. Your draft is retained, but the comment is no longer available from the server.',
          });
          return;
        }
        setSuppressedCommentUpdateError(error);
        setCommentEdit((active) => active?.commentId === variables.commentId ? {
          ...active,
          baseline: confirmed,
          draft: variables.draft,
          editorEpoch: active.editorEpoch + 1,
        } : active);
        setCommentEditRecovery({
          commentId: variables.commentId,
          confirmedRevision: confirmed.revision,
        });
        setCommentEditNotice({
          tone: 'error',
          message: confirmed.archivedAt === null
            ? `Comment was not saved. Server revision ${confirmed.revision} confirmed; your draft is retained.`
            : `Comment was not saved because server revision ${confirmed.revision} is archived; your draft is retained.`,
        });
      } catch {
        setCommentEditNotice({
          tone: 'error',
          message: 'Comment was not saved and the current server revision could not be confirmed. Your draft is retained.',
        });
        await client.invalidateQueries({ queryKey: ['comments', workspaceId, issueId] });
      }
    },
  });
  const setCommentArchive = useMutation({
    mutationFn: (comment: Comment) => comment.archivedAt === null
      ? api.archiveComment(workspaceId, issueId, comment.id, comment.revision)
      : api.restoreComment(workspaceId, issueId, comment.id, comment.revision),
    onMutate: () => {
      setCommentEditNotice(null);
    },
    onSuccess: async (updated) => {
      client.setQueryData<Comment[]>(
        ['comments', workspaceId, issueId, true],
        (records) => records?.map((record) => record.id === updated.id ? updated : record) ?? [updated],
      );
      setCommentEditNotice({
        tone: 'success',
        message: `${updated.archivedAt === null ? 'Comment restored' : 'Comment archived'}. Revision ${updated.revision}.`,
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['comments', workspaceId, issueId] }),
        client.invalidateQueries({ queryKey: ['issue-activity', workspaceId, issueId] }),
      ]);
      focusCommentControl(updated.id);
    },
    onError: async (_error, attempted) => {
      try {
        const confirmedComments = await api.comments(workspaceId, issueId, true);
        const confirmed = confirmedComments.find((comment) => comment.id === attempted.id);
        client.setQueryData(['comments', workspaceId, issueId, true], confirmedComments);
        setCommentEditNotice({
          tone: 'error',
          message: confirmed === undefined
            ? 'Comment archive state was not changed. Current server values were restored.'
            : `Comment archive state was not changed. Server revision ${confirmed.revision} was restored.`,
        });
      } catch {
        setCommentEditNotice({
          tone: 'error',
          message: 'Comment archive state was not changed and the server revision could not be confirmed.',
        });
        await client.invalidateQueries({ queryKey: ['comments', workspaceId, issueId] });
      }
    },
  });

  useEffect(() => {
    createComment.reset();
    updateComment.reset();
    setCommentArchive.reset();
    setCommentEdit(null);
    setCommentEditRecovery(null);
    setCommentEditNotice(null);
    setSuppressedCommentUpdateError(null);
    setEditRecovery(null);
    setSuppressedUpdateError(null);
    setIssuePropertyNotice(null);
    setResourceEditorIssueId(null);
    createRelation.reset();
    removeRelation.reset();
    setRelationCreateEpoch({ hierarchy: 0, peer: 0 });
    setRelationNotice(null);
    setArchiveNotice(null);
    setArchive.reset();
  }, [issueId]);
  useEffect(() => {
    if (canWriteIssues) return;
    setCommentEdit(null);
    setCommentEditRecovery(null);
    setCommentEditNotice(null);
    setSuppressedCommentUpdateError(null);
    setEditRecovery(null);
    setSuppressedUpdateError(null);
    setIssuePropertyNotice(null);
    setResourceEditorIssueId(null);
    setRelationNotice(null);
    setArchiveNotice(null);
  }, [canWriteIssues]);
  useEffect(() => {
    if (!canPurgeIssues) setPurgeOpen(false);
  }, [canPurgeIssues]);
  useEffect(() => {
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) onBack();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onBack]);
  useEffect(() => {
    if (issue.data === undefined || performance.getEntriesByName('basiclinear-issue-navigation-start', 'mark').length === 0) return;
    performance.mark('basiclinear-issue-navigation-end');
    const navigation = performance.measure(
      'basiclinear-issue-navigation',
      'basiclinear-issue-navigation-start',
      'basiclinear-issue-navigation-end',
    );
    document.documentElement.dataset.issueNavigationMs = navigation.duration.toFixed(2);
    performance.clearMarks('basiclinear-issue-navigation-start');
    performance.clearMarks('basiclinear-issue-navigation-end');
  }, [issue.data]);

  if (issue.isLoading) return <LoadingSkeleton variant="detail" panel={panel} label="Loading issue details" />;
  if (issueBlockingError !== null) return (
    <section className={`issue-detail ${panel ? 'issue-detail-panel-content' : ''}`} aria-label="Issue details">
      <button className={panel ? 'panel-close icon-button' : 'back-button'} aria-label={panel ? 'Close issue details' : undefined} title={panel ? 'Close issue details' : undefined} onClick={onBack}>{panel ? <X size={16} /> : <><ArrowLeft size={15} /> Issues</>}</button>
      <QueryErrorState
        title="Could not load this issue"
        error={issueBlockingError}
        retrying={issue.isFetching}
        onRetry={() => { void issue.refetch(); }}
      />
    </section>
  );
  const current = issue.data;
  if (!current) return null;
  const team = teams.find((item) => item.id === current.teamId);
  const groupedRelations = groupIssueRelations(relations.data ?? []);
  const storedResources = current.resources ?? [];
  const currentResources = issueResourceInputs(storedResources);
  const storedEditRecovery = editRecovery?.issueId === current.id ? editRecovery : null;
  const activeEditRecovery = storedEditRecovery?.phase === 'conflict'
    && current.revision > storedEditRecovery.confirmedRevision
    ? { ...storedEditRecovery, confirmedRevision: current.revision }
    : storedEditRecovery;
  const serverContentDraft = issueContentDraftFromIssue(current);
  const retainedContentDraft = detailDraft?.content !== undefined
    && issueContentDraftDirty(current, detailDraft.content)
    ? detailDraft.content
    : null;
  const editableContentDraft = activeEditRecovery?.phase === 'conflict'
    ? serverContentDraft
    : activeEditRecovery?.phase === 'reapplied'
      ? activeEditRecovery.draft
      : retainedContentDraft ?? serverContentDraft;
  const editableResources = editableContentDraft.resources;
  const resourceEditorResources = editableResources.length > 0
    ? editableResources
    : [{ label: '', url: '' }];
  const resourceEditing = canWriteIssues
    && resourceEditorIssueId === current.id
    && current.archivedAt === null
    && activeEditRecovery === null;
  const resourcesDirty = !issueResourcesEqual(editableResources, currentResources);
  const commentDocument = detailDraft?.comment ?? emptyDocument;
  const commentDraftRetained = issueCommentDraftHasContent(commentDocument);
  const issueContentFormKey = [
    current.id,
    current.revision,
    contentEditorEpoch,
    activeEditRecovery?.phase ?? 'server',
    activeEditRecovery?.phase === 'reapplied' ? activeEditRecovery.confirmedRevision : 0,
  ].join(':');
  const issueRevisionMutationPending = update.isPending || inlineUpdate.isPending || setArchive.isPending;
  const relationInteractionLocked = createRelation.isPending || removeRelation.isPending;
  const commentRevisionMutationPending = updateComment.isPending || setCommentArchive.isPending;
  const commentInteractionLocked = commentEdit !== null
    || commentRevisionMutationPending
    || createComment.isPending;
  const activeCommentRecovery = commentEditRecovery?.commentId === commentEdit?.commentId
    ? commentEditRecovery
    : null;
  const canManageCommentRecord = (comment: Comment) => canWriteIssues
    && current.archivedAt === null
    && (
      workspaceRole === 'owner'
      || workspaceRole === 'admin'
      || currentUserId === undefined
      || comment.author?.id === currentUserId
    );
  const canEditCommentRecord = (comment: Comment) => canManageCommentRecord(comment)
    && comment.archivedAt === null;
  const submitRelation = (section: 'hierarchy' | 'peer', draft: IssueRelationCreateDraft) => {
    if (!canWriteIssues || current.archivedAt !== null || relationInteractionLocked) return;
    const command = issueRelationCreateCommand(current, draft, issueOptions.data ?? []);
    if (command === null) {
      setRelationNotice({
        tone: 'error',
        message: 'Relation was not added because the selected issue or direction is no longer valid.',
      });
      focusRelationCreate(section);
      return;
    }
    createRelation.mutate({ command, section });
  };
  const beginCommentEdit = (comment: Comment) => {
    if (commentInteractionLocked || !canEditCommentRecord(comment)) return;
    updateComment.reset();
    setSuppressedCommentUpdateError(null);
    setCommentEditRecovery(null);
    setCommentEditNotice(null);
    setCommentEdit({
      commentId: comment.id,
      baseline: comment,
      draft: commentEditDraft(comment),
      editorEpoch: 0,
    });
    focusCommentEditor(comment.id);
  };
  const cancelCommentEdit = () => {
    const commentId = commentEdit?.commentId;
    updateComment.reset();
    setCommentEdit(null);
    setCommentEditRecovery(null);
    setCommentEditNotice(null);
    setSuppressedCommentUpdateError(null);
    if (commentId !== undefined) focusCommentControl(commentId);
  };
  const submitCommentEdit = () => {
    if (commentEdit === null || commentRevisionMutationPending) return;
    const input = commentEditRequest(commentEdit.baseline, commentEdit.draft);
    if (input === null) {
      setCommentEditNotice({
        tone: 'error',
        message: commentEdit.baseline.archivedAt === null
          ? 'Comment was not saved because the draft is empty, invalid, or unchanged.'
          : 'Comment was not saved because the confirmed server value is archived.',
      });
      return;
    }
    updateComment.mutate({
      commentId: commentEdit.commentId,
      input,
      draft: commentEditDraft({ ...commentEdit.baseline, bodyDocument: input.bodyDocument }),
    });
  };
  const useCommentServerValues = () => {
    if (commentEdit === null || commentRevisionMutationPending) return;
    const { commentId, baseline } = commentEdit;
    updateComment.reset();
    setSuppressedCommentUpdateError(null);
    setCommentEditRecovery(null);
    if (baseline.archivedAt !== null) {
      setCommentEdit(null);
      setCommentEditNotice({
        tone: 'success',
        message: `Server values restored at revision ${baseline.revision}. Restore the comment before editing it.`,
      });
      focusCommentControl(commentId);
      return;
    }
    setCommentEdit({
      ...commentEdit,
      draft: commentEditDraft(baseline),
      editorEpoch: commentEdit.editorEpoch + 1,
    });
    setCommentEditNotice({
      tone: 'success',
      message: `Server values restored at revision ${baseline.revision}.`,
    });
    focusCommentEditor(commentId);
  };
  const submitInlineProperty = (label: string, change: IssueInlinePropertyChange) => {
    if (issueRevisionMutationPending || activeEditRecovery !== null) return;
    const input = issueInlinePropertyRequest(current, change, {
      statuses,
      members,
      projects,
      milestones: issueMilestones.data ?? [],
      labels,
    });
    if (input === null) {
      setIssuePropertyNotice({
        tone: 'error',
        message: `${label} was not applied because the selected value is unchanged or unavailable.`,
      });
      return;
    }
    inlineUpdate.mutate({ label, input });
  };
  const focusIssueEditor = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    const detail = document.querySelector<HTMLElement>(`[data-issue-detail="${current.id}"]`);
    const target = detail?.querySelector<HTMLElement>('[data-issue-title-editor]:not([disabled])')
      ?? detail?.querySelector<HTMLElement>('[data-issue-archive-action]:not([disabled])')
      ?? detail?.querySelector<HTMLElement>('.back-button, .panel-close');
    target?.focus();
  }));
  const discardRetainedContent = () => {
    update.reset();
    setEditRecovery(null);
    setSuppressedUpdateError(null);
    setResourceEditorIssueId(null);
    setContentEditorEpoch((value) => value + 1);
    onClearContentDraft(current.id);
    focusIssueEditor();
  };
  const discardRetainedComment = () => {
    createComment.reset();
    onClearCommentDraft(current.id);
    setCommentEditorKey((value) => value + 1);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-issue-detail="${current.id}"] .comment-create .rich-editor-content`)?.focus();
    }));
  };
  return (
    <section className={`issue-detail ${panel ? 'issue-detail-panel-content' : ''}`} data-issue-detail={current.id} aria-label={`Issue ${current.identifier}`}>
      {!panel ? <h1 className="sr-only">{current.title}</h1> : null}
      <button className={panel ? 'panel-close icon-button' : 'back-button'} aria-label={panel ? 'Close issue details' : undefined} title={panel ? 'Close issue details' : undefined} onClick={onBack}>{panel ? <X size={16} /> : <><ArrowLeft size={15} /> Issues</>}</button>
      <header className="issue-detail-header">
        <div><span className="issue-identifier"><span className="team-icon">{team?.key.slice(0, 1) ?? 'I'}</span>{current.identifier}</span><span className="revision-label">Revision {current.revision}</span></div>
        <div className="issue-detail-actions">
          <button className="button" data-issue-archive-action onClick={() => setArchive.mutate({ current, source: 'direct' })} disabled={!canWriteIssues || issueRevisionMutationPending || commentInteractionLocked || relationInteractionLocked}>{current.archivedAt === null ? <Archive size={14} /> : <RefreshCcw size={14} />}{current.archivedAt === null ? 'Archive' : 'Restore'}</button>
          {canPurgeIssues && current.archivedAt !== null ? <button className="icon-button danger" aria-label={`Purge ${current.identifier}`} title="Purge issue" onClick={() => setPurgeOpen(true)}><Trash2 size={15} /></button> : null}
        </div>
      </header>
      <ErrorNotice error={issue.error} />
      {archiveNotice !== null ? (
        <ArchiveActionNotice
          message={archiveNotice.message}
          tone={archiveNotice.tone}
          undoAvailable={archiveNotice.undoTarget !== null}
          pending={setArchive.isPending && setArchive.variables?.source === 'undo'}
          undoLabel={archiveNotice.undoTarget === null
            ? 'Undo archive'
            : `Undo archive for ${archiveNotice.undoTarget.identifier}`}
          undoButtonRef={archiveUndoButtonRef}
          onUndo={() => {
            if (archiveNotice.undoTarget !== null) {
              setArchive.mutate({ current: archiveNotice.undoTarget, source: 'undo' });
            }
          }}
          onDismiss={() => {
            setArchiveNotice(null);
            focusArchiveAction();
          }}
        />
      ) : null}
      {current.archivedAt !== null ? <div className="archive-banner"><Archive size={15} />Archived {new Date(current.archivedAt).toLocaleString()}. Restore to edit or comment.</div> : null}
      <ErrorNotice error={setArchive.variables?.source === 'undo' ? null : setArchive.error} />
      {activeEditRecovery ? (
        <div
          className={`issue-conflict-banner ${activeEditRecovery.phase === 'reapplied' ? 'draft-reapplied' : ''}`}
          role={activeEditRecovery.phase === 'conflict' ? 'alert' : 'status'}
          aria-live={activeEditRecovery.phase === 'conflict' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          <AlertCircle size={17} aria-hidden="true" />
          <div className="issue-conflict-copy">
            <strong>{activeEditRecovery.phase === 'conflict' ? 'Issue changed' : 'Draft ready for review'}</strong>
            <p>{issueEditRecoveryMessage(current.identifier, activeEditRecovery)}</p>
          </div>
          <div className="issue-conflict-actions">
            {activeEditRecovery.phase === 'conflict' ? (
              <button
                type="button"
                className="button"
                onClick={() => {
                  const reapplied = reapplyIssueEditDraft(activeEditRecovery);
                  setEditRecovery({ ...reapplied, issueId: current.id });
                  onContentDraftChange(current, reapplied.draft);
                  focusIssueEditor();
                }}
                disabled={!canWriteIssues || current.archivedAt !== null}
              ><RefreshCcw size={14} /> Reapply draft</button>
            ) : null}
            <button
              type="button"
              className="button"
              onClick={discardRetainedContent}
            >{activeEditRecovery.phase === 'conflict' ? 'Discard draft' : 'Use server values'}</button>
          </div>
        </div>
      ) : null}
      {activeEditRecovery === null && (retainedContentDraft !== null || commentDraftRetained) ? (
        <div className="issue-draft-banner" role="status" aria-live="polite" aria-atomic="true">
          <Pencil size={16} aria-hidden="true" />
          <div className="issue-draft-copy">
            <strong>Unsaved draft retained</strong>
            <p>{retainedContentDraft !== null && commentDraftRetained
              ? `Issue content and a new comment stay with ${current.identifier} while you navigate.`
              : retainedContentDraft !== null
                ? `Issue content stays with ${current.identifier} while you navigate.`
                : `A new comment stays with ${current.identifier} while you navigate.`}</p>
          </div>
          <div className="issue-draft-actions">
            {retainedContentDraft !== null ? <button type="button" className="button" onClick={discardRetainedContent} disabled={update.isPending}>Discard content</button> : null}
            {commentDraftRetained ? <button type="button" className="button" onClick={discardRetainedComment} disabled={createComment.isPending}>Discard comment</button> : null}
          </div>
        </div>
      ) : null}
      <div className="issue-edit-form" data-issue-edit-surface={current.id}>
        <IssueContentForm
          key={issueContentFormKey}
          issue={current}
          canWrite={canWriteIssues}
          {...(activeEditRecovery?.phase === 'reapplied' ? { draft: activeEditRecovery.draft } : {})}
          {...(activeEditRecovery?.phase !== 'reapplied' ? { draft: editableContentDraft } : {})}
          pending={update.isPending}
          locked={issueRevisionMutationPending || activeEditRecovery?.phase === 'conflict'}
          error={update.error === suppressedUpdateError ? null : update.error}
          onChange={(draft) => onContentDraftChange(current, draft)}
          onSubmit={(input) => update.mutate(input)}
        />
        <IssuePropertiesEditor
          issue={current}
          statuses={statuses}
          members={members}
          ownerMode={ownerMode}
          ownerDisplayName={ownerDisplayName}
          projects={projects}
          milestones={issueMilestones.data ?? []}
          labels={labels}
          canWrite={canWriteIssues}
          locked={issueRevisionMutationPending || activeEditRecovery !== null}
          milestoneLoading={issueMilestones.isLoading}
          milestoneError={issueMilestonesBlockingError}
          milestoneRetrying={issueMilestones.isFetching}
          pendingLabel={inlineUpdate.isPending ? inlineUpdate.variables?.label ?? 'Property' : null}
          notice={issuePropertyNotice}
          error={inlineUpdate.error ?? (issueMilestones.data === undefined ? null : issueMilestones.error)}
          onRetryMilestones={() => { void issueMilestones.refetch(); }}
          onChange={submitInlineProperty}
        />
      </div>

      <ErrorNotice error={(relations.data === undefined ? null : relations.error) ?? (issueOptions.data === undefined ? null : issueOptions.error)} />
      <div
        className={`relation-feedback ${relationInteractionLocked ? 'pending' : relationNotice?.tone ?? 'idle'}`}
        role={relationNotice?.tone === 'error' ? 'alert' : 'status'}
        aria-live={relationNotice?.tone === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
      >
        {relationInteractionLocked ? <><Spinner />Updating relations...</> : relationNotice?.message ?? <span aria-hidden="true">&nbsp;</span>}
      </div>
      <div className="issue-secondary-grid">
        {relationBlockingError !== null ? (
          <div className="issue-secondary-query-error">
            <QueryErrorState
              compact
              title="Could not load issue relationships"
              error={relationBlockingError}
              retrying={relations.isFetching || issueOptions.isFetching}
              onRetry={retryFailedRelationReads}
            />
          </div>
        ) : <>
          <IssueRelationSection hierarchy loading={relations.isLoading} relations={groupedRelations.hierarchy} onOpenIssue={onOpenIssue} onRemove={(relation) => removeRelation.mutate({ relation })} removeDisabled={!canWriteIssues || current.archivedAt !== null || relationInteractionLocked || issueRevisionMutationPending}>
            {canWriteIssues && current.archivedAt === null ? <IssueRelationCreateForm key={`hierarchy-${current.id}-${relationCreateEpoch.hierarchy}`} section="hierarchy" issue={current} issues={issueOptions.data ?? []} pending={relationInteractionLocked || issueRevisionMutationPending} loading={issueOptions.isLoading} onSubmit={(draft) => submitRelation('hierarchy', draft)} /> : null}
          </IssueRelationSection>

          <IssueRelationSection loading={relations.isLoading} relations={groupedRelations.peers} onOpenIssue={onOpenIssue} onRemove={(relation) => removeRelation.mutate({ relation })} removeDisabled={!canWriteIssues || current.archivedAt !== null || relationInteractionLocked || issueRevisionMutationPending}>
            {canWriteIssues && current.archivedAt === null ? <IssueRelationCreateForm key={`peer-${current.id}-${relationCreateEpoch.peer}`} section="peer" issue={current} issues={issueOptions.data ?? []} pending={relationInteractionLocked || issueRevisionMutationPending} loading={issueOptions.isLoading} onSubmit={(draft) => submitRelation('peer', draft)} /> : null}
          </IssueRelationSection>
        </>}

        <section className="issue-secondary-section issue-resource-section" aria-labelledby="issue-resources-title">
          <header>
            <div><Link2 size={15} /><h2 id="issue-resources-title">Resources</h2><span>{resourceEditing ? editableResources.length : storedResources.length}</span></div>
            {canWriteIssues && current.archivedAt === null ? <button type="button" className="icon-button" aria-label={storedResources.length > 0 ? 'Edit issue resources' : 'Add issue resource'} title={storedResources.length > 0 ? 'Edit resources' : 'Add resource'} onClick={() => setResourceEditorIssueId(current.id)} disabled={issueRevisionMutationPending || activeEditRecovery !== null}>{storedResources.length > 0 ? <Pencil size={14} /> : <Plus size={14} />}</button> : null}
          </header>
          {resourceEditing ? <>
            <IssueResourceEditor resources={resourceEditorResources} onChange={(resources) => onContentDraftChange(current, { ...editableContentDraft, resources })} hideLegend />
            <div className="issue-resource-actions">
              <button type="button" className="button" onClick={() => {
                setResourceEditorIssueId(null);
                onContentDraftChange(current, { ...editableContentDraft, resources: currentResources });
              }}>Cancel</button>
              <button type="submit" className="button primary" form={`issue-edit-form-${current.id}`} disabled={!resourcesDirty || issueRevisionMutationPending}>{update.isPending ? <Spinner /> : <Save size={14} />}Save resources</button>
            </div>
          </> : storedResources.length > 0 ? <ul className="issue-resource-list">{storedResources.map((resource) => <li key={resource.id}><Link2 size={14} /><a href={resource.url} target="_blank" rel="noreferrer">{resource.label}<ExternalLink size={12} /></a></li>)}</ul> : <p className="muted-copy">No resources</p>}
        </section>

        <section className="issue-secondary-section" aria-labelledby="comments-title">
          <header><div><MessageSquare size={15} /><h2 id="comments-title">Comments</h2>{comments.isLoading ? <span className="skeleton-block skeleton-inline-count" aria-hidden="true" /> : commentsBlockingError !== null ? <span className="skeleton-block skeleton-inline-count" aria-hidden="true" /> : <span>{comments.data?.filter((comment) => comment.archivedAt === null).length ?? 0}</span>}</div></header>
          <div
            className={`comment-edit-feedback ${commentEditNotice?.tone ?? ''}`}
            role={commentEditNotice?.tone === 'error' ? 'alert' : 'status'}
            aria-live={commentEditNotice?.tone === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            {commentRevisionMutationPending || createComment.isPending ? <><Spinner />Saving comment...</> : commentEditNotice ? <>{commentEditNotice.tone === 'error' ? <AlertCircle size={14} /> : <CircleDot size={14} />}{commentEditNotice.message}</> : null}
          </div>
          <ErrorNotice error={createComment.error ?? (comments.data === undefined ? null : comments.error)} />
          {commentsBlockingError !== null ? (
            <QueryErrorState
              compact
              title="Could not load issue comments"
              error={commentsBlockingError}
              retrying={comments.isFetching}
              onRetry={() => { void comments.refetch(); }}
            />
          ) : comments.isLoading ? <LoadingSkeleton variant="comments" label="Loading issue comments" /> : comments.data?.length ? (
            <ol className="comment-list">
              {comments.data.map((comment) => {
                const activeEdit = commentEdit?.commentId === comment.id ? commentEdit : null;
                return (
                  <li key={comment.id} data-comment-id={comment.id} className={comment.archivedAt === null ? '' : 'archived'}>
                    <header>
                      <span className="avatar">{comment.author?.displayName.slice(0, 1).toUpperCase() ?? '?'}</span>
                      <strong>{comment.author?.displayName ?? 'Former member'}</strong>
                      <time>{new Date(comment.createdAt).toLocaleString()}</time>
                      <button
                        type="button"
                        className="icon-button"
                        data-comment-edit={comment.id}
                        aria-label={`Edit comment by ${comment.author?.displayName ?? 'former member'}`}
                        title="Edit comment"
                        onClick={() => beginCommentEdit(comment)}
                        disabled={!canEditCommentRecord(comment) || commentInteractionLocked}
                      ><Pencil size={13} /></button>
                      <button
                        type="button"
                        className="icon-button"
                        data-comment-archive={comment.id}
                        aria-label={comment.archivedAt === null ? 'Archive comment' : 'Restore comment'}
                        title={comment.archivedAt === null ? 'Archive comment' : 'Restore comment'}
                        onClick={() => setCommentArchive.mutate(comment)}
                        disabled={!canManageCommentRecord(comment) || commentInteractionLocked}
                      >{comment.archivedAt === null ? <Archive size={13} /> : <RefreshCcw size={13} />}</button>
                    </header>
                    {activeEdit === null ? <RichTextView document={comment.bodyDocument} empty="Empty comment" /> : (
                      <div data-comment-editor={comment.id}>
                        <InlineCommentEditForm
                          edit={activeEdit}
                          recovery={activeCommentRecovery}
                          pending={updateComment.isPending}
                          error={updateComment.error === suppressedCommentUpdateError ? null : updateComment.error}
                          onChange={(draft) => setCommentEdit((currentEdit) => currentEdit?.commentId === comment.id
                            ? { ...currentEdit, draft }
                            : currentEdit)}
                          onSubmit={submitCommentEdit}
                          onCancel={cancelCommentEdit}
                          onRetry={submitCommentEdit}
                          onUseServerValues={useCommentServerValues}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : <p className="muted-copy">No comments</p>}
          {canWriteIssues && current.archivedAt === null ? <form className="comment-create" data-comment-draft={current.id} hidden={commentsBlockingError !== null} onSubmit={(event) => { event.preventDefault(); if (!commentInteractionLocked && commentDraftRetained) createComment.mutate(); }}><RichTextEditor key={`${current.id}:${commentEditorKey}`} initial={commentDocument} onChange={(document) => onCommentDraftChange(current.id, document)} label="New comment" disabled={commentInteractionLocked} /><button className="button primary" disabled={createComment.isPending || commentInteractionLocked || !commentDraftRetained}>{createComment.isPending ? <Spinner /> : <MessageSquare size={14} />}Comment</button></form> : null}
        </section>
      </div>

      <section className="activity-section issue-activity" aria-labelledby="issue-activity-title">
        <h2 id="issue-activity-title">Activity</h2>
        {activityBlockingError !== null ? (
          <QueryErrorState
            title="Could not load issue activity"
            error={activityBlockingError}
            retrying={activity.isFetching}
            onRetry={() => { void activity.refetch(); }}
          />
        ) : <>
          <ErrorNotice error={activity.error} />
          {activity.isLoading ? <LoadingSkeleton variant="activity" label="Loading issue activity" /> : <ActivityList entries={activity.data ?? []} members={members} statuses={statuses} projects={projects} milestones={issueMilestones.data ?? []} labels={labels} issues={[current, ...(issueOptions.data ?? []).filter((option) => option.id !== current.id)]} />}
        </>}
      </section>

      <Dialog title={`Purge ${current.identifier}`} open={purgeOpen && canPurgeIssues} onClose={() => setPurgeOpen(false)}>
        <form className="dialog-form purge-form" onSubmit={(event) => {
          event.preventDefault();
          purge.mutate({ current, confirmation: String(new FormData(event.currentTarget).get('confirmation')) });
        }}><p>This permanently removes the issue, its comments, and relations. Type <strong>{current.identifier}</strong> to continue.</p><Field label="Confirmation" name="confirmation" autoComplete="off" /><ErrorNotice error={purge.error} /><button className="button danger-button" disabled={purge.isPending}>{purge.isPending ? <Spinner /> : <Trash2 size={14} />}Purge issue</button></form>
      </Dialog>
    </section>
  );
}

function cloneIssueViewState(state: IssueViewState): IssueViewState {
  return normalizeIssueViewConfiguration(JSON.parse(JSON.stringify(state)) as IssueViewState);
}

function issueViewStateFromUrl(base: IssueViewState): {
  state: IssueViewState;
  invalidFilter: string | null;
} {
  const params = new URLSearchParams(window.location.search);
  const next = cloneIssueViewState(base);
  const layout = params.get('layout');
  const groupBy = params.get('group');
  const order = params.get('order');
  const direction = params.get('direction');
  const density = params.get('density');
  const archiveState = params.get('archive');
  if (layout === 'list' || layout === 'board') next.layout = layout;
  if (['none', 'status', 'priority', 'assignee', 'project', 'milestone'].includes(groupBy ?? '')) {
    next.groupBy = groupBy as IssueViewGrouping;
  }
  if (['updatedAt', 'identifier', 'priority', 'dueDate'].includes(order ?? '')) {
    next.order.field = order as IssueViewOrderField;
  }
  if (direction === 'asc' || direction === 'desc') next.order.direction = direction;
  if (density === 'compact' || density === 'default' || density === 'comfortable') next.density = density;
  if (archiveState === 'active' || archiveState === 'archived' || archiveState === 'all') {
    next.archiveState = archiveState;
  }
  next.searchQuery = (params.get('q') ?? '').slice(0, 200);
  next.visibleProperties = issueViewPropertiesFromParam(
    params.get('properties'),
    next.visibleProperties,
  );
  next.collapsedGroups = collapsedIssueGroupsFromParam(params.get('collapsed'), next.groupBy);
  const restoredFilter = parseIssueUrlFilter(params.get('filter'));
  if (restoredFilter.filter !== null) next.filter = restoredFilter.filter;
  return { state: next, invalidFilter: restoredFilter.invalidClause };
}

function writeIssueUrl(
  state: IssueViewState,
  selectedIssueId: string | null,
  savedViewId: string | null,
  detailMode: IssueDetailMode | null,
  mode: 'push' | 'replace',
  routeView: IssueWorkspaceView,
) {
  const url = new URL(window.location.href);
  url.searchParams.set('view', routeView);
  url.searchParams.set('layout', state.layout);
  url.searchParams.set('group', state.groupBy);
  url.searchParams.set('order', state.order.field);
  url.searchParams.set('direction', state.order.direction);
  url.searchParams.set('density', state.density);
  url.searchParams.set('archive', state.archiveState);
  url.searchParams.set('properties', issueViewPropertiesParam(state.visibleProperties));
  const assignOptional = (name: string, value: string) => {
    if (value === '') url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  };
  assignOptional('q', state.searchQuery);
  assignOptional('collapsed', collapsedIssueGroupsParam(state.collapsedGroups, state.groupBy));
  assignOptional(
    'filter',
    state.filter.root.type === 'group' && state.filter.root.children.length > 0
      ? JSON.stringify(state.filter)
      : '',
  );
  assignOptional('issue', selectedIssueId ?? '');
  assignOptional('saved', savedViewId ?? '');
  const historyState = issueRouteHistoryState(window.history.state, selectedIssueId, detailMode);
  if (mode === 'push') window.history.pushState(historyState, '', url);
  else window.history.replaceState(historyState, '', url);
}

const filterFields: Array<{ value: IssueFilterField; label: string }> = [
  { value: 'teamId', label: 'Team' },
  { value: 'statusId', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assigneeUserId', label: 'Assignee' },
  { value: 'projectId', label: 'Project' },
  { value: 'milestoneId', label: 'Milestone' },
  { value: 'labelId', label: 'Label' },
  { value: 'dueDate', label: 'Due date' },
];

function operatorsFor(field: IssueFilterField): Array<{ value: IssueFilterOperator; label: string }> {
  if (field === 'dueDate') return [
    { value: 'is', label: 'is' }, { value: 'isNot', label: 'is not' },
    { value: 'before', label: 'before' }, { value: 'after', label: 'after' },
    { value: 'isEmpty', label: 'is empty' }, { value: 'isNotEmpty', label: 'is not empty' },
  ];
  if (field === 'priority') return [
    { value: 'is', label: 'is' }, { value: 'isNot', label: 'is not' },
    { value: 'in', label: 'is any of' }, { value: 'notIn', label: 'is not any of' },
  ];
  return [
    { value: 'is', label: 'is' }, { value: 'isNot', label: 'is not' },
    { value: 'isEmpty', label: 'is empty' }, { value: 'isNotEmpty', label: 'is not empty' },
  ];
}

function FilterBuilder({
  state,
  teams,
  statuses,
  members,
  projects,
  milestones,
  labels,
  excludedFields = [],
  onApply,
}: {
  state: IssueViewState;
  teams: Team[];
  statuses: WorkflowStatus[];
  members: Membership[];
  projects: Project[];
  milestones: Milestone[];
  labels: Label[];
  excludedFields?: readonly IssueFilterField[];
  onApply: (filter: IssueViewState['filter']) => void;
}) {
  const availableFilterFields = filterFields.filter((field) => !excludedFields.includes(field.value));
  const root = state.filter.root.type === 'group'
    ? state.filter.root
    : { type: 'group' as const, operator: 'and' as const, children: [] };
  const [join, setJoin] = useState<'and' | 'or'>(root.operator);
  const [conditions, setConditions] = useState<IssueFilterCondition[]>(
    root.children.filter((node): node is IssueFilterCondition => node.type === 'condition'),
  );
  const optionsFor = (field: IssueFilterField): Array<{ value: string; label: string }> => {
    if (field === 'teamId') return teams.map((team) => ({ value: team.id, label: team.name }));
    if (field === 'statusId') return statuses.map((status) => ({
      value: status.id,
      label: issueStatusLabel(status, statuses, teams),
    }));
    if (field === 'assigneeUserId') return members.map((member) => ({ value: member.userId, label: member.displayName }));
    if (field === 'projectId') return projects.filter((project) => project.archivedAt === null).map((project) => ({ value: project.id, label: project.name }));
    if (field === 'milestoneId') return milestoneViewOptions(milestones, projects).map((milestone) => ({ value: milestone.value, label: milestone.label }));
    if (field === 'labelId') return labels.filter((label) => label.archivedAt === null).map((label) => ({ value: label.id, label: label.name }));
    if (field === 'priority') return ['urgent', 'high', 'medium', 'low', 'none'].map((priority) => ({ value: priority, label: priority === 'none' ? 'No priority' : titleCase(priority) }));
    return [];
  };
  const defaultValue = (field: IssueFilterField): string => optionsFor(field)[0]?.value
    ?? (field === 'dueDate' ? new Date().toISOString().slice(0, 10) : '');
  const update = (index: number, condition: IssueFilterCondition) => {
    setConditions((current) => current.map((item, itemIndex) => itemIndex === index ? condition : item));
  };
  return (
    <form className="dialog-form filter-builder" onSubmit={(event) => {
      event.preventDefault();
      onApply({ version: 1, root: { type: 'group', operator: join, children: conditions } });
    }}>
      <div className="filter-join" role="group" aria-label="Filter logic">
        <span>Match</span>
        <button type="button" className={join === 'and' ? 'active' : ''} aria-pressed={join === 'and'} onClick={() => setJoin('and')}>all</button>
        <button type="button" className={join === 'or' ? 'active' : ''} aria-pressed={join === 'or'} onClick={() => setJoin('or')}>any</button>
      </div>
      <div className="filter-condition-list">
        {conditions.map((condition, index) => {
          const empty = condition.operator === 'isEmpty' || condition.operator === 'isNotEmpty';
          const value = Array.isArray(condition.value) ? condition.value[0] ?? '' : condition.value ?? '';
          return (
            <div className="filter-condition" key={`${condition.field}-${index}`}>
              <select aria-label={`Filter ${index + 1} field`} value={condition.field} onChange={(event) => {
                const field = event.target.value as IssueFilterField;
                update(index, { type: 'condition', field, operator: 'is', value: defaultValue(field) });
              }}>{availableFilterFields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}</select>
              <select aria-label={`Filter ${index + 1} operator`} value={condition.operator} onChange={(event) => {
                const operator = event.target.value as IssueFilterOperator;
                update(index, {
                  ...condition,
                  operator,
                  value: operator === 'isEmpty' || operator === 'isNotEmpty'
                    ? null
                    : operator === 'in' || operator === 'notIn'
                      ? [String(value || defaultValue(condition.field))]
                      : String(value || defaultValue(condition.field)),
                });
              }}>{operatorsFor(condition.field).map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}</select>
              {empty ? <span className="filter-empty-value" /> : condition.field === 'dueDate' ? (
                <input aria-label={`Filter ${index + 1} value`} type="date" value={String(value)} onChange={(event) => update(index, { ...condition, value: event.target.value })} />
              ) : (
                <select aria-label={`Filter ${index + 1} value`} value={String(value)} onChange={(event) => update(index, {
                  ...condition,
                  value: condition.operator === 'in' || condition.operator === 'notIn'
                    ? [event.target.value]
                    : event.target.value,
                })}>{optionsFor(condition.field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              )}
              <button type="button" className="icon-button" aria-label={`Remove filter ${index + 1}`} title="Remove filter" onClick={() => setConditions((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button>
            </div>
          );
        })}
      </div>
      <button type="button" className="button filter-add" onClick={() => {
        const preferredField: IssueFilterField = statuses.length > 0 ? 'statusId' : 'priority';
        const field = availableFilterFields.some((candidate) => candidate.value === preferredField)
          ? preferredField
          : availableFilterFields[0]?.value;
        if (field === undefined) return;
        setConditions((current) => [...current, {
          type: 'condition', field, operator: 'is', value: defaultValue(field),
        }]);
      }}><Plus size={14} /> Add filter</button>
      <div className="filter-actions">
        <button type="button" className="button" onClick={() => { setConditions([]); onApply({ version: 1, root: { type: 'group', operator: 'and', children: [] } }); }}>Clear</button>
        <button className="button primary"><Filter size={14} />Apply</button>
      </div>
    </form>
  );
}

export function IssuesView({
  workspaceId,
  workspaceRole,
  teams,
  statuses,
  members,
  currentUserId,
  routeView = 'issues',
  viewTitle = 'Issues',
  systemTeam,
  systemAssignee,
  ownerMode = false,
  contextProject,
  contextMilestone,
  contextMilestones,
  onClearContextMilestone,
  embedded = false,
  createSignal = 0,
  openIssueId,
  openIssueSignal = 0,
  onOpenIssueHandled,
}: {
  workspaceId: string;
  workspaceRole: Workspace['role'];
  teams: Team[];
  statuses: WorkflowStatus[];
  members: Membership[];
  currentUserId?: string;
  routeView?: IssueWorkspaceView;
  viewTitle?: string;
  systemTeam?: Pick<Team, 'id' | 'name'>;
  systemAssignee?: { userId: string; displayName: string };
  ownerMode?: boolean;
  contextProject?: Project;
  contextMilestone?: Pick<Milestone, 'id' | 'name'>;
  contextMilestones?: Milestone[];
  onClearContextMilestone?: () => void;
  embedded?: boolean;
  createSignal?: number;
  openIssueId?: string | null;
  openIssueSignal?: number;
  onOpenIssueHandled?: () => void;
}) {
  const client = useQueryClient();
  const canWrite = hasCapability(workspaceRole, 'issue:write')
    && (contextProject?.archivedAt ?? null) === null;
  const enforceOwnerViewBoundary = useCallback((state: IssueViewState) =>
    ownerMode ? ownerIssueViewConfiguration(state) : state, [ownerMode]);
  const baseState = useMemo(() => cloneIssueViewState(initialIssueViewState), []);
  const systemTeamId = systemTeam?.id;
  const systemAssigneeUserId = systemAssignee?.userId;
  const initialCreateAssigneeUserId = ownerMode ? currentUserId : systemAssigneeUserId;
  const scopedTeams = useMemo(
    () => systemTeamId === undefined ? teams : teams.filter((team) => team.id === systemTeamId),
    [systemTeamId, teams],
  );
  const scopedStatuses = useMemo(
    () => systemTeamId === undefined ? statuses : statuses.filter((status) => status.teamId === systemTeamId),
    [systemTeamId, statuses],
  );
  const systemScope = useMemo<IssueQueryScope>(() => ({
    ...(systemTeamId === undefined ? {} : { teamId: systemTeamId }),
    ...(systemAssigneeUserId === undefined ? {} : { assigneeUserId: systemAssigneeUserId }),
  }), [systemTeamId, systemAssigneeUserId]);
  const restoredUrlState = useMemo(() => {
    const restored = embedded
      ? { state: baseState, invalidFilter: null }
      : issueViewStateFromUrl(baseState);
    return {
      ...restored,
      state: enforceOwnerViewBoundary(withoutIssueQueryScope(restored.state, systemScope)),
    };
  }, [embedded, baseState, systemScope, enforceOwnerViewBoundary]);
  const initialIssueRoute = useMemo(() => embedded
    ? { issueId: null, detailMode: null }
    : readIssueRoute(window.location.search, window.history.state), [embedded]);
  const [viewState, setViewState] = useState<IssueViewState>(() => restoredUrlState.state);
  const [invalidUrlFilter, setInvalidUrlFilter] = useState<string | null>(() =>
    restoredUrlState.invalidFilter);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(() => initialIssueRoute.issueId);
  const [detailMode, setDetailMode] = useState<IssueDetailMode | null>(() => initialIssueRoute.detailMode);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [currentSavedViewId, setCurrentSavedViewId] = useState<string | null>(() =>
    embedded || systemAssignee !== undefined
      ? null
      : new URLSearchParams(window.location.search).get('saved'));
  const [createOpen, setCreateOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(viewState.searchQuery);
  const [bulkDraft, setBulkDraft] = useState<IssueBulkDraft>(emptyIssueBulkDraft);
  const [bulkLabelOperation, setBulkLabelOperation] = useState<IssueBulkLabelOperation>('add');
  const [bulkLabelIds, setBulkLabelIds] = useState<string[]>([]);
  const [bulkResult, setBulkResult] = useState<BulkIssueMutationResult[] | null>(null);
  const [actionMenu, setActionMenu] = useState<IssueActionMenuState | null>(null);
  const [quickEditIssue, setQuickEditIssue] = useState<Issue | null>(null);
  const [issueActionAnnouncement, setIssueActionAnnouncement] = useState('');
  const [rowArchiveNotice, setRowArchiveNotice] = useState<ArchiveNotice<RowIssueArchiveTarget> | null>(null);
  const [boardFocusIssueId, setBoardFocusIssueId] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(() => readIssuePanelWidth(localStorage));
  const [issueDetailDraftStore, setIssueDetailDraftStore] = useState<{
    workspaceId: string;
    drafts: IssueDetailDraftRegistry;
  }>(() => ({ workspaceId, drafts: {} }));
  const issueDetailDrafts = issueDetailDraftStore.workspaceId === workspaceId
    ? issueDetailDraftStore.drafts
    : {};
  const searchRef = useRef<HTMLInputElement>(null);
  const rowArchiveUndoButtonRef = useRef<HTMLButtonElement>(null);
  const focusReturnIssueId = useRef<string | null>(null);
  const pushedIssueEntry = useRef(false);
  const initialSavedViewApplied = useRef(false);
  const handledOpenIssueSignal = useRef(0);
  const handledCreateSignal = useRef(0);
  const panelResizeCleanupRef = useRef<(() => void) | null>(null);
  const retainContentDraft = useCallback((issue: Issue, draft: IssueContentDraft) => {
    setIssueDetailDraftStore((current) => {
      const drafts = current.workspaceId === workspaceId ? current.drafts : {};
      return { workspaceId, drafts: retainIssueContentDraft(drafts, issue, draft) };
    });
  }, [workspaceId]);
  const retainCommentDraft = useCallback((issueId: string, draft: IssueRichTextDocument) => {
    setIssueDetailDraftStore((current) => {
      const drafts = current.workspaceId === workspaceId ? current.drafts : {};
      return { workspaceId, drafts: retainIssueCommentDraft(drafts, issueId, draft) };
    });
  }, [workspaceId]);
  const discardContentDraft = useCallback((issueId: string) => {
    setIssueDetailDraftStore((current) => current.workspaceId === workspaceId
      ? { ...current, drafts: clearIssueContentDraft(current.drafts, issueId) }
      : current);
  }, [workspaceId]);
  const discardCommentDraft = useCallback((issueId: string) => {
    setIssueDetailDraftStore((current) => current.workspaceId === workspaceId
      ? { ...current, drafts: clearIssueCommentDraft(current.drafts, issueId) }
      : current);
  }, [workspaceId]);
  const discardDetailDraft = useCallback((issueId: string) => {
    setIssueDetailDraftStore((current) => current.workspaceId === workspaceId
      ? { ...current, drafts: clearIssueDetailDraft(current.drafts, issueId) }
      : current);
  }, [workspaceId]);
  const queryState = useMemo(
    () => scopeIssueViewState(viewState, {
      ...(contextProject === undefined ? {} : { projectId: contextProject.id }),
      ...(contextMilestone === undefined ? {} : { milestoneId: contextMilestone.id }),
      ...systemScope,
    }),
    [viewState, contextProject, contextMilestone, systemScope],
  );
  const navigationContextKey = useMemo(
    () => JSON.stringify([workspaceId, queryState]),
    [workspaceId, queryState],
  );
  const navigationScrollRef = useRef(createIssueNavigationScrollState(navigationContextKey));
  const navigationScroll = issueNavigationScrollStateForContext(
    navigationScrollRef.current,
    navigationContextKey,
  );
  if (navigationScroll !== navigationScrollRef.current) navigationScrollRef.current = navigationScroll;
  const issues = useQuery({
    queryKey: ['issues', workspaceId, queryState],
    queryFn: () => api.queryIssues(workspaceId, queryState),
    enabled: invalidUrlFilter === null,
  });
  const labels = useQuery({
    queryKey: ['labels', workspaceId, true],
    queryFn: () => api.labels(workspaceId, true),
  });
  const projectFilters = useMemo(() => ({
    ...(systemTeamId === undefined ? {} : { teamId: systemTeamId }),
    archiveState: 'all' as const,
    order: 'name' as const,
    direction: 'asc' as const,
  }), [systemTeamId]);
  const projects = useQuery({
    queryKey: ['projects', workspaceId, projectFilters],
    queryFn: () => api.projects(workspaceId, projectFilters),
  });
  const workspaceMilestones = useQuery({
    queryKey: ['workspace-milestones', workspaceId, true],
    queryFn: () => api.workspaceMilestones(workspaceId, true),
  });
  const savedViews = useQuery({
    queryKey: ['saved-views', workspaceId, true],
    queryFn: () => api.savedViews(workspaceId, true),
    enabled: !embedded && systemAssignee === undefined,
  });
  const selectedIssueScope = useQuery({
    queryKey: ['issue', workspaceId, selectedIssueId],
    queryFn: () => api.issue(workspaceId, selectedIssueId ?? ''),
    enabled: systemTeamId !== undefined && selectedIssueId !== null,
  });
  const selectedIssueRejected = systemTeamId !== undefined
    && selectedIssueScope.data !== undefined
    && selectedIssueScope.data.teamId !== systemTeamId;
  const issueListBlockingError = (invalidUrlFilter === null && issues.data === undefined ? issues.error : null)
    ?? (labels.data === undefined ? labels.error : null)
    ?? (projects.data === undefined ? projects.error : null)
    ?? (workspaceMilestones.data === undefined ? workspaceMilestones.error : null);
  const issueSavedViewsBlockingError = !embedded
    && systemAssignee === undefined
    && savedViews.data === undefined
    ? savedViews.error
    : null;
  const retryFailedIssueListReads = () => {
    const tasks: Promise<unknown>[] = [];
    if (invalidUrlFilter === null && issues.data === undefined && issues.error !== null) tasks.push(issues.refetch());
    if (labels.data === undefined && labels.error !== null) tasks.push(labels.refetch());
    if (projects.data === undefined && projects.error !== null) tasks.push(projects.refetch());
    if (workspaceMilestones.data === undefined && workspaceMilestones.error !== null) tasks.push(workspaceMilestones.refetch());
    void Promise.all(tasks);
  };
  const visibleMilestones = useMemo(() => {
    const scopedProjectIds = new Set((projects.data ?? []).map((project) => project.id));
    return (workspaceMilestones.data ?? []).filter((milestone) => contextProject === undefined
      ? systemTeamId === undefined || scopedProjectIds.has(milestone.projectId)
      : milestone.projectId === contextProject.id);
  }, [workspaceMilestones.data, projects.data, contextProject, systemTeamId]);

  const focusIssueRecord = useCallback((id: string) => {
    const focus = (remainingAttempts: number) => requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-issue-id="${id}"]`);
      if (target !== null) {
        target.focus();
      } else if (remainingAttempts > 0) {
        focus(remainingAttempts - 1);
      } else {
        searchRef.current?.focus();
      }
    });
    focus(4);
  }, []);
  const focusRowArchiveUndo = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      rowArchiveUndoButtonRef.current?.focus();
    }));
  }, []);
  const handleBoardFocusRequest = useCallback((id: string) => {
    setBoardFocusIssueId((current) => current === id ? null : current);
  }, []);

  const requestIssueMenu = useCallback((id: string, anchor: IssueActionMenuAnchor) => {
    setActionMenu({
      issueId: id,
      anchor,
    });
  }, []);

  const closeIssueMenu = useCallback((id: string, restoreFocus = true) => {
    setActionMenu((current) => current?.issueId === id ? null : current);
    if (restoreFocus) focusIssueRecord(id);
  }, [focusIssueRecord]);

  const openIssue = useCallback((id: string) => {
    const nextDetailMode = detailMode ?? 'contextual';
    focusReturnIssueId.current = issueNavigationOriginForOpen(
      focusReturnIssueId.current,
      selectedIssueId,
      id,
    );
    performance.clearMarks('basiclinear-issue-navigation-start');
    performance.mark('basiclinear-issue-navigation-start');
    setSelectedIssueId(id);
    setDetailMode(nextDetailMode);
    if (!embedded && invalidUrlFilter === null) {
      const historyMode = selectedIssueId === null && !pushedIssueEntry.current ? 'push' : 'replace';
      writeIssueUrl(viewState, id, currentSavedViewId, nextDetailMode, historyMode, routeView);
      if (historyMode === 'push') pushedIssueEntry.current = true;
    }
  }, [selectedIssueId, detailMode, embedded, invalidUrlFilter, viewState, currentSavedViewId, routeView]);

  const restoreRowFocus = useCallback(() => {
    const id = focusReturnIssueId.current;
    focusReturnIssueId.current = null;
    if (id === null) return;
    focusIssueRecord(id);
  }, [focusIssueRecord]);

  const rememberListScroll = useCallback((scrollTop: number) => {
    navigationScrollRef.current = recordIssueListScroll(
      navigationScrollRef.current,
      navigationContextKey,
      scrollTop,
    );
  }, [navigationContextKey]);
  const rememberBoardScroll = useCallback((scrollLeft: number) => {
    navigationScrollRef.current = recordIssueBoardScroll(
      navigationScrollRef.current,
      navigationContextKey,
      scrollLeft,
    );
  }, [navigationContextKey]);
  const rememberBoardColumnScroll = useCallback((groupKey: string, scrollTop: number) => {
    navigationScrollRef.current = recordIssueBoardColumnScroll(
      navigationScrollRef.current,
      navigationContextKey,
      groupKey,
      scrollTop,
    );
  }, [navigationContextKey]);

  const closeIssue = useCallback(() => {
    setSelectedIssueId(null);
    setDetailMode(null);
    if (!embedded) {
      if (pushedIssueEntry.current) {
        pushedIssueEntry.current = false;
        window.history.back();
      } else {
        writeIssueUrl(viewState, null, currentSavedViewId, null, 'replace', routeView);
      }
    }
    restoreRowFocus();
  }, [embedded, viewState, currentSavedViewId, restoreRowFocus, routeView]);

  useEffect(() => {
    if (!selectedIssueRejected) return;
    focusReturnIssueId.current = null;
    pushedIssueEntry.current = false;
    setSelectedIssueId(null);
    setDetailMode(null);
    if (!embedded) writeIssueUrl(viewState, null, currentSavedViewId, null, 'replace', routeView);
  }, [selectedIssueRejected, embedded, viewState, currentSavedViewId, routeView]);

  const create = useMutation({
    mutationFn: (input: Parameters<typeof api.createIssue>[1]) => api.createIssue(workspaceId, input),
    onSuccess: async (created) => {
      setCreateOpen(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['issues', workspaceId] }),
        client.invalidateQueries({ queryKey: ['projects', workspaceId] }),
        client.invalidateQueries({ queryKey: ['project', workspaceId] }),
        client.invalidateQueries({ queryKey: ['milestones', workspaceId] }),
      ]);
      openIssue(created.id);
    },
  });
  const createSavedView = useMutation({
    mutationFn: (input: { name: string }) =>
      api.createSavedView(workspaceId, { ...input, sharingScope: 'private', state: viewState }),
    onSuccess: async (created) => {
      setSaveViewOpen(false);
      setCurrentSavedViewId(created.id);
      const restoredState = enforceOwnerViewBoundary(cloneIssueViewState(created.state));
      setViewState(restoredState);
      setSearchDraft(restoredState.searchQuery);
      await client.invalidateQueries({ queryKey: ['saved-views', workspaceId] });
    },
  });
  const updateSavedView = useMutation({
    mutationFn: (savedView: SavedView) => api.updateSavedView(workspaceId, savedView.id, {
      expectedRevision: savedView.revision,
      state: viewState,
    }),
    onSuccess: async (updated) => {
      setViewState(enforceOwnerViewBoundary(cloneIssueViewState(updated.state)));
      await client.invalidateQueries({ queryKey: ['saved-views', workspaceId] });
    },
  });
  const setSavedViewArchive = useMutation({
    mutationFn: (savedView: SavedView) => savedView.archivedAt === null
      ? api.archiveSavedView(workspaceId, savedView.id, savedView.revision)
      : api.restoreSavedView(workspaceId, savedView.id, savedView.revision),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['saved-views', workspaceId] });
    },
  });
  const bulk = useMutation({
    mutationFn: (input: Parameters<typeof api.bulkIssues>[1]) => api.bulkIssues(workspaceId, input),
    onSuccess: async (result, input) => {
      setBulkResult(result);
      const unresolvedIds = result.filter((item) => item.status !== 'updated').map((item) => item.id);
      setSelectedIds(new Set(unresolvedIds));
      if (unresolvedIds.length === 0) {
        setBulkDraft(emptyIssueBulkDraft());
        if (input.mutation.type === 'labels') setBulkLabelIds([]);
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: ['issues', workspaceId] }),
        client.invalidateQueries({ queryKey: ['issue', workspaceId] }),
        client.invalidateQueries({ queryKey: ['issue-activity', workspaceId] }),
        client.invalidateQueries({ queryKey: ['projects', workspaceId] }),
        client.invalidateQueries({ queryKey: ['project', workspaceId] }),
        client.invalidateQueries({ queryKey: ['milestones', workspaceId] }),
        client.invalidateQueries({ queryKey: ['workspace-milestones', workspaceId] }),
      ]);
    },
  });
  const refreshIssueAction = useCallback(async (targetWorkspaceId: string, issueId: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['issues', targetWorkspaceId] }),
      client.invalidateQueries({ queryKey: ['issue', targetWorkspaceId, issueId] }),
      client.invalidateQueries({ queryKey: ['issue-activity', targetWorkspaceId, issueId] }),
      client.invalidateQueries({ queryKey: ['projects', targetWorkspaceId] }),
      client.invalidateQueries({ queryKey: ['project', targetWorkspaceId] }),
      client.invalidateQueries({ queryKey: ['milestones', targetWorkspaceId] }),
      client.invalidateQueries({ queryKey: ['workspace-milestones', targetWorkspaceId] }),
    ]);
  }, [client]);
  const quickEdit = useMutation({
    mutationFn: ({ targetWorkspaceId, issueId, input }: {
      targetWorkspaceId: string;
      issueId: string;
      input: Parameters<typeof api.updateIssue>[2];
    }) => api.updateIssue(targetWorkspaceId, issueId, input),
    onSuccess: async (updated, variables) => {
      client.setQueryData(['issue', variables.targetWorkspaceId, updated.id], updated);
      await refreshIssueAction(variables.targetWorkspaceId, updated.id);
      if (variables.targetWorkspaceId !== workspaceId) return;
      setQuickEditIssue(null);
      const status = scopedStatuses.find((candidate) => candidate.id === updated.statusId)?.name ?? 'Unknown';
      const assignee = members.find((member) => member.userId === updated.assigneeUserId)?.displayName ?? 'Unassigned';
      const project = (projects.data ?? []).find((candidate) => candidate.id === updated.projectId)?.name ?? 'No project';
      const milestone = visibleMilestones.find((candidate) => candidate.id === updated.milestoneId)?.name ?? 'No milestone';
      setIssueActionAnnouncement(`${updated.identifier} updated. Status ${status}, priority ${titleCase(updated.priority)}, assignee ${assignee}, project ${project}, milestone ${milestone}.`);
      focusIssueRecord(updated.id);
    },
  });
  const moveBoardIssue = useMutation({
    mutationFn: ({ targetWorkspaceId, issueId, input }: {
      targetWorkspaceId: string;
      issueId: string;
      identifier: string;
      targetGroupLabel: string;
      input: Parameters<typeof api.updateIssue>[2];
    }) => api.updateIssue(targetWorkspaceId, issueId, input),
    onSuccess: async (updated, variables) => {
      client.setQueryData(['issue', variables.targetWorkspaceId, updated.id], updated);
      await refreshIssueAction(variables.targetWorkspaceId, updated.id);
      if (variables.targetWorkspaceId !== workspaceId) return;
      setIssueActionAnnouncement(`${updated.identifier} moved to ${variables.targetGroupLabel}.`);
      setBoardFocusIssueId(updated.id);
    },
    onError: async (_error, variables) => {
      try {
        await refreshIssueAction(variables.targetWorkspaceId, variables.issueId);
      } finally {
        if (variables.targetWorkspaceId === workspaceId) {
          setIssueActionAnnouncement(`${variables.identifier} could not be moved. Current issue state restored.`);
          setBoardFocusIssueId(variables.issueId);
        }
      }
    },
  });
  const setRowArchive = useMutation({
    mutationFn: ({ targetWorkspaceId, issue }: {
      targetWorkspaceId: string;
      issue: Issue;
      source: 'direct' | 'undo';
    }) =>
      issue.archivedAt === null
        ? api.archiveIssue(targetWorkspaceId, issue.id, issue.revision)
        : api.restoreIssue(targetWorkspaceId, issue.id, issue.revision),
    onMutate: ({ targetWorkspaceId, source }) => {
      if (targetWorkspaceId === workspaceId && source === 'direct') {
        setRowArchiveNotice(null);
        setIssueActionAnnouncement('');
      }
    },
    onSuccess: async (updated, variables) => {
      client.setQueryData(['issue', variables.targetWorkspaceId, updated.id], updated);
      const archived = updated.archivedAt !== null;
      if (variables.targetWorkspaceId === workspaceId) {
        setRowArchiveNotice({
          tone: 'success',
          message: `${updated.identifier} ${archived ? 'archived' : 'restored'}.`,
          undoTarget: archived
            ? { targetWorkspaceId: variables.targetWorkspaceId, issue: updated }
            : null,
        });
      }
      await refreshIssueAction(variables.targetWorkspaceId, updated.id);
      if (variables.targetWorkspaceId !== workspaceId) return;
      if (archived) focusRowArchiveUndo();
      else focusIssueRecord(updated.id);
    },
    onError: async (_error, variables) => {
      if (variables.targetWorkspaceId !== workspaceId || variables.source !== 'undo') return;
      setRowArchiveNotice({
        tone: 'error',
        message: `${variables.issue.identifier} could not be restored. It remains in Archive, where you can retry.`,
        undoTarget: null,
      });
      try {
        await refreshIssueAction(variables.targetWorkspaceId, variables.issue.id);
      } finally {
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    },
  });

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  useEffect(() => {
    if (embedded || createSignal <= 0 || createSignal === handledCreateSignal.current) return;
    handledCreateSignal.current = createSignal;
    if (canWrite) setCreateOpen(true);
  }, [createSignal, embedded, canWrite]);
  useEffect(() => {
    if (canWrite) return;
    setCreateOpen(false);
    setLabelsOpen(false);
    setSaveViewOpen(false);
    setRowArchiveNotice(null);
    if (quickEditIssue !== null) {
      const issueId = quickEditIssue.id;
      setQuickEditIssue(null);
      quickEdit.reset();
      focusIssueRecord(issueId);
    }
  }, [canWrite, quickEditIssue, focusIssueRecord]);
  useEffect(() => {
    setActionMenu(null);
    setQuickEditIssue(null);
    setIssueActionAnnouncement('');
    setRowArchiveNotice(null);
    setSelectedIds(new Set());
    setBulkDraft(emptyIssueBulkDraft());
    setBulkLabelOperation('add');
    setBulkLabelIds([]);
    setBulkResult(null);
    quickEdit.reset();
    setRowArchive.reset();
  }, [workspaceId]);
  const syncIssueLocation = useCallback((restoreFocus: boolean) => {
    if (embedded) return;
    const route = readIssueRoute(window.location.search, window.history.state);
    if (route.detailMode === 'direct') focusReturnIssueId.current = null;
    setSelectedIssueId(route.issueId);
    setDetailMode(route.detailMode);
    const params = new URLSearchParams(window.location.search);
    setCurrentSavedViewId(systemAssigneeUserId === undefined ? params.get('saved') : null);
    const restored = issueViewStateFromUrl(baseState);
    setInvalidUrlFilter(restored.invalidFilter);
    const restoredState = enforceOwnerViewBoundary(withoutIssueQueryScope(restored.state, systemScope));
    setViewState(restoredState);
    setSearchDraft(restoredState.searchQuery);
    pushedIssueEntry.current = false;
    if (restoreFocus) restoreRowFocus();
    else focusReturnIssueId.current = null;
  }, [embedded, baseState, restoreRowFocus, systemAssigneeUserId, systemScope, enforceOwnerViewBoundary]);
  useEffect(() => {
    if (openIssueSignal <= 0 || openIssueSignal === handledOpenIssueSignal.current) return;
    handledOpenIssueSignal.current = openIssueSignal;
    if (openIssueId !== null && openIssueId !== undefined) openIssue(openIssueId);
    else syncIssueLocation(false);
    onOpenIssueHandled?.();
  }, [openIssueSignal, openIssueId, openIssue, onOpenIssueHandled, syncIssueLocation]);
  useEffect(() => {
    if (embedded || invalidUrlFilter !== null) return;
    writeIssueUrl(viewState, selectedIssueId, currentSavedViewId, detailMode, 'replace', routeView);
  }, [viewState, selectedIssueId, currentSavedViewId, detailMode, embedded, invalidUrlFilter, routeView]);
  useEffect(() => {
    if (embedded) return;
    const syncHistory = () => syncIssueLocation(true);
    window.addEventListener('popstate', syncHistory);
    return () => window.removeEventListener('popstate', syncHistory);
  }, [embedded, syncIssueLocation]);
  useEffect(() => {
    if (embedded || systemAssignee !== undefined || initialSavedViewApplied.current || !currentSavedViewId || !savedViews.data) return;
    initialSavedViewApplied.current = true;
    const saved = savedViews.data.find((view) => view.id === currentSavedViewId);
    if (saved === undefined) return;
    const restoredState = enforceOwnerViewBoundary(withoutIssueQueryScope(cloneIssueViewState(saved.state), systemScope));
    setViewState(restoredState);
    setSearchDraft(restoredState.searchQuery);
  }, [embedded, systemAssignee, currentSavedViewId, savedViews.data, systemScope, enforceOwnerViewBoundary]);
  useEffect(() => {
    const keyboard = (event: globalThis.KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const action = resolveIssueViewKeyAction({
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        repeat: event.repeat,
        isComposing: event.isComposing,
        defaultPrevented: event.defaultPrevented,
        withinExcludedTarget: Boolean(target?.closest('input, textarea, select, [contenteditable="true"], dialog')),
        selectionEnabled: false,
      });
      if (action === null) return;
      event.preventDefault();
      if (action === 'focus-search') {
        searchRef.current?.focus();
      } else if (action === 'open-filter') {
        setFilterOpen(true);
      } else if (action === 'toggle-layout') {
        setViewState((current) => ({
          ...current,
          layout: current.layout === 'list' ? 'board' : 'list',
          groupBy: current.layout === 'list' && current.groupBy === 'none' ? 'status' : current.groupBy,
        }));
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, []);

  const issueRows = useMemo(
    () => invalidUrlFilter === null ? issues.data ?? [] : [],
    [invalidUrlFilter, issues.data],
  );
  const selectedIssues = useMemo(
    () => issueRows.filter((issue) => selectedIds.has(issue.id)),
    [issueRows, selectedIds],
  );
  const availableBulkStatuses = useMemo(
    () => issueBulkStatuses(selectedIssues, scopedStatuses),
    [selectedIssues, scopedStatuses],
  );
  const availableBulkProjects = useMemo(
    () => issueBulkProjects(selectedIssues, projects.data ?? []),
    [selectedIssues, projects.data],
  );
  const availableBulkMilestones = useMemo(
    () => issueBulkMilestones(
      selectedIssues,
      projects.data ?? [],
      visibleMilestones,
      bulkDraft.projectId,
    ),
    [selectedIssues, projects.data, visibleMilestones, bulkDraft.projectId],
  );
  const availableBulkLabels = useMemo(
    () => issueBulkLabels(labels.data ?? []),
    [labels.data],
  );
  const bulkUpdateDraft = useMemo(() => ownerMode && bulkDraft.assigneeUserId !== ''
    ? { ...bulkDraft, assigneeUserId: '' }
    : bulkDraft, [ownerMode, bulkDraft]);
  const bulkUpdateRequest = useMemo(
    () => issueBulkUpdateRequest(
      selectedIssues,
      bulkUpdateDraft,
      scopedStatuses,
      members,
      projects.data ?? [],
      visibleMilestones,
    ),
    [selectedIssues, bulkUpdateDraft, scopedStatuses, members, projects.data, visibleMilestones],
  );
  const bulkLabelRequest = useMemo(
    () => issueBulkLabelRequest(
      selectedIssues,
      bulkLabelOperation,
      bulkLabelIds,
      labels.data ?? [],
    ),
    [selectedIssues, bulkLabelOperation, bulkLabelIds, labels.data],
  );
  useEffect(() => {
    setBulkDraft((current) => reconcileIssueBulkDraft(
      current,
      availableBulkStatuses,
      members,
      availableBulkProjects,
      availableBulkMilestones,
    ));
  }, [availableBulkStatuses, members, availableBulkProjects, availableBulkMilestones]);
  useEffect(() => {
    const available = new Set(availableBulkLabels.map((label) => label.id));
    setBulkLabelIds((current) => {
      const next = current.filter((labelId) => available.has(labelId));
      return next.length === current.length ? current : next;
    });
  }, [availableBulkLabels]);
  useEffect(() => {
    if (selectedIds.size === 0) {
      setBulkDraft(emptyIssueBulkDraft());
      setBulkLabelOperation('add');
      setBulkLabelIds([]);
    }
  }, [selectedIds.size]);
  const menuIssue = actionMenu === null
    ? null
    : issueRows.find((issue) => issue.id === actionMenu.issueId) ?? null;
  const activeSavedView = savedViews.data?.find((view) => view.id === currentSavedViewId) ?? null;
  const savedViewDirty = activeSavedView !== null
    && JSON.stringify(activeSavedView.state) !== JSON.stringify(viewState);
  const ownsSavedView = canWrite
    && activeSavedView !== null
    && activeSavedView.ownerUserId === currentUserId;
  useEffect(() => {
    if (actionMenu !== null && menuIssue === null) setActionMenu(null);
  }, [actionMenu, menuIssue]);
  const detailPresentation = issueDetailPresentation(detailMode, viewportWidth);
  const filterCount = viewState.filter.root.type === 'group' ? viewState.filter.root.children.length : 0;
  const excludedFilterFields: IssueFilterField[] = [
    ...(systemTeam === undefined ? [] : ['teamId' as const]),
    ...(systemAssignee === undefined ? [] : ['assigneeUserId' as const]),
  ];
  const clearInvalidUrlFilter = () => {
    setInvalidUrlFilter(null);
    setViewState((current) => ({
      ...current,
      filter: cloneIssueViewState(initialIssueViewState).filter,
    }));
  };
  const openIssueCreate = () => {
    create.reset();
    setCreateOpen(true);
  };
  const clearIssueResultFilters = () => {
    setSearchDraft('');
    setViewState((current) => ({
      ...current,
      searchQuery: '',
      filter: cloneIssueViewState(initialIssueViewState).filter,
    }));
  };
  const toggleSelection = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setBulkResult(null);
    return next;
  });
  const toggleAll = () => setSelectedIds((current) =>
    issueRows.length > 0 && issueRows.every((issue) => current.has(issue.id))
      ? new Set()
      : new Set(issueRows.map((issue) => issue.id)));
  const applySavedView = (id: string) => {
    setInvalidUrlFilter(null);
    if (id === '') {
      const reset = cloneIssueViewState(initialIssueViewState);
      setCurrentSavedViewId(null);
      setViewState(reset);
      setSearchDraft(reset.searchQuery);
      return;
    }
    const saved = savedViews.data?.find((view) => view.id === id);
    if (saved === undefined) return;
    const restoredState = enforceOwnerViewBoundary(withoutIssueQueryScope(cloneIssueViewState(saved.state), systemScope));
    setCurrentSavedViewId(saved.id);
    setViewState(restoredState);
    setSearchDraft(restoredState.searchQuery);
  };
  const runBulkUpdate = () => {
    if (!canWrite || bulkUpdateRequest === null) return;
    bulk.mutate(bulkUpdateRequest);
  };
  const toggleBulkLabel = (labelId: string) => setBulkLabelIds((current) =>
    current.includes(labelId)
      ? current.filter((candidate) => candidate !== labelId)
      : [...current, labelId]);
  const runBulkLabels = () => {
    if (!canWrite || bulkLabelRequest === null) return;
    bulk.mutate(bulkLabelRequest);
  };
  const closeQuickEdit = () => {
    const issueId = quickEditIssue?.id;
    setQuickEditIssue(null);
    quickEdit.reset();
    if (issueId !== undefined) focusIssueRecord(issueId);
  };
  const submitQuickEdit = (values: IssueQuickEditValues) => {
    if (!canWrite || quickEditIssue === null) return;
    const input = issueQuickEditRequest(quickEditIssue, ownerMode
      ? { ...values, assigneeUserId: quickEditIssue.assigneeUserId }
      : values);
    if (input === null) {
      setIssueActionAnnouncement(`${quickEditIssue.identifier} properties unchanged.`);
      closeQuickEdit();
      return;
    }
    quickEdit.mutate({ targetWorkspaceId: workspaceId, issueId: quickEditIssue.id, input });
  };
  const moveIssueAcrossBoard = useCallback((issue: Issue, targetGroupKey: string, targetGroupLabel: string) => {
    if (!canWrite || moveBoardIssue.isPending || (ownerMode && viewState.groupBy === 'assignee')) return;
    const input = issueBoardMoveRequest(
      issue,
      viewState.groupBy,
      targetGroupKey,
      scopedStatuses,
      members,
      projects.data ?? [],
      visibleMilestones,
    );
    if (input === null) {
      setIssueActionAnnouncement(`${issue.identifier} move canceled because the target is no longer valid.`);
      setBoardFocusIssueId(issue.id);
      return;
    }
    moveBoardIssue.mutate({
      targetWorkspaceId: workspaceId,
      issueId: issue.id,
      identifier: issue.identifier,
      targetGroupLabel,
      input,
    });
  }, [canWrite, members, moveBoardIssue, ownerMode, projects.data, scopedStatuses, viewState.groupBy, visibleMilestones, workspaceId]);
  const toggleGroup = (key: string) => setViewState((current) => ({
    ...current,
    collapsedGroups: current.collapsedGroups.includes(key)
      ? current.collapsedGroups.filter((group) => group !== key)
      : [...current.collapsedGroups, key],
  }));
  const updateSearch = (value: string) => {
    const searchQuery = value.trim();
    setViewState((current) => ({ ...current, searchQuery }));
  };
  const beginPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    panelResizeCleanupRef.current?.();
    const startX = event.clientX;
    const startWidth = panelWidth;
    let finalWidth = startWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    const move = (moveEvent: globalThis.PointerEvent) => {
      finalWidth = issuePanelWidthForPointer(startWidth, startX, moveEvent.clientX);
      setPanelWidth(finalWidth);
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', finish);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      writeIssuePanelWidth(localStorage, finalWidth);
      panelResizeCleanupRef.current = null;
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('blur', finish);
    panelResizeCleanupRef.current = finish;
  };
  const resizePanelWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const next = issuePanelWidthForKey(panelWidth, event.key);
    if (next === null) return;
    event.preventDefault();
    setPanelWidth(next);
    writeIssuePanelWidth(localStorage, next);
  };

  const issueFiltersActive = viewState.searchQuery !== '' || filterCount > 0;
  const canCreateIssue = canWrite && teams.length > 0;
  const issueEmptyTitle = issueFiltersActive
    ? 'No matching issues'
    : viewState.archiveState === 'archived'
      ? 'Archive is empty'
      : contextMilestone !== undefined
        ? `No issues in ${contextMilestone.name}`
        : contextProject !== undefined
          ? `No issues in ${contextProject.name}`
          : 'No issues';
  const issueEmptyAction = issueFiltersActive ? (
    <button type="button" className="button" onClick={clearIssueResultFilters}>Clear filters</button>
  ) : viewState.archiveState === 'archived' ? (
    <button type="button" className="button" onClick={() => setViewState((current) => ({ ...current, archiveState: 'active' }))}>View active</button>
  ) : canCreateIssue ? (
    <button type="button" className="button" onClick={openIssueCreate}><Plus size={15} />New issue</button>
  ) : undefined;

  useEffect(() => () => panelResizeCleanupRef.current?.(), []);

  return (
    <section
      className={`issues-view ${embedded ? 'issues-view-embedded' : ''} ${detailPresentation === 'panel' ? 'detail-open' : ''} ${detailPresentation === 'route' ? 'detail-route-open' : ''}`}
      aria-labelledby={detailPresentation === 'route' ? undefined : embedded ? 'project-issues-title' : 'issues-title'}
      aria-label={detailPresentation === 'route' ? 'Issue detail route' : undefined}
      data-issue-presentation={detailPresentation ?? 'list'}
      style={{ '--issue-panel-width': `${panelWidth}px` } as CSSProperties}
    >
      <div className="sr-only" role="status" aria-live="polite">{issueActionAnnouncement}</div>
      {detailPresentation !== 'route' ? <div className="issue-workspace-list">
        <div className="section-heading issues-heading">
          <div><h1 id={embedded ? 'project-issues-title' : 'issues-title'}>{embedded ? 'Project issues' : activeSavedView?.name ?? viewTitle}</h1><p>{issueListBlockingError !== null ? <span className="skeleton-block skeleton-inline-count" aria-hidden="true" /> : `${issueRows.length} ${viewState.archiveState === 'all' ? 'issues' : viewState.archiveState}`}</p></div>
          <div className="heading-actions">
            <button className="icon-button" aria-label="Manage labels" title="Manage labels" onClick={() => setLabelsOpen(true)} disabled={!canWrite || labels.data === undefined}><Tag size={15} /></button>
            <button className="button primary" onClick={openIssueCreate} disabled={!canCreateIssue || issueListBlockingError !== null}><Plus size={15} /> New issue</button>
          </div>
        </div>
        {invalidUrlFilter !== null ? (
          <div className="invalid-filter-banner" role="alert">
            <AlertCircle size={16} />
            <div><strong>Filter could not be restored</strong><code>{invalidUrlFilter}</code></div>
            <div className="invalid-filter-actions">
              <button className="button" onClick={() => setFilterOpen(true)}>Replace filter</button>
              <button className="button" onClick={clearInvalidUrlFilter}>Clear filter</button>
            </div>
          </div>
        ) : null}
        {!embedded ? <div className="issue-viewbar">
          {systemAssignee === undefined ? <label className="toolbar-select saved-view-select"><span className="sr-only">Saved view</span><select value={currentSavedViewId ?? ''} onChange={(event) => applySavedView(event.target.value)}><option value="">All issues</option>{(savedViews.data ?? []).map((savedView) => <option key={savedView.id} value={savedView.id}>{savedView.name}{savedView.archivedAt === null ? '' : ' (archived)'}</option>)}</select></label> : null}
          <div className="segmented-control" role="group" aria-label="Issue layout">
            <button className={viewState.layout === 'list' ? 'active' : ''} aria-label="List layout" aria-pressed={viewState.layout === 'list'} title="List layout" onClick={() => setViewState((current) => ({ ...current, layout: 'list' }))}><Rows3 size={14} /></button>
            <button className={viewState.layout === 'board' ? 'active' : ''} aria-label="Board layout" aria-pressed={viewState.layout === 'board'} title="Board layout" onClick={() => setViewState((current) => ({ ...current, layout: 'board', groupBy: current.groupBy === 'none' ? 'status' : current.groupBy }))}><Columns3 size={14} /></button>
          </div>
          {systemAssignee === undefined ? <button className="icon-button" aria-label="Save new view" title="Save new view" disabled={!canWrite || invalidUrlFilter !== null} onClick={() => setSaveViewOpen(true)}><Plus size={15} /></button> : null}
          {systemAssignee === undefined && ownsSavedView && activeSavedView?.archivedAt === null ? <button className="icon-button" aria-label="Update saved view" title={savedViewDirty ? 'Update saved view' : 'Saved view is current'} disabled={!savedViewDirty || updateSavedView.isPending} onClick={() => updateSavedView.mutate(activeSavedView)}><Save size={14} /></button> : null}
          {systemAssignee === undefined && ownsSavedView && activeSavedView ? <button className="icon-button" aria-label={activeSavedView.archivedAt === null ? 'Archive saved view' : 'Restore saved view'} title={activeSavedView.archivedAt === null ? 'Archive saved view' : 'Restore saved view'} disabled={setSavedViewArchive.isPending} onClick={() => setSavedViewArchive.mutate(activeSavedView)}>{activeSavedView.archivedAt === null ? <Archive size={14} /> : <ArchiveRestore size={14} />}</button> : null}
          <span className="issue-viewbar-spacer" />
          <label className="toolbar-select"><span>Group</span><select value={viewState.groupBy} onChange={(event) => setViewState((current) => ({ ...current, groupBy: event.target.value as IssueViewGrouping, collapsedGroups: [] }))}><option value="none">None</option><option value="status">Status</option><option value="priority">Priority</option>{!ownerMode ? <option value="assignee">Assignee</option> : null}<option value="project">Project</option><option value="milestone">Milestone</option></select></label>
        </div> : null}
        {(!ownerMode && (systemTeam !== undefined || systemAssignee !== undefined)) || contextMilestone !== undefined ? (
          <div className="issue-context-filters" role="group" aria-label="Applied issue filters">
            <span>Filtered by</span>
            {!ownerMode && systemTeam !== undefined ? <span className="issue-context-filter">
              <span>Team</span>
              <strong>{systemTeam.name}</strong>
            </span> : null}
            {!ownerMode && systemAssignee !== undefined ? <span className="issue-context-filter">
              <span>Assignee</span>
              <strong>{systemAssignee.displayName}</strong>
            </span> : null}
            {contextMilestone !== undefined ? <span className="issue-context-filter">
              <span>Milestone</span>
              <strong>{contextMilestone.name}</strong>
              <button type="button" className="icon-button" aria-label={`Clear milestone filter ${contextMilestone.name}`} title="Clear milestone filter" onClick={onClearContextMilestone}><X size={13} /></button>
            </span> : null}
          </div>
        ) : null}
        <div className="issue-toolbar">
          <form className="project-search" role="search" onSubmit={(event) => { event.preventDefault(); updateSearch(searchDraft); }}><Search size={15} /><label><span className="sr-only">Search issues</span><input ref={searchRef} data-issue-search value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search issues" maxLength={200} /></label>{viewState.searchQuery !== '' ? <button type="button" className="icon-button" aria-label="Clear issue search" title="Clear search" onClick={() => { setSearchDraft(''); updateSearch(''); }}><X size={13} /></button> : null}</form>
          <button className={`button toolbar-button ${filterCount > 0 ? 'active' : ''}`} onClick={() => setFilterOpen(true)}><ListFilter size={14} />Filter{filterCount > 0 ? <span>{filterCount}</span> : null}</button>
          <details className="toolbar-menu properties-menu"><summary aria-label="Visible properties" title="Visible properties"><SlidersHorizontal size={14} /> Properties</summary><div>{issueViewProperties.map((property) => <label key={property}><input type="checkbox" checked={viewState.visibleProperties.includes(property)} onChange={() => setViewState((current) => ({ ...current, visibleProperties: toggleIssueViewProperty(current.visibleProperties, property) }))} />{titleCase(property)}</label>)}</div></details>
          <span className="toolbar-divider" />
          <label className="toolbar-select"><span className="sr-only">Order issues</span><select value={viewState.order.field} onChange={(event) => setViewState((current) => ({ ...current, order: { ...current.order, field: event.target.value as IssueViewOrderField } }))}><option value="updatedAt">Updated</option><option value="identifier">Identifier</option><option value="priority">Priority</option><option value="dueDate">Due date</option></select></label>
          <button className="icon-button" aria-label={`Sort ${viewState.order.direction === 'asc' ? 'descending' : 'ascending'}`} title={`Sort ${viewState.order.direction === 'asc' ? 'descending' : 'ascending'}`} onClick={() => setViewState((current) => ({ ...current, order: { ...current.order, direction: current.order.direction === 'asc' ? 'desc' : 'asc' } }))}>{viewState.order.direction === 'asc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}</button>
          <label className="toolbar-select density-select"><span className="sr-only">Issue density</span><select value={viewState.density} onChange={(event) => setViewState((current) => ({ ...current, density: event.target.value as IssueViewDensity }))}><option value="compact">Compact</option><option value="default">Default</option><option value="comfortable">Comfortable</option></select></label>
          <label className="toolbar-select archive-select"><Archive size={14} /><span className="sr-only">Archive state</span><select value={viewState.archiveState} onChange={(event) => setViewState((current) => ({ ...current, archiveState: event.target.value as IssueViewState['archiveState'] }))}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label>
        </div>
        {selectedIds.size > 0 ? (
          <div className="bulk-toolbar" role="region" aria-label="Bulk issue actions">
            <strong>{selectedIds.size} selected</strong>
            <label>
              <span className="sr-only">Bulk status</span>
              <select value={bulkDraft.statusId} onChange={(event) => setBulkDraft((current) => ({ ...current, statusId: event.target.value }))} disabled={!canWrite || bulk.isPending}>
                <option value="">Status</option>
                {availableBulkStatuses.map((status) => <option key={status.id} value={status.id}>{issueStatusLabel(status, scopedStatuses, scopedTeams)}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Bulk priority</span>
              <select value={bulkDraft.priority} onChange={(event) => setBulkDraft((current) => ({ ...current, priority: event.target.value as '' | IssuePriority }))} disabled={!canWrite || bulk.isPending}>
                <option value="">Priority</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="none">No priority</option>
              </select>
            </label>
            {!ownerMode ? <label>
              <span className="sr-only">Bulk assignee</span>
              <select value={bulkDraft.assigneeUserId} onChange={(event) => setBulkDraft((current) => ({ ...current, assigneeUserId: event.target.value }))} disabled={!canWrite || bulk.isPending}>
                <option value="">Assignee</option>
                <option value={issueBulkUnassignedValue}>Unassigned</option>
                {members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
              </select>
            </label> : null}
            <label>
              <span className="sr-only">Bulk project</span>
              <select value={bulkDraft.projectId} onChange={(event) => setBulkDraft((current) => ({ ...current, projectId: event.target.value, milestoneId: '' }))} disabled={!canWrite || bulk.isPending}>
                <option value="">Project</option>
                <option value={issueBulkClearValue}>No project</option>
                {availableBulkProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Bulk milestone</span>
              <select
                value={bulkDraft.milestoneId}
                disabled={!canWrite || bulk.isPending || bulkDraft.projectId === issueBulkClearValue}
                onChange={(event) => {
                  const milestoneId = event.target.value;
                  const milestone = availableBulkMilestones.find((candidate) => candidate.id === milestoneId);
                  setBulkDraft((current) => ({
                    ...current,
                    milestoneId,
                    ...(milestone === undefined ? {} : { projectId: milestone.projectId }),
                  }));
                }}
              >
                <option value="">Milestone</option>
                <option value={issueBulkClearValue}>No milestone</option>
                {availableBulkMilestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{bulkDraft.projectId === '' ? `${(projects.data ?? []).find((project) => project.id === milestone.projectId)?.name ?? 'Project'} / ` : ''}{milestone.name}</option>)}
              </select>
            </label>
            <div className={`bulk-due-control ${bulkDraft.clearDueDate ? 'clear-active' : ''}`}>
              <CalendarDays size={13} aria-hidden="true" />
              <label>
                <span className="sr-only">Bulk due date</span>
                <input type="date" value={bulkDraft.dueDate} disabled={!canWrite || bulk.isPending || bulkDraft.clearDueDate} onChange={(event) => setBulkDraft((current) => ({ ...current, dueDate: event.target.value, clearDueDate: false }))} />
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label={bulkDraft.clearDueDate ? 'Keep existing due dates' : 'Clear due dates'}
                aria-pressed={bulkDraft.clearDueDate}
                title={bulkDraft.clearDueDate ? 'Keep existing due dates' : 'Clear due dates'}
                disabled={!canWrite || bulk.isPending}
                onClick={() => setBulkDraft((current) => ({ ...current, dueDate: '', clearDueDate: !current.clearDueDate }))}
              ><X size={13} /></button>
            </div>
            {canWrite ? <details className="toolbar-menu bulk-label-menu">
              <summary
                aria-label="Bulk labels"
                aria-disabled={bulk.isPending}
                title="Bulk labels"
                onClick={(event) => { if (bulk.isPending) event.preventDefault(); }}
              ><Tag size={13} />Labels{bulkLabelIds.length > 0 ? <span>{bulkLabelIds.length}</span> : null}</summary>
              <div className="bulk-label-popover">
                <div className="bulk-label-mode" role="group" aria-label="Bulk label operation">
                  <button type="button" aria-pressed={bulkLabelOperation === 'add'} onClick={() => setBulkLabelOperation('add')} disabled={bulk.isPending}>Add</button>
                  <button type="button" aria-pressed={bulkLabelOperation === 'remove'} onClick={() => setBulkLabelOperation('remove')} disabled={bulk.isPending}>Remove</button>
                </div>
                <fieldset>
                  <legend className="sr-only">Select labels</legend>
                  {availableBulkLabels.map((label) => <label key={label.id}>
                    <input type="checkbox" checked={bulkLabelIds.includes(label.id)} disabled={bulk.isPending} onChange={() => toggleBulkLabel(label.id)} />
                    <i style={{ background: label.color }} />
                    <span>{label.name}</span>
                  </label>)}
                  {availableBulkLabels.length === 0 ? <span className="muted-copy">No active labels</span> : null}
                </fieldset>
                <button type="button" className="button" disabled={bulk.isPending || bulkLabelRequest === null} onClick={runBulkLabels}>{bulk.isPending ? <Spinner /> : <Tag size={13} />}Apply labels</button>
              </div>
            </details> : null}
            <button className="button" disabled={!canWrite || bulk.isPending || bulkUpdateRequest === null} onClick={runBulkUpdate}>{bulk.isPending ? <Spinner /> : <Save size={14} />}Apply</button>
            <button className="button" disabled={!canWrite || bulk.isPending || selectedIssues.length === 0} onClick={() => bulk.mutate({ items: selectedIssues.map((issue) => ({ id: issue.id, expectedRevision: issue.revision })), mutation: { type: viewState.archiveState === 'archived' ? 'restore' : 'archive' } })}>{viewState.archiveState === 'archived' ? <ArchiveRestore size={14} /> : <Archive size={14} />}{viewState.archiveState === 'archived' ? 'Restore' : 'Archive'}</button>
            <button className="icon-button" aria-label="Clear selection" title="Clear selection" onClick={() => { setSelectedIds(new Set()); setBulkDraft(emptyIssueBulkDraft()); setBulkLabelOperation('add'); setBulkLabelIds([]); setBulkResult(null); }}><X size={14} /></button>
          </div>
        ) : null}
        {bulkResult ? <div className="bulk-result" role="status">{issueBulkResultSummary(bulkResult)}</div> : null}
        {rowArchiveNotice !== null ? (
          <ArchiveActionNotice
            message={rowArchiveNotice.message}
            tone={rowArchiveNotice.tone}
            undoAvailable={rowArchiveNotice.undoTarget !== null}
            pending={setRowArchive.isPending && setRowArchive.variables?.source === 'undo'}
            undoLabel={rowArchiveNotice.undoTarget === null
              ? 'Undo archive'
              : `Undo archive for ${rowArchiveNotice.undoTarget.issue.identifier}`}
            undoButtonRef={rowArchiveUndoButtonRef}
            onUndo={() => {
              if (rowArchiveNotice.undoTarget !== null) {
                setRowArchive.mutate({ ...rowArchiveNotice.undoTarget, source: 'undo' });
              }
            }}
            onDismiss={() => {
              setRowArchiveNotice(null);
              requestAnimationFrame(() => searchRef.current?.focus());
            }}
          />
        ) : null}
        <ErrorNotice error={createSavedView.error ?? updateSavedView.error ?? setSavedViewArchive.error ?? bulk.error ?? (moveBoardIssue.variables?.targetWorkspaceId === workspaceId ? moveBoardIssue.error : null) ?? (setRowArchive.variables?.targetWorkspaceId === workspaceId && setRowArchive.variables.source !== 'undo' ? setRowArchive.error : null) ?? (issues.data === undefined ? null : issues.error) ?? (labels.data === undefined ? null : labels.error) ?? (projects.data === undefined ? null : projects.error) ?? (workspaceMilestones.data === undefined ? null : workspaceMilestones.error) ?? (savedViews.data === undefined ? null : savedViews.error)} />
        {issueSavedViewsBlockingError !== null ? (
          <QueryErrorState
            compact
            title="Could not load saved views"
            error={issueSavedViewsBlockingError}
            retrying={savedViews.isFetching}
            onRetry={() => { void savedViews.refetch(); }}
          />
        ) : null}
        {invalidUrlFilter !== null ? (
          <div className="invalid-filter-blocked" role="status"><AlertCircle size={20} /><strong>Issue results are hidden until the filter is replaced or cleared.</strong></div>
        ) : issueListBlockingError !== null ? (
          <QueryErrorState
            title="Could not load issues"
            error={issueListBlockingError}
            retrying={issues.isFetching || labels.isFetching || projects.isFetching || workspaceMilestones.isFetching}
            onRetry={retryFailedIssueListReads}
          />
        ) : labels.isLoading || issues.isLoading || projects.isLoading || workspaceMilestones.isLoading ? viewState.layout === 'list' ? <LoadingSkeleton variant="table" tableKind="issues" tableDensity={viewState.density} tableColumnCount={4 + viewState.visibleProperties.length} tableGridTemplate={issueGridTemplate(viewState.visibleProperties)} label="Loading issues" /> : <LoadingSkeleton variant="board" boardDensity={viewState.density} label="Loading issue board" /> : issueRows.length ? viewState.layout === 'list' ? (
          <VirtualIssueList
            issues={issueRows}
            statuses={scopedStatuses}
            teams={scopedTeams}
            members={members}
            projects={projects.data ?? []}
            milestones={visibleMilestones}
            state={viewState}
            selectedIds={selectedIds}
            activeIssueId={selectedIssueId}
            onOpen={openIssue}
            onToggleSelection={toggleSelection}
            onToggleAll={toggleAll}
            onToggleGroup={toggleGroup}
            openMenuIssueId={actionMenu?.issueId ?? null}
            onRequestMenu={requestIssueMenu}
            onCloseMenu={closeIssueMenu}
            initialScrollTop={navigationScroll.listScrollTop}
            onScrollTopChange={rememberListScroll}
          />
        ) : (
          <VirtualIssueBoard
            issues={issueRows}
            statuses={scopedStatuses}
            teams={scopedTeams}
            members={members}
            projects={projects.data ?? []}
            milestones={visibleMilestones}
            state={viewState}
            selectedIds={selectedIds}
            activeIssueId={selectedIssueId}
            onOpen={openIssue}
            onToggleSelection={toggleSelection}
            openMenuIssueId={actionMenu?.issueId ?? null}
            onRequestMenu={requestIssueMenu}
            onCloseMenu={closeIssueMenu}
            canMove={canWrite && !quickEdit.isPending && !setRowArchive.isPending}
            movePendingIssueId={moveBoardIssue.isPending ? moveBoardIssue.variables?.issueId ?? null : null}
            onMoveIssue={moveIssueAcrossBoard}
            onAnnounce={setIssueActionAnnouncement}
            focusRequestedIssueId={boardFocusIssueId}
            onFocusRequestHandled={handleBoardFocusRequest}
            initialScrollLeft={navigationScroll.boardScrollLeft}
            initialColumnScrollTops={navigationScroll.boardColumnScrollTops}
            onScrollLeftChange={rememberBoardScroll}
            onColumnScrollTopChange={rememberBoardColumnScroll}
          />
        ) : <EmptyState icon={<CircleDot size={22} />} title={issueEmptyTitle} action={issueEmptyAction} />}
      </div> : null}

      {actionMenu !== null && menuIssue !== null ? <IssueActionMenu
        issue={menuIssue}
        anchor={actionMenu.anchor}
        canWrite={canWrite}
        pending={setRowArchive.isPending || moveBoardIssue.isPending}
        onClose={(restoreFocus) => closeIssueMenu(menuIssue.id, restoreFocus)}
        onOpen={() => {
          closeIssueMenu(menuIssue.id, false);
          openIssue(menuIssue.id);
        }}
        onEdit={() => {
          setActionMenu(null);
          quickEdit.reset();
          setQuickEditIssue(menuIssue);
        }}
        onToggleArchive={() => {
          if (!canWrite) return;
          closeIssueMenu(menuIssue.id);
          setRowArchive.mutate({ targetWorkspaceId: workspaceId, issue: menuIssue, source: 'direct' });
        }}
      /> : null}

      {selectedIssueId !== null && !selectedIssueRejected && detailPresentation === 'route' ? (
        <div className="issue-detail-route">
          <IssueDetail
            key={`${workspaceId}:${selectedIssueId}`}
            workspaceId={workspaceId}
            workspaceRole={workspaceRole}
            ownerMode={ownerMode}
            {...(currentUserId === undefined ? {} : { currentUserId })}
            issueId={selectedIssueId}
            teams={scopedTeams}
            statuses={scopedStatuses}
            members={members}
            projects={projects.data ?? []}
            labels={labels.data ?? []}
            {...(issueDetailDrafts[selectedIssueId] === undefined ? {} : { detailDraft: issueDetailDrafts[selectedIssueId] })}
            onBack={closeIssue}
            onOpenIssue={openIssue}
            onContentDraftChange={retainContentDraft}
            onCommentDraftChange={retainCommentDraft}
            onClearContentDraft={discardContentDraft}
            onClearCommentDraft={discardCommentDraft}
            onClearDetailDraft={discardDetailDraft}
          />
        </div>
      ) : null}

      {selectedIssueId !== null && !selectedIssueRejected && detailPresentation === 'panel' ? <>
        <div
          className="issue-panel-resizer"
          role="separator"
          tabIndex={0}
          aria-label="Resize issue details"
          aria-orientation="vertical"
          aria-valuemin={480}
          aria-valuemax={640}
          aria-valuenow={panelWidth}
          aria-valuetext={`${panelWidth} pixels`}
          title="Resize issue details"
          onPointerDown={beginPanelResize}
          onKeyDown={resizePanelWithKeyboard}
        ><GripVertical size={14} /></div>
        <aside className="issue-detail-panel"><IssueDetail
          key={`${workspaceId}:${selectedIssueId}`}
          panel
          workspaceId={workspaceId}
          workspaceRole={workspaceRole}
          ownerMode={ownerMode}
          {...(currentUserId === undefined ? {} : { currentUserId })}
          issueId={selectedIssueId}
          teams={scopedTeams}
          statuses={scopedStatuses}
          members={members}
          projects={projects.data ?? []}
          labels={labels.data ?? []}
          {...(issueDetailDrafts[selectedIssueId] === undefined ? {} : { detailDraft: issueDetailDrafts[selectedIssueId] })}
          onBack={closeIssue}
          onOpenIssue={openIssue}
          onContentDraftChange={retainContentDraft}
          onCommentDraftChange={retainCommentDraft}
          onClearContentDraft={discardContentDraft}
          onClearCommentDraft={discardCommentDraft}
          onClearDetailDraft={discardDetailDraft}
        /></aside>
      </> : null}

      <Dialog title={quickEditIssue === null ? 'Edit issue properties' : `Edit ${quickEditIssue.identifier} properties`} open={quickEditIssue !== null && canWrite} onClose={closeQuickEdit}>
        {quickEditIssue !== null && canWrite ? <IssueQuickEditForm
          key={`${quickEditIssue.id}-${quickEditIssue.revision}`}
          issue={quickEditIssue}
          statuses={scopedStatuses}
          members={members}
          ownerMode={ownerMode}
          ownerDisplayName={members.find((member) => member.userId === currentUserId)?.displayName ?? 'Local owner'}
          projects={projects.data ?? []}
          milestones={visibleMilestones}
          pending={quickEdit.isPending || moveBoardIssue.isPending}
          error={quickEdit.error}
          onSubmit={submitQuickEdit}
        /> : null}
      </Dialog>
      <Dialog title={contextMilestone ? `New issue for ${contextMilestone.name}` : contextProject ? `New issue in ${contextProject.name}` : 'New issue'} open={createOpen && canWrite} onClose={() => setCreateOpen(false)} wide>
        {createOpen && canWrite ? <IssueCreateForm workspaceId={workspaceId} teams={scopedTeams} statuses={scopedStatuses} members={members} projects={projects.data ?? []} labels={labels.data ?? []} ownerMode={ownerMode} {...(systemTeam === undefined ? {} : { contextTeam: systemTeam })} {...(initialCreateAssigneeUserId === undefined ? {} : { initialAssigneeUserId: initialCreateAssigneeUserId })} {...(contextProject === undefined ? {} : { contextProject })} {...(contextMilestone === undefined ? {} : { contextMilestone })} {...(contextMilestones === undefined ? {} : { contextMilestones })} pending={create.isPending} error={create.error} onSubmit={(input) => create.mutate(input)} /> : null}
      </Dialog>
      <Dialog title="Labels" open={labelsOpen && canWrite} onClose={() => setLabelsOpen(false)}>
        {labelsOpen && canWrite ? <LabelManager workspaceId={workspaceId} labels={labels.data ?? []} /> : null}
      </Dialog>
      <Dialog title="Filter issues" open={filterOpen} onClose={() => setFilterOpen(false)} wide>
        {filterOpen ? <FilterBuilder state={viewState} teams={scopedTeams} statuses={scopedStatuses} members={members} projects={projects.data ?? []} milestones={visibleMilestones} labels={labels.data ?? []} excludedFields={excludedFilterFields} onApply={(filter) => { setInvalidUrlFilter(null); setViewState((current) => ({ ...current, filter })); setFilterOpen(false); }} /> : null}
      </Dialog>
      <Dialog title="Save view" open={saveViewOpen && canWrite} onClose={() => setSaveViewOpen(false)}>
        <form className="dialog-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); createSavedView.mutate({ name: String(data.get('name')) }); }}><Field label="Name" name="name" maxLength={80} /><ErrorNotice error={createSavedView.error} /><button className="button primary" disabled={createSavedView.isPending}>{createSavedView.isPending ? <Spinner /> : <Save size={14} />}Save view</button></form>
      </Dialog>
    </section>
  );
}
