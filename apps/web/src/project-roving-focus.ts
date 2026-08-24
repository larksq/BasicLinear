export function resolveRovingProjectId(
  visibleProjectIds: readonly string[],
  preferredProjectId: string | null,
): string | null {
  if (visibleProjectIds.length === 0) return null;
  if (preferredProjectId !== null && visibleProjectIds.includes(preferredProjectId)) {
    return preferredProjectId;
  }
  return visibleProjectIds[0] ?? null;
}
