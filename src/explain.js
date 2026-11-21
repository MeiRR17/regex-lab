// A small explanatory scanner; never evaluates regex source or injects HTML.
// Explanations are educational and do not replace a full ECMAScript grammar parser.
const ESCAPES = {
  d: 'Digit character', D: 'Non-digit character',
  w: 'Word character', W: 'Non-word character',
  s: 'Whitespace character', S: 'Non-whitespace character',
  b: 'Word boundary', B: 'Non-word boundary',
  n: 'Newline', r: 'Carriage return', t: 'Tab',
  f: 'Form feed', v: 'Vertical tab', '0': 'Null character',
};
const FLAGS = {
  g: 'Find every match', i: 'Ignore letter case',
  m: 'Treat ^ and $ as line anchors', s: 'Dot also matches newlines',
  u: 'Unicode-aware matching', y: 'Match only from lastIndex',
};

function token(value, label, kind = 'plain') { return { value, label, kind }; }

/** Provide a best-effort ordered explanation of the pattern's syntax. */
export function explainPattern(pattern, flags = '') {
  const result = [];
  for (let i = 0; i < pattern.length;) {
    const char = pattern[i];
    if (char === '\\') {
      let end = Math.min(pattern.length, i + 2);
      const next = pattern[i + 1];
      if (next === 'u' && pattern[i + 2] === '{') {
        const brace = pattern.indexOf('}', i + 3);
        if (brace > 0) end = brace + 1;
      } else if ((next === 'u' && /^[\da-f]{4}$/i.test(pattern.slice(i + 2, i + 6)))) end = i + 6;
      else if (next === 'x' && /^[\da-f]{2}$/i.test(pattern.slice(i + 2, i + 4))) end = i + 4;
      const raw = pattern.slice(i, end);
      result.push(token(raw, ESCAPES[next] || (/[1-9]/.test(next || '') ? 'Numeric backreference' : 'Escaped character or Unicode escape'), 'escape'));
      i = end; continue;
    }
    if (char === '[') {
      let j = i + 1;
      while (j < pattern.length) {
        if (pattern[j] === '\\') { j += 2; continue; }
        if (pattern[j] === ']') { j++; break; }
        j++;
      }
      const raw = pattern.slice(i, j);
      result.push(token(raw, pattern[i + 1] === '^' ? 'Negated character class' : 'Character class: match one listed character', 'class'));
      i = j; continue;
    }
    if (char === '(') {
      const prefixes = [
        ['(?<=', 'Positive lookbehind'], ['(?<!', 'Negative lookbehind'],
        ['(?:', 'Non-capturing group'], ['(?=', 'Positive lookahead'], ['(?!', 'Negative lookahead'],
      ];
      const special = prefixes.find(item => pattern.startsWith(item[0], i));
      if (special) { result.push(token(special[0], special[1], 'group')); i += special[0].length; }
      else if (pattern.startsWith('(?<', i)) {
        const end = pattern.indexOf('>', i + 3);
        if (end > 0) {
          result.push(token(pattern.slice(i, end + 1), 'Named capturing group', 'group'));
          i = end + 1;
        } else { result.push(token('(', 'Capturing group begins', 'group')); i++; }
      } else { result.push(token('(', 'Capturing group begins', 'group')); i++; }
      continue;
    }
    if (char === ')') { result.push(token(')', 'Group ends', 'group')); i++; continue; }
    if (char === '{') {
      const quantifier = /^\{\d+(?:,\d*)?\}\??/.exec(pattern.slice(i));
      if (quantifier) {
        result.push(token(quantifier[0], 'Repeat the previous item ' + quantifier[0].replace(/\?$/, '') + (quantifier[0].endsWith('?') ? ' (lazy)' : ''), 'quantifier'));
        i += quantifier[0].length; continue;
      }
    }
    if (char === '*' || char === '+' || char === '?') {
      const nextIsLazy = pattern[i + 1] === '?' && char !== '?';
      const labels = { '*': 'Repeat 0 or more times', '+': 'Repeat 1 or more times', '?': 'Optional (0 or 1 times)' };
      const raw = nextIsLazy ? char + '?' : char;
      result.push(token(raw, labels[char] + (nextIsLazy ? ' (lazy)' : ''), 'quantifier'));
      i += raw.length; continue;
    }
    if (char === '^' || char === '$') {
      result.push(token(char, char === '^' ? 'Start of input or line' : 'End of input or line', 'anchor'));
      i++; continue;
    }
    if (char === '|') { result.push(token('|', 'Alternative: OR', 'operator')); i++; continue; }
    if (char === '.') { result.push(token('.', 'Any character except newline (unless s flag)', 'class')); i++; continue; }
    result.push(token(char, 'Literal character: ' + char, 'plain'));
    i++;
  }
  return { tokens: result, flags: Array.from(flags).map(flag => token(flag, FLAGS[flag] || 'Unknown flag', 'flag')) };
}
