import type { IssueFilterAst } from '@basiclinear/contracts';
import { normalizeIssueFilter } from '@basiclinear/domain';

export const invalidFilterDisplayLimit = 240;

export interface ParsedIssueUrlFilter {
  filter: IssueFilterAst | null;
  invalidClause: string | null;
}

function boundedClause(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= invalidFilterDisplayLimit) return compact;
  return `${compact.slice(0, invalidFilterDisplayLimit - 3)}...`;
}

export function parseIssueUrlFilter(value: string | null): ParsedIssueUrlFilter {
  if (value === null) return { filter: null, invalidClause: null };
  try {
    return {
      filter: normalizeIssueFilter(JSON.parse(value), 'url.filter'),
      invalidClause: null,
    };
  } catch {
    return {
      filter: null,
      invalidClause: boundedClause(value) || '(empty filter clause)',
    };
  }
}
