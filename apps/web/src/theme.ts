export type ColorTheme = 'light' | 'dark';

export const themeStorageKey = 'appsolo.color-theme';

function isColorTheme(value: string | null | undefined): value is ColorTheme {
  return value === 'light' || value === 'dark';
}

function readStoredTheme(): ColorTheme | null {
  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    return isColorTheme(storedTheme) ? storedTheme : null;
  } catch {
    return null;
  }
}

function readSystemTheme(): ColorTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: ColorTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function initializeTheme(): ColorTheme {
  const theme = readStoredTheme() ?? readSystemTheme();
  applyTheme(theme);
  return theme;
}

export function getAppliedTheme(): ColorTheme {
  const appliedTheme = document.documentElement.dataset.theme;
  return isColorTheme(appliedTheme) ? appliedTheme : initializeTheme();
}

export function saveTheme(theme: ColorTheme): void {
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // The theme still applies for this page when storage is unavailable.
  }
  applyTheme(theme);
}
