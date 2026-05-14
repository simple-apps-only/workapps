import { useState, useMemo, useEffect } from 'react';
import CsvInput from './components/CsvInput';
import ColumnSelector from './components/ColumnSelector';
import RowFilter from './components/RowFilter';
import DedupControl from './components/DedupControl';
import SortControl from './components/SortControl';
import ParsedPreview from './components/ParsedPreview';
import FormatSelector from './components/FormatSelector';
import OutputDisplay from './components/OutputDisplay';
import ThemeSelector from './components/ThemeSelector';
import { parseCSV, detectDelimiter, filterColumns, filterRows, dedupRows, sortRows } from './utils/csvParser';
import { converters } from './converters';
import { themes, applyTheme, getStoredThemeId, storeThemeId, type Theme } from './themes';
import type { Delimiter, FilterColumn, FilterMode, SortColumn, SortDirection, DedupColumn, DedupMode, DedupEnabled } from './types';

export default function App() {
  const [rawText, setRawText] = useState('');
  const [delimiter, setDelimiter] = useState<Delimiter>(',');
  const [hasHeaders, setHasHeaders] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState(converters[0].id);
  const [selectedColumns, setSelectedColumns] = useState<boolean[]>([]);
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [filterColumn, setFilterColumn] = useState<FilterColumn>('any');
  const [filterMode, setFilterMode] = useState<FilterMode>('exclude');
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [dedupEnabled, setDedupEnabled] = useState<DedupEnabled>(false);
  const [dedupColumn, setDedupColumn] = useState<DedupColumn>('all');
  const [dedupMode, setDedupMode] = useState<DedupMode>('keep-first');
  const [transformExpanded, setTransformExpanded] = useState(true);
  const [theme, setTheme] = useState<Theme>(() => {
    const storedId = getStoredThemeId();
    return themes.find((t) => t.id === storedId) || themes[0];
  });

  useEffect(() => {
    applyTheme(theme);
    storeThemeId(theme.id);
  }, [theme]);

  const parsed = useMemo(
    () => parseCSV(rawText, delimiter, hasHeaders),
    [rawText, delimiter, hasHeaders]
  );

  useEffect(() => {
    setSelectedColumns(parsed.headers.map(() => true));
  }, [parsed.headers.length]);

  const columnFilteredData = useMemo(
    () =>
      selectedColumns.length === parsed.headers.length
        ? filterColumns(parsed, selectedColumns)
        : parsed,
    [parsed, selectedColumns]
  );

  const rowFilteredData = useMemo(
    () => filterRows(columnFilteredData, filterValues, filterColumn, filterMode),
    [columnFilteredData, filterValues, filterColumn, filterMode]
  );

  const affectedCount = columnFilteredData.rows.length - rowFilteredData.rows.length;

  const dedupedData = useMemo(
    () => (dedupEnabled ? dedupRows(rowFilteredData, dedupColumn, dedupMode) : rowFilteredData),
    [rowFilteredData, dedupEnabled, dedupColumn, dedupMode]
  );

  const removedDedupCount = rowFilteredData.rows.length - dedupedData.rows.length;

  const finalData = useMemo(
    () => sortRows(dedupedData, sortColumn, sortDirection),
    [dedupedData, sortColumn, sortDirection]
  );

  const converter = converters.find((c) => c.id === selectedFormat) ?? converters[0];

  const output = useMemo(() => {
    if (finalData.rows.length === 0) return '';
    try {
      return converter.convert(finalData);
    } catch {
      return '// Error generating output';
    }
  }, [finalData, converter]);

  const handleTextChange = (text: string) => {
    setRawText(text);
    if (text && text !== rawText) {
      const detected = detectDelimiter(text);
      setDelimiter(detected);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              CSV List Converter
            </h1>
            <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-2 py-0.5 rounded">
              v1.0
            </span>
          </div>
          <ThemeSelector currentTheme={theme} onThemeChange={setTheme} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
            Input
          </h2>
          <CsvInput
            value={rawText}
            onChange={handleTextChange}
            delimiter={delimiter}
            onDelimiterChange={setDelimiter}
            hasHeaders={hasHeaders}
            onHasHeadersChange={setHasHeaders}
          />
        </section>

        {parsed.headers.length > 1 && (
          <section>
            <ColumnSelector
              headers={parsed.headers}
              selected={selectedColumns}
              onChange={setSelectedColumns}
            />
          </section>
        )}

        {parsed.rows.length > 0 && (
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
            <button
              type="button"
              id="transform-heading"
              aria-expanded={transformExpanded}
              aria-controls="transform-panel"
              onClick={() => setTransformExpanded((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--color-bg-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-border-focus)]"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                  Transform
                </span>
                {!transformExpanded && (
                  <span className="text-xs text-[var(--color-text-muted)] truncate">
                    {finalData.rows.length} row{finalData.rows.length !== 1 ? 's' : ''} in result · click to edit
                  </span>
                )}
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
                className={`h-5 w-5 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${
                  transformExpanded ? 'rotate-180' : ''
                }`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {transformExpanded && (
              <div
                id="transform-panel"
                role="region"
                aria-labelledby="transform-heading"
                className="border-t border-[var(--color-border)] p-4"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 min-w-0 flex flex-col h-full">
                    <RowFilter
                      headers={columnFilteredData.headers}
                      filterValues={filterValues}
                      onFilterValuesChange={setFilterValues}
                      filterColumn={filterColumn}
                      onFilterColumnChange={setFilterColumn}
                      filterMode={filterMode}
                      onFilterModeChange={setFilterMode}
                      affectedCount={Math.abs(affectedCount)}
                      totalRows={columnFilteredData.rows.length}
                    />
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 min-w-0 flex flex-col h-full">
                    <DedupControl
                      headers={columnFilteredData.headers}
                      enabled={dedupEnabled}
                      onEnabledChange={setDedupEnabled}
                      dedupColumn={dedupColumn}
                      onDedupColumnChange={setDedupColumn}
                      dedupMode={dedupMode}
                      onDedupModeChange={setDedupMode}
                      removedCount={removedDedupCount}
                      totalRows={rowFilteredData.rows.length}
                    />
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 min-w-0 flex flex-col h-full">
                    <SortControl
                      headers={columnFilteredData.headers}
                      sortColumn={sortColumn}
                      onSortColumnChange={setSortColumn}
                      sortDirection={sortDirection}
                      onSortDirectionChange={setSortDirection}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {parsed.rows.length > 0 && (
          <section>
            <ParsedPreview data={finalData} />
          </section>
        )}

        {parsed.rows.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
              Output Format
            </h2>
            <FormatSelector
              selected={selectedFormat}
              onChange={setSelectedFormat}
            />
            <OutputDisplay output={output} formatName={converter.name} formatId={converter.id} />
          </section>
        )}
      </main>
    </div>
  );
}
