// A dedicated worker isolates user-supplied regular expressions from the UI thread.
// The UI terminates this worker when an expression runs too long.
const MAX_TEXT = 50_000;
const MAX_PATTERN = 500;
const MAX_MATCHES = 250;

self.onmessage = event => {
  const { id, pattern, flags, text } = event.data || {};
  try {
    if (typeof pattern !== 'string' || pattern.length > MAX_PATTERN) {
      throw new RangeError('Pattern must be no more than 500 characters.');
    }
    if (typeof text !== 'string' || text.length > MAX_TEXT) {
      throw new RangeError('Test text must be no more than 50,000 characters.');
    }
    if (typeof flags !== 'string' || !/^[gimsuy]*$/.test(flags)) {
      throw new SyntaxError('Only g, i, m, s, u, and y flags are supported.');
    }
    const expression = new RegExp(pattern, flags);
    const matches = [];
    const started = performance.now();
    let match;
    while ((match = expression.exec(text)) !== null) {
      matches.push({
        index: match.index,
        end: match.index + match[0].length,
        value: match[0],
        captures: match.slice(1),
        groups: match.groups ? { ...match.groups } : null,
      });
      if (matches.length >= MAX_MATCHES || (!expression.global && !expression.sticky)) break;
      if (match[0].length === 0) {
        // AdvanceStringIndex per ECMAScript: zero-length global matches must progress.
        const index = expression.lastIndex;
        const codepoint = text.codePointAt(index);
        expression.lastIndex += expression.unicode && codepoint > 0xffff ? 2 : 1;
      }
    }
    self.postMessage({
      id,
      matches,
      duration: Math.round((performance.now() - started) * 100) / 100,
      capped: matches.length >= MAX_MATCHES,
    });
  } catch (error) {
    self.postMessage({ id, error: error.message || 'Regular expression failed.' });
  }
};
