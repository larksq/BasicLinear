import type {
  Comment,
  IssueRichTextDocument,
  UpdateCommentRequest,
} from '@openlinear/contracts';
import { normalizeIssueDocument } from '@openlinear/domain';

type CommentEditSource = Pick<Comment,
  'revision' | 'bodyDocument' | 'archivedAt'>;

function cloneDocument(document: IssueRichTextDocument): IssueRichTextDocument {
  return JSON.parse(JSON.stringify(document)) as IssueRichTextDocument;
}

function documentText(document: IssueRichTextDocument): string {
  const values: string[] = [];
  const visit = (node: IssueRichTextDocument['content'][number]) => {
    if (node.type === 'text' && node.text !== undefined) values.push(node.text);
    if ('content' in node) for (const child of node.content ?? []) visit(child);
  };
  for (const node of document.content) visit(node);
  return values.join(' ').trim();
}

export function commentEditDraft(comment: CommentEditSource): IssueRichTextDocument {
  return cloneDocument(comment.bodyDocument);
}

export function commentEditRequest(
  comment: CommentEditSource,
  draft: IssueRichTextDocument,
): UpdateCommentRequest | null {
  if (
    comment.archivedAt !== null
    || !Number.isSafeInteger(comment.revision)
    || comment.revision < 1
  ) return null;

  try {
    const baseline = normalizeIssueDocument(
      comment.bodyDocument,
      'bodyDocument',
    ) as unknown as IssueRichTextDocument;
    const bodyDocument = normalizeIssueDocument(
      draft,
      'bodyDocument',
    ) as unknown as IssueRichTextDocument;
    if (
      documentText(bodyDocument) === ''
      || JSON.stringify(bodyDocument) === JSON.stringify(baseline)
    ) return null;
    return { expectedRevision: comment.revision, bodyDocument };
  } catch {
    return null;
  }
}
