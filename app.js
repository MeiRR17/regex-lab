import { explainPattern } from './src/explain.js';
import { summarizeMatches } from './src/metadata.js';

const get = id => document.getElementById(id);
const patternInput = get('pattern');
const textInput = get('text');
const flagInputs = [...document.querySelectorAll('.flags input')];
const highlight = get('highlighted');
const matchList = get('match-list');
const exportButton = get('export');
const exportPrivate = get('export-private');
const replacementInput = get('replacement');
const replacementResult = get('replace-result');
const copyReplacement = get('copy-replace');
const example = {
  pattern: '([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+)\\.([A-Za-z]{2,})',
  text: 'Questions? Email hello@example.com or support@regex.dev.\nIgnore invalid addresses like hello@@site.com.',
};
let worker = null;
let requestId = 0;
let lastResult = null;
let timeout = null;
let resultRevision = 0; // Invalidate outstanding clipboard responses when results change.

function flags() {
  return flagInputs.filter(input => input.checked).map(input => input.value).join('');
}
function status(message, kind = '') {
  const node = get('message');
  node.textContent = message;
  node.className = 'status' + (kind ? ' ' + kind : '');
}
function span(text, className = '') {
  const node = document.createElement('span');
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
function cancelWorker() {
  if (worker) { worker.terminate(); worker = null; }
  if (timeout !== null) { clearTimeout(timeout); timeout = null; }
}
function clearResults() {
  resultRevision++;
  lastResult = null;
  exportButton.disabled = true;
  exportPrivate.disabled = true;
  copyReplacement.disabled = true;
  replacementResult.value = '';
  get('replace-status').textContent = 'Run the expression to preview replacements.';
  get('match-count').textContent = '0 matches';
  get('duration').textContent = '—';
  highlight.replaceChildren();
  matchList.replaceChildren(span('Matched groups and offsets will appear here.', 'empty-state'));
}
function renderExplanation() {
  get('flag-readout').textContent = flags() || '—';
  const tokens = get('tokens');
  const details = get('flag-explanations');
  tokens.replaceChildren();
  details.replaceChildren();
  const explanation = explainPattern(patternInput.value, flags());
  if (!explanation.tokens.length) tokens.append(span('Add a pattern to see an explanation.', 'empty-token'));
  for (const item of explanation.tokens) {
    const div = document.createElement('div');
    div.className = 'token ' + item.kind;
    const code = document.createElement('code');
    code.textContent = item.value;
    const detail = document.createElement('small');
    detail.textContent = item.label;
    div.append(code, detail);
    tokens.append(div);
  }
  for (const item of explanation.flags) {
    const label = document.createElement('span');
    label.textContent = item.value + ' — ' + item.label;
    details.append(label);
  }
}
function renderHighlight(text, matches) {
  highlight.replaceChildren();
  let cursor = 0;
  for (const match of matches) {
    if (match.index < cursor || match.index > text.length || match.end > text.length) continue;
    highlight.append(document.createTextNode(text.slice(cursor, match.index)));
    const mark = document.createElement('mark');
    if (match.end === match.index) {
      mark.className = 'zero-width';
      mark.textContent = '';
      mark.setAttribute('aria-label', 'Zero-width match at position ' + match.index);
    } else mark.textContent = text.slice(match.index, match.end);
    highlight.append(mark);
    cursor = match.end;
  }
  highlight.append(document.createTextNode(text.slice(cursor)));
}
function renderMatches(matches) {
  matchList.replaceChildren();
  if (!matches.length) {
    matchList.append(span('No matches. Try adjusting the expression or flags.', 'empty-state'));
    return;
  }
  for (let i = 0; i < matches.length; i++) {
    const result = matches[i];
    const card = document.createElement('article');
    card.className = 'match-item';
    const line = document.createElement('div');
    line.className = 'match-line';
    const code = document.createElement('code');
    code.textContent = '#' + (i + 1) + '  ' + JSON.stringify(result.value.length > 180 ? result.value.slice(0, 180) + '…' : result.value);
    const index = span('Line ' + result.line + ', col ' + result.column +
      ' · [' + result.index + '–' + result.end + ']', 'match-index');
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'match-jump';
    jump.dataset.start = String(result.index);
    jump.dataset.end = String(result.end);
    jump.textContent = 'Jump to text';
    jump.setAttribute('aria-label', 'Select match ' + (i + 1) +
      ' at line ' + result.line + ', column ' + result.column);
    line.append(code, index, jump);
    card.append(line);
    if (result.captures.length || (result.groups && Object.keys(result.groups).length)) {
      const captures = document.createElement('div');
      captures.className = 'captures';
      const parts = result.captures.map((capture, j) => 'Group ' + (j + 1) + ': ' + JSON.stringify(capture));
      if (result.groups) {
        for (const [name, value] of Object.entries(result.groups)) {
          parts.push('Named "' + name + '": ' + JSON.stringify(value));
        }
      }
      captures.textContent = parts.join('\n');
      card.append(captures);
    }
    matchList.append(card);
  }
}

matchList.addEventListener('click', event => {
  const button = event.target.closest('button.match-jump');
  if (!button || !matchList.contains(button)) return;
  const start = Number(button.dataset.start);
  const end = Number(button.dataset.end);
  // Match locations are UTF-16 offsets into the exact current source text.
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 ||
      end < start || end > textInput.value.length || !lastResult) return;
  textInput.focus();
  textInput.setSelectionRange(start, end);
  textInput.scrollIntoView({ block: 'center', behavior: 'auto' });
});

function run() {
  cancelWorker();
  clearResults();
  const pattern = patternInput.value;
  const text = textInput.value;
  const activeFlags = flags();
  const replacement = replacementInput.value;
  if (!pattern.trim()) {
    status('Enter a pattern to find matches.', 'error');
    return;
  }
  if (pattern.length > 500 || text.length > 50_000 || replacement.length > 200) {
    status('Limits: 500 pattern characters, 50,000 test-text characters and 200 replacement characters.', 'error');
    return;
  }
  status('Evaluating the regular expression…');
  const id = ++requestId;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  } catch {
    status('Web Workers are unavailable here. Open the project through a local HTTP server.', 'error');
    return;
  }
  const activeWorker = worker;
  timeout = setTimeout(() => {
    if (worker !== activeWorker) return;
    cancelWorker();
    status('Execution stopped after 1.5 seconds. Try a simpler pattern to avoid catastrophic backtracking.', 'error');
  }, 1500);
  activeWorker.onerror = () => {
    if (worker !== activeWorker) return;
    cancelWorker();
    status('The regex worker could not start. Serve the project over HTTP or HTTPS.', 'error');
  };
  activeWorker.onmessage = event => {
    if (worker !== activeWorker || event.data?.id !== id) return;
    cancelWorker();
    if (event.data.error) {
      status(event.data.error, 'error');
      return;
    }
    lastResult = {
      pattern, flags: activeFlags, replacement, inputLength: text.length, matches: event.data.matches,
      durationMs: event.data.duration, capped: event.data.capped,
    };
    renderHighlight(text, event.data.matches);
    renderMatches(event.data.matches);
    if (typeof event.data.replacedText === 'string') {
      replacementResult.value = event.data.replacedText;
      copyReplacement.disabled = false;
      get('replace-status').textContent = 'Replacement preview: ' + event.data.replacedText.length.toLocaleString() + ' characters.';
    } else {
      replacementResult.value = '';
      copyReplacement.disabled = true;
      get('replace-status').textContent = event.data.replacementWarning || 'Replacement preview is unavailable.';
    }
    get('match-count').textContent = event.data.matches.length + (event.data.capped ? '+' : '') + ' matches';
    get('duration').textContent = event.data.duration + ' ms in an isolated worker';
    exportButton.disabled = false;
    exportPrivate.disabled = false;
    status(event.data.matches.length + ' match(es) found.' +
      (event.data.capped ? ' Showing only the first 250.' : ''), 'success');
  };
  activeWorker.postMessage({ id, pattern, flags: activeFlags, text, replacement });
}

get('run').addEventListener('click', run);
get('example').addEventListener('click', () => {
  patternInput.value = example.pattern;
  textInput.value = example.text;
  flagInputs.forEach(input => { input.checked = input.value === 'g' || input.value === 'i'; });
  get('text-size').textContent = textInput.value.length.toLocaleString() + ' characters';
  renderExplanation();
  run();
});
get('reset').addEventListener('click', () => {
  cancelWorker();
  patternInput.value = '';
  textInput.value = '';
  replacementInput.value = '';
  flagInputs.forEach(input => { input.checked = input.value === 'g' || input.value === 'i'; });
  get('text-size').textContent = '0 characters';
  clearResults();
  renderExplanation();
  status('Editor cleared. Add a new pattern to begin.');
  patternInput.focus();
});
patternInput.addEventListener('input', () => { renderExplanation(); cancelWorker(); clearResults(); });
replacementInput.addEventListener('input', () => {
  cancelWorker();
  clearResults();
  status('Replacement template changed. Run the expression again.');
});
textInput.addEventListener('input', () => {
  get('text-size').textContent = textInput.value.length.toLocaleString() + ' characters';
  cancelWorker();
  clearResults();
});
flagInputs.forEach(input => input.addEventListener('change', () => {
  cancelWorker();
  clearResults();
  renderExplanation();
}));
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    run();
  }
});
copyReplacement.addEventListener('click', async () => {
  if (copyReplacement.disabled || !lastResult) return;
  const revision = resultRevision;
  const content = replacementResult.value;
  try {
    await navigator.clipboard.writeText(content);
    if (revision !== resultRevision) {
      // Browser clipboard writes cannot be rolled back. Never imply a fresh
      // result was copied if the user edited/cleared while the write awaited.
      status('An earlier replacement was copied after the results changed. The clipboard may still contain stale text; replace or clear it.', 'error');
      return;
    }
    status('Replacement preview copied to clipboard.', 'success');
  } catch {
    if (revision !== resultRevision) return;
    replacementResult.focus();
    replacementResult.select();
    status('Clipboard access was blocked. The preview is selected for manual copying.', 'error');
  }
});
function downloadReport(report, filename) {
  const blob = new Blob([JSON.stringify(report, null, 2) + '\n'], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
exportButton.addEventListener('click', () => {
  if (!lastResult) return;
  downloadReport(lastResult, 'regex-matches.json');
  status('Full JSON exported. It contains matched text and captures; review before sharing.');
});
exportPrivate.addEventListener('click', () => {
  if (!lastResult) return;
  try {
    downloadReport(summarizeMatches(lastResult), 'regex-match-positions.json');
    status('Positions-only JSON exported. It excludes patterns, matched strings and captures.');
  } catch (error) {
    status('Metadata export failed: ' + error.message, 'error');
  }
});
renderExplanation();
