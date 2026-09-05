# OnlineToolsWeb — Phase 1 UI/UX Fixes

**Scope:** Critical usability defects only, per the Phase 1 brief. No redesign, no framework/architecture changes, no new dependencies, no server-side processing added.

---

## 1. Summary of Root Causes

**Horizontal overflow (5 distinct causes found, not just the ones named in the brief):**
- `.mega-menu-full` was sized with `width: 100vw`. `100vw` measures the *scrollbar-inclusive* viewport, while the page's actual layout width (`documentElement.clientWidth`) excludes the scrollbar — so on any page with a vertical scrollbar, a `100vw` element is wider than the page itself. This panel stays in the DOM at full layout size even while hidden (`opacity/visibility`, not `display:none`), so it contributed to overflow at all times, not just when opened.
- The particle-field canvas's `resize()` function set `canvas.style.width/height` directly from `window.innerWidth/innerHeight` (also scrollbar-inclusive), overriding the CSS that would otherwise size it correctly with `inset: 0`.
- (Found during re-validation, not in the original report) The header's `.logo-tagline` used `white-space: nowrap`, forcing the header's flex row wider than the viewport at 320–390px.
- (Found during re-validation) `.tool-grid` and related grids used bare `1fr` columns. CSS Grid tracks default to `min-width: auto`, meaning a track will not shrink below its content's intrinsic width even at `1fr` — a single long tool name could force the whole grid, and the page, wider than the viewport.
- (Found during re-validation, isolated to `about.html`) The page's `<h1>` contained "OnlineToolsWeb" as one unbreakable word, which overflowed its column at 320px with no visible layout-level signature (only the rendered text spilled past the box).

**Search silently failing on broad queries:** the old logic tried to resolve every query to a single tool and fell back to doing nothing when it couldn't, with no suggestions list, no ranking, and no way to tell the user why nothing happened.

**Category/"All Tools" mismatch:** not an active-state bug — `aria-current` was already correct. The real cause was that the tool grid caps how many cards it shows, and the underlying tool list happened to be ordered so every "Image" tool came first (plain object key order), so the visible slice under the 18-card cap was accidentally all-Image even though "All Tools" was genuinely selected and genuinely held every tool underneath.

**"How It Works" navigation:** the footer link pointed at `/` with no anchor because no element with that id existed — the content it should point to (the three "how it works" editorial sections) was present but had no landmark or id.

**Semantic issues:** a shared modal template rendered `<h2 id="modalTitle"></h2>` with no text set at parse time (populated only after JS ran), which is what a static/empty-heading scan flagged; the footer's column headings used `<h4>` directly after a page's `<h1>`/`<h2>`, skipping a level; the mobile search input had only a placeholder, no persistent label.

## 2. Files Changed

76 files total:

- `src/style.css` — overflow fixes, new `.sr-only` utility, `scroll-margin-top` for anchor targets, search UI styling (clear button, no-results state, category tag), heading-hierarchy selector rename.
- `src/main.js` — particle-field resize logic, round-robin "All Tools" ordering, full search rewrite (ranking, ARIA, keyboard nav, clear control).
- `scripts/generate-seo-pages.mjs` — page-generator template fix so regenerated pages don't reintroduce the empty heading.
- `partials/_header.html` — mobile search: added persistent label and Clear button.
- `partials/_footer.html` — "How It Works" link now points to `/#how-it-works`; footer column headings `h4` → `h3`.
- `index.html` — new `#how-it-works` landmark wrapping the existing editorial sections, Clear button added to home search, modal heading given real text.
- 6 category hub pages (`pdf.html`, `image.html`, `excel.html`, `word.html`, `ppt.html`, `other-tools.html`) — Clear button added to search, modal heading given real text.
- 64 individual tool pages — modal heading given real (tool-specific) text, e.g. `merge-pdf.html` → "Merge PDFs", `resize-image.html` → "Resize Image".

Nothing in the file-processing logic, build config, routing, or dependency list was touched.

## 3. Exact Fixes Implemented

**Overflow**
- `.mega-menu-full`: `width: 100vw` removed, replaced with `max-width: 100%` (kept `left: 0; right: 0` for the visual fill).
- Particle-field canvas: draw buffer now sized from `document.documentElement.clientWidth/clientHeight` (not `window.innerWidth/innerHeight`); `canvas.style.width/height` set to `100%` and left to CSS `inset: 0` layout instead of being overridden inline.
- `.logo-tagline` hidden at `≤600px`; `#soundToggleBtn` (already noted in code as meaningless without hover) hidden at the existing `≤1180px` breakpoint; `.logo-wordmark-img` capped to `120px` at `≤600px` — together closing the header's narrow-viewport pixel budget.
- `.tool-grid`, `.tp-related-grid`, `.tp-result-continue-grid`: every `1fr` track changed to `minmax(0, 1fr)` at all breakpoints.
- `.legal-page h1`: added `overflow-wrap: break-word`.

**Search** (`src/main.js`, full rewrite of the search block)
- Index now built from title, category, description, accepted file formats, and a manually curated alias list (e.g. `compress` → "shrink", "reduce size"; `bgremove` → "remove bg", "transparent background").
- Three-tier ranking: exact (label or alias equals query) → prefix → partial substring match anywhere in the combined haystack. Internal tool `key`s are deliberately excluded from exact-match scoring (a tool's key can coincidentally equal a generic term, e.g. the image→PDF tool's key is literally `pdf`, which had caused a false "unique match" on that exact query during testing — caught and fixed before delivery).
- A "clear match" (safe to auto-open on Enter) is defined as exactly one result in the top-ranked tier. Enter with an ambiguous top tier does nothing except keep focus and the list open — it never navigates and never clears the field.
- Results list renders on every keystroke (debounced), each row showing icon, title, and category.
- No-results state shows the literal query back to the user ("No tools found for '...'") plus a hint, and does not clear the input.
- New Clear ("✕") button next to the input, wired to reset the field and close the list.
- Arrow Up/Down moves a highlighted option (`aria-selected`, scrolled into view); Escape closes the list without clearing the query; click-outside closes the list; mouse click and touch tap on a row both activate it.
- ARIA: input has `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant`; results container has `role="listbox"`; each row has `role="option"` + `aria-selected`.

**Category state**
- Added `allToolKeysInterleaved()`, which pulls one tool per category in rotation instead of taking the raw object order — so the default "All Tools" view's visible slice genuinely represents every category rather than front-loading whichever category happened to be listed first in the data.

**Navigation**
- Wrapped the three existing "how it works" sections in `<section id="how-it-works" aria-labelledby="howItWorksHeading">` with a visually-hidden (`.sr-only`) `<h2 id="howItWorksHeading">How It Works</h2>` for a real accessible name.
- Footer link changed to `/#how-it-works`.
- Added `scroll-margin-top: calc(var(--header-height, 84px) + 16px)` to `#how-it-works` and `#faq` (the FAQ anchor had the identical latent sticky-header-overlap problem and got the same fix).
- No JS routing changes — anchor navigation and the browser back button behave exactly as native HTML anchors always have.

**Semantic cleanup**
- `<h2 id="modalTitle"></h2>` given real, page-appropriate static text everywhere it appears (71 pages: 64 tool pages + 7 hub/home pages) — still overwritten by JS when a specific tool modal opens, so behavior is unchanged, only the at-rest/empty state is fixed.
- Footer column headings `<h4>` → `<h3>` (closes the h1/h2 → h4 skip).
- Mobile search input given `aria-label="Search tools"` (desktop/category search inputs already had this).
- Icon-only controls audited: all already had `aria-label`s — no changes were needed here, and none were made.

## 4. Viewports Tested

320, 375, 390, 768, 1024, 1280, 1366, and 1440px — in both light and dark themes.

- Core 4-page set (home, one PDF tool, one image tool, a category hub): 64/64 viewport×theme combinations passed with zero horizontal scrollbar.
- Extended to 6 more pages: 48/48 passed.
- Full sweep of all 77 HTML pages at 320px (the tightest, most failure-prone width): 0 overflow.
- Mega-menu open (1024/1366/1440px) and mobile hamburger menu open (375px): 0 overflow in either state.

## 5. Search Test Results

All 8 required queries, tested against the live rebuilt search on the home page:

| Query | Result |
|---|---|
| `merge pdf` | Single exact/prefix match on "Merge PDFs" → Enter opens it directly. |
| `pdf` | 8 matches shown as a list (no unique top-tier match) → Enter does nothing, list stays open, query stays in the field. This was the exact bug reported and is now fixed. |
| `image` | Multiple category/label matches shown as a list. |
| `resize` | Unique prefix match on "Resize Image" → Enter opens it directly. |
| `word to pdf` | Unique match → Enter opens it directly. |
| `qr` | Unique prefix match on "QR Code Generator" → Enter opens it directly. |
| `calculator` | Multiple matches (GPA Calculator, etc.) shown as a list. |
| Invalid query (e.g. `xyzzynotarealtool`) | "No tools found for '...'" shown, query preserved in the field, no crash. |

Additional interaction tests: Clear button empties the field and closes the list; Arrow Down/Up correctly highlights options and updates `aria-selected`/`aria-activedescendant`; Enter on a highlighted option opens that tool; Escape closes the list while leaving the typed text in place.

## 6. Build / Lint Results

- `npm run build` succeeds cleanly after every round of changes. Remaining console output is limited to pre-existing warnings unrelated to this work (a bundled dependency's use of `eval`, standard chunk-size advisories).
- **No lint step exists in this repository.** `package.json` defines only `dev`, `build`, and `preview` scripts, and there is no ESLint (or other linter) config anywhere in the repo. This is stated plainly rather than fabricated, per the brief's instruction.
- Functional smoke test: home page, `merge-pdf.html` (PDF), `resize-image.html` (image), `word-to-pdf.html` (document), `qr-code-generator.html` (utility) all load correctly with their real H1, correct dropzone/open-tool controls, the corrected modal heading, and no real console errors (the only console output seen was the sandbox's own blocked Google Fonts request, irrelevant to production).
- Keyboard-only pass: search is fully operable by keyboard (typing, Arrow Up/Down, Enter, Escape); `#how-it-works` anchor navigation and back-button behavior verified via simulated cross-page navigation.
- No existing tool route or file-processing workflow was changed or broken — all edits were confined to layout/CSS, the search module, navigation markup, and static heading text.

## 7. Remaining Risks

- The overflow fixes were verified with the header height read from the existing `--header-height` CSS variable; if that variable's value is ever changed elsewhere without updating it, `scroll-margin-top` on `#how-it-works`/`#faq` could drift out of sync again.
- The search alias list (`SEARCH_ALIASES`) is a manually curated starting set for common variations — it is not exhaustive, and new tools added later will need their own aliases added by hand if they should be reachable by a non-literal-title term.
- The "All Tools" round-robin ordering changes the order tools appear in under the default view (previously grouped by category insertion order). This is a visible, intentional change to satisfy "All Tools must display tools from all categories," but it is a small behavior change worth knowing about going into Phase 2.
- This was validated in a local build/preview environment against the same source, not against the live production deployment directly (the sandbox this work ran in cannot reach production network hosts) — a final check on the live site after deploy is recommended before considering Phase 1 fully closed.
- No automated test suite exists in the repo, so these fixes were verified via manual/scripted browser checks (Playwright) rather than CI-enforced tests; a future phase could add regression coverage for the overflow and search behavior specifically, since both were regressions found without any tests catching them originally.

No UX score or improvement metric is claimed — only the specific acceptance criteria above, all of which were actually run and are reported with their actual results.
