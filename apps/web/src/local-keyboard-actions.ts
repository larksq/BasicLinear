export type IssueViewKeyAction = 'focus-search' | 'open-filter' | 'toggle-layout';
export type RecordKeyAction = 'open' | 'toggle-selection' | 'next' | 'previous' | 'open-menu';

export interface LocalKeyInput {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
  withinExcludedTarget: boolean;
  selectionEnabled: boolean;
  menuEnabled?: boolean;
}

function isEligible(input: LocalKeyInput): boolean {
  return !input.defaultPrevented
    && !input.isComposing
    && !input.altKey
    && !input.ctrlKey
    && !input.metaKey
    && !input.shiftKey
    && !input.withinExcludedTarget;
}

export function resolveIssueViewKeyAction(input: LocalKeyInput): IssueViewKeyAction | null {
  if (!isEligible(input) || input.repeat) return null;
  const key = input.key.toLowerCase();
  if (key === '/') return 'focus-search';
  if (key === 'f') return 'open-filter';
  if (key === 'b') return 'toggle-layout';
  return null;
}

export function resolveRecordKeyAction(input: LocalKeyInput): RecordKeyAction | null {
  const menuKey = input.key.toLowerCase();
  const exactMenuGesture = input.menuEnabled === true
    && !input.defaultPrevented
    && !input.isComposing
    && !input.repeat
    && !input.altKey
    && !input.ctrlKey
    && !input.metaKey
    && !input.withinExcludedTarget
    && ((menuKey === 'contextmenu' && !input.shiftKey) || (menuKey === 'f10' && input.shiftKey));
  if (exactMenuGesture) return 'open-menu';
  if (!isEligible(input)) return null;
  const key = input.key.toLowerCase();
  if (key === 'enter') return input.repeat ? null : 'open';
  if (key === ' ') return input.selectionEnabled && !input.repeat ? 'toggle-selection' : null;
  if (key === 'arrowdown' || key === 'j') return 'next';
  if (key === 'arrowup' || key === 'k') return 'previous';
  return null;
}

export function resolveMenuFocusIndex(
  key: string,
  currentIndex: number,
  itemCount: number,
): number | null {
  if (itemCount <= 0) return null;
  const bounded = Math.max(0, Math.min(currentIndex, itemCount - 1));
  if (key === 'ArrowDown') return (bounded + 1) % itemCount;
  if (key === 'ArrowUp') return (bounded - 1 + itemCount) % itemCount;
  if (key === 'Home') return 0;
  if (key === 'End') return itemCount - 1;
  return null;
}
