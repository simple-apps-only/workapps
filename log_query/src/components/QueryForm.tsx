import { useState, useMemo } from 'react';

export interface QueryParams {
  environment: string;
  namespace: string;
  searchField: string;
  searchOperator: string;
  searchValue: string;
  severity: string;
  start: string;
  end: string;
  limit: number;
  logFamily: string;
}

interface Props {
  onQuery: (params: QueryParams) => void;
  loading: boolean;
}

const NAMESPACES = [
  { value: '', label: 'All namespaces' },
  { value: 'boost', label: 'boost' },
  { value: 'marketing', label: 'marketing' },
  { value: 'promotions', label: 'promotions' },
  { value: 'brand-market', label: 'brand-market' },
  { value: 'future-foods', label: 'future-foods' },
  { value: 'integrations', label: 'integrations' },
  { value: 'analytics', label: 'analytics' },
  { value: 'log-exporter', label: 'log-exporter' },
  { value: 'log-exporter-logproc', label: 'log-exporter-logproc' },
];

const SEARCH_TYPES = [
  { label: 'Trace ID / UUID', field: 'extracted.uuid', operator: '=', placeholder: 'trace / uuid...' },
  { label: 'Keyword', field: 'payload.text', operator: '=*', placeholder: 'keyword...' },
  { label: 'Source File', field: 'payload.json.source_file', operator: '=*', placeholder: 'ClassName...' },
  { label: 'Log Message', field: 'payload.json.message', operator: '=*', placeholder: 'message text...' },
];

const TIME_PRESETS = [
  { label: '15m', value: 'now-15m' },
  { label: '30m', value: 'now-30m' },
  { label: '1h', value: 'now-1h' },
  { label: '2h', value: 'now-2h' },
  { label: '6h', value: 'now-6h' },
  { label: '12h', value: 'now-12h' },
  { label: '1d', value: 'now-1d' },
  { label: '7d', value: 'now-7d' },
];

const SEVERITIES = [
  { value: '', label: 'All severity' },
  { value: 'ERROR', label: 'ERROR' },
  { value: 'WARN', label: 'WARN' },
  { value: 'INFO', label: 'INFO' },
  { value: 'DEBUG', label: 'DEBUG' },
  { value: 'TRACE', label: 'TRACE' },
];

const LOG_FAMILIES = [
  { value: 'container_logs', label: 'Container' },
  { value: 'istio', label: 'Istio' },
];

function buildCliPreview(params: QueryParams): string {
  const parts: string[] = [];
  if (params.logFamily !== 'istio') {
    parts.push(`"k8s_environment"="${params.environment}"`);
    if (params.namespace) parts.push(`"k8s_namespace"="${params.namespace}"`);
  }
  if (params.searchValue) {
    const op = params.searchOperator === '=*' ? '=*' : '=';
    parts.push(`"${params.searchField}"${op}"${params.searchValue}"`);
  }
  if (params.severity) parts.push(`"payload.json.severity"="${params.severity}"`);
  const query = `{${parts.join(', ')}}`;
  const familyFlag = params.logFamily === 'istio' ? ' -f istio' : '';
  return `css logs logproc${familyFlag} '${query}' -s '${params.start}' -e '${params.end}' -l ${params.limit} --format json`;
}

const selectClass =
  'h-8 px-2 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors cursor-pointer';
const inputClass =
  'h-8 px-2 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors';

const STORAGE_KEY = 'log_query_form_v1';

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function usePersisted<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const saved = loadSaved();
  const [value, setValue] = useState<T>(key in saved ? saved[key] : defaultValue);
  const set = (v: T) => {
    setValue(v);
    try {
      const current = loadSaved();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, [key]: v }));
    } catch { /* ignore */ }
  };
  return [value, set];
}

export default function QueryForm({ onQuery, loading }: Props) {
  const [environment, setEnvironment] = usePersisted('environment', 'production');
  const [namespace, setNamespace] = usePersisted('namespace', '');
  const [searchTypeIdx, setSearchTypeIdx] = usePersisted('searchTypeIdx', 0);
  const [searchValue, setSearchValue] = usePersisted('searchValue', '');
  const [severity, setSeverity] = usePersisted('severity', '');
  const [timePreset, setTimePreset] = usePersisted('timePreset', 'now-1h');
  const [customStart, setCustomStart] = usePersisted('customStart', '');
  const [customEnd, setCustomEnd] = usePersisted('customEnd', '');
  const [useCustomTime, setUseCustomTime] = usePersisted('useCustomTime', false);
  const [limit, setLimit] = usePersisted('limit', 200);
  const [logFamily, setLogFamily] = usePersisted('logFamily', 'container_logs');
  const [showCli, setShowCli] = useState(false);

  const searchType = SEARCH_TYPES[searchTypeIdx]!;

  const params: QueryParams = useMemo(() => {
    const formatDateTime = (dt: string) => dt && !dt.includes(':00') ? `${dt}:00` : (dt || 'now-1h');
    return {
      environment,
      namespace,
      searchField: searchType.field,
      searchOperator: searchType.operator,
      searchValue,
      severity,
      start: useCustomTime ? formatDateTime(customStart) : timePreset,
      end: useCustomTime ? customEnd ? `${customEnd}:00` : 'now' : 'now',
      limit,
      logFamily,
    };
  }, [environment, namespace, searchType, searchValue, severity, useCustomTime, customStart, customEnd, timePreset, limit, logFamily]);

  const cliPreview = useMemo(() => buildCliPreview(params), [params]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onQuery(params);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {/* Main row: all controls in one horizontal line */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Environment */}
        <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={selectClass} title="Environment">
          <option value="production">production</option>
          <option value="staging">staging</option>
        </select>

        {/* Log family */}
        <select value={logFamily} onChange={(e) => setLogFamily(e.target.value)} className={selectClass} title="Log Family">
          {LOG_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Namespace */}
        <select value={namespace} onChange={(e) => setNamespace(e.target.value)} className={`${selectClass} min-w-[140px]`} title="Namespace">
          {NAMESPACES.map((n) => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>

        <div className="w-px h-5 bg-[var(--color-border)]" />

        {/* Search type + value */}
        <select
          value={searchTypeIdx}
          onChange={(e) => { setSearchTypeIdx(Number(e.target.value)); setSearchValue(''); }}
          className={`${selectClass} min-w-[130px]`}
          title="Search by"
        >
          {SEARCH_TYPES.map((t, i) => (
            <option key={i} value={i}>{t.label}</option>
          ))}
        </select>
        <div className="relative">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={searchType.placeholder}
            className={`${inputClass} w-56 pr-6`}
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => setSearchValue('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Severity */}
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={selectClass} title="Severity">
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <div className="w-px h-5 bg-[var(--color-border)]" />

        {/* Time range */}
        {!useCustomTime ? (
          <div className="flex rounded overflow-hidden border border-[var(--color-border)]">
            {TIME_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setTimePreset(p.value)}
                className={`h-8 px-2.5 text-xs font-medium transition-colors ${
                  timePreset === p.value
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-1">
            <input
              type="datetime-local"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className={`${inputClass} w-56`}
            />
            <input
              type="datetime-local"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className={`${inputClass} w-56`}
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => setUseCustomTime(!useCustomTime)}
          className="h-8 px-2 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors border border-transparent hover:border-[var(--color-border)] rounded"
          title={useCustomTime ? 'Use presets' : 'Custom time range'}
        >
          {useCustomTime ? 'Presets' : 'Custom'}
        </button>

        {/* Limit */}
        <input
          type="number"
          min={1}
          max={10000}
          value={limit}
          onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 200))}
          className={`${inputClass} w-20`}
          title="Result limit"
        />

        <div className="w-px h-5 bg-[var(--color-border)]" />

        {/* Query button */}
        <button
          type="submit"
          disabled={loading}
          className="h-8 px-4 text-sm font-medium bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Querying...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              Query
            </>
          )}
        </button>

        {/* CLI toggle */}
        <button
          type="button"
          onClick={() => setShowCli(!showCli)}
          className={`h-8 px-2 text-xs border rounded transition-colors ${
            showCli
              ? 'bg-[var(--color-bg-hover)] border-[var(--color-border)] text-[var(--color-text-secondary)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
          title="Show generated CLI command"
        >
          CLI
        </button>
      </div>

      {/* CLI preview row */}
      {showCli && (
        <div className="rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] px-3 py-2">
          <code className="text-xs font-mono text-[var(--color-accent)] break-all">{cliPreview}</code>
        </div>
      )}
    </form>
  );
}
