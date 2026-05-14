/**
 * Best-effort extraction of structured objects from a string.
 * Handles JSON, escaped JSON, Java toString() format, and Protobuf text format.
 * Non-parseable content is silently discarded.
 */
export function extractJsonObjects(text: string): unknown[] {
  if (!text || typeof text !== 'string') return [];

  const trimmed = text.trim();
  if (!trimmed) return [];

  // Strategy 1: the entire string is valid JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) return [parsed];
  } catch { /* continue */ }

  // Strategy 2: scan for balanced { } or [ ] JSON segments
  const fromBraces = extractBalancedJsonSegments(trimmed);
  if (fromBraces.length > 0) return fromBraces;

  // Strategy 3: unescape \" sequences and retry
  if (trimmed.includes('\\"')) {
    const unescaped = trimmed
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    try {
      const parsed = JSON.parse(unescaped.trim());
      if (typeof parsed === 'object' && parsed !== null) return [parsed];
    } catch { /* continue */ }

    const fromUnescaped = extractBalancedJsonSegments(unescaped);
    if (fromUnescaped.length > 0) return fromUnescaped;
  }

  // Strategy 4: Java toString() format — ClassName{key=value, ...}
  const fromJava = extractJavaObjects(trimmed);
  if (fromJava.length > 0) return fromJava;

  // Strategy 5: Protobuf text format — field: value / field { ... }
  // Also handles content inside single-quoted strings (e.g. Request: '...')
  const fromProto = extractProtoObjects(trimmed);
  if (fromProto.length > 0) return fromProto;

  return [];
}

// ---------------------------------------------------------------------------
// JSON balanced-brace extraction
// ---------------------------------------------------------------------------

function extractBalancedJsonSegments(text: string): unknown[] {
  const results: unknown[] = [];
  const openers: Record<string, string> = { '{': '}', '[': ']' };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== '{' && ch !== '[') { i++; continue; }

    const closer = openers[ch]!;
    const start = i;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = start; j < text.length; j++) {
      const c = text[j];

      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }

      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;

      if (c === ch) depth++;
      else if (c === closer) {
        depth--;
        if (depth === 0) {
          const candidate = text.substring(start, j + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (typeof parsed === 'object' && parsed !== null) {
              results.push(parsed);
            }
          } catch { /* skip */ }
          i = j + 1;
          break;
        }
      }

      if (j === text.length - 1) {
        i = start + 1;
      }
    }

    if (i === start) i++;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Java toString() format: ClassName{key=value, key2=Nested{...}}
// ---------------------------------------------------------------------------

const JAVA_OBJ_RE = /[A-Z][A-Za-z0-9_]*\{/;

function extractJavaObjects(text: string): unknown[] {
  const results: unknown[] = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const remaining = text.substring(searchFrom);
    const match = remaining.match(JAVA_OBJ_RE);
    if (!match || match.index === undefined) break;

    const absStart = searchFrom + match.index;
    const braceStart = absStart + match[0].length - 1;
    const braceEnd = findMatchingBrace(text, braceStart);

    if (braceEnd === -1) {
      searchFrom = braceStart + 1;
      continue;
    }

    const inner = text.substring(braceStart + 1, braceEnd);
    const className = match[0].slice(0, -1);
    const parsed = parseJavaInner(inner);

    if (parsed !== null && Object.keys(parsed).length > 0) {
      results.push({ _type: className, ...parsed });
    }

    searchFrom = braceEnd + 1;
  }

  return results;
}

function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Parse the inside of a Java toString() brace: "key=value, key2=value2"
 * Handles nested ClassName{...}, arrays [...], and primitive values.
 */
function parseJavaInner(inner: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  const pairs = splitTopLevelCommas(inner);

  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;

    const key = pair.substring(0, eqIdx).trim();
    const rawValue = pair.substring(eqIdx + 1).trim();

    if (!key) continue;
    result[key] = parseJavaValue(rawValue);
  }

  return Object.keys(result).length > 0 ? result : null;
}

function parseJavaValue(raw: string): unknown {
  if (!raw || raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // Numeric
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (!isNaN(n)) return n;
  }

  // Nested Java object: ClassName{...}
  const nestedMatch = raw.match(/^([A-Z][A-Za-z0-9_]*)\{(.*)\}$/s);
  if (nestedMatch) {
    const parsed = parseJavaInner(nestedMatch[2]);
    if (parsed !== null) return { _type: nestedMatch[1], ...parsed };
  }

  // Array: [Item{...}, Item{...}]
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const arrayInner = raw.substring(1, raw.length - 1).trim();
    if (!arrayInner) return [];
    const items = splitTopLevelCommas(arrayInner);
    return items.map((item) => parseJavaValue(item.trim()));
  }

  return raw;
}

/**
 * Split on commas that are not inside braces {} or brackets [].
 */
function splitTopLevelCommas(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(text.substring(start, i));
      start = i + 1;
    }
  }

  if (start < text.length) {
    parts.push(text.substring(start));
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Protobuf text format: field_name: value  /  field_name { nested }
// ---------------------------------------------------------------------------

// Matches a lowercase/snake_case identifier followed by optional whitespace + {
const PROTO_BLOCK_RE = /\b([a-z][a-z0-9_]*)\s*\{/g;

function extractProtoObjects(text: string): unknown[] {
  const results: unknown[] = [];

  // Also search inside single-quoted strings (e.g. Request: '...')
  const candidates: string[] = [text];
  const singleQuoteRe = /'([^']{10,})'/g;
  let sq: RegExpExecArray | null;
  while ((sq = singleQuoteRe.exec(text)) !== null) {
    candidates.push(sq[1]);
  }

  for (const candidate of candidates) {
    PROTO_BLOCK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PROTO_BLOCK_RE.exec(candidate)) !== null) {
      const braceStart = match.index + match[0].length - 1;
      const braceEnd = findMatchingBrace(candidate, braceStart);
      if (braceEnd === -1) continue;

      const inner = candidate.substring(braceStart + 1, braceEnd);
      const parsed = parseProtoInner(inner);
      if (parsed !== null && Object.keys(parsed).length > 0) {
        results.push({ _proto: match[1], ...parsed });
        // Advance past this block to avoid re-processing its interior
        PROTO_BLOCK_RE.lastIndex = braceEnd + 1;
      }
    }
    if (results.length > 0) break;
  }

  return results;
}

/**
 * Parse the inside of a protobuf text block.
 * Handles:
 *   field: "string value"
 *   field: 123
 *   field: ENUM_VALUE
 *   nested_field { ... }
 *   repeated_field: "a"  repeated_field: "b"  (produces array)
 */
function parseProtoInner(inner: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  const text = inner.trim();
  let i = 0;

  while (i < text.length) {
    // Skip whitespace
    while (i < text.length && /\s/.test(text[i]!)) i++;
    if (i >= text.length) break;

    // Read field name: [a-z][a-z0-9_]*
    const nameStart = i;
    while (i < text.length && /[a-z0-9_]/.test(text[i]!)) i++;
    const fieldName = text.substring(nameStart, i);
    if (!fieldName) { i++; continue; }

    // Skip whitespace
    while (i < text.length && /\s/.test(text[i]!)) i++;
    if (i >= text.length) break;

    const sep = text[i];

    let value: unknown;

    if (sep === '{') {
      // Nested block
      const braceEnd = findMatchingBrace(text, i);
      if (braceEnd === -1) { i++; continue; }
      const nested = parseProtoInner(text.substring(i + 1, braceEnd));
      value = nested ?? {};
      i = braceEnd + 1;
    } else if (sep === ':') {
      i++; // skip ':'
      while (i < text.length && text[i] === ' ') i++;

      if (text[i] === '"') {
        // Quoted string
        i++;
        let str = '';
        while (i < text.length && text[i] !== '"') {
          if (text[i] === '\\') i++;
          str += text[i++];
        }
        i++; // closing quote
        value = str;
      } else if (text[i] === '{') {
        // Inline nested block
        const braceEnd = findMatchingBrace(text, i);
        if (braceEnd === -1) { i++; continue; }
        const nested = parseProtoInner(text.substring(i + 1, braceEnd));
        value = nested ?? {};
        i = braceEnd + 1;
      } else {
        // Scalar: number or enum
        const valStart = i;
        while (i < text.length && !/[\s{]/.test(text[i]!)) i++;
        const raw = text.substring(valStart, i).trim();
        const n = Number(raw);
        value = isNaN(n) || raw === '' ? raw : n;
      }
    } else {
      i++;
      continue;
    }

    // Store — repeated fields become arrays
    if (fieldName in result) {
      const existing = result[fieldName];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[fieldName] = [existing, value];
      }
    } else {
      result[fieldName] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
