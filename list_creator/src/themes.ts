export interface Theme {
  id: string;
  name: string;
}

export const themes: Theme[] = [
  { id: 'dark', name: 'Dark' },
  { id: 'light', name: 'Light' },
  { id: 'dracula', name: 'Dracula' },
  { id: 'nord', name: 'Nord' },
  { id: 'solarized-dark', name: 'Solarized' },
];

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme.id);
}

export function getStoredThemeId(): string {
  return localStorage.getItem('csv-converter-theme') || 'dark';
}

export function storeThemeId(themeId: string): void {
  localStorage.setItem('csv-converter-theme', themeId);
}
