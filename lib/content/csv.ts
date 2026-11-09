/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes (""), commas and
 * newlines inside quotes, CRLF or LF line endings. Returns rows of strings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (inQuotes) throw new SyntaxError("Unterminated quoted field");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines.
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Rows → objects keyed by the header row. */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  return rows.map((r, line) => {
    if (r.length !== header.length) {
      throw new SyntaxError(`Row ${line + 2}: expected ${header.length} fields, got ${r.length}`);
    }
    return Object.fromEntries(header.map((h, i) => [h.trim(), r[i]!]));
  });
}
