import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import {
  IssueRichTextDocumentSchema,
  RichTextDocumentSchema,
} from '../src/index.js';

const richOverview = {
  version: 1,
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Delivery plan' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Keep ' },
        { type: 'text', text: 'recovery', marks: [{ type: 'bold' }] },
        {
          type: 'text',
          text: ' visible.',
          marks: [{
            type: 'link',
            attrs: { href: 'https://example.test/recovery', target: '_blank', rel: 'noopener noreferrer nofollow' },
          }],
        },
      ],
    },
  ],
} as const;

describe('shared rich-text contract', () => {
  it('accepts the rich project overview representation', () => {
    expect(Value.Check(RichTextDocumentSchema, richOverview)).toBe(true);
  });

  it('rejects the retired plain-paragraph representation', () => {
    expect(Value.Check(RichTextDocumentSchema, {
      version: 1,
      type: 'doc',
      content: [{ type: 'paragraph', text: 'Retired representation' }],
    })).toBe(false);
  });

  it('uses one document schema for project and issue rich text', () => {
    expect(IssueRichTextDocumentSchema).toBe(RichTextDocumentSchema);
  });
});
