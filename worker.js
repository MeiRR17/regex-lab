import { indexLineStarts, offsetToPosition } from './src/positions.js';

// User regular expressions run only in a disposable Web Worker.
// The main UI terminates the worker when a pattern takes too long.
const MAX_TEXT = 50_000;
const MAX_PATTERN = 500;
const MAX_MATCHES = 250;
const MAX_REPLACEMENT = 200;
const MAX_PREVIEW = 100_000;

function advanceStringIndex(source, index, unicode) {
  if (!unicode || index >= source.length) return index + 1;
  const point = source.codePointAt(index);
  return index + (point !== undefined && point > 0xffff ? 2 : 1);
}

self.onmessage = event => {
  const { id, pattern, flags, text, replacement = '' } = event.data || {};
  try {
    if (typeof pattern !== 'string' || pattern.length > MAX_PATTERN) {
      throw new RangeError('Pattern must be no more than 500 characters.');
    }
    if (typeof text !== 'string' || text.length > MAX_TEXT) {
      throw new RangeError('Test text must be no more than 50,000 characters.');
    }
    if (typeof flags !== 'string' || !/^[gimsuy]*$/.test(flags) ||
        new Set(flags).size !== flags.length) {
      throw new SyntaxError('Only unique g, i, m, s, u and y flags are supported.');
    }
    if (typeof replacement !== 'string' || replacement.length > MAX_REPLACEMENT) {
      throw new RangeError('Replacement template must be no more than 200 characters.');
    }
    const expression = new RegExp(pattern, flags);
    const started = performance.now();
    const lineStarts = indexLineStarts(text);
    const matches = [];
    let truncated = false;
    let match;
    while ((match = expression.exec(text)) !== null) {
      if (matches.length >= MAX_MATCHES) {
        truncated = true;
        break;
      }
      matches.push({
        index: match.index,
        end: match.index + match[0].length,
        value: match[0],
        ...offsetToPosition(match.index, lineStarts, text.length),
        captures: match.slice(1),
        groups: match.groups ? { ...match.groups } : null,
      });
      if (!expression.global && !expression.sticky) break;
      if (match[0].length === 0) {
        expression.lastIndex = advanceStringIndex(text, expression.lastIndex, expression.unicode);
      }
    }

    let replacedText = null;
    let replacementWarning = null;
    if (truncated) {
      replacementWarning = 'Replacement preview is unavailable when matching exceeds 250 results.';
    } else {
      // Use a fresh RegExp to preserve native JavaScript replace semantics,
      // including whole-match, numbered-capture and named-capture tokens.
      const preview = text.replace(new RegExp(pattern, flags), replacement);
      if (preview.length > MAX_PREVIEW) {
        replacementWarning = 'Replacement preview exceeds 100,000 characters.';
      } else {
        replacedText = preview;
      }
    }
    self.postMessage({
      id,
      matches,
      duration: Math.round((performance.now() - started) * 100) / 100,
      capped: truncated,
      replacedText,
      replacementWarning,
    });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Regular expression failed.' });
  }
};
