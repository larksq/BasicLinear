export type GlobalShortcutAction = 'toggle-command' | 'create-issue';

export interface GlobalShortcutInput {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
  withinEditable: boolean;
  withinDialog: boolean;
  withinCommandDialog: boolean;
}

export function resolveGlobalShortcutAction(input: GlobalShortcutInput): GlobalShortcutAction | null {
  if (input.defaultPrevented || input.repeat || input.isComposing) return null;
  const key = input.key.toLowerCase();
  const primaryModifier = input.metaKey || input.ctrlKey;

  if (key === 'k' && primaryModifier && !input.altKey && !input.shiftKey) {
    if (input.withinCommandDialog) return 'toggle-command';
    if (input.withinEditable || input.withinDialog) return null;
    return 'toggle-command';
  }

  if (key === 'c'
    && !primaryModifier
    && !input.altKey
    && !input.shiftKey
    && !input.withinEditable
    && !input.withinDialog) {
    return 'create-issue';
  }

  return null;
}
