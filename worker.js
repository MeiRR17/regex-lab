// A dedicated worker isolates user-supplied regular expressions from the UI thread.
// The UI terminates this worker when an expression runs too long.
const MAX_TEXT = 50_000;
const MAX_PATTERN = 500;
const MAX_MATCHES = 250;
const MAX_REPLACEMENT = 200;
const MAX_PREVIEW = 100_000;

self.onmessage = event => {
  const { id, pattern, flags, text, replacement = '' } = event.data || {};
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
    if (typeof replacement !== 'string' || replacement.length > MAX_REPLACEMENT) {
      throw new RangeError('Replacement template must be no more than 200 characters.');
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
    let replacedText = null;
    let replacementWarning = null;
    if (matches.length >= MAX_MATCHES && (expression.global || expression.sticky)) {
      replacementWarning = 'Replacement preview unavailable when match results hit the 250-match limit.';
    } else {
      // A new RegExp keeps replacement independent of mutated lastIndex.
      // This supports JavaScript replacement syntax:     self.postMessage({
      id,
      matches,
      duration: Math.round((performance.now() - started) * 100) / 100,
      capped: matches.length >= MAX_MATCHES,
    });, $1, $<name>, etc.
      const preview = text.replace(new RegExp(pattern, flags), replacement);
      if (preview.length > MAX_PREVIEW) {
        replacementWarning = 'Replacement result exceeds the 100,000-character preview limit.';
      } else replacedText = preview;
    }
    self.postMessage({
      id,
      matches,
      duration: Math.round((performance.now() - started) * 100) / 100,
      capped: matches.length >= MAX_MATCHES,
      replacedText,
      replacementWarning,
    });
  } catch (error) {
    self.postMessage({ id, error: error.message || 'Regular expression failed.' });
  }
};
