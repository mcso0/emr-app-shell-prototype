// Display bounds only. These do not change upload limits or the original download.
export const CSV_PREVIEW_ROWS = 200;
export const CSV_PREVIEW_COLUMNS = 50;
export const CSV_PREVIEW_CELL_LENGTH = 4000;
export const TEXT_PREVIEW_LENGTH = 50_000;

export function decodeAttachmentText(bytes: ArrayBuffer): { text: string; encoding: string } {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "UTF-8" };
  } catch {
    return { text: new TextDecoder("euc-kr", { fatal: true }).decode(bytes), encoding: "EUC-KR" };
  }
}

function detectDelimiter(text: string): string {
  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted) {
      if (char === "\n" || char === "\r") break;
      if (counts.has(char)) counts.set(char, counts.get(char)! + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

export function parseAttachmentCsv(source: string) {
  const text = source.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let cellStarted = false;
  let columns = 0;
  let rowCount = 0;
  let columnCount = 0;
  let quoted = false;
  let afterQuote = false;
  let malformed = false;
  let truncatedCell = false;
  const append = (char: string) => {
    cellStarted = true;
    if (rowCount >= CSV_PREVIEW_ROWS || columns >= CSV_PREVIEW_COLUMNS) return;
    if (cell.length < CSV_PREVIEW_CELL_LENGTH) cell += char;
    else truncatedCell = true;
  };
  const finishCell = () => {
    if (rowCount < CSV_PREVIEW_ROWS && columns < CSV_PREVIEW_COLUMNS) row.push(cell);
    columns += 1;
    cell = "";
    cellStarted = false;
    afterQuote = false;
  };
  const finishRow = () => {
    finishCell();
    columnCount = Math.max(columnCount, columns);
    if (rowCount < CSV_PREVIEW_ROWS) rows.push(row);
    rowCount += 1;
    row = [];
    columns = 0;
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { append('"'); i += 1; }
        else { quoted = false; afterQuote = true; }
      } else append(char);
    } else if (char === delimiter) finishCell();
    else if (char === "\r" || char === "\n") {
      finishRow();
      if (char === "\r" && text[i + 1] === "\n") i += 1;
    } else if (char === '"' && !cellStarted && !afterQuote) quoted = true;
    else {
      if (afterQuote || char === '"') malformed = true;
      append(char);
    }
  }
  if (quoted) malformed = true;
  // A final line separator is not an additional empty row. A trailing delimiter is a cell.
  if ((text.length && !/[\r\n]$/.test(text)) || quoted) finishRow();
  return { rows, rowCount, columnCount, delimiter, malformed, truncatedCell,
    partial: rowCount > CSV_PREVIEW_ROWS || columnCount > CSV_PREVIEW_COLUMNS || truncatedCell };
}

export function attachmentReadStatus(status: number): "denied" | "unavailable" | "error" {
  return status === 401 || status === 403 ? "denied" : status === 404 || status === 410 ? "unavailable" : "error";
}
