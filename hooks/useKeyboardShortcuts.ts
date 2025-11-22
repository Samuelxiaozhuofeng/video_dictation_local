import { useEffect, useRef } from 'react';

type ShortcutHandler = (event: KeyboardEvent) => void;

export interface ShortcutDefinition {
  code?: string;
  key?: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  ctrlOrMeta?: boolean;
  allowRepeat?: boolean;
  allowInEditable?: boolean;
  preventDefault?: boolean;
  condition?: (event: KeyboardEvent) => boolean;
  handler: ShortcutHandler;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  target?: Window | Document | HTMLElement | null;
}

const isEditableElement = (target: EventTarget | null): target is HTMLElement => {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName?.toLowerCase();
  if (!tagName) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
};

const matchesShortcut = (shortcut: ShortcutDefinition, event: KeyboardEvent) => {
  if (shortcut.allowRepeat === false && event.repeat) {
    return false;
  }

  if (shortcut.code && shortcut.code !== event.code) {
    return false;
  }

  if (shortcut.key && shortcut.key !== event.key) {
    return false;
  }

  if (shortcut.shiftKey !== undefined && shortcut.shiftKey !== event.shiftKey) {
    return false;
  }

  if (shortcut.altKey !== undefined && shortcut.altKey !== event.altKey) {
    return false;
  }

  if (shortcut.ctrlKey !== undefined && shortcut.ctrlKey !== event.ctrlKey) {
    return false;
  }

  if (shortcut.metaKey !== undefined && shortcut.metaKey !== event.metaKey) {
    return false;
  }

  if (shortcut.ctrlOrMeta && !(event.ctrlKey || event.metaKey)) {
    return false;
  }

  if (shortcut.condition && !shortcut.condition(event)) {
    return false;
  }

  return true;
};

export const useKeyboardShortcuts = (
  shortcuts: ShortcutDefinition[],
  options?: UseKeyboardShortcutsOptions
) => {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const { enabled = true, target = typeof window !== 'undefined' ? window : null } = options || {};

    if (!enabled || !target) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcutsRef.current) {
        if (!shortcut) {
          continue;
        }

        if (
          event.target &&
          isEditableElement(event.target) &&
          shortcut.allowInEditable === false
        ) {
          continue;
        }

        if (!matchesShortcut(shortcut, event)) {
          continue;
        }

        if (shortcut.preventDefault) {
          event.preventDefault();
        }

        shortcut.handler(event);
        break;
      }
    };

    target.addEventListener('keydown', handleKeyDown as EventListener);
    return () => target.removeEventListener('keydown', handleKeyDown as EventListener);
  }, [options]);
};
