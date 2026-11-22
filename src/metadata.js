/**
 * Counts/positions-only export for regex investigations involving confidential
 * strings. Does not serialize the pattern, replacement template, test text,
 * matched text, capture contents, or named-group names.
 *
 * Match locations and input length remain metadata and may themselves reveal
 * document structure; users should review these before external sharing.
 */
export function summarizeMatches(report) {
  if (!report || typeof report !== 'object' || !Array.isArray(report.matches) ||
      report.matches.length > 250 || !Number.isInteger(report.inputLength) ||
      report.inputLength < 0 || report.inputLength > 50_000) {
    throw new TypeError('Expected a bounded Regex Lab match report.');
  }
  let zeroWidth = 0;
  const locations = report.matches.map(match => {
    if (!match || !Number.isInteger(match.index) || !Number.isInteger(match.end) ||
        !Number.isInteger(match.line) || !Number.isInteger(match.column) ||
        match.index < 0 || match.end < match.index || match.end > report.inputLength ||
        match.line < 1 || match.column < 1) {
      throw new TypeError('Invalid Regex Lab match location.');
    }
    if (match.index === match.end) zeroWidth++;
    return {
      start: match.index,
      end: match.end,
      line: match.line,
      column: match.column,
      length: match.end - match.index,
    };
  });
  return {
    format: 'regex-lab-position-summary-v1',
    inputLength: report.inputLength,
    shownMatches: locations.length,
    capped: report.capped === true,
    zeroWidthMatches: zeroWidth,
    positions: locations,
    advisory: 'Contains offsets and document length, but no pattern or matched text. Positions may still be sensitive.',
  };
}


/**
 * Spreadsheet-readable positions only. Rows are numeric metadata, never
 * snippets, patterns, replacement templates, matched values or captures.
 * When capped=true, only the first recorded matches are exported.
 * The first line is a fixed schema; even an empty match set produces
 * a valid empty CSV table, while the full counts remain in the JSON report.
 */
export function matchPositionsCsv(report) {
  const summary = summarizeMatches(report);
  const headers = [
    'match_number', 'start_utf16', 'end_utf16', 'line', 'column',
    'length_utf16', 'zero_width', 'truncated_preview',
  ];
  const rows = [headers.join(',')];
  for (let i = 0; i < summary.positions.length; i++) {
    const item = summary.positions[i];
    rows.push([
      i + 1, item.start, item.end, item.line, item.column,
      item.length, item.length === 0 ? 'true' : 'false',
      summary.capped ? 'true' : 'false',
    ].join(','));
  }
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}
