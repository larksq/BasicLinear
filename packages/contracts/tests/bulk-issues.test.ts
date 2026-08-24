import { FormatRegistry } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import { BulkIssueMutationRequestSchema } from '../src/index.js';

FormatRegistry.Set('uuid', (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value));

const issueId = '11111111-1111-4111-8111-111111111111';
const labelId = '22222222-2222-4222-8222-222222222222';

function request(mutation: unknown): unknown {
  return { items: [{ id: issueId, expectedRevision: 3 }], mutation };
}

describe('bulk issue mutation contract', () => {
  it('accepts explicit non-empty label add and remove operations', () => {
    expect(Value.Check(BulkIssueMutationRequestSchema, request({
      type: 'labels', operation: 'add', labelIds: [labelId],
    }))).toBe(true);
    expect(Value.Check(BulkIssueMutationRequestSchema, request({
      type: 'labels', operation: 'remove', labelIds: [labelId],
    }))).toBe(true);
  });

  it('rejects empty, duplicate, unknown, and destructive replacement label operations', () => {
    expect(Value.Check(BulkIssueMutationRequestSchema, request({
      type: 'labels', operation: 'add', labelIds: [],
    }))).toBe(false);
    expect(Value.Check(BulkIssueMutationRequestSchema, request({
      type: 'labels', operation: 'add', labelIds: [labelId, labelId],
    }))).toBe(false);
    expect(Value.Check(BulkIssueMutationRequestSchema, request({
      type: 'labels', operation: 'replace', labelIds: [labelId],
    }))).toBe(false);
    expect(Value.Check(BulkIssueMutationRequestSchema, request({
      type: 'update', patch: { labelIds: [labelId] },
    }))).toBe(false);
  });
});
