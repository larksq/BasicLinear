export type NativeDateCommitDecision =
  | { action: 'commit'; value: string | null }
  | { action: 'restore'; value: string }
  | { action: 'none' };

export function validNativeDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function nativeDateCommitDecision(
  authoritativeValue: string | null,
  baselineValue: string | null,
  candidateValue: string,
  inputValid: boolean,
): NativeDateCommitDecision {
  if (baselineValue !== authoritativeValue) {
    return { action: 'restore', value: authoritativeValue ?? '' };
  }
  if (!inputValid || (candidateValue !== '' && !validNativeDate(candidateValue))) {
    return { action: 'restore', value: authoritativeValue ?? '' };
  }
  const candidate = candidateValue === '' ? null : candidateValue;
  return candidate === authoritativeValue
    ? { action: 'none' }
    : { action: 'commit', value: candidate };
}

export function nativeDateInputShouldSync(focused: boolean, dirty: boolean): boolean {
  return !focused || !dirty;
}
