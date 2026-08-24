import type { Label, UpdateLabelRequest } from '@openlinear/contracts';

type LabelEditSource = Pick<Label, 'revision' | 'name' | 'color' | 'archivedAt'>;

export interface LabelEditDraft {
  name: string;
  color: string;
}

function normalizedName(value: string): string | null {
  const normalized = value.trim().replace(/\r\n?/g, '\n');
  return normalized.length >= 1 && normalized.length <= 60 ? normalized : null;
}

function normalizedColor(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : null;
}

export function labelEditDraft(label: LabelEditSource): LabelEditDraft {
  return { name: label.name, color: label.color };
}

export function labelEditRequest(
  label: LabelEditSource,
  draft: LabelEditDraft,
): UpdateLabelRequest | null {
  if (
    label.archivedAt !== null
    || !Number.isSafeInteger(label.revision)
    || label.revision < 1
  ) return null;

  const name = normalizedName(draft.name);
  const color = normalizedColor(draft.color);
  const baselineName = normalizedName(label.name);
  const baselineColor = normalizedColor(label.color);
  if (name === null || color === null || baselineName === null || baselineColor === null) return null;

  const request: UpdateLabelRequest = { expectedRevision: label.revision };
  if (name !== baselineName) request.name = name;
  if (color !== baselineColor) request.color = color;
  return Object.keys(request).length > 1 ? request : null;
}
