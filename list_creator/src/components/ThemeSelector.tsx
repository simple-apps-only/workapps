import { themes, type Theme } from '../themes';

interface ThemeSelectorProps {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export default function ThemeSelector({ currentTheme, onThemeChange }: ThemeSelectorProps) {
  return (
    <select
      value={currentTheme.id}
      onChange={(e) => {
        const theme = themes.find((t) => t.id === e.target.value);
        if (theme) onThemeChange(theme);
      }}
      className="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)] cursor-pointer"
      title="Select color theme"
    >
      {themes.map((theme) => (
        <option key={theme.id} value={theme.id}>
          {theme.name}
        </option>
      ))}
    </select>
  );
}
