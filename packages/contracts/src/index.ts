import { type Static, Type } from '@sinclair/typebox';

export type * from './transfer.js';

const Id = Type.String({ format: 'uuid' });
const Timestamp = Type.String({ format: 'date-time' });
const Revision = Type.Integer({ minimum: 1 });

export const ErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    correlationId: Type.String(),
    field: Type.Optional(Type.String()),
    currentRevision: Type.Optional(Revision),
  }),
});
export type ErrorResponse = Static<typeof ErrorResponseSchema>;

export const SetupStateSchema = Type.Object({
  setupRequired: Type.Boolean(),
  localAuthEnabled: Type.Literal(true),
  oidcRequired: Type.Literal(false),
  oidcEnabled: Type.Boolean(),
  oidcProviderName: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
});
export type SetupState = Static<typeof SetupStateSchema>;

export const SetupRequestSchema = Type.Object({
  setupToken: Type.String({ minLength: 1, maxLength: 512 }),
  email: Type.String({ minLength: 3, maxLength: 254 }),
  password: Type.String({ minLength: 12, maxLength: 1024 }),
  displayName: Type.String({ minLength: 1, maxLength: 80 }),
  workspaceName: Type.String({ minLength: 1, maxLength: 80 }),
  workspaceSlug: Type.String({ minLength: 1, maxLength: 48 }),
  teamName: Type.String({ minLength: 1, maxLength: 80 }),
  teamKey: Type.String({ minLength: 1, maxLength: 10 }),
});
export type SetupRequest = Static<typeof SetupRequestSchema>;

export const LoginRequestSchema = Type.Object({
  email: Type.String({ minLength: 3, maxLength: 254 }),
  password: Type.String({ minLength: 1, maxLength: 1024 }),
});
export type LoginRequest = Static<typeof LoginRequestSchema>;

export const PasswordChangeRequestSchema = Type.Object({
  currentPassword: Type.String({ minLength: 1, maxLength: 1024 }),
  newPassword: Type.String({ minLength: 12, maxLength: 1024 }),
});
export type PasswordChangeRequest = Static<typeof PasswordChangeRequestSchema>;

export const UserSchema = Type.Object({
  id: Id,
  email: Type.String(),
  displayName: Type.String(),
  revision: Revision,
});
export type User = Static<typeof UserSchema>;

export const OidcIdentitySchema = Type.Object({
  id: Id,
  issuer: Type.String({ minLength: 1, maxLength: 2048 }),
  subject: Type.String({ minLength: 1, maxLength: 1024 }),
  revision: Revision,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type OidcIdentity = Static<typeof OidcIdentitySchema>;

export const WorkspaceSchema = Type.Object({
  id: Id,
  name: Type.String(),
  slug: Type.String(),
  role: Type.Union([
    Type.Literal('owner'),
    Type.Literal('admin'),
    Type.Literal('member'),
    Type.Literal('guest'),
  ]),
  revision: Revision,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Workspace = Static<typeof WorkspaceSchema>;

export const WorkspaceEventSchema = Type.Object({
  cursor: Type.String({ pattern: '^[1-9][0-9]*$', maxLength: 19 }),
  workspaceId: Id,
  entityType: Type.String({ minLength: 1, maxLength: 80 }),
  entityId: Id,
  revision: Revision,
});
export type WorkspaceEvent = Static<typeof WorkspaceEventSchema>;

export const TeamSchema = Type.Object({
  id: Id,
  workspaceId: Id,
  name: Type.String(),
  key: Type.String(),
  revision: Revision,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Team = Static<typeof TeamSchema>;

export const MembershipSchema = Type.Object({
  id: Id,
  workspaceId: Id,
  userId: Id,
  email: Type.String(),
  displayName: Type.String(),
  role: Type.Union([
    Type.Literal('owner'),
    Type.Literal('admin'),
    Type.Literal('member'),
    Type.Literal('guest'),
  ]),
  revision: Revision,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Membership = Static<typeof MembershipSchema>;

export const WorkflowStatusSchema = Type.Object({
  id: Id,
  workspaceId: Id,
  teamId: Id,
  name: Type.String(),
  category: Type.Union([
    Type.Literal('backlog'),
    Type.Literal('unstarted'),
    Type.Literal('started'),
    Type.Literal('completed'),
    Type.Literal('canceled'),
  ]),
  color: Type.String(),
  position: Type.Number(),
  isDefault: Type.Boolean(),
  revision: Revision,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type WorkflowStatus = Static<typeof WorkflowStatusSchema>;

export const ProjectStatusSchema = Type.Union([
  Type.Literal('planned'),
  Type.Literal('in_progress'),
  Type.Literal('paused'),
  Type.Literal('completed'),
  Type.Literal('canceled'),
]);
export type ProjectStatus = Static<typeof ProjectStatusSchema>;
export const ProjectPrioritySchema = Type.Union([
  Type.Literal('none'),
  Type.Literal('urgent'),
  Type.Literal('high'),
  Type.Literal('medium'),
  Type.Literal('low'),
]);
export type ProjectPriority = Static<typeof ProjectPrioritySchema>;
export const ProjectIconSchema = Type.Union([
  Type.Literal('briefcase'),
  Type.Literal('layers'),
  Type.Literal('target'),
  Type.Literal('compass'),
  Type.Literal('rocket'),
]);
export type ProjectIcon = Static<typeof ProjectIconSchema>;

export const RichTextMarkSchema = Type.Object({
  type: Type.Union([
    Type.Literal('bold'),
    Type.Literal('italic'),
    Type.Literal('strike'),
    Type.Literal('code'),
    Type.Literal('link'),
  ]),
  attrs: Type.Optional(Type.Object({
    href: Type.String({ maxLength: 2048 }),
    target: Type.Optional(Type.Literal('_blank')),
    rel: Type.Optional(Type.String({ maxLength: 80 })),
    class: Type.Optional(Type.Union([Type.String({ maxLength: 120 }), Type.Null()])),
  }, { additionalProperties: false })),
}, { additionalProperties: false });

export const RichTextNodeSchema = Type.Recursive((Node) => Type.Union([
  Type.Object({
    type: Type.Literal('text'),
    text: Type.String({ maxLength: 20_000 }),
    marks: Type.Optional(Type.Array(RichTextMarkSchema, { maxItems: 20 })),
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('paragraph'),
    content: Type.Optional(Type.Array(Node, { maxItems: 1_000 })),
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('heading'),
    attrs: Type.Object({ level: Type.Integer({ minimum: 1, maximum: 3 }) }, { additionalProperties: false }),
    content: Type.Array(Node, { maxItems: 1_000 }),
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('bulletList'),
    content: Type.Array(Node, { maxItems: 1_000 }),
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('orderedList'),
    attrs: Type.Optional(Type.Object({
      start: Type.Integer({ minimum: 1, maximum: 10_000 }),
    }, { additionalProperties: false })),
    content: Type.Array(Node, { maxItems: 1_000 }),
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('listItem'),
    content: Type.Array(Node, { maxItems: 1_000 }),
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('blockquote'),
    content: Type.Array(Node, { maxItems: 1_000 }),
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('codeBlock'),
    attrs: Type.Optional(Type.Object({
      language: Type.Union([Type.String({ maxLength: 40 }), Type.Null()]),
    }, { additionalProperties: false })),
    content: Type.Array(Node, { maxItems: 1_000 }),
  }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal('hardBreak') }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal('horizontalRule') }, { additionalProperties: false }),
]));

export const RichTextDocumentSchema = Type.Object({
  version: Type.Literal(1),
  type: Type.Literal('doc'),
  content: Type.Array(RichTextNodeSchema, { maxItems: 1_000 }),
}, { additionalProperties: false });
export type RichTextDocument = Static<typeof RichTextDocumentSchema>;

export const ProjectProgressSchema = Type.Object({
  policy: Type.Literal('project-progress-v1'),
  issueCount: Type.Integer({ minimum: 0 }),
  completedCount: Type.Integer({ minimum: 0 }),
  canceledCount: Type.Integer({ minimum: 0 }),
  eligibleCount: Type.Integer({ minimum: 0 }),
  fraction: Type.Number({ minimum: 0, maximum: 1 }),
});
export type ProjectProgress = Static<typeof ProjectProgressSchema>;

export const ProjectResourceInputSchema = Type.Object({
  label: Type.String({ minLength: 1, maxLength: 120 }),
  url: Type.String({ minLength: 1, maxLength: 2048 }),
});
export type ProjectResourceInput = Static<typeof ProjectResourceInputSchema>;

export const ProjectResourceSchema = Type.Intersect([
  Type.Object({ id: Id, position: Type.Number({ minimum: 0 }) }),
  ProjectResourceInputSchema,
]);
export type ProjectResource = Static<typeof ProjectResourceSchema>;

export const ProjectSchema = Type.Object({
  id: Id,
  workspaceId: Id,
  teamId: Id,
  name: Type.String(),
  summary: Type.String(),
  status: ProjectStatusSchema,
  priority: ProjectPrioritySchema,
  leadUserId: Type.Union([Id, Type.Null()]),
  startDate: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
  targetDate: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
  icon: ProjectIconSchema,
  color: Type.String(),
  position: Type.Number({ minimum: 0 }),
  overviewDocument: RichTextDocumentSchema,
  resources: Type.Array(ProjectResourceSchema),
  progress: ProjectProgressSchema,
  archivedAt: Type.Union([Timestamp, Type.Null()]),
  revision: Revision,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Project = Static<typeof ProjectSchema>;

export const CreateProjectRequestSchema = Type.Object({
  teamId: Id,
  name: Type.String({ minLength: 1, maxLength: 80 }),
  summary: Type.Optional(Type.String({ maxLength: 280 })),
  status: Type.Optional(ProjectStatusSchema),
  priority: Type.Optional(ProjectPrioritySchema),
  leadUserId: Type.Optional(Type.Union([Id, Type.Null()])),
  startDate: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  targetDate: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  icon: Type.Optional(ProjectIconSchema),
  color: Type.Optional(Type.String({ pattern: '^#[0-9a-fA-F]{6}$' })),
  overviewDocument: Type.Optional(RichTextDocumentSchema),
  resources: Type.Optional(Type.Array(ProjectResourceInputSchema, { maxItems: 50 })),
  idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
}, { additionalProperties: false });
export type CreateProjectRequest = Static<typeof CreateProjectRequestSchema>;

export const UpdateProjectRequestSchema = Type.Intersect([
  Type.Object({ expectedRevision: Revision }),
  Type.Partial(Type.Object({
    teamId: Id,
    name: Type.String({ minLength: 1, maxLength: 80 }),
    summary: Type.String({ maxLength: 280 }),
    status: ProjectStatusSchema,
    priority: ProjectPrioritySchema,
    leadUserId: Type.Union([Id, Type.Null()]),
    startDate: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
    targetDate: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
    icon: ProjectIconSchema,
    color: Type.String({ pattern: '^#[0-9a-fA-F]{6}$' }),
    overviewDocument: RichTextDocumentSchema,
    resources: Type.Array(ProjectResourceInputSchema, { maxItems: 50 }),
  })),
]);
export type UpdateProjectRequest = Static<typeof UpdateProjectRequestSchema>;

export const PurgeProjectRequestSchema = Type.Object({
  expectedRevision: Revision,
  confirmation: Type.String({ minLength: 1, maxLength: 80 }),
}, { additionalProperties: false });
export type PurgeProjectRequest = Static<typeof PurgeProjectRequestSchema>;

export const PurgeProjectReceiptSchema = Type.Object({
  id: Id,
  name: Type.String(),
  detachedIssueCount: Type.Integer({ minimum: 0 }),
  removedMilestoneCount: Type.Integer({ minimum: 0 }),
  purgedAt: Timestamp,
}, { additionalProperties: false });
export type PurgeProjectReceipt = Static<typeof PurgeProjectReceiptSchema>;

export const ExpectedRevisionRequestSchema = Type.Object({ expectedRevision: Revision });
export type ExpectedRevisionRequest = Static<typeof ExpectedRevisionRequestSchema>;

export const ReorderRequestSchema = Type.Object({
  items: Type.Array(Type.Object({ id: Id, expectedRevision: Revision }), { minItems: 1, maxItems: 500 }),
}, { additionalProperties: false });
export type ReorderRequest = Static<typeof ReorderRequestSchema>;

export const MilestoneSchema = Type.Object({
  id: Id,
  workspaceId: Id,
  projectId: Id,
  name: Type.String(),
  description: Type.String(),
  targetDate: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
  position: Type.Number({ minimum: 0 }),
  progress: ProjectProgressSchema,
  archivedAt: Type.Union([Timestamp, Type.Null()]),
  revision: Revision,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Milestone = Static<typeof MilestoneSchema>;

export const CreateMilestoneRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
  description: Type.Optional(Type.String({ maxLength: 4000 })),
  targetDate: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
}, { additionalProperties: false });
export type CreateMilestoneRequest = Static<typeof CreateMilestoneRequestSchema>;

export const UpdateMilestoneRequestSchema = Type.Intersect([
  Type.Object({ expectedRevision: Revision }),
  Type.Partial(Type.Object({
    name: Type.String({ minLength: 1, maxLength: 80 }),
    description: Type.String({ maxLength: 4000 }),
    targetDate: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
  })),
]);
export type UpdateMilestoneRequest = Static<typeof UpdateMilestoneRequestSchema>;

export const PurgeMilestoneRequestSchema = Type.Object({
  expectedRevision: Revision,
  confirmation: Type.String({ minLength: 1, maxLength: 80 }),
}, { additionalProperties: false });
export type PurgeMilestoneRequest = Static<typeof PurgeMilestoneRequestSchema>;

export const PurgeMilestoneReceiptSchema = Type.Object({
  id: Id,
  projectId: Id,
  name: Type.String(),
  detachedIssueCount: Type.Integer({ minimum: 0 }),
  purgedAt: Timestamp,
}, { additionalProperties: false });
export type PurgeMilestoneReceipt = Static<typeof PurgeMilestoneReceiptSchema>;

export const IssuePrioritySchema = Type.Union([
  Type.Literal('none'),
  Type.Literal('urgent'),
  Type.Literal('high'),
  Type.Literal('medium'),
  Type.Literal('low'),
]);
export type IssuePriority = Static<typeof IssuePrioritySchema>;

export const IssueResourceInputSchema = ProjectResourceInputSchema;
export type IssueResourceInput = Static<typeof IssueResourceInputSchema>;

export const IssueResourceSchema = Type.Intersect([
  Type.Object({ id: Id, position: Type.Number({ minimum: 0 }) }),
  IssueResourceInputSchema,
]);
export type IssueResource = Static<typeof IssueResourceSchema>;

export const IssueRelationTypeSchema = Type.Union([
  Type.Literal('blocks'),
  Type.Literal('related'),
  Type.Literal('duplicate'),
  Type.Literal('parent'),
]);
export type IssueRelationType = Static<typeof IssueRelationTypeSchema>;

export const IssueRichTextMarkSchema = RichTextMarkSchema;
export const IssueRichTextNodeSchema = RichTextNodeSchema;
export const IssueRichTextDocumentSchema = RichTextDocumentSchema;
export type IssueRichTextDocument = RichTextDocument;

export const LabelSchema = Type.Object({
  id: Id,
  workspaceId: Id,
  name: Type.String(),
  color: Type.String(),
  archivedAt: Type.Union([Timestamp, Type.Null()]),
  revision: Revision,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Label = Static<typeof LabelSchema>;

export const CreateLabelRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 60 }),
  color: Type.String({ pattern: '^#[0-9a-fA-F]{6}$' }),
  idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
}, { additionalProperties: false });
export type CreateLabelRequest = Static<typeof CreateLabelRequestSchema>;

export const UpdateLabelRequestSchema = Type.Intersect([
  Type.Object({ expectedRevision: Revision }),
  Type.Partial(Type.Object({
    name: Type.String({ minLength: 1, maxLength: 60 }),
    color: Type.String({ pattern: '^#[0-9a-fA-F]{6}$' }),
  })),
]);
export type UpdateLabelRequest = Static<typeof UpdateLabelRequestSchema>;

export const IssueSchema = Type.Object({
  id: Id,
  workspaceId: Id,
  teamId: Id,
  sequenceNumber: Type.Integer({ minimum: 1 }),
  identifier: Type.String(),
  title: Type.String(),
  descriptionDocument: IssueRichTextDocumentSchema,
  statusId: Id,
  priority: IssuePrioritySchema,
  assigneeUserId: Type.Union([Id, Type.Null()]),
  dueDate: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
  projectId: Type.Union([Id, Type.Null()]),
  milestoneId: Type.Union([Id, Type.Null()]),
  labels: Type.Array(LabelSchema),
  resources: Type.Array(IssueResourceSchema),
  archivedAt: Type.Union([Timestamp, Type.Null()]),
  revision: Revision,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Issue = Static<typeof IssueSchema>;

export const CreateIssueRequestSchema = Type.Object({
  teamId: Id,
  title: Type.String({ minLength: 1, maxLength: 240 }),
  descriptionDocument: Type.Optional(IssueRichTextDocumentSchema),
  statusId: Type.Optional(Id),
  priority: Type.Optional(IssuePrioritySchema),
  assigneeUserId: Type.Optional(Type.Union([Id, Type.Null()])),
  dueDate: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  projectId: Type.Optional(Type.Union([Id, Type.Null()])),
  milestoneId: Type.Optional(Type.Union([Id, Type.Null()])),
  labelIds: Type.Optional(Type.Array(Id, { maxItems: 50, uniqueItems: true })),
  resources: Type.Optional(Type.Array(IssueResourceInputSchema, { maxItems: 50 })),
  idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
}, { additionalProperties: false });
export type CreateIssueRequest = Static<typeof CreateIssueRequestSchema>;

export const UpdateIssueRequestSchema = Type.Intersect([
  Type.Object({ expectedRevision: Revision }),
  Type.Partial(Type.Object({
    title: Type.String({ minLength: 1, maxLength: 240 }),
    descriptionDocument: IssueRichTextDocumentSchema,
    statusId: Id,
    priority: IssuePrioritySchema,
    assigneeUserId: Type.Union([Id, Type.Null()]),
    dueDate: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
    projectId: Type.Union([Id, Type.Null()]),
    milestoneId: Type.Union([Id, Type.Null()]),
    labelIds: Type.Array(Id, { maxItems: 50, uniqueItems: true }),
    resources: Type.Array(IssueResourceInputSchema, { maxItems: 50 }),
  })),
]);
export type UpdateIssueRequest = Static<typeof UpdateIssueRequestSchema>;

export const IssueReferenceSchema = Type.Object({
  id: Id,
  identifier: Type.String(),
  title: Type.String(),
  archivedAt: Type.Union([Timestamp, Type.Null()]),
});
export type IssueReference = Static<typeof IssueReferenceSchema>;

export const IssueRelationSchema = Type.Object({
  id: Id,
  workspaceId: Id,
  sourceIssueId: Id,
  targetIssueId: Id,
  type: IssueRelationTypeSchema,
  direction: Type.Union([
    Type.Literal('blocks'),
    Type.Literal('blocked_by'),
    Type.Literal('related'),
    Type.Literal('duplicate_of'),
    Type.Literal('duplicates'),
    Type.Literal('parent'),
    Type.Literal('sub_issue'),
  ]),
  otherIssue: IssueReferenceSchema,
  revision: Revision,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type IssueRelation = Static<typeof IssueRelationSchema>;

export const CreateIssueRelationRequestSchema = Type.Object({
  type: IssueRelationTypeSchema,
  targetIssueId: Id,
  idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
}, { additionalProperties: false });
export type CreateIssueRelationRequest = Static<typeof CreateIssueRelationRequestSchema>;

export const DeleteIssueRelationRequestSchema = Type.Object({ expectedRevision: Revision }, {
  additionalProperties: false,
});
export type DeleteIssueRelationRequest = Static<typeof DeleteIssueRelationRequestSchema>;

export const CommentSchema = Type.Object({
  id: Id,
  workspaceId: Id,
  issueId: Id,
  author: Type.Union([Type.Object({ id: Id, displayName: Type.String() }), Type.Null()]),
  bodyDocument: IssueRichTextDocumentSchema,
  archivedAt: Type.Union([Timestamp, Type.Null()]),
  revision: Revision,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Comment = Static<typeof CommentSchema>;

export const CreateCommentRequestSchema = Type.Object({
  bodyDocument: IssueRichTextDocumentSchema,
  idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
}, { additionalProperties: false });
export type CreateCommentRequest = Static<typeof CreateCommentRequestSchema>;

export const UpdateCommentRequestSchema = Type.Object({
  expectedRevision: Revision,
  bodyDocument: IssueRichTextDocumentSchema,
}, { additionalProperties: false });
export type UpdateCommentRequest = Static<typeof UpdateCommentRequestSchema>;

export const PurgeIssueRequestSchema = Type.Object({
  expectedRevision: Revision,
  confirmation: Type.String({ minLength: 1, maxLength: 32 }),
}, { additionalProperties: false });
export type PurgeIssueRequest = Static<typeof PurgeIssueRequestSchema>;

export const PurgeIssueReceiptSchema = Type.Object({
  id: Id,
  identifier: Type.String(),
  purgedAt: Timestamp,
});
export type PurgeIssueReceipt = Static<typeof PurgeIssueReceiptSchema>;

export const IssueFilterFieldSchema = Type.Union([
  Type.Literal('teamId'),
  Type.Literal('statusId'),
  Type.Literal('priority'),
  Type.Literal('assigneeUserId'),
  Type.Literal('projectId'),
  Type.Literal('milestoneId'),
  Type.Literal('labelId'),
  Type.Literal('dueDate'),
]);
export type IssueFilterField = Static<typeof IssueFilterFieldSchema>;

export const IssueFilterOperatorSchema = Type.Union([
  Type.Literal('is'),
  Type.Literal('isNot'),
  Type.Literal('in'),
  Type.Literal('notIn'),
  Type.Literal('isEmpty'),
  Type.Literal('isNotEmpty'),
  Type.Literal('before'),
  Type.Literal('after'),
]);
export type IssueFilterOperator = Static<typeof IssueFilterOperatorSchema>;

export const IssueFilterNodeSchema = Type.Recursive((Node) => Type.Union([
  Type.Object({
    type: Type.Literal('condition'),
    field: IssueFilterFieldSchema,
    operator: IssueFilterOperatorSchema,
    value: Type.Union([
      Type.String({ maxLength: 200 }),
      Type.Array(Type.String({ maxLength: 200 }), { minItems: 1, maxItems: 50, uniqueItems: true }),
      Type.Null(),
    ]),
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('group'),
    operator: Type.Union([Type.Literal('and'), Type.Literal('or')]),
    children: Type.Array(Node, { maxItems: 20 }),
  }, { additionalProperties: false }),
]));
export type IssueFilterNode = Static<typeof IssueFilterNodeSchema>;

export const IssueFilterAstSchema = Type.Object({
  version: Type.Literal(1),
  root: IssueFilterNodeSchema,
}, { additionalProperties: false });
export type IssueFilterAst = Static<typeof IssueFilterAstSchema>;

export const IssueViewLayoutSchema = Type.Union([Type.Literal('list'), Type.Literal('board')]);
export type IssueViewLayout = Static<typeof IssueViewLayoutSchema>;
export const IssueViewGroupingSchema = Type.Union([
  Type.Literal('none'),
  Type.Literal('status'),
  Type.Literal('priority'),
  Type.Literal('assignee'),
  Type.Literal('project'),
  Type.Literal('milestone'),
]);
export type IssueViewGrouping = Static<typeof IssueViewGroupingSchema>;
export const IssueViewOrderFieldSchema = Type.Union([
  Type.Literal('updatedAt'),
  Type.Literal('identifier'),
  Type.Literal('priority'),
  Type.Literal('dueDate'),
]);
export type IssueViewOrderField = Static<typeof IssueViewOrderFieldSchema>;
export const IssueViewPropertySchema = Type.Union([
  Type.Literal('priority'),
  Type.Literal('assignee'),
  Type.Literal('project'),
  Type.Literal('milestone'),
  Type.Literal('labels'),
  Type.Literal('dueDate'),
]);
export type IssueViewProperty = Static<typeof IssueViewPropertySchema>;
export const IssueViewDensitySchema = Type.Union([
  Type.Literal('compact'),
  Type.Literal('default'),
  Type.Literal('comfortable'),
]);
export type IssueViewDensity = Static<typeof IssueViewDensitySchema>;

export const IssueViewStateSchema = Type.Object({
  version: Type.Literal(1),
  layout: IssueViewLayoutSchema,
  groupBy: IssueViewGroupingSchema,
  order: Type.Object({
    field: IssueViewOrderFieldSchema,
    direction: Type.Union([Type.Literal('asc'), Type.Literal('desc')]),
  }, { additionalProperties: false }),
  visibleProperties: Type.Array(IssueViewPropertySchema, { maxItems: 6, uniqueItems: true }),
  density: IssueViewDensitySchema,
  filter: IssueFilterAstSchema,
  searchQuery: Type.String({ maxLength: 200 }),
  archiveState: Type.Union([
    Type.Literal('active'),
    Type.Literal('archived'),
    Type.Literal('all'),
  ]),
  collapsedGroups: Type.Array(Type.String({ maxLength: 120 }), { maxItems: 100, uniqueItems: true }),
}, { additionalProperties: false });
export type IssueViewState = Static<typeof IssueViewStateSchema>;

export const QueryIssuesRequestSchema = Type.Object({
  state: IssueViewStateSchema,
}, { additionalProperties: false });
export type QueryIssuesRequest = Static<typeof QueryIssuesRequestSchema>;

export const SavedViewSharingScopeSchema = Type.Union([
  Type.Literal('private'),
  Type.Literal('workspace'),
]);
export type SavedViewSharingScope = Static<typeof SavedViewSharingScopeSchema>;

export const SavedViewSchema = Type.Object({
  id: Id,
  workspaceId: Id,
  ownerUserId: Id,
  name: Type.String(),
  sharingScope: SavedViewSharingScopeSchema,
  state: IssueViewStateSchema,
  archivedAt: Type.Union([Timestamp, Type.Null()]),
  revision: Revision,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type SavedView = Static<typeof SavedViewSchema>;

export const CreateSavedViewRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
  sharingScope: SavedViewSharingScopeSchema,
  state: IssueViewStateSchema,
  idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
}, { additionalProperties: false });
export type CreateSavedViewRequest = Static<typeof CreateSavedViewRequestSchema>;

export const UpdateSavedViewRequestSchema = Type.Object({
  expectedRevision: Revision,
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
  sharingScope: Type.Optional(SavedViewSharingScopeSchema),
  state: Type.Optional(IssueViewStateSchema),
}, { additionalProperties: false });
export type UpdateSavedViewRequest = Static<typeof UpdateSavedViewRequestSchema>;

const BulkIssuePatchSchema = Type.Object({
  statusId: Type.Optional(Id),
  priority: Type.Optional(IssuePrioritySchema),
  assigneeUserId: Type.Optional(Type.Union([Id, Type.Null()])),
  dueDate: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  projectId: Type.Optional(Type.Union([Id, Type.Null()])),
  milestoneId: Type.Optional(Type.Union([Id, Type.Null()])),
}, { additionalProperties: false });

export const BulkIssueMutationRequestSchema = Type.Object({
  items: Type.Array(Type.Object({ id: Id, expectedRevision: Revision }, {
    additionalProperties: false,
  }), { minItems: 1, maxItems: 200 }),
  mutation: Type.Union([
    Type.Object({ type: Type.Literal('update'), patch: BulkIssuePatchSchema }, {
      additionalProperties: false,
    }),
    Type.Object({
      type: Type.Literal('labels'),
      operation: Type.Union([Type.Literal('add'), Type.Literal('remove')]),
      labelIds: Type.Array(Id, { minItems: 1, maxItems: 50, uniqueItems: true }),
    }, { additionalProperties: false }),
    Type.Object({ type: Type.Literal('archive') }, { additionalProperties: false }),
    Type.Object({ type: Type.Literal('restore') }, { additionalProperties: false }),
  ]),
}, { additionalProperties: false });
export type BulkIssueMutationRequest = Static<typeof BulkIssueMutationRequestSchema>;

export const BulkIssueMutationResultSchema = Type.Object({
  id: Id,
  status: Type.Union([Type.Literal('updated'), Type.Literal('conflict'), Type.Literal('failed')]),
  issue: Type.Optional(IssueSchema),
  error: Type.Optional(Type.Object({
    code: Type.String(),
    message: Type.String(),
    currentRevision: Type.Optional(Revision),
  }, { additionalProperties: false })),
}, { additionalProperties: false });
export type BulkIssueMutationResult = Static<typeof BulkIssueMutationResultSchema>;

export const SearchResultSchema = Type.Object({
  kind: Type.Union([Type.Literal('issue'), Type.Literal('project')]),
  id: Id,
  identifier: Type.Union([Type.String(), Type.Null()]),
  title: Type.String(),
  subtitle: Type.String(),
  matchedBy: Type.Union([
    Type.Literal('identifier'),
    Type.Literal('title'),
    Type.Literal('description'),
    Type.Literal('label'),
    Type.Literal('summary'),
  ]),
  rank: Type.Integer({ minimum: 0 }),
});
export type SearchResult = Static<typeof SearchResultSchema>;

export const ActivityFieldChangeSchema = Type.Object({
  field: Type.String(),
  before: Type.Unknown(),
  after: Type.Unknown(),
});
export const ActivityEntrySchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
  entityType: Type.String(),
  entityId: Id,
  action: Type.String(),
  entityRevision: Revision,
  actor: Type.Union([Type.Object({ id: Id, displayName: Type.String() }), Type.Null()]),
  fields: Type.Array(ActivityFieldChangeSchema),
  createdAt: Timestamp,
});
export type ActivityEntry = Static<typeof ActivityEntrySchema>;

export const SessionSchema = Type.Object({
  user: UserSchema,
  workspaces: Type.Array(WorkspaceSchema),
});
export type Session = Static<typeof SessionSchema>;

export const CreateWorkspaceRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
  slug: Type.String({ minLength: 1, maxLength: 48 }),
  idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
});
export type CreateWorkspaceRequest = Static<typeof CreateWorkspaceRequestSchema>;

export const CreateTeamRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
  key: Type.String({ minLength: 1, maxLength: 10 }),
  idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
});
export type CreateTeamRequest = Static<typeof CreateTeamRequestSchema>;

export const CreateMembershipRequestSchema = Type.Object({
  email: Type.String({ minLength: 3, maxLength: 254 }),
  displayName: Type.String({ minLength: 1, maxLength: 80 }),
  password: Type.String({ minLength: 12, maxLength: 1024 }),
  role: Type.Union([Type.Literal('admin'), Type.Literal('member'), Type.Literal('guest')]),
  idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
});
export type CreateMembershipRequest = Static<typeof CreateMembershipRequestSchema>;

export const CreateStatusRequestSchema = Type.Object({
  teamId: Id,
  name: Type.String({ minLength: 1, maxLength: 80 }),
  category: Type.Union([
    Type.Literal('backlog'),
    Type.Literal('unstarted'),
    Type.Literal('started'),
    Type.Literal('completed'),
    Type.Literal('canceled'),
  ]),
  color: Type.String({ pattern: '^#[0-9a-fA-F]{6}$' }),
  position: Type.Number({ minimum: 0 }),
  idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
});
export type CreateStatusRequest = Static<typeof CreateStatusRequestSchema>;

export const UpdateStatusRequestSchema = Type.Intersect([
  Type.Object({ expectedRevision: Revision }),
  Type.Partial(Type.Object({
    name: Type.String({ minLength: 1, maxLength: 80 }),
    category: Type.Union([
      Type.Literal('backlog'),
      Type.Literal('unstarted'),
      Type.Literal('started'),
      Type.Literal('completed'),
      Type.Literal('canceled'),
    ]),
    color: Type.String({ pattern: '^#[0-9a-fA-F]{6}$' }),
    position: Type.Number({ minimum: 0 }),
  })),
]);
export type UpdateStatusRequest = Static<typeof UpdateStatusRequestSchema>;

export const RetireStatusRequestSchema = Type.Object({
  expectedRevision: Revision,
  replacementStatusId: Id,
  replacementExpectedRevision: Revision,
}, { additionalProperties: false });
export type RetireStatusRequest = Static<typeof RetireStatusRequestSchema>;

export const RetireStatusResultSchema = Type.Object({
  retiredStatusId: Id,
  replacementStatusId: Id,
  reassignedIssueCount: Type.Integer({ minimum: 0 }),
  statuses: Type.Array(WorkflowStatusSchema),
}, { additionalProperties: false });
export type RetireStatusResult = Static<typeof RetireStatusResultSchema>;

export const ListResponse = <T extends Parameters<typeof Type.Array>[0]>(item: T) =>
  Type.Object({ data: Type.Array(item) });

export const DataResponse = <T extends Parameters<typeof Type.Object>[0][string]>(item: T) =>
  Type.Object({ data: item });
