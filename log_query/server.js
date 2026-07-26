import express from 'express';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { ALLOWED_TIME_ZONES, parseQueryTime } from './time.js';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, 'dist');
const PORT = process.env.PORT || 3001;
const QUERY_TIMEOUT_MS = parseInt(process.env.QUERY_TIMEOUT_MS ?? '60000', 10);
const MONOREPO_ROOT = process.env.MONOREPO_ROOT ?? '';

const GATEWAY_URLS = {
  production: 'https://developer-tools-gateway.citystoragesystems.com',
  staging: 'https://developer-tools-gateway.citystoragesystems-staging.com',
};
const LOGPROC_PATHS = {
  container_logs: '/logproc-logs/search_streaming',
  istio: '/logproc-logs/search_streaming',
  reqresp: '/logproc-reqresp/search_streaming',
};

const ALLOWED_ENVIRONMENTS = new Set(['production', 'staging']);
const ALLOWED_NAMESPACES = new Set([
  'boost', 'marketing', 'promotions', 'brand-market', 'future-foods',
  'integrations', 'analytics', 'log-exporter', 'log-exporter-logproc',
]);
const ALLOWED_SEVERITIES = new Set(['INFO', 'WARN', 'WARNING', 'ERROR', 'DEBUG', 'TRACE']);
const ALLOWED_SEARCH_FIELDS = new Set([
  'extracted.uuid', 'payload.text', 'payload.json.source_file',
  'payload.json.message', 'payload.json.severity',
]);
const ALLOWED_SEARCH_OPERATORS = new Set(['=', '=*', '!=']);
const SAFE_VALUE_RE = /^[^"'\\\x00-\x1f\x7f]{0,512}$/;
const SAFE_TIME_RE = /^(now(-\d+(m|h|d))?|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})$/;

// ---------------------------------------------------------------------------
// Netrc parsing
// ---------------------------------------------------------------------------

function parseNetrc() {
  const netrcPath = join(homedir(), '.netrc');
  if (!existsSync(netrcPath)) return {};
  const text = readFileSync(netrcPath, 'utf-8');
  const tokens = {};
  let currentMachine = null;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const machineMatch = trimmed.match(/^machine\s+(\S+)/);
    if (machineMatch) {
      currentMachine = machineMatch[1];
      continue;
    }
    if (currentMachine) {
      const passMatch = trimmed.match(/^password\s+(\S+)/);
      if (passMatch) {
        tokens[currentMachine] = passMatch[1];
        currentMachine = null;
      }
    }
  }
  return tokens;
}

function getGatewayToken(environment) {
  const tokens = parseNetrc();
  const gatewayHost = environment === 'staging'
    ? 'developer-tools-gateway.citystoragesystems-staging.com'
    : 'developer-tools-gateway.citystoragesystems.com';
  return tokens[gatewayHost] ?? null;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function buildLogProcQLQuery(params) {
  const { environment, namespace, searchField, searchOperator, searchValue, severity, logFamily } = params;
  const parts = [];
  if (logFamily !== 'istio') {
    parts.push(`"k8s_environment"="${environment}"`);
    if (namespace) parts.push(`"k8s_namespace"="${namespace}"`);
  }
  if (searchValue) {
    const op = searchOperator === '=*' ? '=*' : '=';
    parts.push(`"${searchField}"${op}"${searchValue}"`);
  }
  if (severity) {
    parts.push(`"payload.json.severity"="${severity}"`);
  }
  return `{${parts.join(', ')}}`;
}

function flattenObject(obj, prefix, result) {
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) { result[prefix] = obj.map(String).join(', '); return; }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (key === 'text' && prefix === 'payload') result[path] = String(value);
      else flattenObject(value, path, result);
    }
    return;
  }
  result[prefix] = String(obj);
}

function flattenEntry(obj) {
  const result = {};
  flattenObject(obj, '', result);
  return result;
}

function parseNDJSONLines(text) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const columnsSet = new Set();
  const rows = [];
  for (const line of lines) {
    try {
      let jsonStr = line;
      const braceIdx = line.indexOf('{');
      if (braceIdx > 0) jsonStr = line.substring(braceIdx);
      const parsed = JSON.parse(jsonStr);
      if ('Done' in parsed) continue;
      const flat = flattenEntry(parsed);
      for (const key of Object.keys(flat)) columnsSet.add(key);
      rows.push(flat);
    } catch { /* skip malformed */ }
  }
  const columns = Array.from(columnsSet).sort((a, b) => {
    if (a === '@timestamp') return -1;
    if (b === '@timestamp') return 1;
    return a.localeCompare(b);
  });
  return { columns, rows };
}

function validateInput(body) {
  const {
    environment = 'production', namespace = '', searchField = 'extracted.uuid',
    searchOperator = '=', searchValue = '', severity = '',
    start = 'now-1h', end = 'now', timeZone = 'America/Los_Angeles',
    limit = 200, logFamily = 'container_logs',
  } = body ?? {};

  if (!ALLOWED_ENVIRONMENTS.has(environment)) return { error: `Invalid environment: ${environment}` };
  if (namespace && !ALLOWED_NAMESPACES.has(namespace)) return { error: `Invalid namespace: ${namespace}` };
  if (!ALLOWED_SEARCH_FIELDS.has(searchField)) return { error: `Invalid searchField: ${searchField}` };
  if (!ALLOWED_SEARCH_OPERATORS.has(searchOperator)) return { error: `Invalid searchOperator: ${searchOperator}` };
  if (searchValue && !SAFE_VALUE_RE.test(searchValue)) return { error: 'searchValue contains invalid characters.' };
  if (severity && !ALLOWED_SEVERITIES.has(severity)) return { error: `Invalid severity: ${severity}` };
  if (!SAFE_TIME_RE.test(start)) return { error: `Invalid start time: ${start}` };
  if (!SAFE_TIME_RE.test(end)) return { error: `Invalid end time: ${end}` };
  if (!ALLOWED_TIME_ZONES.has(timeZone)) return { error: `Invalid timezone: ${timeZone}` };
  try {
    parseQueryTime(start, timeZone);
    parseQueryTime(end, timeZone);
  } catch (error) {
    return { error: error.message };
  }
  const limitNum = parseInt(String(limit), 10);
  if (isNaN(limitNum) || limitNum < 0 || limitNum > 10000) return { error: 'limit must be 0-10000.' };
  if (!['container_logs', 'istio'].includes(logFamily)) return { error: `Invalid logFamily: ${logFamily}` };

  return { environment, namespace, searchField, searchOperator, searchValue, severity, start, end, timeZone, limitNum, logFamily };
}

// ---------------------------------------------------------------------------
// Gateway-based query (direct HTTP to the developer-tools gateway)
// ---------------------------------------------------------------------------

async function queryViaGateway(params) {
  const { environment, logFamily, start, end, timeZone, limitNum } = params;
  const query = buildLogProcQLQuery(params);
  const token = getGatewayToken(environment);
  if (!token) throw new Error(`No gateway token found in ~/.netrc for ${environment}. Run: css auth login`);

  const gatewayBase = GATEWAY_URLS[environment] ?? GATEWAY_URLS.production;
  const path = LOGPROC_PATHS[logFamily] ?? LOGPROC_PATHS.container_logs;
  const url = gatewayBase + path;

  const minTime = parseQueryTime(start, timeZone).toISOString();
  const maxTime = parseQueryTime(end, timeZone).toISOString();
  const family = logFamily === 'istio' ? 'istio' : 'container_logs';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ min_time: minTime, max_time: maxTime, logprocql: query, limit: limitNum, family }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Gateway returned ${resp.status}: ${body}`);
    }

    const text = await resp.text();
    const { columns, rows } = parseNDJSONLines(text);
    return { columns, rows, query, mode: 'gateway' };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// CLI-based query (fallback)
// ---------------------------------------------------------------------------

async function queryViaCLI(params) {
  const { logFamily, start, end, timeZone, limitNum } = params;
  const query = buildLogProcQLQuery(params);

  const args = ['logs', 'logproc'];
  if (logFamily === 'istio') args.push('-f', 'istio');
  const normalizedStart = parseQueryTime(start, timeZone).toISOString();
  const normalizedEnd = parseQueryTime(end, timeZone).toISOString();
  args.push(query, '-s', normalizedStart, '-e', normalizedEnd, '-l', String(limitNum), '--format', 'json', '--no-color');

  const { stdout, stderr } = await execFileAsync('css', args, {
    cwd: MONOREPO_ROOT,
    timeout: QUERY_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env },
  });

  if (stderr && !stdout) throw new Error(stderr.trim());

  const { columns, rows } = parseNDJSONLines(stdout);
  return { columns, rows, query, mode: 'cli' };
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  const prodToken = getGatewayToken('production');
  const stagingToken = getGatewayToken('staging');
  res.json({
    ok: !!(prodToken || MONOREPO_ROOT),
    gateway: { production: !!prodToken, staging: !!stagingToken },
    cli: !!MONOREPO_ROOT,
  });
});

app.post('/api/query', async (req, res) => {
  const validated = validateInput(req.body);
  if (validated.error) { res.status(400).json(validated); return; }

  const startTime = Date.now();

  // Try gateway first, fall back to CLI
  try {
    const result = await queryViaGateway(validated);
    const durationMs = Date.now() - startTime;
    res.json({ ...result, durationMs });
  } catch (gatewayErr) {
    if (!MONOREPO_ROOT) {
      const durationMs = Date.now() - startTime;
      res.status(502).json({
        error: `Gateway query failed: ${gatewayErr.message}`,
        hint: 'Ensure css auth login has been run, or set MONOREPO_ROOT for CLI fallback.',
        durationMs,
      });
      return;
    }
    try {
      const result = await queryViaCLI(validated);
      const durationMs = Date.now() - startTime;
      res.json({ ...result, durationMs });
    } catch (cliErr) {
      const durationMs = Date.now() - startTime;
      const detail = cliErr?.stderr?.trim() || cliErr?.message || 'Unknown error';
      if (cliErr?.killed || cliErr?.signal === 'SIGTERM') {
        res.status(504).json({ error: `Query timed out after ${QUERY_TIMEOUT_MS}ms`, durationMs });
        return;
      }
      res.status(502).json({ error: 'Query failed', detail, durationMs });
    }
  }
});

app.use(express.static(DIST_DIR));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(join(DIST_DIR, 'index.html'));
});

// Startup info
const prodToken = getGatewayToken('production');
const stagingToken = getGatewayToken('staging');
console.log('');
if (prodToken) console.log('  Gateway (production): ready');
else console.log('  Gateway (production): no token found — run css auth login');
if (stagingToken) console.log('  Gateway (staging): ready');
else console.log('  Gateway (staging): no token');
if (MONOREPO_ROOT) console.log(`  CLI fallback: ${MONOREPO_ROOT}`);
else console.log('  CLI fallback: disabled (MONOREPO_ROOT not set)');

app.listen(PORT, () => {
  console.log(`\nLog Query server running at http://localhost:${PORT}\n`);
});
