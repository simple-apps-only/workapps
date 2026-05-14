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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-secondary)]">Deduplicate Rows</span>
          <button
            onClick={() => onEnabledChange(!enabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-tertiary)]'
            }`}
            title={enabled ? 'Deduplication enabled' : 'Deduplication disabled'}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-4.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {enabled && removedCount > 0 && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {removedCount} duplicate{removedCount !== 1 ? 's' : ''} removed
            ({resultCount} row{resultCount !== 1 ? 's' : ''} remaining)
          </span>
        )}
      </div>
      {enabled && (
        <>
          <div className="flex items-center gap-3">
            <label className="text-xs text-[var(--color-text-muted)]">Based on</label>
            <select
              value={dedupColumn === 'all' ? 'all' : dedupColumn.toString()}
              onChange={handleColumnChange}
              className="px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="all">All columns</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div className="flex rounded border border-[var(--color-border)] overflow-hidden w-fit">
            <button
              onClick={() => onDedupModeChange('keep-first')}
              className={`px-2 py-0.5 text-xs transition-colors ${
                dedupMode === 'keep-first'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
              title="Keep the first occurrence of each duplicate"
            >
              Keep first
            </button>
            <button
              onClick={() => onDedupModeChange('keep-last')}
              className={`px-2 py-0.5 text-xs transition-colors ${
                dedupMode === 'keep-last'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
              title="Keep the last occurrence of each duplicate"
            >
              Keep last
            </button>
          </div>
        </>
      )}
    </div>
  );
}
