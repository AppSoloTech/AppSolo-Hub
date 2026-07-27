import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTheme, saveTheme, themeStorageKey } from './theme.js';

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.removeProperty('color-scheme');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('theme preference', () => {
  it('uses the system preference when no saved preference exists', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );

    expect(initializeTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(themeStorageKey)).toBeNull();
  });

  it('uses a saved preference ahead of the system preference', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    window.localStorage.setItem(themeStorageKey, 'light');

    expect(initializeTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('persists and applies an explicit preference', () => {
    saveTheme('dark');

    expect(window.localStorage.getItem(themeStorageKey)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
