# Regex Lab

A private, browser-based JavaScript regex playground: see matches highlighted in context, inspect capture groups and named captures, and read explanations for the parts of an expression.

## Start

Run a local static HTTP server from the repository root:

    python3 -m http.server 8000

Then visit http://localhost:8000. The app uses native ES modules and Web Workers, so opening HTML directly through file:// is not recommended. You can also host the project on GitHub Pages or any other static HTTPS host.

## Features

- JavaScript RegExp pattern input and six flags (g, i, m, s, u, y).
- Highlighting of exact matched text without HTML injection. Supports zero-width matches.
- Offset display, numbered capture groups, and named captures.
- Pattern explanations for character classes, escapes, quantifiers, anchors, groups and lookarounds.
- Local JSON export containing the pattern, flags, captures, indices, run duration and truncation state.
- **Replacement preview:** enter a JavaScript replacement string, see the resulting text and copy it; supports `- Local JSON export containing the pattern, flags, captures, indices, run duration and truncation state.`, `$1`, `$<name>`, `$` and other native JS replace tokens.
- Built-in sample expression and text, responsive accessible interface.
- Execution in a disposable Web Worker that is terminated after 1.5 seconds to prevent long-running expressions from freezing the main page.
- No third-party libraries, account, cookies, telemetry or server-side processing.

## Limits and safety

- Pattern length: up to 500 characters. Test text: up to 50,000 characters. Replacement template: up to 200 characters. Replacement preview: up to 100,000 characters.
- Results: at most 250 matches. Zero-length matches advance safely during global or sticky evaluation. Replacement preview is disabled when the maximum match count is reached for global/sticky patterns, so the preview cannot misleadingly claim a complete transformation.
- Timeout: 1,500 ms. A browser worker is stopped when the time budget is exceeded.
- Flag compatibility depends on the JavaScript RegExp features supported by your browser.
- Token explanations are simplified educational descriptions rather than complete grammar validation.
- Be cautious with regexes copied from untrusted sources. The worker provides a UI isolation boundary but is not a security sandbox for hostile code.
- Automated tests have not been run; the owner requested centralized verification later.

## Structure

- index.html — playground UI
- styles.css — responsive layout and syntax colors
- app.js — user interactions, worker lifecycle, safe DOM match rendering, export
- worker.js — isolated regex execution, match capture and bounded replacement preview
- src/explain.js — human-readable syntax explanations
- LICENSE — MIT

## License

MIT. See LICENSE.

## Author

Built by Meir Dvir · https://github.com/MeiRR17
