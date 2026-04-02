import { converters } from '../converters';

interface FormatSelectorProps {
  selected: string;
  onChange: (id: string) => void;
}

export default function FormatSelector({ selected, onChange }: FormatSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {converters.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          title={c.description}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            selected === c.id
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]'
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
