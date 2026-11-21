/**
 * Convert JavaScript RegExp UTF-16 string offsets into editor line/column
 * positions. Lines and columns are 1-based; columns count UTF-16 code units,
 * consistent with RegExp match.index and HTML textarea selection offsets.
 */
export function indexLineStarts(text) {
  if (typeof text !== 'string' || text.length > 50_000) {
    throw new RangeError('Text must contain at most 50,000 UTF-16 code units.');
  }
  const starts = [0];
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '\r') {
      if (text[index + 1] === '\n') index++;
      starts.push(index + 1);
    } else if (text[index] === '\n') starts.push(index + 1);
  }
  return starts;
}

/** Binary search finds the last newline boundary at or before offset. */
export function offsetToPosition(offset, starts, textLength) {
  if (!Number.isInteger(offset) || offset < 0 || offset > textLength ||
      !Array.isArray(starts) || starts.length < 1) {
    throw new RangeError('Invalid match offset or line index.');
  }
  let lower = 0, upper = starts.length - 1;
  while (lower < upper) {
    const middle = Math.ceil((lower + upper) / 2);
    if (starts[middle] <= offset) lower = middle;
    else upper = middle - 1;
  }
  return { line: lower + 1, column: offset - starts[lower] + 1 };
}
