import { useState, useRef, useCallback, useEffect, useMemo, useLayoutEffect } from 'react';
import type { FlattenedRow, SortConfig, SeverityConfig } from '../types';
import { SEVERITY_COLORS } from '../types';
import { formatTimestamp } from '../utils/parser';
import LogDetailPanel from './LogDetailPanel';
import type { ExclusionRule } from './LogDetailPanel';

interface Props {
  columns: string[];
  rows: FlattenedRow[];
  sortConfig: SortConfig | null;
  onSort: (config: SortConfig) => void;
  severityConfig: SeverityConfig;
  wordWrap: boolean;
  onExclude?: (rule: ExclusionRule) => void;
  onExcludeText?: (text: string) => void;
}

const ROW_HEIGHT = 36;
const BUFFER = 10;
const DEFAULT_COL_WIDTH = 200;
const MIN_COL_WIDTH = 60;
const GUTTER_WIDTH = 30;

function rowHeightAt(i: number, k: number | null, H: number, R: number): number {
  if (k === null || i !== k) return R;
  return H;
}

/** Top offset of row `i` (sum of heights of rows 0..i-1). */
function rowTopAt(i: number, k: number | null, H: number, R: number): number {
  if (i === 0) return 0;
  if (k === null) return i * R;
  if (i <= k) return i * R;
  return k * R + H + (i - k - 1) * R;
}

function findFirstVisibleRow(scrollTop: number, n: number, k: number | null, H: number, R: number): number {
  if (n === 0) return 0;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const bottom = rowTopAt(mid, k, H, R) + rowHeightAt(mid, k, H, R);
    if (bottom <= scrollTop) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function findLastVisibleRow(scrollBottom: number, n: number, k: number | null, H: number, R: number): number {
  if (n === 0) return 0;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (rowTopAt(mid, k, H, R) < scrollBottom) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function WrapRowIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 ${expanded ? 'text-[var(--color-accent)]' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
    </svg>
  );
}

export default function LogTable({ columns, rows, sortConfig, onSort, severityConfig, wordWrap, onExclude, onExcludeText }: Props) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [containerWidth, setContainerWidth] = useState(800);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [wrappedRowIndex, setWrappedRowIndex] = useState<number | null>(null);
  const [wrappedRowHeight, setWrappedRowHeight] = useState(ROW_HEIGHT);
  const wrappedRowMeasureRef = useRef<HTMLDivElement>(null);

  const resizing = useRef<{ col: string; startX: number; startW: number } | null>(null);
  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;

  const k = wordWrap ? null : wrappedRowIndex;
  const H = wrappedRowHeight;

  useEffect(() => {
    setColWidths({});
  }, [columns]);

  useEffect(() => {
    setWrappedRowIndex(null);
  }, [rows.length]);

  useEffect(() => {
    if (wordWrap) setWrappedRowIndex(null);
  }, [wordWrap]);

  useLayoutEffect(() => {
    if (wordWrap || wrappedRowIndex === null) {
      setWrappedRowHeight(ROW_HEIGHT);
      return;
    }
    const el = wrappedRowMeasureRef.current;
    if (!el) return;
    const h = Math.max(ROW_HEIGHT, Math.ceil(el.getBoundingClientRect().height));
    setWrappedRowHeight((prev) => (prev === h ? prev : h));
  }, [wordWrap, wrappedRowIndex, rows, columns, colWidths, containerWidth]);

  useEffect(() => {
    if (wordWrap || wrappedRowIndex === null) return;
    const el = wrappedRowMeasureRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.max(ROW_HEIGHT, Math.ceil(entry.contentRect.height));
        if (h > 0) {
          setWrappedRowHeight((prev) => (Math.abs(prev - h) < 0.5 ? prev : h));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [wordWrap, wrappedRowIndex, columns, colWidths, containerWidth]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { height, width } = entry.contentRect;
        if (height > 0) setContainerHeight(height);
        if (width > 0) setContainerWidth(width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) setScrollTop(containerRef.current.scrollTop);
  }, []);

  const n = rows.length;
  const totalScrollHeight = rowTopAt(n, k, H, ROW_HEIGHT);
  const firstVis = findFirstVisibleRow(scrollTop, n, k, H, ROW_HEIGHT);
  const lastVis = findLastVisibleRow(scrollTop + containerHeight, n, k, H, ROW_HEIGHT);
  const startIdx = Math.max(0, firstVis - BUFFER);
  const endIdx = Math.min(n, lastVis + BUFFER + 1);
  const visibleRows = wordWrap ? rows : rows.slice(startIdx, endIdx);

  const getRowColor = useMemo(() => {
    if (!severityConfig.enabled || !severityConfig.field) return () => '';
    const ruleMap = new Map(
      severityConfig.rules.map((r) => [r.keyword.toUpperCase(), SEVERITY_COLORS[r.color] ?? '']),
    );
    return (row: FlattenedRow) => {
      const val = (row[severityConfig.field] ?? '').toUpperCase();
      return ruleMap.get(val) ?? '';
    };
  }, [severityConfig]);

  const handleSort = (col: string) => {
    if (sortConfig?.column === col) {
      onSort({ column: col, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      onSort({ column: col, direction: 'asc' });
    }
  };

  const formatCell = (col: string, value: string) => {
    if (col === '@timestamp') return formatTimestamp(value);
    return value;
  };

  // Columns that auto-expand to fill remaining width unless user manually resized them
  const AUTO_EXPAND_COLS = new Set(['payload.json.message', 'payload.fields.message']);

  const getEffectiveColWidth = (col: string): number => {
    if (colWidths[col] !== undefined) return colWidths[col];
    if (AUTO_EXPAND_COLS.has(col) && columns.includes(col)) {
      const otherWidth = columns
        .filter((c) => c !== col)
        .reduce((sum, c) => sum + (colWidths[c] ?? DEFAULT_COL_WIDTH), 0);
      return Math.max(DEFAULT_COL_WIDTH, containerWidth - otherWidth - GUTTER_WIDTH - 2);
    }
    return DEFAULT_COL_WIDTH;
  };

  const onResizeStart = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidthsRef.current[col] ?? getEffectiveColWidth(col);
    resizing.current = { col, startX, startW };

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const diff = ev.clientX - resizing.current.startX;
      const newW = Math.max(MIN_COL_WIDTH, resizing.current.startW + diff);
      setColWidths((prev) => ({ ...prev, [resizing.current!.col]: newW }));
    };

    const onUp = () => {
      resizing.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection()?.toString().trim();
    if (!selection || !onExcludeText) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, text: selection });
  }, [onExcludeText]);

  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = () => setContextMenu(null);
    document.addEventListener('click', dismiss);
    document.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('click', dismiss);
      document.removeEventListener('scroll', dismiss, true);
    };
  }, [contextMenu]);

  const totalWidth = GUTTER_WIDTH + columns.reduce((sum, col) => sum + getEffectiveColWidth(col), 0);

  const cellClassWrap =
    'px-3 py-1.5 text-sm text-[var(--color-text-secondary)] font-mono flex-shrink-0 whitespace-pre-wrap break-all';
  const cellClassTruncate =
    'px-3 text-sm text-[var(--color-text-secondary)] truncate font-mono flex-shrink-0';

  const toggleRowWrap = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    setWrappedRowIndex((prev) => (prev === idx ? null : idx));
  }, []);

  const gutterHeader = (
    <div
      className="flex-shrink-0 border-r border-[var(--color-border)]/40 bg-[var(--color-bg-tertiary)]"
      style={{ width: GUTTER_WIDTH }}
      aria-hidden
    />
  );

  const renderGutterCell = (realIdx: number, rowIsWrapped: boolean) => (
    <div
      className="flex-shrink-0 flex items-center justify-center border-r border-[var(--color-border)]/30 self-stretch"
      style={{ width: GUTTER_WIDTH }}
      onClick={(e) => e.stopPropagation()}
    >
      {!wordWrap ? (
        <button
          type="button"
          onClick={(e) => toggleRowWrap(e, realIdx)}
          className={`p-0.5 rounded flex items-center justify-center transition-colors ${
            rowIsWrapped
              ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
          }`}
          title={rowIsWrapped ? 'Collapse row wrap' : 'Wrap this row'}
        >
          <WrapRowIcon expanded={rowIsWrapped} />
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] flex flex-col flex-1 min-h-0 relative">
        <div className="overflow-x-auto flex-shrink-0" style={{ minWidth: totalWidth }}>
          <div className="flex bg-[var(--color-bg-tertiary)]" style={{ width: totalWidth }}>
            {gutterHeader}
            {columns.map((col) => (
              <div
                key={col}
                className="relative px-3 py-2 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider cursor-pointer hover:text-[var(--color-text-secondary)] select-none flex-shrink-0"
                style={{ width: getEffectiveColWidth(col) }}
                onClick={() => handleSort(col)}
              >
                <span className="inline-flex items-center gap-1 truncate">
                  {col}
                  {sortConfig?.column === col && (
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      {sortConfig.direction === 'asc'
                        ? <path d="M5.293 9.707l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 7.414l-3.293 3.293a1 1 0 01-1.414-1.414z" />
                        : <path d="M14.707 10.293l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 12.586l3.293-3.293a1 1 0 111.414 1.414z" />
                      }
                    </svg>
                  )}
                </span>
                <div
                  onMouseDown={(e) => onResizeStart(col, e)}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[var(--color-accent)]/30 transition-colors"
                />
              </div>
            ))}
          </div>
        </div>

        <div
          ref={containerRef}
          onScroll={handleScroll}
          onContextMenu={handleContextMenu}
          className="flex-1 overflow-auto min-h-0"
        >
          {wordWrap ? (
            <div style={{ minWidth: totalWidth }}>
              {visibleRows.map((row, realIdx) => {
                const colorClass = getRowColor(row);
                return (
                  <div
                    key={realIdx}
                    onClick={() => setSelectedRow(realIdx)}
                    className={`flex items-stretch cursor-pointer border-b border-[var(--color-border)]/30 hover:bg-[var(--color-bg-hover)] transition-colors ${colorClass}`}
                    style={{ minWidth: totalWidth }}
                  >
                    {renderGutterCell(realIdx, false)}
                    {columns.map((col) => (
                      <div
                        key={col}
                        className={cellClassWrap}
                        style={{ width: getEffectiveColWidth(col) }}
                      >
                        {formatCell(col, row[col] ?? '')}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ height: totalScrollHeight, position: 'relative', minWidth: totalWidth }}>
              {visibleRows.map((row, i) => {
                const realIdx = startIdx + i;
                const colorClass = getRowColor(row);
                const rowIsWrapped = wrappedRowIndex === realIdx;
                const top = rowTopAt(realIdx, k, H, ROW_HEIGHT);
                const cellClass = rowIsWrapped ? cellClassWrap : cellClassTruncate;
                const rowRef = rowIsWrapped ? wrappedRowMeasureRef : undefined;
                return (
                  <div
                    key={realIdx}
                    ref={rowRef}
                    onClick={() => setSelectedRow(realIdx)}
                    className={`flex cursor-pointer border-b border-[var(--color-border)]/30 hover:bg-[var(--color-bg-hover)] transition-colors ${colorClass} ${rowIsWrapped ? 'items-stretch' : 'items-center'}`}
                    style={{
                      position: 'absolute',
                      top,
                      height: rowIsWrapped ? 'auto' : ROW_HEIGHT,
                      minHeight: rowIsWrapped ? ROW_HEIGHT : undefined,
                      width: '100%',
                      minWidth: totalWidth,
                      boxSizing: 'border-box',
                    }}
                  >
                    {renderGutterCell(realIdx, rowIsWrapped)}
                    {columns.map((col) => (
                      <div
                        key={col}
                        className={cellClass}
                        style={{
                          width: getEffectiveColWidth(col),
                          ...(rowIsWrapped ? {} : { lineHeight: `${ROW_HEIGHT}px` }),
                        }}
                        title={rowIsWrapped ? undefined : row[col] ?? ''}
                      >
                        {formatCell(col, row[col] ?? '')}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Scroll to top / bottom buttons */}
      <div className="absolute bottom-3 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={scrollToTop}
          className="w-7 h-7 flex items-center justify-center rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors shadow-sm"
          title="Scroll to top"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
        <button
          onClick={scrollToBottom}
          className="w-7 h-7 flex items-center justify-center rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors shadow-sm"
          title="Scroll to bottom"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl py-1 min-w-[200px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-2"
            onClick={() => {
              onExcludeText?.(contextMenu.text);
              setContextMenu(null);
            }}
          >
            <svg className="w-4 h-4 text-[var(--color-error)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span className="truncate">
              Exclude rows with &quot;<span className="font-medium text-[var(--color-accent)]">{contextMenu.text.length > 40 ? contextMenu.text.slice(0, 40) + '...' : contextMenu.text}</span>&quot;
            </span>
          </button>
        </div>
      )}

      {selectedRow !== null && rows[selectedRow] && (
        <LogDetailPanel
          row={rows[selectedRow]}
          onClose={() => setSelectedRow(null)}
          onExclude={onExclude}
        />
      )}
    </>
  );
}
