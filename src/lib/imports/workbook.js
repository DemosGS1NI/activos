import { read, utils } from 'xlsx';

function normalizeHeaderKey(value) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^0-9a-zA-Z]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function isRowEmpty(row) {
  if (!Array.isArray(row)) return true;
  return row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '');
}

export function readWorkbook(buffer) {
  const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return read(view, { type: 'array', cellDates: true });
}

export function extractSheet(workbook, sheetName) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return {
      present: false,
      headers: [],
      rows: []
    };
  }

  const rawRows = utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
    defval: null
  });

  if (!rawRows.length) {
    return {
      present: true,
      headers: [],
      rows: []
    };
  }

  const headerCells = rawRows.shift();
  const headers = headerCells.map((value, index) => {
    const normalized = normalizeHeaderKey(value);
    return {
      index,
      original: value === undefined || value === null ? '' : String(value).trim(),
      key: normalized
    };
  });

  const rows = [];
  rawRows.forEach((cells, position) => {
    if (isRowEmpty(cells)) return;
    const rowNumber = position + 2; // include header offset
    const record = {};
    headers.forEach((header) => {
      if (!header.key) return;
      record[header.key] = cells[header.index] ?? null;
    });
    rows.push({ rowNumber, values: record });
  });

  return {
    present: true,
    headers,
    rows
  };
}
