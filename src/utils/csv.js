/**
 * Utilitas CSV untuk ekspor data keuangan.
 *
 * Rien kept sederhana: dibuat manual tanpa library tambahan.
 */
'use strict';

/** Escape satu nilai sel CSV (rumus spreadsheet dicegah agar aman dibuka di Excel) */
function escapeCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Cegah formula injection (=, +, -, @ di awal sel)
  if (/^[=+\-@]/.test(str)) str = `'${str}`;
  if (/[",\n\r]/.test(str)) str = `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * Ubah array of object menjadi teks CSV.
 * @param {Array<Object>} rows
 * @param {Array<{key: string, label: string}>} columns
 */
function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.format ? c.format(row[c.key], row) : row[c.key])).join(','))
    .join('\n');
  return `${header}\n${body}\n`;
}

module.exports = { toCsv, escapeCell };
