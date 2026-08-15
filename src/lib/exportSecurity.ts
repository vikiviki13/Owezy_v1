export function neutralizeSpreadsheetFormula(value: unknown) {
  const text = String(value ?? '');
  return /^\s*[=+\-@]/.test(text) || /^[\t\r]/.test(text) ? `'${text}` : text;
}

export function quoteCsvCell(value: unknown) {
  return `"${neutralizeSpreadsheetFormula(value).replace(/"/g, '""')}"`;
}

