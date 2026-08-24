import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Issue, IssueRichTextDocument } from '@openlinear/contracts';
import {
  clearIssueCommentDraft,
  clearIssueContentDraft,
  clearIssueDetailDraft,
  issueCommentDraftHasContent,
  issueContentDraftDirty,
  issueContentDraftFromIssue,
  retainIssueCommentDraft,
  retainIssueContentDraft,
} from '../src/issue-detail-drafts.js';

const draftSourcePath = fileURLToPath(new URL('../src/issue-detail-drafts.ts', import.meta.url));
const issuesSourcePath = fileURLToPath(new URL('../src/issues.tsx', import.meta.url));
const stylesPath = fileURLToPath(new URL('../src/styles.css', import.meta.url));

type IssueContentSource = Pick<Issue,
  'id' | 'revision' | 'title' | 'descriptionDocument' | 'resources'>;

const emptyDocument: IssueRichTextDocument = { version: 1, type: 'doc', content: [] };
const textDocument = (text: string): IssueRichTextDocument => ({
  version: 1,
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const emptyParagraphDocument: IssueRichTextDocument = {
  version: 1,
  type: 'doc',
  content: [{ type: 'paragraph' }],
};
const issueSource = (id = 'issue-a'): IssueContentSource => ({
  id,
  revision: 4,
  title: `Issue ${id}`,
  descriptionDocument: textDocument('Server description'),
  resources: [{ id: `${id}-resource`, position: 0, label: 'Spec', url: 'https://example.com/spec' }],
});

describe('issue detail draft registry', () => {
  it('creates a content draft without retaining resource persistence metadata', () => {
    const issue = issueSource();
    const draft = issueContentDraftFromIssue(issue);

    expect(draft).toEqual({
      expectedRevision: 4,
      title: 'Issue issue-a',
      descriptionDocument: textDocument('Server description'),
      resources: [{ label: 'Spec', url: 'https://example.com/spec' }],
    });
    expect(draft.descriptionDocument).not.toBe(issue.descriptionDocument);
    expect(draft.resources[0]).not.toBe(issue.resources[0]);
  });

  it('detects content changes while ignoring revision metadata alone', () => {
    const issue = issueSource();
    const baseline = issueContentDraftFromIssue(issue);

    expect(issueContentDraftDirty(issue, { ...baseline, expectedRevision: 99 })).toBe(false);
    expect(issueContentDraftDirty(issue, { ...baseline, title: 'Changed' })).toBe(true);
    expect(issueContentDraftDirty(issue, {
      ...baseline,
      descriptionDocument: textDocument('Changed description'),
    })).toBe(true);
    expect(issueContentDraftDirty(issue, {
      ...baseline,
      resources: [{ label: 'Runbook', url: 'https://example.com/runbook' }],
    })).toBe(true);
  });

  it('treats editor-normalized empty documents as clean without hiding structural edits', () => {
    const issue = { ...issueSource(), descriptionDocument: emptyDocument };
    const baseline = issueContentDraftFromIssue(issue);
    const structuredDocument: IssueRichTextDocument = {
      version: 1,
      type: 'doc',
      content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }],
    };

    expect(issueContentDraftDirty(issue, {
      ...baseline,
      descriptionDocument: emptyParagraphDocument,
    })).toBe(false);
    expect(issueContentDraftDirty(issue, {
      ...baseline,
      descriptionDocument: textDocument('   '),
    })).toBe(false);
    expect(retainIssueContentDraft({}, issue, {
      ...baseline,
      descriptionDocument: emptyParagraphDocument,
    })).toEqual({});
    expect(issueContentDraftDirty(issue, {
      ...baseline,
      descriptionDocument: structuredDocument,
    })).toBe(true);
    expect(issueContentDraftDirty(issue, {
      ...baseline,
      descriptionDocument: textDocument('Meaningful change'),
    })).toBe(true);
  });

  it('retains content by issue identity and prunes server-equivalent records', () => {
    const issueA = issueSource('issue-a');
    const issueB = issueSource('issue-b');
    const draftA = { ...issueContentDraftFromIssue(issueA), title: 'Draft A' };
    const draftB = { ...issueContentDraftFromIssue(issueB), title: 'Draft B' };

    const retainedA = retainIssueContentDraft({}, issueA, draftA);
    const retainedBoth = retainIssueContentDraft(retainedA, issueB, draftB);
    expect(retainedBoth['issue-a']?.content?.title).toBe('Draft A');
    expect(retainedBoth['issue-b']?.content?.title).toBe('Draft B');

    const restoredA = retainIssueContentDraft(
      retainedBoth,
      issueA,
      issueContentDraftFromIssue(issueA),
    );
    expect(restoredA['issue-a']).toBeUndefined();
    expect(restoredA['issue-b']?.content?.title).toBe('Draft B');
    expect(clearIssueContentDraft(restoredA, 'issue-b')).toEqual({});
  });

  it('retains only meaningful new comments and clears draft kinds independently', () => {
    const issue = issueSource();
    const whitespace = textDocument('   ');
    const comment = textDocument('Keep this comment with issue A');
    const content = { ...issueContentDraftFromIssue(issue), title: 'Draft title' };

    expect(issueCommentDraftHasContent(emptyDocument)).toBe(false);
    expect(issueCommentDraftHasContent(whitespace)).toBe(false);
    expect(issueCommentDraftHasContent(comment)).toBe(true);
    expect(retainIssueCommentDraft({}, issue.id, whitespace)).toEqual({});

    const both = retainIssueCommentDraft(
      retainIssueContentDraft({}, issue, content),
      issue.id,
      comment,
    );
    expect(clearIssueCommentDraft(both, issue.id)[issue.id]?.content?.title).toBe('Draft title');
    expect(clearIssueContentDraft(both, issue.id)[issue.id]?.comment).toEqual(comment);
    expect(clearIssueDetailDraft(both, issue.id)).toEqual({});
  });

  it('binds controlled editors to workspace-scoped, issue-keyed in-memory state', async () => {
    const [draftSource, source] = await Promise.all([
      readFile(draftSourcePath, 'utf8'),
      readFile(issuesSourcePath, 'utf8'),
    ]);
    const issueDetailSource = source.slice(
      source.indexOf('function IssueDetail('),
      source.indexOf('function cloneIssueViewState('),
    );

    expect(source).toContain('value={editing ? editableDraft.title : issue.title}');
    expect(issueDetailSource).toContain('onContentDraftChange(current, draft)');
    expect(issueDetailSource).toContain('bodyDocument: detailDraft?.comment ?? emptyDocument');
    expect(issueDetailSource).toContain('key={`${current.id}:${commentEditorKey}`}');
    expect(source).toContain('current.workspaceId === workspaceId ? current.drafts : {}');
    expect(source).toContain('key={`${workspaceId}:${selectedIssueId}`}');
    expect(issueDetailSource).not.toContain('useState<IssueRichTextDocument>(emptyDocument)');
    expect(draftSource).not.toMatch(/localStorage|sessionStorage|indexedDB/i);
  });

  it('keeps retained-draft status and actions bounded at desktop and mobile widths', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toContain('.issue-draft-banner { min-height: 54px; display: grid; grid-template-columns: 18px minmax(0, 1fr) auto;');
    expect(styles).toContain('.issue-draft-copy p { min-width: 0;');
    expect(styles).toContain('.issue-draft-actions .button { min-height: 30px; white-space: nowrap; }');
    expect(styles).toContain('.issue-draft-banner { grid-template-columns: 18px minmax(0, 1fr); align-items: start; }');
    expect(styles).toContain('.issue-draft-actions { grid-column: 1 / -1; flex-wrap: wrap; justify-content: flex-start; padding-left: 28px; }');
  });
});
