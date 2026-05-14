import { useState, useCallback } from 'react';

interface Props {
  data: unknown;
  defaultExpanded?: boolean;
  rootLabel?: string;
}

export default function JsonTree({ data, defaultExpanded = true, rootLabel }: Props) {
  return (
    <div className="font-mono text-xs leading-relaxed">
      <JsonNode value={data} depth={0} defaultExpanded={defaultExpanded} label={rootLabel} />
    </div>
  );
}

interface NodeProps {
  value: unknown;
  depth: number;
  defaultExpanded: boolean;
  label?: string;
}

function JsonNode({ value, depth, defaultExpanded, label }: NodeProps) {
  if (value === null) return <Leaf label={label} content="null" colorClass="text-[var(--color-text-muted)]" value={value} />;
  if (typeof value === 'boolean') return <Leaf label={label} content={String(value)} colorClass="text-amber-400" value={value} />;
  if (typeof value === 'number') return <Leaf label={label} content={String(value)} colorClass="text-teal-400" value={value} />;
  if (typeof value === 'string') return <StringLeaf label={label} value={value} />;
  if (Array.isArray(value)) return <ArrayNode label={label} items={value} depth={depth} defaultExpanded={defaultExpanded} />;
  if (typeof value === 'object') return <ObjectNode label={label} obj={value as Record<string, unknown>} depth={depth} defaultExpanded={defaultExpanded} />;
  return <Leaf label={label} content={String(value)} colorClass="text-[var(--color-text-secondary)]" value={value} />;
}

function Leaf({ label, content, colorClass, value }: { label?: string; content: string; colorClass: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(typeof value === 'string' ? value : JSON.stringify(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [value]);

  return (
    <span className="group inline-flex items-baseline gap-1">
      {label !== undefined && <span className="text-[var(--color-accent)]">{label}: </span>}
      <span className={colorClass}>{content}</span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ml-0.5" title="Copy value">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </span>
  );
}

function StringLeaf({ label, value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [value]);

  const truncated = value.length > 300;
  const [expanded, setExpanded] = useState(false);
  const display = truncated && !expanded ? value.slice(0, 300) + '...' : value;

  return (
    <span className="group inline-flex items-baseline gap-1 max-w-full">
      {label !== undefined && <span className="text-[var(--color-accent)]">{label}: </span>}
      <span className="text-green-400 break-all">
        &quot;{display}&quot;
        {truncated && (
          <button onClick={() => setExpanded(!expanded)} className="ml-1 text-[var(--color-accent)] hover:underline">
            {expanded ? 'less' : 'more'}
          </button>
        )}
      </span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ml-0.5 flex-shrink-0" title="Copy value">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </span>
  );
}

function ObjectNode({ label, obj, depth, defaultExpanded }: { label?: string; obj: Record<string, unknown>; depth: number; defaultExpanded: boolean }) {
  const keys = Object.keys(obj);
  const shouldStartOpen = defaultExpanded && depth < 1;
  const [open, setOpen] = useState(shouldStartOpen);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [obj]);

  return (
    <div>
      <span className="inline-flex items-center gap-1 cursor-pointer select-none group" onClick={() => setOpen(!open)}>
        <ToggleArrow open={open} />
        {label !== undefined && <span className="text-[var(--color-accent)]">{label}: </span>}
        <span className="text-[var(--color-text-muted)]">
          {open ? '{' : `{ ${keys.length} ${keys.length === 1 ? 'key' : 'keys'} }`}
        </span>
        <button onClick={(e) => { e.stopPropagation(); copy(); }} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity" title="Copy object">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </span>
      {open && (
        <div className="ml-4 border-l border-[var(--color-border)]/40 pl-3">
          {keys.map((key) => (
            <div key={key} className="py-0.5">
              <JsonNode value={obj[key]} depth={depth + 1} defaultExpanded={defaultExpanded} label={key} />
            </div>
          ))}
          <span className="text-[var(--color-text-muted)]">{'}'}</span>
        </div>
      )}
    </div>
  );
}

function ArrayNode({ label, items, depth, defaultExpanded }: { label?: string; items: unknown[]; depth: number; defaultExpanded: boolean }) {
  const shouldStartOpen = defaultExpanded && depth < 1;
  const [open, setOpen] = useState(shouldStartOpen);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(items, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [items]);

  return (
    <div>
      <span className="inline-flex items-center gap-1 cursor-pointer select-none group" onClick={() => setOpen(!open)}>
        <ToggleArrow open={open} />
        {label !== undefined && <span className="text-[var(--color-accent)]">{label}: </span>}
        <span className="text-[var(--color-text-muted)]">
          {open ? '[' : `[ ${items.length} ${items.length === 1 ? 'item' : 'items'} ]`}
        </span>
        <button onClick={(e) => { e.stopPropagation(); copy(); }} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity" title="Copy array">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </span>
      {open && (
        <div className="ml-4 border-l border-[var(--color-border)]/40 pl-3">
          {items.map((item, i) => (
            <div key={i} className="py-0.5">
              <JsonNode value={item} depth={depth + 1} defaultExpanded={defaultExpanded} label={String(i)} />
            </div>
          ))}
          <span className="text-[var(--color-text-muted)]">{']'}</span>
        </div>
      )}
    </div>
  );
}

function ToggleArrow({ open }: { open: boolean }) {
  return (
    <svg className={`w-3 h-3 text-[var(--color-text-muted)] transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
      <path d="M6 4l8 6-8 6V4z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
