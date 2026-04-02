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
    <div className="flex flex-col gap-2">
      <span className="text-sm text-[var(--color-text-secondary)]">Sort Rows</span>
      <div className="flex items-center gap-3">
        <select
          value={sortColumn === null ? 'none' : sortColumn.toString()}
          onChange={handleColumnChange}
          className="px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]"
        >
          <option value="none">No sorting</option>
          {headers.map((h, i) => (
            <option key={i} value={i}>
              {h}
            </option>
          ))}
        </select>
        {sortColumn !== null && (
          <div className="flex rounded border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => onSortDirectionChange('asc')}
              className={`px-2 py-1 text-xs transition-colors ${
                sortDirection === 'asc'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
              title="Ascending (A→Z, 1→9)"
            >
              A→Z
            </button>
            <button
              onClick={() => onSortDirectionChange('desc')}
              className={`px-2 py-1 text-xs transition-colors ${
                sortDirection === 'desc'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
              title="Descending (Z→A, 9→1)"
            >
              Z→A
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
