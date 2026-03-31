import type { ConverterInfo, ParsedData } from '../types';

function sanitizeField(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

function convert(data: ParsedData): string {
  const lines: string[] = [];
  if (data.hasHeaders) {
    lines.push(data.headers.map(sanitizeField).join('\t'));
  }
  for (const row of data.rows) {
    lines.push(row.map(sanitizeField).join('\t'));
  }
  return lines.join('\n');
}

export const tsvConverter: ConverterInfo = {
  id: 'tsv',
  name: 'TSV',
  description: 'Tab-separated values',
  convert,
};
