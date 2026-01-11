export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[] = [];
  let cur = "";
  let inQuotes = false;

  // Normalize newlines
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "\n" && !inQuotes) {
      lines.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim().length) lines.push(cur);

  const splitRow = (row: string) => {
    const out: string[] = [];
    let c = "";
    let q = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      const next = row[i + 1];
      if (ch === '"' && q && next === '"') {
        c += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        q = !q;
        continue;
      }
      if (ch === "," && !q) {
        out.push(c.trim());
        c = "";
        continue;
      }
      c += ch;
    }
    out.push(c.trim());
    return out;
  };

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitRow(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).filter(Boolean).map((line) => {
    const cols = splitRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h] = (cols[idx] ?? "").trim()));
    return obj;
  });

  return { headers, rows };
}

export function toCsv(headers: string[], rows: Record<string, any>[]) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const out = [headers.map(esc).join(",")];
  for (const r of rows) out.push(headers.map((h) => esc(r[h])).join(","));
  return out.join("\n");
}
