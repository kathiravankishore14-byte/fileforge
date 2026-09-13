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

---

## 2026-09-13 · 09:35 UTC (15:05 IST) · SLOT 0 — 3 PM run · group 2
**Pages in scope:** ppt-to-text, word-to-text, pdf-to-markdown
(dayOfYear 256 → runIndex 512 → group 2)

### Changes written: 2 full builds + 1 one-line fix

**word-to-text — new full `PAGE_SEO` entry (was auto-copy, 263 words / 0 custom FAQs).**
- title: `Word to Text Online Free | OnlineToolsWeb` → `Word to Text Converter Online Free | OnlineToolsWeb` (51 ch).
  Every ranking competitor titles on "Converter"; the old title omitted the head term.
- description: 104 ch, no reason-to-click → 148 ch leading with free + .docx→.txt +
  "never leaves your device".
- h1 `Word to Text Online` → `Word to Text Converter — Online and Free`.
- 12 FAQs added. Deliberately includes the two questions **no competitor in the top
  set answers**: UTF-8 / accented-character survival, and whether headers, footers
  and comments are included. Also covers free / how-to / preview / .doc vs .docx /
  formatting-images-tables loss / privacy / size limit / batch / what opens .txt / mobile.
- ~1,000-word body. Page 263 → 1,327 words.
- Accuracy check against `src/main.js`: tool is `wordtotext` → mammoth
  `extractRawText` on `.docx` only, outputs `.txt`, shows a 400-character preview
  before conversion (a real differentiator — written up, not invented). No size limit
  is imposed anywhere in the code, so the FAQ says "the tool does not impose one"
  rather than quoting a number. One file at a time — stated honestly.

**pdf-to-markdown — new full `PAGE_SEO` entry (was auto-copy, 324 words / 0 custom FAQs).**
- title → `PDF to Markdown Converter Online Free | OnlineToolsWeb` (54 ch).
- description: 108 ch generic → 141 ch.
- h1 `PDF to Markdown Online` → `PDF to Markdown Converter — Online and Free`.
- 13 FAQs + ~1,100-word body, including a dedicated **"PDF to Markdown for AI tools
  and RAG pipelines"** section — that is where the commercial intent on this keyword
  now sits (markitdown.online, anythingmd.com, blazedocs.io all built their pages
  around it) and the client-side angle is genuinely stronger there than anywhere else
  on the site: converting locally means the PDF is seen by one fewer third party
  before it reaches a model.
- Page 324 → 1,555 words.
- Accuracy check against `src/main.js` (`runPdfToMarkdown` + `extractPdfTextPages`):
  output is `## Page N` per page plus paragraph splits, nothing more. So the page
  states plainly that it does **not** reconstruct heading levels, bold/italic, links
  or Markdown tables, does **not** OCR scanned PDFs, and can interleave multi-column
  layouts. This is the opposite of iLovePDF's "headings, tables, lists and links stay
  intact" claim — we cannot make that claim, so the page turns the limits into
  routing instead (tables → /pdf-to-excel, images → /pdf-to-jpg, structure → /pdf-to-word).

**ppt-to-text — one-line fix only, otherwise left alone.**
Rewritten in full on 2026-09-11 (1,321 words, 8 FAQs); gap analysis against the
current SERP (slidespilot, magicslides, convertio, autoslide, sharayeh) turned up
nothing it does not already answer — speaker notes, .ppt, text-in-images, privacy,
mobile and output shape are all covered. Per the no-churn rule the copy was not
touched. The one real defect was the meta description at **159 characters**, over
the ~155 limit and at risk of truncation. Trimmed to 141 ch:
`Extract all the text from a PowerPoint (.pptx) into a plain .txt file, slide by
slide — no signup, no upload, runs in your browser.` →
`Pull every word out of a PowerPoint (.pptx) into a plain .txt file, slide by
slide — no signup, nothing uploaded.`
Diff confirms the only changes to `ppt-to-text.html` are that description in its
four places (meta, og, twitter, WebApplication schema).

`SITE_LASTMOD` bumped `2026-09-12` → `2026-09-13`.

### Verification performed (all passed)
- Only `word-to-text.html`, `pdf-to-markdown.html` and `ppt-to-text.html` differ from
  the pre-run baseline of all 64 generated pages. No shared page affected.
- FAQPage JSON-LD parses as valid JSON on all three (12 / 13 / 8 questions);
  WebApplication and BreadcrumbList also valid.
- Tag balance clean on all three (`<p>`/`</p>`, `<h3>`, `<li>` all matched).
- No backticks, no `${`, no `undefined`, no placeholder text in output.
- Titles 51 / 54 / 50 ch; descriptions 148 / 141 / 141 ch — all within limits.
- `sitemap.xml` still 75 URLs, diff is the lastmod bump only.

### Ranking observed (2026-09-13)
**onlinetoolsweb.com does not appear in results for any of the three keyword
clusters.** Checked: `word to text converter`, `docx to txt converter online`,
`convert word to text free`, `extract text from word document online`,
`pdf to markdown converter online free`, `convert pdf to md`,
`pdf to markdown for LLM RAG`, `ppt to text converter online free`, plus the
site-scoped `onlinetoolsweb.com word to text` and `pdf to markdown onlinetoolsweb`.
Absent, not low-ranked — same finding as 2026-09-12. **Indexing remains the most
likely binding constraint; copy work cannot rank an unindexed page.** Search Console
coverage status is still the highest-value thing to check.

### Competitive picture (research done this run)
**word to text** — cloudconvert.com/docx-to-txt (~190 words, no FAQ) and
convertio.co/docx-txt (~2,200 words, 6 FAQs: why convert / what opens TXT / images
and tables preserved / batch / free / no install) anchor the SERP, with
freeconvert.com (~1,200 words, 3 how-to questions), zamzar.com (~2,100 words, all
trust and cross-sell, no Q&A) and products.aspose.app (~1,150 words, 7 FAQs: free /
how many at a time / max size / how to get result / how long files are stored /
safety / why slow). Every one of them uploads to a server, and every one therefore
spends a section reassuring you about deletion. **Nobody covers text encoding, and
only Convertio covers formatting/table loss** — both now answered on his page.
FAQPage JSON-LD was not detected on any of the five.

**pdf to markdown** — two distinct clusters. The plain converters: ilovepdf.com
(~150 words, no FAQ, but already advertising "reuse in LLMs"), cloudconvert.com
(~190 words), vertopal.com (~580 words), zamzar.com (~1,900 words, trust-heavy).
The AI-angle pages, which are where the depth is: markitdown.online (~1,400 words,
13 FAQs), anythingmd.com (~1,200 words, 7 FAQs, spec-sheet style with an explicit
Limits section), blazedocs.io (~4,300 words, 9 FAQs, answers "why can't ChatGPT read
PDFs" and RAG-prep directly), notegpt.io (~1,300 words, 6 FAQs). All upload.
No FAQPage JSON-LD detected on any of them.

*Caveat on the schema findings: they come from fetched-and-converted page content,
which strips `<script>` blocks, so "no FAQPage schema" is strong-but-not-certain.*

### Sources consulted
- https://convertio.co/docx-txt/
- https://cloudconvert.com/docx-to-txt
- https://www.freeconvert.com/docx-to-txt
- https://www.zamzar.com/convert/docx-to-txt/
- https://products.aspose.app/words/conversion/docx-to-txt
- https://www.ilovepdf.com/pdf-to-markdown
- https://cloudconvert.com/pdf-to-md
- https://www.zamzar.com/convert/pdf-to-md/
- https://www.vertopal.com/en/convert/pdf-to-markdown
- https://notegpt.io/pdf-to-markdown-converter
- https://markitdown.online/
- https://anythingmd.com/
- https://blazedocs.io/
- https://convertio.co/ppt-txt/
- https://www.slidespilot.com/features/ppt-to-text
- https://www.magicslides.app/tools/ppt-to-text

### Notes for the next run
1. `PAGE_SEO` now covers: `wordtoexcel`, `ppttotext`, `compress`, `pdfcompress`,
   `texttoppt`, `imagetoexcel`, `wordtotext`, `pdftomarkdown`. Everything else is
   still thin auto-derived copy (~280–330 words, 3–4 generic FAQs).
2. **Still no HowTo schema anywhere on the site**, and no competitor checked across
   two runs uses FAQPage. Adding HowTo JSON-LD to the generator from the existing
   ordered `body.blocks` data remains the biggest single site-wide win available.
3. Unpushed work in the folder now includes: word-to-excel, ppt-to-text,
   compress-image, compress-pdf, text-to-ppt, image-to-excel (2026-09-11/12) **and**
   word-to-text, pdf-to-markdown, ppt-to-text (this run). All of it needs one commit
   and push.
4. A second session was writing this repo on 2026-09-12. `generate-seo-pages.mjs`
   mtime was re-checked immediately before committing this run and had not moved.
