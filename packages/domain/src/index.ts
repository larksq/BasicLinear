export const membershipRoles = ['owner', 'admin', 'member', 'guest'] as const;
export type MembershipRole = (typeof membershipRoles)[number];

export const statusCategories = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
] as const;
export type StatusCategory = (typeof statusCategories)[number];

export const projectStatuses = ['planned', 'in_progress', 'paused', 'completed', 'canceled'] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const projectPriorities = ['none', 'urgent', 'high', 'medium', 'low'] as const;
export type ProjectPriority = (typeof projectPriorities)[number];

export const issuePriorities = ['none', 'urgent', 'high', 'medium', 'low'] as const;
export type IssuePriority = (typeof issuePriorities)[number];

export const issueRelationTypes = ['blocks', 'related', 'duplicate', 'parent'] as const;
export type IssueRelationType = (typeof issueRelationTypes)[number];

export const issueFilterFields = [
  'teamId',
  'statusId',
  'priority',
  'assigneeUserId',
  'projectId',
  'milestoneId',
  'labelId',
  'dueDate',
] as const;
export type IssueFilterField = (typeof issueFilterFields)[number];

export const issueFilterOperators = [
  'is',
  'isNot',
  'in',
  'notIn',
  'isEmpty',
  'isNotEmpty',
  'before',
  'after',
] as const;
export type IssueFilterOperator = (typeof issueFilterOperators)[number];

export interface IssueFilterCondition {
  type: 'condition';
  field: IssueFilterField;
  operator: IssueFilterOperator;
  value: string | string[] | null;
}

export interface IssueFilterGroup {
  type: 'group';
  operator: 'and' | 'or';
  children: IssueFilterNode[];
}

export type IssueFilterNode = IssueFilterCondition | IssueFilterGroup;

export interface IssueFilterAst {
  version: 1;
  root: IssueFilterGroup;
}

export const issueViewLayouts = ['list', 'board'] as const;
export type IssueViewLayout = (typeof issueViewLayouts)[number];
export const issueViewGroupings = ['none', 'status', 'priority', 'assignee', 'project', 'milestone'] as const;
export type IssueViewGrouping = (typeof issueViewGroupings)[number];
export const issueViewOrderFields = ['updatedAt', 'identifier', 'priority', 'dueDate'] as const;
export type IssueViewOrderField = (typeof issueViewOrderFields)[number];
export const issueViewProperties = ['priority', 'assignee', 'project', 'milestone', 'labels', 'dueDate'] as const;
export type IssueViewProperty = (typeof issueViewProperties)[number];
export const issueViewDensities = ['compact', 'default', 'comfortable'] as const;
export type IssueViewDensity = (typeof issueViewDensities)[number];

export interface IssueViewState {
  version: 1;
  layout: IssueViewLayout;
  groupBy: IssueViewGrouping;
  order: { field: IssueViewOrderField; direction: 'asc' | 'desc' };
  visibleProperties: IssueViewProperty[];
  density: IssueViewDensity;
  filter: IssueFilterAst;
  searchQuery: string;
  archiveState: 'active' | 'archived' | 'all';
  collapsedGroups: string[];
}

export const defaultIssueViewState: IssueViewState = {
  version: 1,
  layout: 'list',
  groupBy: 'status',
  order: { field: 'updatedAt', direction: 'desc' },
  visibleProperties: ['priority', 'assignee', 'project', 'labels', 'dueDate'],
  density: 'default',
  filter: { version: 1, root: { type: 'group', operator: 'and', children: [] } },
  searchQuery: '',
  archiveState: 'active',
  collapsedGroups: [],
};

export const richTextNodeTypes = [
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
] as const;
export type RichTextNodeType = (typeof richTextNodeTypes)[number];

export const richTextMarkTypes = ['bold', 'italic', 'strike', 'code', 'link'] as const;
export type RichTextMarkType = (typeof richTextMarkTypes)[number];

export interface IssueRichTextMark {
  type: RichTextMarkType;
  attrs?: { href: string; target: '_blank'; rel: 'noopener noreferrer nofollow' };
}

export interface IssueRichTextNode {
  type: RichTextNodeType;
  attrs?: { level?: number; start?: number; language?: string | null };
  content?: IssueRichTextNode[];
  text?: string;
  marks?: IssueRichTextMark[];
}

export interface IssueRichTextDocument {
  version: 1;
  type: 'doc';
  content: IssueRichTextNode[];
}

export const projectIconTokens = ['briefcase', 'layers', 'target', 'compass', 'rocket'] as const;
export type ProjectIconToken = (typeof projectIconTokens)[number];

export const progressPolicy = 'project-progress-v1' as const;

export interface ProgressSnapshot {
  policy: typeof progressPolicy;
  issueCount: number;
  completedCount: number;
  canceledCount: number;
  eligibleCount: number;
  fraction: number;
}

export const capabilities = [
  'workspace:read',
  'workspace:manage',
  'membership:manage',
  'team:manage',
  'status:manage',
  'project:write',
  'project:purge',
  'milestone:purge',
  'issue:write',
  'issue:purge',
] as const;
export type Capability = (typeof capabilities)[number];

const roleCapabilities: Readonly<Record<MembershipRole, ReadonlySet<Capability>>> = {
  owner: new Set(capabilities),
  admin: new Set(capabilities.filter((capability) =>
    capability !== 'project:purge'
    && capability !== 'milestone:purge'
    && capability !== 'issue:purge')),
  member: new Set<Capability>(['workspace:read', 'project:write', 'issue:write']),
  guest: new Set<Capability>(['workspace:read']),
};

export type ErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'OIDC_AUTHENTICATION_FAILED'
  | 'OIDC_IDENTITY_CONFLICT'
  | 'OIDC_IDENTITY_NOT_LINKED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'SETUP_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly field: string | undefined;
  readonly currentRevision: number | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    options: { field?: string; currentRevision?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.field = options.field;
    this.currentRevision = options.currentRevision;
  }
}

export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('VALIDATION_ERROR', 'Enter a valid email address.', 400, { field: 'email' });
  }
  return email;
}

export function validatePassword(value: string): string {
  if (value.length < 12) {
    throw new AppError('VALIDATION_ERROR', 'Password must be at least 12 characters.', 400, {
      field: 'password',
    });
  }
  if (value.length > 1024) {
    throw new AppError('VALIDATION_ERROR', 'Password is too long.', 400, { field: 'password' });
  }
  return value;
}

export function normalizeName(value: string, field = 'name'): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 80) {
    throw new AppError('VALIDATION_ERROR', 'Name must be between 1 and 80 characters.', 400, {
      field,
    });
  }
  return name;
}

export function normalizeText(value: string, maxLength: number, field: string): string {
  const text = value.trim().replace(/\r\n?/g, '\n');
  if (text.length > maxLength) {
    throw new AppError('VALIDATION_ERROR', `${field} is too long.`, 400, { field });
  }
  return text;
}

export function normalizeOptionalText(
  value: string | null,
  maxLength: number,
  field: string,
): string | null {
  if (value === null) return null;
  const text = normalizeText(value, maxLength, field);
  return text === '' ? null : text;
}

export function normalizeDate(value: string | null, field: string): string | null {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError('VALIDATION_ERROR', 'Use a valid calendar date.', 400, { field });
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new AppError('VALIDATION_ERROR', 'Use a valid calendar date.', 400, { field });
  }
  return value;
}

export function normalizeColor(value: string, field = 'color'): string {
  const color = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) {
    throw new AppError('VALIDATION_ERROR', 'Choose a valid color.', 400, { field });
  }
  return color;
}

export function normalizeHttpUrl(value: string, field = 'url'): string {
  const text = value.trim();
  if (text.length < 1 || text.length > 2048) {
    throw new AppError('VALIDATION_ERROR', 'Enter a valid HTTP or HTTPS URL.', 400, { field });
  }
  try {
    const url = new URL(text);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username !== '' || url.password !== '') {
      throw new Error('unsupported URL');
    }
    return url.toString();
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Enter a valid HTTP or HTTPS URL.', 400, { field });
  }
}

export function parseProjectStatus(value: string): ProjectStatus {
  if (!projectStatuses.includes(value as ProjectStatus)) {
    throw new AppError('VALIDATION_ERROR', 'Choose a valid project status.', 400, { field: 'status' });
  }
  return value as ProjectStatus;
}

export function parseProjectPriority(value: string): ProjectPriority {
  if (!projectPriorities.includes(value as ProjectPriority)) {
    throw new AppError('VALIDATION_ERROR', 'Choose a valid project priority.', 400, { field: 'priority' });
  }
  return value as ProjectPriority;
}

export function parseIssuePriority(value: string): IssuePriority {
  if (!issuePriorities.includes(value as IssuePriority)) {
    throw new AppError('VALIDATION_ERROR', 'Choose a valid issue priority.', 400, {
      field: 'priority',
    });
  }
  return value as IssuePriority;
}

export function parseIssueRelationType(value: string): IssueRelationType {
  if (!issueRelationTypes.includes(value as IssueRelationType)) {
    throw new AppError('VALIDATION_ERROR', 'Choose a valid relation type.', 400, {
      field: 'type',
    });
  }
  return value as IssueRelationType;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new AppError('VALIDATION_ERROR', `Choose a valid ${field}.`, 400, { field });
  }
  return value as T;
}

function normalizeUuid(value: unknown, field: string): string {
  if (typeof value !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError('VALIDATION_ERROR', 'Choose a valid record.', 400, { field });
  }
  return value.toLowerCase();
}

export function normalizeIssueFilter(value: unknown, field = 'filter'): IssueFilterAst {
  if (!isObject(value) || value.version !== 1 || !isObject(value.root)) {
    throw new AppError('VALIDATION_ERROR', 'The issue filter is invalid.', 400, { field });
  }
  let nodeCount = 0;
  const normalizeNode = (candidate: unknown, depth: number, path: string): IssueFilterNode => {
    nodeCount += 1;
    if (nodeCount > 40 || depth > 4 || !isObject(candidate)) {
      throw new AppError('VALIDATION_ERROR', 'The issue filter is too complex.', 400, { field: path });
    }
    if (candidate.type === 'group') {
      const operator = parseEnumValue(candidate.operator, ['and', 'or'] as const, `${path}.operator`);
      if (!Array.isArray(candidate.children) || candidate.children.length > 20) {
        throw new AppError('VALIDATION_ERROR', 'The issue filter group is invalid.', 400, {
          field: `${path}.children`,
        });
      }
      const children = candidate.children.map((child, index) =>
        normalizeNode(child, depth + 1, `${path}.children.${index}`));
      const unique = new Map(children.map((child) => [JSON.stringify(child), child]));
      return {
        type: 'group',
        operator,
        children: [...unique.values()].sort((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right))),
      };
    }
    if (candidate.type !== 'condition') {
      throw new AppError('VALIDATION_ERROR', 'The issue filter node is invalid.', 400, { field: path });
    }
    const conditionField = parseEnumValue(candidate.field, issueFilterFields, `${path}.field`);
    const operator = parseEnumValue(candidate.operator, issueFilterOperators, `${path}.operator`);
    const emptyOperator = operator === 'isEmpty' || operator === 'isNotEmpty';
    const setOperator = operator === 'in' || operator === 'notIn';
    const dateOperator = operator === 'before' || operator === 'after';
    if (dateOperator && conditionField !== 'dueDate') {
      throw new AppError('VALIDATION_ERROR', 'This filter operator requires a due date.', 400, {
        field: `${path}.operator`,
      });
    }
    if (!dateOperator && conditionField === 'dueDate'
      && !['is', 'isNot', 'isEmpty', 'isNotEmpty', 'in', 'notIn'].includes(operator)) {
      throw new AppError('VALIDATION_ERROR', 'Choose a valid due-date operator.', 400, {
        field: `${path}.operator`,
      });
    }
    if (emptyOperator) return { type: 'condition', field: conditionField, operator, value: null };

    const normalizeScalar = (item: unknown, itemPath: string): string => {
      if (conditionField === 'priority') {
        if (typeof item !== 'string') {
          throw new AppError('VALIDATION_ERROR', 'Choose a valid priority.', 400, { field: itemPath });
        }
        return parseIssuePriority(item);
      }
      if (conditionField === 'dueDate') {
        if (typeof item !== 'string') {
          throw new AppError('VALIDATION_ERROR', 'Choose a valid due date.', 400, { field: itemPath });
        }
        return normalizeDate(item, itemPath) ?? '';
      }
      return normalizeUuid(item, itemPath);
    };

    if (setOperator) {
      if (!Array.isArray(candidate.value) || candidate.value.length < 1 || candidate.value.length > 50) {
        throw new AppError('VALIDATION_ERROR', 'Choose one or more filter values.', 400, {
          field: `${path}.value`,
        });
      }
      const normalized = candidate.value.map((item, index) =>
        normalizeScalar(item, `${path}.value.${index}`));
      return {
        type: 'condition',
        field: conditionField,
        operator,
        value: [...new Set(normalized)].sort(),
      };
    }
    return {
      type: 'condition',
      field: conditionField,
      operator,
      value: normalizeScalar(candidate.value, `${path}.value`),
    };
  };
  const root = normalizeNode(value.root, 1, `${field}.root`);
  if (root.type !== 'group') {
    throw new AppError('VALIDATION_ERROR', 'The issue filter root must be a group.', 400, {
      field: `${field}.root`,
    });
  }
  return { version: 1, root };
}

export function normalizeIssueViewState(value: unknown, field = 'state'): IssueViewState {
  if (!isObject(value) || value.version !== 1 || !isObject(value.order)) {
    throw new AppError('VALIDATION_ERROR', 'The saved view state is invalid.', 400, { field });
  }
  if (!Array.isArray(value.visibleProperties) || value.visibleProperties.length > issueViewProperties.length) {
    throw new AppError('VALIDATION_ERROR', 'The visible property set is invalid.', 400, {
      field: `${field}.visibleProperties`,
    });
  }
  const visibleProperties = value.visibleProperties.map((property, index) =>
    parseEnumValue(property, issueViewProperties, `${field}.visibleProperties.${index}`));
  if (new Set(visibleProperties).size !== visibleProperties.length) {
    throw new AppError('VALIDATION_ERROR', 'Visible properties must be unique.', 400, {
      field: `${field}.visibleProperties`,
    });
  }
  if (!Array.isArray(value.collapsedGroups) || value.collapsedGroups.length > 100
    || value.collapsedGroups.some((group) => typeof group !== 'string' || group.length > 120)) {
    throw new AppError('VALIDATION_ERROR', 'The collapsed group set is invalid.', 400, {
      field: `${field}.collapsedGroups`,
    });
  }
  return {
    version: 1,
    layout: parseEnumValue(value.layout, issueViewLayouts, `${field}.layout`),
    groupBy: parseEnumValue(value.groupBy, issueViewGroupings, `${field}.groupBy`),
    order: {
      field: parseEnumValue(value.order.field, issueViewOrderFields, `${field}.order.field`),
      direction: parseEnumValue(value.order.direction, ['asc', 'desc'] as const, `${field}.order.direction`),
    },
    visibleProperties,
    density: parseEnumValue(value.density, issueViewDensities, `${field}.density`),
    filter: normalizeIssueFilter(value.filter, `${field}.filter`),
    searchQuery: typeof value.searchQuery === 'string'
      ? normalizeText(value.searchQuery, 200, `${field}.searchQuery`)
      : (() => { throw new AppError('VALIDATION_ERROR', 'The search query is invalid.', 400, {
          field: `${field}.searchQuery`,
        }); })(),
    archiveState: parseEnumValue(
      value.archiveState,
      ['active', 'archived', 'all'] as const,
      `${field}.archiveState`,
    ),
    collapsedGroups: [...new Set(value.collapsedGroups as string[])].sort(),
  };
}

export function normalizeIssueDocument(value: unknown, field = 'descriptionDocument'): IssueRichTextDocument {
  if (!isObject(value) || value.version !== 1 || value.type !== 'doc' || !Array.isArray(value.content)) {
    throw new AppError('VALIDATION_ERROR', 'The rich-text document is invalid.', 400, { field });
  }

  let nodeCount = 0;
  let textLength = 0;
  const normalizeMarks = (marks: unknown, path: string): IssueRichTextMark[] | undefined => {
    if (marks === undefined) return undefined;
    if (!Array.isArray(marks) || marks.length > 20) {
      throw new AppError('VALIDATION_ERROR', 'The rich-text document is invalid.', 400, { field: path });
    }
    const normalized = marks.map((mark, index): IssueRichTextMark => {
      if (!isObject(mark) || typeof mark.type !== 'string'
        || !richTextMarkTypes.includes(mark.type as RichTextMarkType)) {
        throw new AppError('VALIDATION_ERROR', 'The rich-text document is invalid.', 400, {
          field: `${path}.${index}`,
        });
      }
      const type = mark.type as RichTextMarkType;
      if (type !== 'link') return { type };
      if (!isObject(mark.attrs) || typeof mark.attrs.href !== 'string') {
        throw new AppError('VALIDATION_ERROR', 'The rich-text link is invalid.', 400, {
          field: `${path}.${index}.attrs.href`,
        });
      }
      return {
        type,
        attrs: {
          href: normalizeHttpUrl(mark.attrs.href, `${path}.${index}.attrs.href`),
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      };
    });
    const unique = new Map(normalized.map((mark) => [JSON.stringify(mark), mark]));
    return [...unique.values()].sort((left, right) => left.type.localeCompare(right.type));
  };

  const normalizeNode = (node: unknown, depth: number, path: string): IssueRichTextNode => {
    nodeCount += 1;
    if (nodeCount > 1_000 || depth > 12 || !isObject(node) || typeof node.type !== 'string'
      || !richTextNodeTypes.includes(node.type as RichTextNodeType)) {
      throw new AppError('VALIDATION_ERROR', 'The rich-text document is invalid.', 400, { field: path });
    }
    const type = node.type as RichTextNodeType;
    if (type === 'text') {
      if (typeof node.text !== 'string' || node.content !== undefined || node.attrs !== undefined) {
        throw new AppError('VALIDATION_ERROR', 'The rich-text document is invalid.', 400, { field: path });
      }
      textLength += node.text.length;
      if (node.text.length > 20_000 || textLength > 100_000) {
        throw new AppError('VALIDATION_ERROR', 'The rich-text document is too long.', 400, { field });
      }
      const marks = normalizeMarks(node.marks, `${path}.marks`);
      return { type, text: node.text, ...(marks === undefined ? {} : { marks }) };
    }
    if (node.text !== undefined || node.marks !== undefined) {
      throw new AppError('VALIDATION_ERROR', 'The rich-text document is invalid.', 400, { field: path });
    }
    if (type === 'hardBreak' || type === 'horizontalRule') {
      if (node.content !== undefined || node.attrs !== undefined) {
        throw new AppError('VALIDATION_ERROR', 'The rich-text document is invalid.', 400, { field: path });
      }
      return { type };
    }

    let attrs: IssueRichTextNode['attrs'];
    if (node.attrs !== undefined) {
      if (!isObject(node.attrs)) {
        throw new AppError('VALIDATION_ERROR', 'The rich-text document is invalid.', 400, { field: `${path}.attrs` });
      }
      if (type === 'heading') {
        const level = node.attrs.level;
        if (!Number.isSafeInteger(level) || Number(level) < 1 || Number(level) > 3) {
          throw new AppError('VALIDATION_ERROR', 'Heading level must be between 1 and 3.', 400, {
            field: `${path}.attrs.level`,
          });
        }
        attrs = { level: Number(level) };
      } else if (type === 'orderedList') {
        const start = node.attrs.start ?? 1;
        if (!Number.isSafeInteger(start) || Number(start) < 1 || Number(start) > 10_000) {
          throw new AppError('VALIDATION_ERROR', 'Ordered-list start is invalid.', 400, {
            field: `${path}.attrs.start`,
          });
        }
        attrs = { start: Number(start) };
      } else if (type === 'codeBlock') {
        const language = node.attrs.language;
        if (language !== null && language !== undefined
          && (typeof language !== 'string' || language.length > 40 || !/^[a-zA-Z0-9_+.-]*$/.test(language))) {
          throw new AppError('VALIDATION_ERROR', 'Code-block language is invalid.', 400, {
            field: `${path}.attrs.language`,
          });
        }
        attrs = { language: language === undefined ? null : language as string | null };
      } else if (Object.keys(node.attrs).length > 0) {
        throw new AppError('VALIDATION_ERROR', 'The rich-text document is invalid.', 400, { field: `${path}.attrs` });
      }
    }
    const rawContent = node.content ?? (type === 'paragraph' ? [] : undefined);
    if (!Array.isArray(rawContent)) {
      throw new AppError('VALIDATION_ERROR', 'The rich-text document is invalid.', 400, { field: `${path}.content` });
    }
    const content = rawContent.map((child, index) => normalizeNode(child, depth + 1, `${path}.content.${index}`));
    return { type, ...(attrs === undefined ? {} : { attrs }), content };
  };

  return {
    version: 1,
    type: 'doc',
    content: value.content.map((node, index) => normalizeNode(node, 1, `${field}.content.${index}`)),
  };
}

export function parseProjectIcon(value: string): ProjectIconToken {
  if (!projectIconTokens.includes(value as ProjectIconToken)) {
    throw new AppError('VALIDATION_ERROR', 'Choose a valid project icon.', 400, { field: 'icon' });
  }
  return value as ProjectIconToken;
}

export function deriveProgress(categories: readonly StatusCategory[]): ProgressSnapshot {
  const completedCount = categories.filter((category) => category === 'completed').length;
  const canceledCount = categories.filter((category) => category === 'canceled').length;
  const eligibleCount = categories.length - canceledCount;
  return {
    policy: progressPolicy,
    issueCount: categories.length,
    completedCount,
    canceledCount,
    eligibleCount,
    fraction: eligibleCount === 0 ? 0 : completedCount / eligibleCount,
  };
}

export function assertUniqueOrder(items: readonly { id: string; expectedRevision: number }[]): void {
  if (items.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'At least one ordered item is required.', 400, {
      field: 'items',
    });
  }
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) {
    throw new AppError('VALIDATION_ERROR', 'Ordered items must be unique.', 400, { field: 'items' });
  }
  for (const item of items) assertExpectedRevision(item.expectedRevision, item.expectedRevision);
}

export function normalizeWorkspaceSlug(value: string): string {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(slug)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Workspace slug must use lowercase letters, numbers, and internal hyphens.',
      400,
      { field: 'slug' },
    );
  }
  return slug;
}

export function normalizeTeamKey(value: string): string {
  const key = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]{0,9}$/.test(key)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Team key must start with a letter and contain at most 10 letters or numbers.',
      400,
      { field: 'key' },
    );
  }
  return key;
}

export function assertCapability(role: MembershipRole, capability: Capability): void {
  if (!hasCapability(role, capability)) {
    throw new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403);
  }
}

export function hasCapability(role: MembershipRole, capability: Capability): boolean {
  return roleCapabilities[role].has(capability);
}

export function assertExpectedRevision(expected: number, current: number): void {
  if (!Number.isSafeInteger(expected) || expected < 1) {
    throw new AppError('VALIDATION_ERROR', 'A valid expected revision is required.', 400, {
      field: 'expectedRevision',
    });
  }
  if (expected !== current) {
    throw new AppError('CONFLICT', 'This record changed. Refresh and try again.', 409, {
      currentRevision: current,
    });
  }
}

export function parseMembershipRole(value: string): MembershipRole {
  if (!membershipRoles.includes(value as MembershipRole)) {
    throw new AppError('VALIDATION_ERROR', 'Choose a valid membership role.', 400, { field: 'role' });
  }
  return value as MembershipRole;
}

export function parseStatusCategory(value: string): StatusCategory {
  if (!statusCategories.includes(value as StatusCategory)) {
    throw new AppError('VALIDATION_ERROR', 'Choose a valid status category.', 400, {
      field: 'category',
    });
  }
  return value as StatusCategory;
}
