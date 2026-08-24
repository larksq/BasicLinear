export function resolveRovingIssueId(
  visibleIssueIds: readonly string[],
  preferredIssueId: string | null,
  activeIssueId: string | null,
): string | null {
  if (visibleIssueIds.length === 0) return null;
  const visibleIds = new Set(visibleIssueIds);
  if (preferredIssueId !== null && visibleIds.has(preferredIssueId)) return preferredIssueId;
  if (activeIssueId !== null && visibleIds.has(activeIssueId)) return activeIssueId;
  return visibleIssueIds[0] ?? null;
}
