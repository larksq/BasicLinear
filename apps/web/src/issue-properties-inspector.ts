export const issuePropertiesInspectorBreakpoint = 768;
export const issuePropertiesInspectorDesktopQuery = '(min-width: '
  + issuePropertiesInspectorBreakpoint
  + 'px)';

export type IssuePropertiesInspectorEvent =
  | { type: 'toggle' }
  | { type: 'viewport' | 'issue'; desktop: boolean }
  | { type: 'require-visible' };

export function issuePropertiesInspectorInitialOpen(desktop: boolean): boolean {
  return desktop;
}

export function issuePropertiesInspectorState(
  current: boolean,
  event: IssuePropertiesInspectorEvent,
): boolean {
  if (event.type === 'toggle') return !current;
  if (event.type === 'require-visible') return true;
  return event.desktop;
}
