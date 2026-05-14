import type { DedupColumn, DedupMode } from '../types';

interface DedupControlProps {
  headers: string[];
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  dedupColumn: DedupColumn;
  onDedupColumnChange: (column: DedupColumn) => void;
  dedupMode: DedupMode;
  onDedupModeChange: (mode: DedupMode) => void;
  removedCount: number;
  totalRows: number;
}

export default function DedupControl({
  headers,
  enabled,
  onEnabledChange,
  dedupColumn,
  onDedupColumnChange,
  dedupMode,
  onDedupModeChange,
  removedCount,
  totalRows,
}: DedupControlProps) {
  const handleColumnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onDedupColumnChange(val === 'all' ? 'all' : parseInt(val, 10));
  };

  const resultCount = totalRows - removedCount;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">Deduplicate</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? 'Deduplication on. Collapse duplicate rows.' : 'Deduplication off. Keep all rows.'}
          onClick={() => onEnabledChange(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-secondary)] ${
            enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-tertiary)]'
          }`}
          title={
            enabled
              ? 'On — collapse duplicate rows'
              : 'Off — keep all rows'
          }
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      {enabled && removedCount > 0 && (
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          {removedCount} duplicate{removedCount !== 1 ? 's' : ''} removed · {resultCount} row
          {resultCount !== 1 ? 's' : ''} remaining
        </p>
      )}
      {enabled && (
        <div className="flex flex-col gap-3 pt-1 border-t border-[var(--color-border)]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dedup-column" className="text-xs text-[var(--color-text-muted)]">
              Match duplicates by
            </label>
            <select
              id="dedup-column"
              value={dedupColumn === 'all' ? 'all' : dedupColumn.toString()}
              onChange={handleColumnChange}
              className="w-full max-w-xs px-2 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="all">Entire row (all columns)</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  Column: {h}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--color-text-muted)]">When duplicates exist</span>
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => onDedupModeChange('keep-first')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  dedupMode === 'keep-first'
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
                title="Keep the first occurrence of each duplicate"
              >
                Keep first
              </button>
              <button
                type="button"
                onClick={() => onDedupModeChange('keep-last')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  dedupMode === 'keep-last'
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
                title="Keep the last occurrence of each duplicate"
              >
                Keep last
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
