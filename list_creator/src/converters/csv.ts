import type { ConverterInfo, ParsedData } from '../types';

function quoteField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function convert(data: ParsedData): string {
  const lines: string[] = [];
  if (data.hasHeaders) {
    lines.push(data.headers.map(quoteField).join(','));
  }
  for (const row of data.rows) {
    lines.push(row.map(quoteField).join(','));
  }
  return lines.join('\n');
}

export const csvConverter: ConverterInfo = {
  id: 'csv',
  name: 'CSV',
  description: 'Comma-separated values (RFC 4180)',
  convert,
};
