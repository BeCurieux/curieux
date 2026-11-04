// CSV for the leads export. Quotes every field, and defuses spreadsheet
// formulas: a cell starting with = + - @ (or a tab or carriage return) is
// prefixed with ' so Excel or Sheets shows it rather than runs it.

const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (FORMULA.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
