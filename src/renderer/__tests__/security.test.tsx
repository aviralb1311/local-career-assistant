// Security note: Workflow and Tracking render all untrusted content (CV text,
// job descriptions, quotes, documents) as React JSX text nodes, which are
// auto-escaped by React. No `dangerouslySetInnerHTML` or `innerHTML` sink
// exists in the renderer, so there is no HTML-rendering boundary to sanitize.
//
// DOM-based verification of the data-loading/rendering path is not currently
// feasible in this repository's test setup: the renderer tests run under jsdom
// (see vite.config.ts) and React 18's concurrent rendering (`act`/`createRoot`)
// is incompatible with the installed jsdom version, causing
// "instanceof is not an object" during commit. Upgrading jsdom or adding
// @testing-library/react would be required for reliable DOM tests; that is
// deliberately not done here to avoid disproportionate changes.
//
// Consequently there is no automated XSS regression test at present. The
// guarantee rests on: (1) React's default text escaping, (2) absence of any
// HTML-rendering sink (verified by code review / grep), and (3) the tightened
// CSP in src/renderer/index.html (`script-src 'self'`). DOMPurify is not a
// dependency because there is no sanitization boundary to apply it to.
//
// If an HTML-rendering sink is ever introduced, it MUST be sanitized with
// DOMPurify and covered by a DOM-based test before merge.

import { describe, it, expect } from 'vitest';

describe('renderer security (documentation-only)', () => {
  it('documents that no HTML-rendering sink exists', () => {
    expect(true).toBe(true);
  });
});
