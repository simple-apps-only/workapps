import type { FilterColumn, FilterMode } from '../types';

interface RowFilterProps {
  headers: string[];
  filterValues: string[];
  onFilterValuesChange: (values: string[]) => void;
  filterColumn: FilterColumn;
  onFilterColumnChange: (column: FilterColumn) => void;
  filterMode: FilterMode;
  onFilterModeChange: (mode: FilterMode) => void;
  affectedCount: number;
  totalRows: number;
}

export default function RowFilter({
  headers,
  filterValues,
  onFilterValuesChange,
  filterColumn,
  onFilterColumnChange,
  filterMode,
  onFilterModeChange,
  affectedCount,
  totalRows,
}: RowFilterProps) {
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const lines = e.target.value.split('\n');
    onFilterValuesChange(lines);
  };

  const handleColumnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onFilterColumnChange(val === 'any' ? 'any' : parseInt(val, 10));
  };

  const resultCount = filterMode === 'exclude' 
    ? totalRows - affectedCount 
    : affectedCount;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-secondary)]">Filter Rows</span>
          <div className="flex rounded border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => onFilterModeChange('exclude')}
              className={`px-2 py-0.5 text-xs transition-colors ${
                filterMode === 'exclude'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Exclude
            </button>
            <button
              onClick={() => onFilterModeChange('include')}
              className={`px-2 py-0.5 text-xs transition-colors ${
                filterMode === 'include'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Include
            </button>
          </div>
        </div>
        {affectedCount > 0 && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {resultCount} row{resultCount !== 1 ? 's' : ''} remaining
          </span>
        )}
      </div>
      <div className="flex gap-3">
        <textarea
          value={filterValues.join('\n')}
          onChange={handleTextChange}
          placeholder={`Enter values to ${filterMode} (one per line)`}
          rows={3}
          className="flex-1 px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm font-mono focus:outline-none focus:border-[var(--color-border-focus)] resize-none"
        />
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[var(--color-text-muted)]">Match in</label>
          <select
            value={filterColumn === 'any' ? 'any' : filterColumn.toString()}
            onChange={handleColumnChange}
            className="px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="any">Any column</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>
                {h}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
