const WALL_CLOCK_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

export const ALLOWED_TIME_ZONES = new Set(['UTC', 'America/Los_Angeles']);

function wallClockParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  );
  return [
    parts.year, parts.month, parts.day,
    parts.hour, parts.minute, parts.second,
  ];
}

function sameParts(left, right) {
  return left.every((value, index) => value === right[index]);
}

function parseWallClock(value, timeZone) {
  const match = WALL_CLOCK_RE.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}`);

  const expected = match.slice(1).map(Number);
  const [year, month, day, hour, minute, second] = expected;
  const utcWallClock = Date.UTC(year, month - 1, day, hour, minute, second);
  const normalized = new Date(utcWallClock);
  const normalizedParts = [
    normalized.getUTCFullYear(),
    normalized.getUTCMonth() + 1,
    normalized.getUTCDate(),
    normalized.getUTCHours(),
    normalized.getUTCMinutes(),
    normalized.getUTCSeconds(),
  ];
  if (!sameParts(expected, normalizedParts)) {
    throw new Error(`Invalid calendar time: ${value}`);
  }

  if (timeZone === 'UTC') return normalized;

  let candidateMs = utcWallClock;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = wallClockParts(new Date(candidateMs), timeZone);
    const actualAsUtc = Date.UTC(
      actual[0], actual[1] - 1, actual[2],
      actual[3], actual[4], actual[5],
    );
    const adjustment = utcWallClock - actualAsUtc;
    if (adjustment === 0) break;
    candidateMs += adjustment;
  }

  const candidate = new Date(candidateMs);
  if (!sameParts(expected, wallClockParts(candidate, timeZone))) {
    throw new Error(
      `${value} does not exist in ${timeZone} because of a daylight-saving transition`,
    );
  }
  return candidate;
}

export function parseQueryTime(value, timeZone, now = new Date()) {
  if (!ALLOWED_TIME_ZONES.has(timeZone)) {
    throw new Error(`Unsupported timezone: ${timeZone}`);
  }

  const relative = value.match(/^now(-(\d+)(m|h|d))?$/);
  if (relative) {
    if (!relative[1]) return new Date(now);
    const amount = Number(relative[2]);
    const unit = relative[3];
    const milliseconds =
      unit === 'm' ? amount * 60_000 :
      unit === 'h' ? amount * 3_600_000 :
      amount * 86_400_000;
    return new Date(now.getTime() - milliseconds);
  }

  return parseWallClock(value, timeZone);
}
