# Regex Lab

A private, browser-based JavaScript regex playground: see matches highlighted in context, inspect capture groups and named captures, and read explanations for the parts of an expression.

## Start

Run a local static HTTP server from the repository root:

    python3 -m http.server 8000

Then visit http://localhost:8000. The app uses native ES modules and Web Workers, so opening HTML directly through file:// is not recommended. You can also host the project on GitHub Pages or any other static HTTPS host.

## Features

- JavaScript RegExp pattern input and six flags (g, i, m, s, u, y).
- Highlighting of exact matched text without HTML injection. Supports zero-width matches.
- UTF-16 match offsets **and one-based line/column coordinates**, numbered capture groups, and named captures. CRLF and LF line breaks are supported.
- Each match includes an accessible **Jump to text** button that focuses the original textarea and selects the exact matched UTF-16 range (or caret for zero-width matches).
- Pattern explanations for character classes, escapes, quantifiers, anchors, groups and lookarounds.
- Local JSON export containing pattern, flags, captures, UTF-16 indices, line/column coordinates, run duration and truncation state.
- A separate **Positions only JSON** download exports match start/end offsets, line/column, match lengths and counts without the regex pattern, replacement expression, match text, capture contents or group names.
- A separate **Positions CSV** download exports the recorded match number, UTF-16 start/end/length, one-based line/column, zero-width flag, and whether the preview was truncated. It contains no input string, matched text, regex pattern, replacement template, group names or capture values. The CSV uses fixed numeric/boolean cells and a UTF-8 BOM for spreadsheet compatibility, so no untrusted strings can be treated as spreadsheet formulas. If the 250-match cap was reached, only the recorded positions are included; an empty match set yields a header-only CSV. Position metadata and input length can still be sensitive and should be reviewed before sharing.
- **Replacement preview:** enter a JavaScript replacement string, view the resulting text, copy it or explicitly download the computed replacement as a UTF-8 `.txt` file. Copy captures the exact current preview and warns if the asynchronous clipboard write completes after the expression, input, flags, or replacement has changed. A prior clipboard write cannot be revoked; users should replace or clear stale clipboard contents. The replacement form markup and labels were also repaired after duplicate elements were found in the Draft branch. Supports native tokens such as whole match (`$&`), numbered captures (`$1`), named captures (`$<name>`) and a literal dollar sign (`$$`).
- Built-in sample expression and text, responsive accessible interface.
- Execution in a disposable Web Worker that is terminated after 1.5 seconds to prevent long-running expressions from freezing the main page.
- No third-party libraries, account, cookies, telemetry or server-side processing.

Full JSON exports include **matched text and captures**. Use the JSON or CSV positions-only export when exact matches should not be disclosed; all download controls are deliberately separate. Even reduced position coordinates may reveal sensitive information about document structure. The reduced report is computed in memory and does not transmit inputs.

## Limits and safety

- Pattern length: up to 500 characters. Test text: up to 50,000 characters. Replacement template: up to 200 characters. Replacement preview: up to 100,000 characters.
- The on-demand replacement-text download is enabled only when the latest worker run produced a complete replacement preview. It is disabled immediately whenever the pattern, flags, test text or replacement template changes, after a reset, or if preview generation fails. The download is a snapshot of the displayed preview and may include the original confidential test text; it is **not** a privacy-reduced export.
- Results: at most 250 matches, with a combined **500,000 UTF-16-unit cap** on match text and capture details sent from the Worker (including duplicate named-group values). If this payload cap is exceeded the Worker reports an error instead of sending an oversized partial result. Zero-length matches advance safely during global or sticky evaluation. Replacement preview is disabled only when **additional matches exist beyond** the 250 shown, so a truncated result cannot misleadingly claim a complete transformation.
- Timeout: 1,500 ms. A browser worker is stopped when the time budget is exceeded.
- Flag compatibility depends on the JavaScript RegExp features supported by your browser.
- Token explanations are simplified educational descriptions rather than complete grammar validation.
- Be cautious with regexes copied from untrusted sources. The worker provides a UI isolation boundary but is not a security sandbox for hostile code.
- Automated tests have not been run; the owner requested centralized verification later.

## Structure

- index.html — playground UI
- styles.css — responsive layout and syntax colors
- app.js — user interactions, worker lifecycle, safe DOM match rendering, report and replacement-text export
- worker.js — isolated regex execution, match capture, position tracking and bounded replacement preview
- src/positions.js — pure UTF-16 offset to line/column conversion
- src/explain.js — human-readable syntax explanations
- src/metadata.js — redacted match-position JSON projection and spreadsheet-safe numeric CSV export
- LICENSE — MIT

## License

MIT. See LICENSE.

## Author

Built by Meir Dvir · https://github.com/MeiRR17
