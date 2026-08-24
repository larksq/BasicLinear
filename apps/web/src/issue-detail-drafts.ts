import type {
  Issue,
  IssueResourceInput,
  IssueRichTextDocument,
} from '@openlinear/contracts';

type IssueContentSource = Pick<Issue,
  'id' | 'revision' | 'title' | 'descriptionDocument' | 'resources'>;

export interface IssueContentDraft {
  expectedRevision: number;
  title: string;
  descriptionDocument: IssueRichTextDocument;
  resources: IssueResourceInput[];
}

export interface IssueDetailDraft {
  content?: IssueContentDraft;
  comment?: IssueRichTextDocument;
}

export type IssueDetailDraftRegistry = Readonly<Record<string, IssueDetailDraft>>;

function cloneDocument(document: IssueRichTextDocument): IssueRichTextDocument {
  return JSON.parse(JSON.stringify(document)) as IssueRichTextDocument;
}

function cloneContentDraft(draft: IssueContentDraft): IssueContentDraft {
  return {
    ...draft,
    descriptionDocument: cloneDocument(draft.descriptionDocument),
    resources: draft.resources.map((resource) => ({ ...resource })),
  };
}

const meaningfulRichTextNodes = new Set([
  'blockquote',
  'bulletList',
  'codeBlock',
  'hardBreak',
  'heading',
  'horizontalRule',
  'orderedList',
]);

function documentHasMeaningfulContent(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(documentHasMeaningfulContent);
  if (typeof value !== 'object' || value === null) return false;
  const node = value as { type?: unknown; text?: unknown; content?: unknown };
  if (typeof node.text === 'string' && node.text.trim() !== '') return true;
  if (typeof node.type === 'string' && meaningfulRichTextNodes.has(node.type)) return true;
  return documentHasMeaningfulContent(node.content);
}

function documentsEqual(
  left: IssueRichTextDocument,
  right: IssueRichTextDocument,
): boolean {
  if (!documentHasMeaningfulContent(left) && !documentHasMeaningfulContent(right)) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

function resourcesEqual(
  left: readonly IssueResourceInput[],
  right: readonly IssueResourceInput[],
): boolean {
  return left.length === right.length && left.every((resource, index) => (
    resource.label === right[index]?.label && resource.url === right[index]?.url
  ));
}

function writeIssueDraft(
  registry: IssueDetailDraftRegistry,
  issueId: string,
  draft: IssueDetailDraft,
): IssueDetailDraftRegistry {
  const next: Record<string, IssueDetailDraft> = { ...registry };
  if (draft.content === undefined && draft.comment === undefined) delete next[issueId];
  else next[issueId] = draft;
  return next;
}

export function issueContentDraftFromIssue(issue: IssueContentSource): IssueContentDraft {
  return {
    expectedRevision: issue.revision,
    title: issue.title,
    descriptionDocument: cloneDocument(issue.descriptionDocument),
    resources: issue.resources.map(({ label, url }) => ({ label, url })),
  };
}

export function issueContentDraftDirty(
  issue: IssueContentSource,
  draft: IssueContentDraft,
): boolean {
  return draft.title !== issue.title
    || !documentsEqual(draft.descriptionDocument, issue.descriptionDocument)
    || !resourcesEqual(draft.resources, issue.resources);
}

export function issueCommentDraftHasContent(document: IssueRichTextDocument): boolean {
  const visit = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(visit);
    if (typeof value !== 'object' || value === null) return false;
    const node = value as { text?: unknown; content?: unknown };
    if (typeof node.text === 'string' && node.text.trim() !== '') return true;
    return visit(node.content);
  };
  return visit(document.content);
}

export function retainIssueContentDraft(
  registry: IssueDetailDraftRegistry,
  issue: IssueContentSource,
  draft: IssueContentDraft,
): IssueDetailDraftRegistry {
  const current = registry[issue.id];
  return writeIssueDraft(registry, issue.id, {
    ...(issueContentDraftDirty(issue, draft) ? { content: cloneContentDraft(draft) } : {}),
    ...(current?.comment === undefined ? {} : { comment: current.comment }),
  });
}

export function clearIssueContentDraft(
  registry: IssueDetailDraftRegistry,
  issueId: string,
): IssueDetailDraftRegistry {
  const current = registry[issueId];
  if (current?.content === undefined) return registry;
  return writeIssueDraft(registry, issueId, {
    ...(current.comment === undefined ? {} : { comment: current.comment }),
  });
}

export function retainIssueCommentDraft(
  registry: IssueDetailDraftRegistry,
  issueId: string,
  document: IssueRichTextDocument,
): IssueDetailDraftRegistry {
  const current = registry[issueId];
  return writeIssueDraft(registry, issueId, {
    ...(current?.content === undefined ? {} : { content: current.content }),
    ...(issueCommentDraftHasContent(document) ? { comment: cloneDocument(document) } : {}),
  });
}

export function clearIssueCommentDraft(
  registry: IssueDetailDraftRegistry,
  issueId: string,
): IssueDetailDraftRegistry {
  const current = registry[issueId];
  if (current?.comment === undefined) return registry;
  return writeIssueDraft(registry, issueId, {
    ...(current.content === undefined ? {} : { content: current.content }),
  });
}

export function clearIssueDetailDraft(
  registry: IssueDetailDraftRegistry,
  issueId: string,
): IssueDetailDraftRegistry {
  if (registry[issueId] === undefined) return registry;
  return writeIssueDraft(registry, issueId, {});
}
