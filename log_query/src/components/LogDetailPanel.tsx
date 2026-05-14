import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FlattenedRow } from '../types';
import { formatTimestamp } from '../utils/parser';
import { extractJsonObjects } from '../utils/jsonExtract';
import JsonTree from './JsonTree';

export interface ExclusionRule {
  column: string;
  value: string;
}

interface Props {
  row: FlattenedRow;
  onClose: () => void;
  onExclude?: (rule: ExclusionRule) => void;
}

const MESSAGE_FIELDS = ['payload.json.message', 'payload.fields.message', 'payload.text'];

export default function LogDetailPanel({ row, onClose, onExclude }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const entries = Object.entries(row).sort(([a], [b]) => a.localeCompare(b));

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showJson) setShowJson(false);
      else onClose();
    }
  }, [onClose, showJson]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const messageValue = useMemo(() => {
    for (const field of MESSAGE_FIELDS) {
      const val = row[field];
      if (val && val.trim().length > 0) return val;
    }
    return null;
  }, [row]);

  const extractedJson = useMemo(() => {
    if (!messageValue) return [];
    return extractJsonObjects(messageValue);
  }, [messageValue]);

  const hasExtractableJson = extractedJson.length > 0;

  const copyValue = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const copyAll = () => {
    const text = entries
      .map(([k, v]) => `${k}: ${k === '@timestamp' ? formatTimestamp(v) : v}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied('__all__');
    setTimeout(() => setCopied(null), 1500);
  };

  const copyExtractedJson = () => {
    const text = extractedJson.length === 1
      ? JSON.stringify(extractedJson[0], null, 2)
      : JSON.stringify(extractedJson, null, 2);
    navigator.clipboard.writeText(text);
    setCopied('__json__');
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-[var(--color-bg-secondary)]/90 backdrop-blur-md border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col max-h-[85vh] w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)] flex-shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {showJson ? 'Extracted JSON' : 'Log Entry Detail'}
          </h2>
          <div className="flex items-center gap-2">
            {showJson ? (
              <>
                <button
                  onClick={copyExtractedJson}
                  className="px-3 py-1 text-xs font-medium bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  {copied === '__json__' ? 'Copied!' : 'Copy JSON'}
                </button>
                <button
                  onClick={() => setShowJson(false)}
                  className="px-3 py-1 text-xs font-medium bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  Back
                </button>
              </>
            ) : (
              <>
                {messageValue && (
                  <button
                    onClick={() => setShowJson(true)}
                    className={`px-3 py-1 text-xs font-medium border rounded transition-colors ${
                      hasExtractableJson
                        ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/50 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25'
                        : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    Extract JSON
                  </button>
                )}
                <button
                  onClick={copyAll}
                  className="px-3 py-1 text-xs font-medium bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  {copied === '__all__' ? 'Copied!' : 'Copy All'}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {showJson ? (
            <div className="p-4">
              {hasExtractableJson ? (
                <div className="flex flex-col gap-4">
                  {extractedJson.map((obj, i) => (
                    <div key={i} className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 overflow-x-auto">
                      {extractedJson.length > 1 && (
                        <p className="text-[var(--color-text-muted)] text-xs mb-2 uppercase tracking-wide font-medium">
                          Object {i + 1}
                        </p>
                      )}
                      <JsonTree data={obj} defaultExpanded />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
                  <p className="text-sm">No JSON found in message</p>
                </div>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {entries.map(([key, value]) => {
                  const display = key === '@timestamp' ? formatTimestamp(value) : value;
                  return (
                    <tr key={key} className="border-b border-[var(--color-border)]/20 hover:bg-[var(--color-bg-hover)]/50 group">
                      <td className="py-2 pl-5 pr-3 font-mono text-xs text-[var(--color-accent)] whitespace-nowrap align-top font-medium w-0">
                        {key}
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs text-[var(--color-text-secondary)] break-all whitespace-pre-wrap">
                        {display}
                      </td>
                      <td className="py-2 pr-4 w-0 align-top whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyValue(key, display)}
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                            title="Copy value"
                          >
                            {copied === key ? (
                              <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                          {onExclude && value && (
                            <button
                              onClick={() => onExclude({ column: key, value })}
                              className="text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
                              title={`Exclude rows where ${key} = "${value.length > 30 ? value.slice(0, 30) + '...' : value}"`}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
