import type { SortColumn, SortDirection } from '../types';

interface SortControlProps {
  headers: string[];
  sortColumn: SortColumn;
  onSortColumnChange: (column: SortColumn) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (direction: SortDirection) => void;
}

export default function SortControl({
  headers,
  sortColumn,
  onSortColumnChange,
  sortDirection,
  onSortDirectionChange,
}: SortControlProps) {
  const handleColumnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onSortColumnChange(val === 'none' ? null : parseInt(val, 10));
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">Sort</span>
      <p className="text-xs text-[var(--color-text-muted)] -mt-1">
        Optional ordering before export and preview.
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <label htmlFor="sort-column" className="text-xs text-[var(--color-text-muted)]">
            Sort by column
          </label>
          <select
            id="sort-column"
            value={sortColumn === null ? 'none' : sortColumn.toString()}
            onChange={handleColumnChange}
            className="w-full min-w-0 px-2 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="none">No sorting</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>
                {h}
              </option>
            ))}
          </select>
        </div>
        {sortColumn !== null && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--color-text-muted)]">Direction</span>
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => onSortDirectionChange('asc')}
                className={`px-3 py-2 text-xs transition-colors ${
                  sortDirection === 'asc'
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
                title="Ascending (A→Z, 1→9)"
              >
                A→Z
              </button>
              <button
                type="button"
                onClick={() => onSortDirectionChange('desc')}
                className={`px-3 py-2 text-xs transition-colors ${
                  sortDirection === 'desc'
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
                title="Descending (Z→A, 9→1)"
              >
                Z→A
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
