import { useState, useMemo, useCallback } from 'react';
import type { ParsedData, SortConfig, SeverityConfig } from './types';
import { DEFAULT_SEVERITY_RULES } from './types';
import QueryForm from './components/QueryForm';
import type { QueryParams } from './components/QueryForm';
import LogTable from './components/LogTable';
import TextFilter from './components/TextFilter';
import MultiSelectDropdown from './components/MultiSelectDropdown';
import type { ExclusionRule } from './components/LogDetailPanel';

const DEFAULT_LOG_COLUMNS = [
  '@timestamp',
  'payload.json.severity',
  'payload.fields.severity',
  'payload.json.message',
  'trace_id',
];

function detectSeverityField(columns: string[]): string {
  const preferred = ['payload.fields.severity', 'payload.json.severity', 'severity'];
  for (const p of preferred) {
    if (columns.includes(p)) return p;
  }
  return columns.find((c) => c.toLowerCase().includes('severity')) ?? '';
}

function pickDefaultColumns(columns: string[]): Set<string> {
  const defaults = new Set(DEFAULT_LOG_COLUMNS.filter((c) => columns.includes(c)));
  if (defaults.size === 0) {
    columns.slice(0, 6).forEach((c) => defaults.add(c));
  }
  return defaults;
}

type AppState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string; detail?: string }
  | { status: 'results'; data: ParsedData; durationMs: number; query: string; lastParams: QueryParams };

export default function App() {
  const [appState, setAppState] = useState<AppState>({ status: 'idle' });
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [wordWrap, setWordWrap] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [severityConfig, setSeverityConfig] = useState<SeverityConfig>({
    enabled: true,
    field: '',
    rules: [...DEFAULT_SEVERITY_RULES],
  });
  const [exclusions, setExclusions] = useState<ExclusionRule[]>([]);  const [textExclusions, setTextExclusions] = useState<string[]>([]);

  const handleQuery = useCallback(async (params: QueryParams) => {
    setAppState({ status: 'loading' });
    setFilterText('');
    setSortConfig(null);
    setExclusions([]);
    setTextExclusions([]);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const json = await res.json() as {
        columns?: string[];
        rows?: Record<string, string>[];
        durationMs?: number;
        query?: string;
        error?: string;
        detail?: string;
        hint?: string;
      };

      if (!res.ok) {
        setAppState({
          status: 'error',
          message: json.error ?? `HTTP ${res.status}`,
          detail: json.detail ?? json.hint,
        });
        return;
      }

      const data: ParsedData = {
        columns: json.columns ?? [],
        rows: json.rows ?? [],
      };

      const cols = pickDefaultColumns(data.columns);
      setSelectedColumns(cols);
      setSeverityConfig((prev) => ({
        ...prev,
        field: detectSeverityField(data.columns),
      }));

      setAppState({
        status: 'results',
        data,
        durationMs: json.durationMs ?? 0,
        query: json.query ?? '',
        lastParams: params,
      });
    } catch (err) {
      setAppState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    }
  }, []);

  const handleExclude = useCallback((rule: ExclusionRule) => {
    setExclusions((prev) => {
      const exists = prev.some((r) => r.column === rule.column && r.value === rule.value);
      if (exists) return prev;
      return [...prev, rule];
    });
  }, []);

  const removeExclusion = useCallback((index: number) => {
    setExclusions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleExcludeText = useCallback((text: string) => {
    setTextExclusions((prev) => {
      if (prev.includes(text)) return prev;
      return [...prev, text];
    });
  }, []);

  const removeTextExclusion = useCallback((index: number) => {
    setTextExclusions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const activeColumns = useMemo(() => {
    if (appState.status !== 'results') return [];
    return appState.data.columns.filter((c) => selectedColumns.has(c));
  }, [appState, selectedColumns]);

  const filteredRows = useMemo(() => {
    if (appState.status !== 'results') return [];
    let rows = appState.data.rows;

    for (const rule of exclusions) {
      rows = rows.filter((row) => (row[rule.column] ?? '') !== rule.value);
    }

    for (const text of textExclusions) {
      const lower = text.toLowerCase();
      rows = rows.filter((row) =>
        !activeColumns.some((col) => (row[col] ?? '').toLowerCase().includes(lower)),
      );
    }

    if (filterText) {
      const lower = filterText.toLowerCase();
      rows = rows.filter((row) =>
        activeColumns.some((col) => (row[col] ?? '').toLowerCase().includes(lower)),
      );
    }

    return rows;
  }, [appState, filterText, activeColumns, exclusions, textExclusions]);

  const sortedRows = useMemo(() => {
    if (!sortConfig) return filteredRows;
    const { column, direction } = sortConfig;
    return [...filteredRows].sort((a, b) => {
      const aVal = a[column] ?? '';
      const bVal = b[column] ?? '';
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
      return direction === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortConfig]);

  const isLoading = appState.status === 'loading';
  const [formCollapsed, setFormCollapsed] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex-shrink-0">
        <div className="px-4 py-2 flex items-center gap-3">
          <h1 className="text-base font-semibold">Log Query</h1>
          <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-2 py-0.5 rounded">
            POC
          </span>
          {appState.status === 'results' && (
            <span className="text-sm text-[var(--color-text-muted)] ml-2">
              {appState.data.rows.length.toLocaleString()} entries
              <span className="ml-2 opacity-60">({(appState.durationMs / 1000).toFixed(1)}s)</span>
            </span>
          )}
        </div>
      </header>

      {/* Query form — full width, collapsible */}
      <div className="flex-shrink-0 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        <div className="flex items-start gap-2 px-4 py-2">
          <div className="flex-1 min-w-0">
            {!formCollapsed && <QueryForm onQuery={(p) => { handleQuery(p); setFormCollapsed(true); }} loading={isLoading} />}
            {formCollapsed && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                {appState.status === 'results'
                  ? <span>{appState.query}</span>
                  : <span className="opacity-60">Query form hidden</span>
                }
              </div>
            )}
          </div>
          <button
            onClick={() => setFormCollapsed(!formCollapsed)}
            className="flex-shrink-0 mt-0.5 h-8 px-2 text-xs border border-[var(--color-border)] rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            title={formCollapsed ? 'Expand query form' : 'Collapse query form'}
          >
            {formCollapsed ? '▼ Query' : '▲ Hide'}
          </button>
        </div>
      </div>

      {/* Main content — full width */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {appState.status === 'idle' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-[var(--color-text-muted)]">
                <svg className="w-14 h-14 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-sm">Fill in the query form above and click <strong className="text-[var(--color-text-secondary)]">Query</strong></p>
              </div>
            </div>
          )}

          {appState.status === 'loading' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-[var(--color-text-muted)]">
                <svg className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm">Querying logs...</p>
                <p className="text-xs mt-1 opacity-60">This may take a few seconds</p>
              </div>
            </div>
          )}

          {appState.status === 'error' && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="max-w-lg w-full bg-[var(--color-bg-secondary)] border border-[var(--color-error)]/40 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-[var(--color-error)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-error)]">{appState.message}</p>
                    {appState.detail && (
                      <pre className="mt-2 text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{appState.detail}</pre>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {appState.status === 'results' && (
            <div className="flex-1 flex flex-col min-h-0 gap-0">
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex-shrink-0 flex-wrap">
                <TextFilter
                  value={filterText}
                  onChange={setFilterText}
                  totalRows={appState.data.rows.length}
                  filteredRows={sortedRows.length}
                />
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setWordWrap(!wordWrap)}
                    className={`px-3 py-1.5 text-sm font-medium border rounded transition-colors ${
                      wordWrap
                        ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/50 text-[var(--color-accent)]'
                        : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                    }`}
                  >
                    Wrap
                  </button>
                  <MultiSelectDropdown
                    options={appState.data.columns}
                    selected={Array.from(selectedColumns)}
                    onChange={(cols) => setSelectedColumns(new Set(cols))}
                    triggerLabel={`Columns (${selectedColumns.size})`}
                    placeholder="Search columns..."
                  />
                </div>
              </div>

              {/* Exclusion chips */}
              {(exclusions.length > 0 || textExclusions.length > 0) && (
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex-shrink-0 flex-wrap">
                  <span className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wide">Excluding:</span>
                  {exclusions.map((rule, i) => (
                    <span
                      key={`col-${rule.column}-${i}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded text-[var(--color-error)]"
                    >
                      <span className="max-w-[120px] truncate" title={rule.column}>{rule.column}</span>
                      <span className="text-[var(--color-text-muted)]">=</span>
                      <span className="max-w-[120px] truncate" title={rule.value}>{rule.value}</span>
                      <button onClick={() => removeExclusion(i)} className="ml-0.5 hover:text-[var(--color-text-primary)] transition-colors" title="Remove exclusion">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                  {textExclusions.map((text, i) => (
                    <span
                      key={`txt-${text}-${i}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded text-[var(--color-warning)]"
                    >
                      <span className="max-w-[200px] truncate" title={text}>&quot;{text}&quot;</span>
                      <button onClick={() => removeTextExclusion(i)} className="ml-0.5 hover:text-[var(--color-text-primary)] transition-colors" title="Remove text exclusion">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                  <button onClick={() => { setExclusions([]); setTextExclusions([]); }} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                    Clear all
                  </button>
                </div>
              )}

              {/* Table or empty state */}
              {appState.data.rows.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
                  <div className="text-center">
                    <p className="text-sm font-medium">No log entries found</p>
                    <p className="text-xs mt-1 opacity-70">Try widening the time range or adjusting the filters</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 p-2">
                  <LogTable
                    columns={activeColumns}
                    rows={sortedRows}
                    sortConfig={sortConfig}
                    onSort={setSortConfig}
                    severityConfig={severityConfig}
                    wordWrap={wordWrap}
                    onExclude={handleExclude}
                    onExcludeText={handleExcludeText}
                  />
                </div>
              )}
            </div>
          )}
        </main>
    </div>
  );
}
