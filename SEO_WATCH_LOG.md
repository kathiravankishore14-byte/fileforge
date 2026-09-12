# SEO Watch Log — OnlineToolsWeb (FileForge)

Running record of SEO page work. **Read this before every run.** One section per run,
newest at the bottom. The scheduled run fires twice daily (`30 9,15 * * *` UTC =
3 PM and 9 PM IST) and works 3 pages per run, chosen by the group rotation in the
task prompt.

Source of page copy: `PAGE_SEO` in `scripts/generate-seo-pages.mjs`.
The 64 root `.html` files are generated — never hand-edit them.

---

## Backfill — work reconstructed from file timestamps (pre-log)

This log was created on 2026-09-12. Entries below were reconstructed from file
mtimes and the research notes in `Claude outputs/`, so they are accurate on
*what and when* but not on the full reasoning.

| Date (UTC) | Page | What happened |
|---|---|---|
| 2026-09-11 22:54 | word-to-excel | Research written to `Claude outputs/word-to-excel-seo.md` |
| 2026-09-11 23:18 | word-to-excel | Full `PAGE_SEO` entry added: title, description, h1, intro, 8 FAQs, long-form `body`. Page went from ~300 to ~1,400 words |
| 2026-09-11 23:26 | — | `Claude outputs/impressions-clicks-adsense.md` — how search impressions → clicks → AdSense revenue; AdSense is **not live** (`ADS_ENABLED = false`) |
| 2026-09-11 23:39 | ppt-to-text | `PAGE_SEO` entry added (title, description, h1, intro, faq, body) |
| 2026-09-12 11:29 | compress-image / compress-pdf | Research written to `Claude outputs/compress-seo-research.md` |
| 2026-09-12 11:38 | compress-image, compress-pdf | `PAGE_SEO` entries added for `compress` and `pdfcompress` |

`PAGE_SEO` entries that existed at the start of 2026-09-12 15:35 UTC:
`wordtoexcel`, `ppttotext`, `compress`, `pdfcompress`. Every other slug was still
running on auto-derived copy (~280–330 words, 3–4 generic FAQs).

`SITE_LASTMOD` was `2026-09-11` at that point.

---

## 2026-09-12 · 15:35 UTC (21:05 IST) · SLOT 1 — 9 PM run · group 1
**Pages in scope:** text-to-ppt, word-to-excel, image-to-excel
(dayOfYear 255 → runIndex 511 → group 1)

### Outcome: no changes written by this run — a concurrent session landed the same work

While this run was doing its research, **another Claude session wrote the same two
`PAGE_SEO` entries** (`texttoppt` and `imagetoexcel`) and committed the full
regenerated output to the repo at **15:42 UTC**:

- `scripts/generate-seo-pages.mjs` (60,361 → 78,355 bytes)
- `text-to-ppt.html`, `image-to-excel.html`
- `public/sitemap.xml`, `public/robots.txt`, `scripts/routing-map.json`
- `SITE_LASTMOD` bumped `2026-09-11` → `2026-09-12`

Only one scheduled task exists (`trig_01QYA5DpRjG6m5wYDzPtdZgn`, last fired
15:35:09 UTC), so this was **not** a second scheduled firing — most likely a manual
session or a locally-scheduled desktop task running the same prompt at the same time.

This run **did not overwrite** that work. The committed version was independently
reviewed and is good: accurate to what the tools actually do, no invented limits or
speed claims, correct on the client-side privacy angle. Overwriting it with a
near-identical rewrite would have been churn.

**Verification performed on the concurrent session's commit (all passed):**
- Regenerating from the committed `.mjs` reproduces the committed `.html` byte-for-byte
- Only `text-to-ppt.html` and `image-to-excel.html` differ from the pre-run baseline;
  no shared page was affected
- FAQPage / WebApplication / BreadcrumbList JSON-LD all parse as valid JSON
  (10 and 12 questions respectively)
- HTML tag balance clean, no stray backticks, no placeholder text
- `sitemap.xml` diff is the `lastmod` bump only, 75 URLs intact
- Titles 50 / 53 chars, descriptions 146 / 145 chars — within limits

**State after that commit:**
- text-to-ppt: 278 → 1,308 words, 3 → 10 FAQs
- image-to-excel: 327 → 1,485 words, 4 → 12 FAQs

### word-to-excel — assessed, deliberately left untouched
Rewritten in full 17 hours earlier (2026-09-11 23:18 UTC). Title 51 chars,
description 152 chars, 8 FAQs covering free / how-to / no-install / privacy /
formatting fidelity / mobile / legacy `.doc` / size-and-count limits, plus a
~1,000-word body. Gap analysis against competitors turned up nothing material that
the page does not already answer. Per the standing instruction not to churn recently
improved copy, no edit was made.

### Ranking observed (2026-09-12)
**onlinetoolsweb.com does not appear in search results for any of these keywords,
and does not appear for its own brand name.** Not "low position" — absent. Checked:
`text to ppt converter free online`, `convert txt to pptx converter online no signup`,
`image to excel converter free online OCR table`, `"picture to excel" convert
screenshot table to spreadsheet online free`, `onlinetoolsweb.com image to excel`,
`onlinetoolsweb`. This is consistent with a site that is new or not yet indexed —
worth checking Search Console for indexing/coverage status, because content work
cannot rank a page Google has not indexed.

### Competitive picture (research done this run)
**text to ppt** — the SERP is AI presentation generators, not converters:
presentations.ai, edraw.ai, genppt.ai, easyslides.ai, dokie.ai. The file-converter
cluster underneath is Convertio, Aspose, online2pdf, GroupDocs, onlineconvertfree.
Convertio TXT→PPTX: ~2,200 words, 6 FAQs, 1 GB limit, files deleted within 24h, no
FAQPage schema. Aspose: ~2,000 words, no FAQ section, no schema, files deleted after
24h. **Nobody in the top set uses FAQPage JSON-LD** — a real structured-data edge.
The honest positioning is "converter, not AI generator": exact wording preserved,
no account, nothing uploaded.

**image to excel** — thunderbit.com (~2,000 words, 9 FAQs, no schema),
myocr.app (~2,100 words, 10 FAQs, no schema, 10 MB free cap, files deleted in 30 min,
claims 99% accuracy), jpgtoexcelconverter.com (~3,500 words, 5 FAQs, no schema,
claims 100-image batches and 100+ languages). All three upload to a server and
advertise a deletion window. **None uses FAQPage schema.** The client-side OCR
(no upload at all) is a genuine differentiator; the honest counterweights are
English-only and printed text only.

### Sources consulted
- https://convertio.co/txt-pptx/
- https://products.aspose.app/pdf/conversion/txt-to-powerpoint
- https://www.presentations.ai/tools/text-to-ppt
- https://genppt.ai/text-to-ppt
- https://thunderbit.com/tool/image-to-excel-converter
- https://www.myocr.app/image-to-excel-converter
- https://jpgtoexcelconverter.com/
- https://flex-ocr.com/free-tools/image-to-excel
- https://www.ilovepdf.com/blog/convert-jpg-to-excel

### Notes for the next run
1. **Two sessions are working this repo at once.** Before editing, re-check
   `scripts/generate-seo-pages.mjs` mtime immediately before committing — it moved
   mid-run today. Never `force` past the mtime guard.
2. `PAGE_SEO` now covers: `wordtoexcel`, `ppttotext`, `compress`, `pdfcompress`,
   `texttoppt`, `imagetoexcel`. Everything else is still thin auto-copy.
3. **No page on this site uses HowTo schema** and no competitor checked uses FAQPage.
   Adding HowTo JSON-LD to the generator (it already has the ordered `body.blocks`
   data to build it from) would be a site-wide win, not a per-page one.
4. Indexing, not copy, may be the binding constraint — see the ranking note above.
5. There is unpushed work in the folder: the word-to-excel, ppt-to-text,
   compress-image, compress-pdf, text-to-ppt and image-to-excel changes from
   2026-09-11 and 2026-09-12 all still need a commit and push.
