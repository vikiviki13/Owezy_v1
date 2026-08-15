import { describe, expect, it } from 'vitest';
import { neutralizeSpreadsheetFormula, quoteCsvCell } from './exportSecurity';

describe('spreadsheet export security', () => {
  it.each(['=1+1', '+cmd', '-2+3', '@SUM(A1:A2)', '  =HYPERLINK("x")', '\t=1'])('neutralizes formula-like cells: %s', (value) => {
    expect(neutralizeSpreadsheetFormula(value).startsWith("'")).toBe(true);
  });

  it('preserves ordinary text and escapes CSV quotes', () => {
    expect(neutralizeSpreadsheetFormula('Dinner')).toBe('Dinner');
    expect(quoteCsvCell('He said "hello"')).toBe('"He said ""hello"""');
  });
});

