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
