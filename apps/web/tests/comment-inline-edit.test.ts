import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Comment, IssueRichTextDocument } from '@basiclinear/contracts';
import { describe, expect, it } from 'vitest';
import {
  commentEditDraft,
  commentEditRequest,
} from '../src/comment-inline-edit.js';

const richDocument = (text: string): IssueRichTextDocument => ({
  version: 1,
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const comment = (overrides: Partial<Comment> = {}): Comment => ({
  id: '71000000-0000-4000-8000-000000000023',
  workspaceId: '20000000-0000-4000-8000-000000000023',
  issueId: '70000000-0000-4000-8000-000000000023',
  author: { id: '10000000-0000-4000-8000-000000000023', displayName: 'Jordan Lee' },
  bodyDocument: richDocument('Keep the chronology visible.'),
  archivedAt: null,
  revision: 7,
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
  ...overrides,
});

describe('inline comment edit requests', () => {
  it('copies the authoritative document into an isolated draft', () => {
    const current = comment();
    const draft = commentEditDraft(current);
    expect(draft).toEqual(current.bodyDocument);
    expect(draft).not.toBe(current.bodyDocument);
    expect(draft.content[0]).not.toBe(current.bodyDocument.content[0]);
  });

  it('emits normalized rich text against the opening revision', () => {
    expect(commentEditRequest(comment(), richDocument('Retain the revised draft.'))).toEqual({
      expectedRevision: 7,
      bodyDocument: richDocument('Retain the revised draft.'),
    });
  });

  it('suppresses semantic no-ops after mark normalization', () => {
    const baseline = {
      version: 1,
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Same meaning',
          marks: [{ type: 'italic' }, { type: 'bold' }, { type: 'bold' }],
        }],
      }],
    } as IssueRichTextDocument;
    const reordered = {
      version: 1,
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Same meaning',
          marks: [{ type: 'bold' }, { type: 'italic' }],
        }],
      }],
    } as IssueRichTextDocument;
    expect(commentEditRequest(comment({ bodyDocument: baseline }), reordered)).toBeNull();
  });

  it('fails closed for empty, invalid, archived, or non-revisioned edits', () => {
    const changed = richDocument('Changed content');
    expect(commentEditRequest(comment(), richDocument('   '))).toBeNull();
    expect(commentEditRequest(comment(), {
      version: 1,
      type: 'doc',
      content: [{ type: 'unsupported' }],
    } as unknown as IssueRichTextDocument)).toBeNull();
    expect(commentEditRequest(comment({ archivedAt: '2026-08-20T00:00:00.000Z' }), changed)).toBeNull();
    expect(commentEditRequest(comment({ revision: 0 }), changed)).toBeNull();
  });

  it('locks the chronology surface to explicit recovery and a stateful fixture', async () => {
    const root = join(import.meta.dirname, '..', '..', '..');
    const [issues, styles, fixture] = await Promise.all([
      readFile(join(root, 'apps/web/src/issues.tsx'), 'utf8'),
      readFile(join(root, 'apps/web/src/styles.css'), 'utf8'),
      readFile(join(root, 'scripts/serve-visual-fixture.mjs'), 'utf8'),
    ]);
    expect(issues).toContain('Save comment');
    expect(issues).toContain('Retry draft');
    expect(issues).toContain('Use server values');
    expect(issues).toContain('commentRevisionMutationPending');
    expect(issues).toContain("api.comments(workspaceId, issueId, true)");
    expect(issues).toContain('comment.author?.id === currentUserId');
    expect(issues).not.toContain('<Dialog title="Edit comment"');
    expect(styles).toContain('.comment-edit-recovery {');
    expect(styles).toContain('.comment-edit-feedback {');
    expect(fixture).toContain("fixtureName(request) === 'comment-inline-edit'");
    expect(fixture).toContain('Change the comment before saving.');
  });
});
