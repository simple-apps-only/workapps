import { useState, useMemo, useEffect } from 'react';
import CsvInput from './components/CsvInput';
import ColumnSelector from './components/ColumnSelector';
import RowFilter from './components/RowFilter';
import ParsedPreview from './components/ParsedPreview';
import FormatSelector from './components/FormatSelector';
import OutputDisplay from './components/OutputDisplay';
import ThemeSelector from './components/ThemeSelector';
import { parseCSV, detectDelimiter, filterColumns, filterRows } from './utils/csvParser';
import { converters } from './converters';
import { themes, applyTheme, getStoredThemeId, storeThemeId, type Theme } from './themes';
import type { Delimiter, FilterColumn, FilterMode } from './types';

export default function App() {
  const [rawText, setRawText] = useState('');
  const [delimiter, setDelimiter] = useState<Delimiter>(',');
  const [hasHeaders, setHasHeaders] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState(converters[0].id);
  const [selectedColumns, setSelectedColumns] = useState<boolean[]>([]);
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [filterColumn, setFilterColumn] = useState<FilterColumn>('any');
  const [filterMode, setFilterMode] = useState<FilterMode>('exclude');
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

  const finalData = useMemo(
    () => filterRows(columnFilteredData, filterValues, filterColumn, filterMode),
    [columnFilteredData, filterValues, filterColumn, filterMode]
  );

  const affectedCount = columnFilteredData.rows.length - finalData.rows.length;

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
          <section>
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
