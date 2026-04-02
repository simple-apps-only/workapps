import { useState, useCallback, useRef } from 'react';

interface OutputDisplayProps {
  output: string;
  formatName: string;
  formatId: string;
}

const extensionMap: Record<string, string> = {
  csv: 'csv',
  tsv: 'tsv',
  json: 'json',
  powershell: 'ps1',
  'sql-in': 'sql',
  'sql-insert': 'sql',
  'sql-values': 'sql',
  markdown: 'md',
  yaml: 'yaml',
  python: 'py',
  bash: 'sh',
  zsh: 'zsh',
  xml: 'xml',
  dos: 'bat',
};

export default function OutputDisplay({ output, formatName, formatId }: OutputDisplayProps) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const handleDownload = useCallback(() => {
    const ext = extensionMap[formatId] || 'txt';
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `list_output.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [output, formatId]);

  const scrollToTop = useCallback(() => {
    preRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    preRef.current?.scrollTo({ top: preRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = output;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [output]);

  if (!output) {
    return (
      <div className="flex items-center justify-center h-48 border border-[var(--color-border)] rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] text-sm">
        Enter CSV data above to see output
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--color-text-secondary)]">
          {formatName} Output
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="px-3 py-1 text-sm rounded transition-colors bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] hover:border-[var(--color-text-muted)]"
          >
            Download
          </button>
          <button
            onClick={handleCopy}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              copied
                ? 'bg-[var(--color-success)]/20 text-[var(--color-success)] border border-[var(--color-success)]/40'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
            }`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="relative">
        <pre ref={preRef} className="p-4 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-auto max-h-96 font-mono text-sm text-[var(--color-syntax-orange)] leading-relaxed whitespace-pre-wrap break-words">
          {output}
        </pre>
        <div className="absolute bottom-2 right-3 flex flex-col gap-1">
          <button
            onClick={scrollToTop}
            title="Scroll to top"
            className="w-7 h-7 flex items-center justify-center rounded bg-[var(--color-bg-tertiary)]/80 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] hover:border-[var(--color-text-muted)] backdrop-blur-sm transition-colors text-xs"
          >
            ▲
          </button>
          <button
            onClick={scrollToBottom}
            title="Scroll to bottom"
            className="w-7 h-7 flex items-center justify-center rounded bg-[var(--color-bg-tertiary)]/80 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] hover:border-[var(--color-text-muted)] backdrop-blur-sm transition-colors text-xs"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}
