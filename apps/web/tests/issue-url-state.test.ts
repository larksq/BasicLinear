import { describe, expect, it } from 'vitest';
import { invalidFilterDisplayLimit, parseIssueUrlFilter } from '../src/issue-url-state.js';

describe('issue URL filter restoration', () => {
  it('distinguishes an absent filter from an invalid one', () => {
    expect(parseIssueUrlFilter(null)).toEqual({ filter: null, invalidClause: null });
    expect(parseIssueUrlFilter('')).toEqual({ filter: null, invalidClause: '(empty filter clause)' });
  });

  it('normalizes a valid versioned filter', () => {
    const encoded = JSON.stringify({
      version: 1,
      root: {
        type: 'group',
        operator: 'and',
        children: [
          { type: 'condition', field: 'priority', operator: 'is', value: 'high' },
        ],
      },
    });
    expect(parseIssueUrlFilter(encoded)).toEqual({
      filter: {
        version: 1,
        root: {
          type: 'group',
          operator: 'and',
          children: [
            { type: 'condition', field: 'priority', operator: 'is', value: 'high' },
          ],
        },
      },
      invalidClause: null,
    });
  });

  it.each([
    ['malformed JSON', '{"version":1'],
    ['unsupported version', '{"version":2,"root":{"type":"group","operator":"and","children":[]}}'],
    ['invalid operator', '{"version":1,"root":{"type":"group","operator":"and","children":[{"type":"condition","field":"priority","operator":"contains","value":"high"}]}}'],
    ['invalid record identifier', '{"version":1,"root":{"type":"group","operator":"and","children":[{"type":"condition","field":"projectId","operator":"is","value":"not-a-uuid"}]}}'],
  ])('fails closed for %s', (_label, encoded) => {
    const restored = parseIssueUrlFilter(encoded);
    expect(restored.filter).toBeNull();
    expect(restored.invalidClause).toBeTruthy();
  });

  it('bounds the visible broken clause', () => {
    const restored = parseIssueUrlFilter(`{${'x'.repeat(500)}`);
    expect(restored.invalidClause).toHaveLength(invalidFilterDisplayLimit);
    expect(restored.invalidClause?.endsWith('...')).toBe(true);
  });
});
