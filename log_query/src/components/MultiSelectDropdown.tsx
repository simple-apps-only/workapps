import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface Props {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  triggerLabel: string;
  placeholder?: string;
  active?: boolean;
}

export default function MultiSelectDropdown({
  options,
  selected,
  onChange,
  triggerLabel,
  placeholder = 'Search...',
  active,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(lower));
  }, [options, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedSet.has(o));

  const toggle = useCallback((value: string) => {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(Array.from(next));
  }, [selectedSet, onChange]);

  const selectAll = useCallback(() => {
    const next = new Set(selectedSet);
    filtered.forEach((o) => next.add(o));
    onChange(Array.from(next));
  }, [selectedSet, filtered, onChange]);

  const clearAll = useCallback(() => {
    const next = new Set(selectedSet);
    filtered.forEach((o) => next.delete(o));
    onChange(Array.from(next));
  }, [selectedSet, filtered, onChange]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape, focus search on open
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setSearch(''); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const isActive = active ?? (open || selected.length > 0);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(!open); if (open) setSearch(''); }}
        className={`px-3 py-1.5 text-sm font-medium border rounded transition-colors flex items-center gap-1.5 ${
          isActive
            ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/50 text-[var(--color-accent)]'
            : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
        }`}
      >
        {triggerLabel}
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl z-50 flex flex-col">
          {/* Search */}
          <div className="px-2 pt-2 pb-1.5 border-b border-[var(--color-border)]">
            <div className="relative">
              <svg
                className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focus)]"
              />
            </div>
          </div>

          {/* Select all / Clear */}
          <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--color-border)]">
            <span className="text-xs text-[var(--color-text-muted)]">
              {selected.length} of {options.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                disabled={allFilteredSelected}
                className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Select all
              </button>
              <span className="text-[var(--color-border)]">·</span>
              <button
                type="button"
                onClick={clearAll}
                disabled={filtered.every((o) => !selectedSet.has(o))}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Option list */}
          <div className="overflow-y-auto max-h-64 py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[var(--color-text-muted)] text-center">No matches for &quot;{search}&quot;</p>
            ) : (
              filtered.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(opt)}
                    onChange={() => toggle(opt)}
                    className="accent-[var(--color-accent)] flex-shrink-0 w-3.5 h-3.5"
                  />
                  <span className="text-xs font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                    {opt}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
