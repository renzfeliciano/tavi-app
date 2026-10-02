// CSV for spreadsheets (2.2, D18): RFC 4180 quoting, CRLF line ends and a
// UTF-8 byte-order mark, so Excel shows "Peñaflor" and "₱" rather than
// mojibake. Text a spreadsheet would run as a formula (starting with = + - @,
// a tab or a carriage return) gets a leading apostrophe, OWASP's advice
// against CSV injection: names and references are typed by people, and a
// report ends up in an accountant's spreadsheet. Numbers, whether numbers or
// decimal strings ("-12.50"), are left alone.

export type CsvCell = string | number | null;

const FORMULA_START = /^[=+\-@\t\r]/;
const NUMBER = /^-?\d+(\.\d+)?$/;
const NEEDS_QUOTES = /[",\r\n]/;

function encode(value: CsvCell): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const text = FORMULA_START.test(value) && !NUMBER.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return `\uFEFF${rows.map((row) => `${row.map(encode).join(",")}\r\n`).join("")}`;
}
