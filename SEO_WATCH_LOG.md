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

---

## 2026-09-13 · 20:15 UTC (01:45 IST, 14 Sep) · SLOT 1 — 9 PM run (fired late) · group 3
**Pages in scope:** image-to-ppt, excel-to-csv, heic-to-jpg
(dayOfYear 256 → runIndex 513 → group 3)

**Schedule note:** the trigger fired at **20:15 UTC**, not the configured 15:30 UTC.
Nearly five hours late, and no 15:30 run is recorded in this log, so this is the
delayed slot-1 firing rather than an extra one. Slot taken as 1, which is consistent
with the 09:35 slot-0 run earlier today (group 2) — the two daily branches did not
collide. If the drift repeats, the cron (`30 9,15 * * *` UTC) is worth re-checking.

### Changes written: 3 new full `PAGE_SEO` entries

All three slugs were still on auto-derived copy — no custom title, description, h1,
intro, FAQ or body between them. Every one was a build-from-nothing, not a rewrite,
so the no-churn rule did not bite on any of them.

**image-to-ppt — new full entry (was 502 words / 0 custom FAQs → 2,011 words / 12 FAQs).**
- title: `Image to PPT Online Free | OnlineToolsWeb` → `Image to PPT Converter Online Free | OnlineToolsWeb` (51 ch). Every ranking page titles on "Converter"; the old title dropped the head term.
- description: `Place one or more images onto slides. Free, private, and runs right in your browser: no upload, no signup.` (106 ch, tool-meta boilerplate) → `Free image to PPT converter. Turn JPG or PNG pictures into PowerPoint slides, one image per slide — no signup, and nothing leaves your browser.` (143 ch).
- h1 `Image to PPT Online` → `Image to PPT Converter — Online and Free`.
- The keyword gap that mattered: this SERP holds **two different products under one name.**
  Canva, CopySlides and AiPPT sell AI "editable PPTX" — OCR the picture, rebuild it as
  text boxes, charge per slide. Simple picture-placers (generateppt.com) are the other
  half. His tool is the second kind, and the page now says so in a dedicated section
  rather than letting a visitor arrive expecting OCR and bounce.
- New FAQs include the three that generateppt.com — the closest functional competitor —
  answers and nobody else does: **will images be stretched**, **what slide size**,
  **can I edit the text inside the pptx**. All three are answered against the code, not
  guessed (see accuracy check).
- Accuracy check against `src/main.js` (`renderMultiFileTool` + the single-file
  `imagetoppt` branch): pptxgenjs, `slide.addImage({x:0, y:0, w:10, h:5.63})` per file,
  one slide per image, order = the order files were added. So the page states plainly
  that images are **stretched to fill a 16:9 slide** (10 × 5.63 in) and routes to
  /crop-image for anything not already widescreen — an honest limitation turned into a
  useful instruction. Drag-to-reorder is `pdfmerge`-only in the code, so the page does
  **not** claim reordering; it says to reorder in PowerPoint afterwards. The >22-file
  memory warning is described as it actually behaves; no invented file cap.

**excel-to-csv — new full entry (was 407 words / 0 custom FAQs → 2,046 words / 13 FAQs).**
- title → `Excel to CSV Converter Online Free | OnlineToolsWeb` (51 ch).
- description: 103 ch boilerplate → `Free Excel to CSV converter. Turn an .xlsx or .xls sheet into a plain .csv in your browser — no upload, no signup, your data stays on your device.` (146 ch).
- h1 `Excel to CSV Online` → `Excel to CSV Converter — Online and Free`.
- **Biggest gap on this keyword: multi-sheet workbooks.** Zamzar, FreeConvert and
  CoolUtils all leave it unanswered, and it is the first thing that surprises people —
  a CSV holds one table. His tool converts `workbook.SheetNames[0]`, the first sheet,
  so the page says exactly that and tells you how to get at a different sheet.
- Second gap: **the UTF-8 / accented-characters problem.** TableConvert is the only
  competitor checked that covers it. `sheet_to_csv` writes UTF-8 with no BOM, so Excel
  on Windows garbles accents on a double-click. The page gives the actual fix
  (Data → From Text/CSV → File Origin: UTF-8) instead of pretending it does not happen.
- Also covers formulas-become-values, comma/quote escaping, .xls as well as .xlsx, what
  formatting is lost, and the five-row preview — the preview is a genuine differentiator
  (sheet name + total row count + first 5 rows before you commit) and is real, not invented.
- Accuracy check against `excelToCsvBlob` and the `exceltopdf/exceltocsv` config branch
  in `src/main.js`: SheetJS `XLSX.read` → `sheet_to_csv` on sheet 0. One file at a time —
  stated honestly, no batch claim. No size limit imposed anywhere in the code, so the
  FAQ says "the tool does not impose one" rather than quoting a number.

**heic-to-jpg — new full entry (was 488 words / 0 custom FAQs → 1,961 words / 12 FAQs).**
- title → `HEIC to JPG Converter Online Free | OnlineToolsWeb` (50 ch).
- description: 108 ch boilerplate → `Free HEIC to JPG converter. Turn an iPhone .heic photo into a JPG that opens anywhere — no signup, no upload, and the photo stays on your device.` (145 ch).
- h1 `HEIC to JPG Online` → `HEIC to JPG Converter — Online and Free`.
- **Honest read of this keyword: the privacy angle is weakest here of anywhere on the site.**
  Unlike every other page worked so far, this SERP is full of client-side competitors —
  openmyheic.com, heicsave.com, heicvault.com, convertheictojpg.online, heicjpgconverter.com
  all lead with "no upload". "Nothing leaves your device" is table stakes on this term,
  not a differentiator. The page still states it (it is true and users look for it) but
  does not lean on it as the whole pitch.
- Where the page competes instead: **the questions around the conversion**, which the
  big converters skip. Why Windows/Android choke on HEIC, whether EXIF date and GPS
  survive, what happens to a Live Photo, how to get the files off the iPhone, and how to
  turn HEIC off at source (Settings → Camera → Formats → Most Compatible).
- Accuracy check against `runSimpleTool` in `src/main.js`: `heic2any({toType:'image/jpeg',
  quality:0.9})`. The 90 percent quality figure in the copy comes from that line — a real
  number, not a marketing one. `accept: '.heic,.heif'` so both extensions are claimed.
  **One photo at a time** — not multiFile in `toolMeta` — so the page says so plainly and
  concedes that a desktop batch tool is better for hundreds of photos, rather than
  matching heictojpg.com's "up to 200 photos" claim it cannot back.
- EXIF is deliberately hedged ("do not count on it") rather than asserted either way:
  heic2any re-encodes from the decoded image and metadata carry-over is not guaranteed,
  so a hard claim in either direction would have been invention.

`SITE_LASTMOD` was **already** `2026-09-13` (set by this morning's slot-0 run), so it was
left alone and `public/sitemap.xml` is byte-identical to before. Nothing to bump twice in a day.

### Verification performed (all passed)
- Baseline regeneration from the pre-edit `.mjs` reproduces the three on-device `.html`
  files **byte-for-byte** — the build is deterministic and this container matches his.
- After the edit, exactly **three** of the 64 generated pages differ from baseline:
  `image-to-ppt.html`, `excel-to-csv.html`, `heic-to-jpg.html`. No shared page touched.
- FAQPage JSON-LD parses as valid JSON on all three (12 / 13 / 12 questions);
  WebApplication and BreadcrumbList also valid.
- Tag balance clean on all three (`<p>`, `<h2>`, `<h3>`, `<ul>`, `<ol>`, `<li>` all matched).
- No backticks, no `${`, no `undefined`, no placeholder text in output.
- **Every internal `href` checked against `src/toolSlugs.js`** — 17 distinct link targets
  across the three pages, all resolve to real slugs. No dead links.
- Titles 51 / 51 / 50 ch; descriptions 143 / 146 / 145 ch — all within limits.
- `scripts/generate-seo-pages.mjs` mtime on the device re-checked immediately before
  committing and unchanged from staging (1789292547990) — no concurrent session this run.

### Ranking observed (2026-09-13)
**onlinetoolsweb.com does not appear for any of the three keyword clusters.** Checked:
`heic to jpg converter free online`, `convert iphone heic photos to jpg on windows free no upload`,
`"heic to jpg" converter browser no upload private`, `excel to csv converter online free xlsx to csv`,
`image to ppt converter online free jpg to powerpoint`, and the site-scoped
`onlinetoolsweb.com image to ppt excel to csv heic to jpg`. Absent, not low-ranked —
the same finding as 2026-09-12 and the 09:35 run today. **Three runs in a row now agree:
indexing, not copy, is the binding constraint.** Search Console coverage status remains
the single highest-value thing to check, and none of this copy work can pay off until it is.

### Competitive picture (research done this run)
**image to ppt** — the term splits. AI editable-PPTX services: copyslides.com (~1,800 words,
9 FAQs, 20 MB image cap, paid tiers from 200 slides/month), canva.com (~1,800 words, 3 FAQs),
aippt.com, dokie.ai. Simple picture-placers: generateppt.com (~2,000 words, 3 FAQs —
"will images be stretched", "what slide size", "can i edit text inside the pptx" — states
16:9 and offers drag-to-reorder), jpgtoppt.com, theonlineconverter.com. Smallpdf's entry is
a blog post, not a tool page. No FAQPage JSON-LD detected on any of them.

**excel to csv** — zamzar.com (~2,500 words, 5 FAQs, 50 MB cap, does not mention sheets),
freeconvert.com (~2,000 words, no labelled FAQ, 1 GB cap, does note CSV has "no multiple
sheets"), tableconvert.com (~4,500 words, 10 FAQs, **client-side like his** and explicitly
says so, covers formulas and the Excel-opens-CSV-wrong problem), coolutils.com, xlsx-to-csv.com,
ocr.ac. TableConvert is the real competitor here — same architecture, deeper page.
No FAQPage JSON-LD detected.

**heic to jpg** — the most crowded and most client-side of the three. iloveimg.com
(~450 words, no FAQ), freeconvert.com (~3,500 words, 5 FAQs, 1 GB cap, uploads and deletes
after 8 hours), heictojpg.com (~250 words, claims up to 200 photos), canva.com, watermarkly.com,
picflow.com, plus a long tail of no-upload single-purpose sites: openmyheic.com (~2,100 words,
6 FAQs, WebAssembly/libheif, "photos are never uploaded", limit is device memory),
heicsave.com, heicvault.com, heicconvertor.com, convertheictojpg.online, heicjpgconverter.com.
No FAQPage JSON-LD detected on any of them.

*Caveat on the schema findings, same as prior runs: they come from fetched-and-converted
page content, which strips `<script>` blocks, so "no FAQPage schema" is strong but not certain.*

### Sources consulted
- https://www.canva.com/features/jpg-to-ppt-converter/
- https://www.generateppt.com/free-tools/images-to-pptx
- https://copyslides.com/image-to-pptx
- https://jpgtoppt.com/
- https://smallpdf.com/blog/jpg-to-ppt-converter
- https://www.zamzar.com/convert/xlsx-to-csv/
- https://www.freeconvert.com/xlsx-to-csv
- https://tableconvert.com/excel-to-csv
- https://www.coolutils.com/online/XLSX-to-CSV
- https://www.iloveimg.com/convert-to-jpg/heic-to-jpg
- https://www.freeconvert.com/heic-to-jpg
- https://heictojpg.com/
- https://openmyheic.com/
- https://watermarkly.com/convert-heic-to-jpg/
- https://picflow.com/convert/heic-to-jpg

### Notes for the next run
1. `PAGE_SEO` now covers **11 slugs**: `wordtoexcel`, `ppttotext`, `compress`, `pdfcompress`,
   `texttoppt`, `imagetoexcel`, `wordtotext`, `pdftomarkdown`, **`imagetoppt`, `exceltocsv`,
   `heictojpg`**. Everything else is still thin auto-derived copy (~280–500 words, no custom FAQs).
2. **Still no HowTo schema anywhere on the site.** Three runs have now flagged it. The
   generator already holds the ordered `body.blocks` data — every custom entry written so far
   has an `ol` of numbered steps under a "How to …" h3, which is exactly the HowTo shape.
   Eleven pages would pick it up the moment it is added. This is the biggest single
   site-wide win still on the table.
3. **Unpushed work in the folder now covers:** word-to-excel, ppt-to-text, compress-image,
   compress-pdf, text-to-ppt, image-to-excel (09-11/12), word-to-text, pdf-to-markdown,
   ppt-to-text (09-13 morning) **and** image-to-ppt, excel-to-csv, heic-to-jpg (this run).
   Twelve pages, one push.
4. Trigger fired ~4h45m late this run — see the schedule note at the top.

---

## 2026-09-13 · 23:30 UTC · Generator change (not a page-copy run) — per-URL `<lastmod>`

Requested by Kathir after the sitemap was flagged in conversation. **No page copy was
touched**; all 64 generated `.html` files are byte-identical before and after.

### The problem
`SITE_LASTMOD` was stamped on all 75 sitemap URLs, so every page claimed to change on
the same day. Google only uses `lastmod` when it is consistently accurate; a sitemap
where all 75 dates advance together teaches it to ignore the field — exactly backwards
when three pages have just been rewritten and those three are what should stand out.

### What changed in `scripts/generate-seo-pages.mjs`
- Added a content fingerprint per sitemap URL, persisted to the new committed file
  **`scripts/page-lastmod.json`** (`{ "<loc>": { hash, lastmod } }`, 75 entries, sorted
  for a readable diff).
- Each build re-fingerprints every URL. Unchanged fingerprint → the page keeps its
  recorded date. Changed or new → it takes `SITE_LASTMOD`.
- **`SITE_LASTMOD` keeps its name and its meaning for the twice-daily run:** it is still
  bumped by hand to today's date, it is just now "the date stamped on pages that actually
  changed" rather than on all 75. The standing instruction in the task prompt still works
  unmodified. Using the constant rather than a runtime `new Date()` also keeps builds
  deterministic.
- **Tool pages are fingerprinted on page-specific content only** — the derived `seo`
  object, the `PAGE_SEO` override, and the `toolMeta` fields the auto-derived copy reads
  (`label`, `desc`, `accept`, `usesServer`, `heroCopy`). Deliberately NOT the rendered
  HTML: hashing that would make a header or footer tweak bump all 64 dates at once and
  put us straight back where we started.
- Static and info pages have no such separation, so they are fingerprinted on their
  source file (`index.html`, `pdf.html`, `about.html`, …), with **line endings normalised
  before hashing** — this repo is edited on Windows with git's autocrlf on, and hashing
  raw bytes would make all 11 claim a change on a fresh clone.
- Console output now reports what actually moved, e.g.
  `Wrote sitemap.xml with 75 URLs (3 changed this build).`

### Seeding
The map was seeded with real dates rather than letting the first run stamp everything
today (which would have reproduced the original problem once more):
- The 11 rewritten pages got the dates recorded in this log — word-to-excel 09-11;
  compress-image, compress-pdf, text-to-ppt, image-to-excel 09-12; ppt-to-text,
  word-to-text, pdf-to-markdown, image-to-ppt, excel-to-csv, heic-to-jpg 09-13.
- The 53 untouched tool pages got 2026-09-10, the last generator run that wrote them.
- The 11 static/info pages got 2026-09-05, from their file timestamps.

Resulting distribution: **11 × 09-05, 53 × 09-10, 1 × 09-11, 4 × 09-12, 6 × 09-13.**

### Verification performed (all passed)
- All 64 generated `.html` files byte-identical to the pre-change build.
- `public/robots.txt` and `scripts/routing-map.json` byte-identical — the only changed
  outputs are `sitemap.xml` and the new `page-lastmod.json`.
- Idempotent: three consecutive runs report `0 changed this build` and produce an
  identical sitemap.
- Change detection tested by simulation: editing one character of the heic-to-jpg
  description made the run report exactly `1 changed this build: /heic-to-jpg`, and
  reverting it flipped back cleanly.
- CRLF-insensitivity tested: converting `index.html`, `pdf.html` and `about.html` to CRLF
  and rebuilding still reported `0 changed`.
- Sitemap still 75 URLs, still valid XML, priorities untouched.

### Note for future runs
`scripts/page-lastmod.json` **must be committed**. If it is deleted or gitignored, the
next build treats all 75 URLs as new and stamps them all with `SITE_LASTMOD` — the exact
failure this change removes. It is also now part of the normal write-back set, alongside
`generate-seo-pages.mjs`, the changed `.html` files, `sitemap.xml`, `robots.txt` and
`routing-map.json`.

### Repo state at the time of this change
Kathir merged `seo/2026-09-13-night` into `main` (fast-forward, `6412e80` → `6cd8fcb`)
and pushed at ~23:16 UTC, so all 11 rewritten pages are now on `main` and deploying.
This generator change sits on top of that and still needs its own commit.

---

## 2026-09-14 · 11:42 UTC · SLOT 0 — 3 PM run (fired late) · group 4
**Pages in scope:** pdf-to-ppt, excel-to-pdf, social-media-image-resize
(dayOfYear 257 → runIndex 514 → group 4)

**Schedule note:** the trigger fired at **11:41:46 UTC**, not the configured 09:30. That is
neither of the two documented slot hours (09 / 15). Treated as **SLOT 0** — it is the
earlier of the two and no slot-0 run is recorded for today. If a run appears later today
at ~15:30 UTC it is slot 1 and gets group 0 (pdf-to-word, image-to-pdf, compress-image);
there is no overlap either way.

### Outcome: all three pages rewritten. None had a `PAGE_SEO` entry before this run.

All three were still on auto-derived copy — **237–324 words, the same four generic FAQs,
and a meta description built from the one-line `toolMeta.desc`**. `PAGE_SEO` now covers
**14 slugs** (was 11).

**pdf-to-ppt — new full entry (was 324 words / 0 custom FAQs → 1,380 words / 12 FAQs).**
- title `PDF to PowerPoint Online Free | OnlineToolsWeb` → `PDF to PPT Converter Online Free | OnlineToolsWeb` (49 ch).
  "PPT" and "Converter" were both missing; the head term on this SERP is
  *pdf to ppt converter*, and every ranking competitor has "Converter" in the title.
- description: 97 ch boilerplate → `Free PDF to PPT converter. Turn every page of a PDF into a PowerPoint slide in your browser — no upload, no signup, the file stays on your device.` (146 ch).
- h1 `PDF to PowerPoint Online` → `PDF to PPT Converter — Online and Free`.
- **The defining gap on this keyword is the editable-vs-image question, and it runs the
  other way from the usual privacy story.** Smallpdf leads with "fully editable PowerPoint
  slides with formatting intact"; Canva, Nitro, Foxit and HiPDF all make some version of
  the same promise. `runPdfToPpt` in `src/main.js` does not do that: pdf.js renders each
  page to a canvas, `canvas.toDataURL('image/jpeg', 0.9)` turns it into a picture and
  pptxgenjs places it on a slide. **The slides are images and the text is not editable.**
  The page now says that plainly, in the FAQ *and* in the body, and turns it into the
  honest counter-argument: nothing reflows, so the layout arrives exactly as it looks in
  the PDF — which is precisely what breaks in converters that rebuild editable text.
  Pretending otherwise would have been the single worst thing to write on this page.
- **Second honest disclosure: aspect ratio.** `addImage({x:0,y:0,w:10,h:5.63})` with no
  `sizing` option stretches the page image to fill a 16:9 slide, so a portrait A4 page
  comes out horizontally stretched. There is an FAQ saying so in those words, and the
  body steers the page at its real best case — a deck that was widescreen to begin with,
  which is also the dominant intent behind this query. Users are pointed at
  `/pdf-to-jpg` if they need the pages to keep their proportions.
  **Worth flagging to Kathir as a possible code fix** (pptxgenjs `sizing: {type:'contain'}`
  would letterbox instead of stretch); the copy describes current behaviour, not a wish.
- Also covers: every page becomes a slide with no range picker (→ `/extract-pdf-pages`,
  `/split-pdf`), the 16:9 slide size, opening the .pptx in Google Slides / Keynote /
  Impress, one file at a time, and password-protected PDFs failing to open (→ `/unlock-pdf`,
  which `toolMeta` describes as "remove a password you already know" — no crack claim made).
- No file-size or page number invented: no cap exists in the code, so the FAQ says the
  ceiling is browser memory and that a few hundred pages is worth splitting first.

**excel-to-pdf — new full entry (was 237 words / 0 custom FAQs → 1,409 words / 14 FAQs).**
This was the thinnest page of the three and had the clearest winnable angle.
- title `Excel to PDF Online Free | OnlineToolsWeb` → `Excel to PDF Converter Online Free | OnlineToolsWeb` (51 ch).
- description: 108 ch boilerplate → `Free Excel to PDF converter. Turn an .xlsx, .xls or .csv sheet into a clean PDF table in your browser — no upload, no signup, no Excel needed.` (142 ch).
- h1 `Excel to PDF Online` → `Excel to PDF Converter — Online and Free`.
- **Biggest find of the run: the cut-off-columns problem.** A search for
  `excel to pdf columns cut off` returns a Microsoft Q&A thread, ExcelDemy, four separate
  blog guides and a forum thread — it is a large, well-evidenced pain point on this
  keyword. **Not one of the ranking tool pages addresses it.** Smallpdf, Xodo and
  FreeConvert say nothing about columns, sheets, orientation or page breaks at all.
  His tool genuinely solves it: `excelToPdfBlob` hands the rows to `jspdf-autotable`,
  which sizes the table to the printable width and wraps long cell text instead of
  letting columns run off the page, and the orientation line
  (`rows[0].length > 8 ? 'landscape' : 'portrait'`) turns wide sheets sideways
  automatically. Both facts are now an FAQ each and a dedicated h3 in the body.
- **The honest counterweight, stated in the same breath:** it produces a clean data table,
  not a picture of the worksheet. Cell fills, custom fonts, borders, conditional
  formatting and merged cells are not carried over, and charts, images and pivot tables
  are not included at all. The FAQ says outright that Excel's own Save as PDF is the
  better choice if the look must be preserved. Smallpdf claims "no data loss or
  misalignment" and keeps "tables, charts, and cell borders"; matching that claim here
  would have been a lie about `autoTable` output.
- Also covers: first sheet only, formulas arriving as values, .csv accepted alongside
  .xlsx/.xls, the header row repeating on every page (`autoTable` default), no Excel
  licence needed — deliberately made a selling point, since Xodo's own FAQ set is
  half "how to do this in Excel instead" — and the five-row preview.
- No size or row limit invented; none exists in the code.

**social-media-image-resize — new full entry (was 322 words / 0 custom FAQs → 1,358 words / 13 FAQs).**
- title `Social Media Resize Online Free | OnlineToolsWeb` → `Social Media Image Resizer Online Free | OnlineToolsWeb` (55 ch).
  The head term is *social media image resizer*; "Image" and "Resizer" were both absent.
- description: 115 ch boilerplate → `Free social media image resizer. Crop a photo to Instagram post, Instagram story, YouTube thumbnail or Facebook cover size — in your browser, no upload.` (152 ch).
- h1 `Social Media Resize Online` → `Social Media Image Resizer — Online and Free`.
- **Honest read of this keyword: he is outgunned on breadth and should not pretend
  otherwise.** Mixpost lists nine platforms and roughly forty presets; imageonline.io
  offers crop/fit/blur/stretch modes and a draggable crop box. `socialresize` in
  `src/main.js` has exactly **four** presets — `ig-post` 1080x1080, `ig-story` 1080x1920,
  `yt-thumb` 1280x720, `fb-cover` 820x312 — and no manual crop control. The page therefore
  **names the four sizes explicitly** rather than gesturing at "Instagram, YouTube and
  more", which also puts the four dimension strings people actually search on the page,
  and sends anyone needing LinkedIn / X / Pinterest / TikTok to `/resize-image` for
  custom width and height. Competing on "all platforms covered" was never available.
- Where it does compete: **the crop maths is right and is explained.**
  `scale = Math.max(w/naturalWidth, h/naturalHeight)` with a centred `drawImage` is a
  cover crop — proportions preserved, frame filled, no stretching and no letterbox bars.
  The body contrasts all three approaches and says which one this does and what it costs
  (the edges). An FAQ handles "part of my picture got cut off" by explaining the centre
  crop and pointing at `/crop-image`.
- Other real behaviour documented: output keeps the source MIME type
  (`currentFile.type || 'image/jpeg'`), so PNG stays PNG; `scale` is unclamped so a small
  source is **upscaled and will look soft** — said plainly, with the 1280-wide threshold
  for YouTube thumbnails; one image at a time; re-saving can make the file bigger, so
  `/compress-image` afterwards.
- The Instagram-re-crops-it FAQ is scoped carefully to the two Instagram presets being
  accepted ratios, with no claim about how the app treats anything else.

`SITE_LASTMOD` bumped `2026-09-13` → `2026-09-14`.

### Verification performed (all passed)
- Baseline regeneration from the pre-edit `.mjs` reproduces all three on-device `.html`
  files **byte-for-byte** — deterministic build, container matches his PC.
- After the edit, exactly **three** of the 64 generated pages differ from baseline:
  `pdf-to-ppt.html`, `excel-to-pdf.html`, `social-media-image-resize.html`.
  No shared page touched.
- Generator reported `3 changed this build` and named exactly those three URLs — the
  lastmod map loaded correctly.
- `public/sitemap.xml` diff is **three lines**, all `2026-09-10` → `2026-09-14`.
  Still 75 URLs. Distribution now 11 x 09-05, 50 x 09-10, 1 x 09-11, 4 x 09-12,
  6 x 09-13, 3 x 09-14.
- `public/robots.txt` byte-identical (it carries no date).
- FAQPage JSON-LD parses as valid JSON on all three (12 / 14 / 13 questions);
  WebApplication and BreadcrumbList also valid.
- Tag balance clean on all three (`p`, `h2`, `h3`, `ul`, `ol`, `li`, `strong`, `em`,
  `a`, `div`, `section` all matched).
- No backticks, no `${`, no `undefined`, no placeholder text in output.
- **Every internal `href` checked against `src/toolSlugs.js`** — all resolve to real
  slugs or real static pages. No dead links.
- Titles 49 / 51 / 55 ch; descriptions 146 / 142 / 152 ch — all within limits.
- Device mtimes re-checked immediately before committing and unchanged from staging
  (`generate-seo-pages.mjs` 1789341872418) — no concurrent session this run.

### Ranking observed (2026-09-14)
**onlinetoolsweb.com does not appear for any of the three keyword clusters.** Checked
`pdf to ppt converter free online`, `excel to pdf converter online free xlsx to pdf`,
`social media image resizer online free instagram youtube`, plus the site-scoped queries
`"onlinetoolsweb.com" pdf to ppt excel to pdf social media image resize`,
`onlinetoolsweb pdf to ppt converter browser no upload` and
`"onlinetoolsweb.com" social media image resizer instagram 1080`. Absent, not low-ranked.
**Four consecutive runs now agree: indexing, not copy, is the binding constraint.**
Search Console coverage status remains the single highest-value thing for Kathir to
check, and none of this copy work pays off until it is.

### Competitive picture (research done this run)
**pdf to ppt** — smallpdf.com (~1,200 words, no labelled FAQ, "fully editable PowerPoint
slides", TLS + 1 hour deletion, GDPR/ISO 27001), tools.pdf24.org (~1,200 words, 1 FAQ,
German servers, 1 hour deletion, silent on editability), canva.com (~1,200 words, 3 FAQs,
routes you into the Canva editor), freeconvert.com (~2,800 words, no labelled FAQ,
1 GB cap, 8 hour deletion, silent on editability), plus gonitro.com, foxit.com,
hipdf.com, pdfgear.com, freepdfconvert.com. **Every one of them uploads.** The
client-side angle is a genuine differentiator on this keyword, unlike heic-to-jpg.
No page checked carries a labelled FAQ block of any depth — an FAQPage schema with 12
questions is unusual here.

**excel to pdf** — xodo.com (~1,200 words, 5 FAQs but three of them are "how to do this
in Excel/on Mac/on your phone" rather than about the tool, AES-256 + TLS, no retention
period given), smallpdf.com (~1,200 words, no labelled FAQ, claims charts and cell
borders survive, 1 hour deletion), foxit.com, coolutils.com, online2pdf.com, pdf2go.com,
wondershare, freepdfconvert.com. **None of them mentions columns, sheets, orientation or
page breaks** — the whole cut-off-columns cluster is unclaimed on the tool pages and is
being served entirely by blog posts (ExcelDemy, fitforpdf, pdfnite, exceloperations).

**social media image resizer** — mixpost.app (~2,100 words, 9 FAQs, nine platforms,
~40 presets, manual crop), imageonline.io (~450 words, no FAQ, crop/fit/blur/stretch
modes), biteable.com, instasize.com, simpleimageresizer.com, poster.ly, social-resize.com,
presetpedia.com, dpimageresize.com. Breadth is table stakes here; four presets is the
weakest competitive position of any page worked so far, which is why the page is written
around naming those four sizes precisely rather than implying coverage it lacks.

*Caveat on the schema findings, same as prior runs: they come from fetched-and-converted
page content, which strips `<script>` blocks, so "no FAQPage schema" is strong but not certain.*

### Sources consulted
- https://smallpdf.com/pdf-to-ppt
- https://tools.pdf24.org/en/pdf-to-powerpoint
- https://www.canva.com/features/pdf-to-ppt-converter/
- https://www.freeconvert.com/pdf-to-ppt
- https://www.hipdf.com/pdf-to-ppt
- https://www.gonitro.com/pdf-to-powerpoint
- https://smallpdf.com/excel-to-pdf
- https://xodo.com/excel-to-pdf
- https://www.foxit.com/excel-to-pdf/
- https://www.coolutils.com/online/XLS-to-PDF
- https://learn.microsoft.com/en-us/answers/questions/5426670/the-last-column-of-an-excel-sheet-is-cut-off-when
- https://www.exceldemy.com/excel-cutting-off-text-when-printing-to-pdf/
- https://www.fitforpdf.com/excel-to-pdf-columns-cut-off
- https://imageonline.io/social-media-resizer/
- https://mixpost.app/tools/social-media-image-resizer
- https://www.simpleimageresizer.com/resize-image-for-social-media
- https://biteable.com/tools/image-resizer/

### Notes for the next run
1. `PAGE_SEO` now covers **14 slugs**: `wordtoexcel`, `ppttotext`, `compress`,
   `pdfcompress`, `texttoppt`, `imagetoexcel`, `wordtotext`, `pdftomarkdown`,
   `imagetoppt`, `exceltocsv`, `heictojpg`, **`pdftoppt`, `exceltopdf`, `socialresize`**.
   The other 50 tool pages are still thin auto-derived copy (~240–500 words, 4 generic FAQs).
2. **Still no HowTo schema anywhere on the site.** Four runs have now flagged it. All 14
   custom entries have an ordered "How to ..." list in `body.blocks`, which is exactly the
   HowTo shape, and the generator already holds the data. Fourteen pages would pick it up
   the moment it is added. Biggest single site-wide win still on the table.
3. **Possible code fix, not copy (new this run):** `runPdfToPpt` stretches portrait pages
   onto a 16:9 slide. `pptxgenjs` `sizing: { type: 'contain', w: 10, h: 5.63 }` would
   letterbox instead. The page currently documents the stretch honestly; if the code is
   fixed, that FAQ and the related body line must be rewritten.
4. **Unpushed work in the folder now covers:** word-to-excel, ppt-to-text, compress-image,
   compress-pdf, text-to-ppt, image-to-excel, word-to-text, pdf-to-markdown, image-to-ppt,
   excel-to-csv, heic-to-jpg, **the per-URL lastmod generator change**, and now
   pdf-to-ppt, excel-to-pdf, social-media-image-resize — **unless** Kathir has pushed since
   2026-09-13 23:30 UTC. The 09-13 23:30 entry records that he merged
   `seo/2026-09-13-night` into main at ~23:16 UTC, so the eleven page rewrites are on main;
   the lastmod generator change and this run's three pages are what remain outstanding.

---

## 2026-09-14 · 15:35 UTC (21:05 IST) · SLOT 1 — 9 PM run · group 0
**Pages in scope:** pdf-to-word, image-to-pdf, compress-image
(dayOfYear 257 → runIndex 515 → group 0)

Second run of the day. The 11:42 UTC run took group 4 (pdf-to-ppt, excel-to-pdf,
social-media-image-resize); no overlap, as the 11:42 entry predicted.

### Changes written: 2 new full `PAGE_SEO` entries. compress-image deliberately untouched.

`PAGE_SEO` now covers **16 slugs** (was 14).

**pdf-to-word — new full entry (was 491 words / 0 custom FAQs → 1,725 words / 12 FAQs).**
Ran on fully auto-derived copy: title `PDF to Word Online Free`, h1 `PDF to Word Online`,
description built from the one-line `toolMeta.desc`.
- title → `PDF to Word Converter Online Free | OnlineToolsWeb` (50 ch). The head term is
  *pdf to word converter*; the word "Converter" was missing entirely.
- description → `Free PDF to Word converter. Pull the text out of a PDF into an editable
  .docx file — runs in your browser, so the PDF never leaves your device.` (143 ch).
- h1 → `PDF to Word Converter — Online and Free`.
- **The positioning decision of this run.** Every ranking page on this keyword claims
  formatting fidelity — Smallpdf "keep fonts, formatting, and layouts intact", Adobe
  "your formatting will look as expected", iLovePDF "incredible accuracy". `runPdfToWord`
  does nothing of the kind: `extractPdfTextPages` pulls `page.getTextContent()`, joins the
  items with spaces, and `docx` writes a `Page N` Heading2 plus paragraphs. **Text only.**
  No fonts, colours, columns, images, tables-as-tables, headers or footers. Matching the
  competitors' claim would have been a straight lie, so the page instead states the scope
  outright and argues for it: a predictable plain-text document beats a layout rebuild that
  gets 80% right and leaves you cleaning up floating text boxes. This is also where the
  demand is — "pdf to word formatting messed up" sustains its own content cluster
  (Smallpdf's own blog, compdf, pdfgear, usepdf, toolisthub all have posts on it).
- **The scanned-PDF FAQ is the other must-have.** No OCR exists in the code, so a scan
  produces an empty .docx. The FAQ says so plainly and gives the one-line self-test —
  try to select text in the PDF; if nothing highlights it is a scan — which also runs as
  its own h3. iLovePDF and Xodo both gate OCR behind Premium; being honest that it is
  absent is cheaper than being vague.
- Routing rather than over-claiming: tables → `/pdf-to-excel`, images → `/pdf-to-jpg`,
  plain text → `/pdf-to-markdown`, locked files → `/unlock-pdf`, oversized files →
  `/split-pdf`. Every link checked against `src/toolSlugs.js`.
- No file-size limit invented — none exists in the code; the FAQ says the ceiling is
  device memory.

**image-to-pdf — new full entry (was 502 words / 0 custom FAQs → 1,692 words / 13 FAQs).**
- **Biggest single defect found on the site so far.** The title was
  `Convert to PDF Online Free` and the h1 `Convert to PDF Online` — derived from
  `toolMeta.label = 'Convert to PDF'`. The words **image**, **JPG**, **photo** and
  **picture** appeared in neither. The page was targeting no keyword at all.
- title → `Image to PDF Converter — JPG to PDF Free | OnlineToolsWeb` (57 ch).
- description → `Free image to PDF converter. Combine JPG, PNG or WebP photos into one PDF
  at full quality, in the order you choose — in your browser, nothing uploaded.` (151 ch).
- h1 → `Image to PDF Converter — JPG, PNG and WebP`.
- **Second find: the blurry-output cluster, and his tool genuinely answers it.**
  "jpg to pdf quality loss / blurry" carries a deep blog cluster (blog.jpgtopdf.com,
  cleanpdf, arysontechnologies, jpgtopdfmobile, pdfasset). The usual cause is the A4
  default — every image scaled down to fit the page. `newImagePdf` sizes the page to
  `pxWidth * PX_TO_PT` by `pxHeight * PX_TO_PT`, i.e. **the image's own dimensions at 1:1**,
  and `drawImageOnPdfPage` draws it at 0,0 at full size. Nothing is resampled. That is a
  real, defensible quality claim and it now has an FAQ and an h3.
- **The honest counterweight, in the same section.** No A4, no Letter, no margin control —
  iLovePDF offers Fit/A4/Letter plus three margin settings and orientation; PDF24 offers
  A0–A6, Letter, Legal, seven margin options and DPI. He has none of that, and a mixed
  batch produces pages of differing sizes. Stated outright, with `/resize-image` as the
  route for anyone who needs a fixed paper size.
- Also documented from the code, nothing invented: multi-file with drag-to-reorder and
  the page-order warning (phones hand files over in odd orders); per-page orientation
  (`isLandscape = pxWidth > pxHeight`, format array swapped, as jsPDF requires); the
  22-file memory warning that already exists in `renderList`; PNG transparency **not**
  preserved, because `addImage` is called with the literal `'JPEG'` format; single file →
  `<name>.pdf`, multiple → `images-combined.pdf`; HEIC not decodable by browsers →
  `/heic-to-jpg` first.
- **File size handled honestly as a consequence, not a flaw.** Keeping every pixel means a
  ten-page PDF of phone photos lands at tens of MB. Said plainly, with both remedies
  (`/compress-pdf` after, `/compress-image` before) and when to use each.

**compress-image — assessed, deliberately left untouched.**
Rewritten 2026-09-12 and it is still the strongest page on the site: 1,890 words, 8 FAQs,
an accurate description of the quality-then-resolution search in `compressToTargetSize`,
a "what it can't do" block, and the Indian government exam sizes table (UPSC / IBPS PO /
SSC) which nothing on the SERP matches. `heroCopy` in `main.js` already targets the
`compress image to 50kb` long-tail through title, description, h1 and intro.
Checked the current SERP for `compress image to 50kb online free` — zamzar, duplichecker,
imresizer, shrinksnaps, jpeg-optimizer, aiease, compressjpeg.online. All are thin
single-purpose pages; none is deeper than his. **No gap found, so nothing was changed.**
Churning this page two days after a substantial rewrite would risk the ranking it may be
building and gain nothing.

`SITE_LASTMOD` was already `2026-09-14` (set by the 11:42 run) — correct for today,
left as is.

### Verification performed (all passed)
- Baseline regeneration from the pre-edit `.mjs` reproduces all three on-device `.html`
  files **byte-for-byte**. Deterministic build confirmed again.
- Baseline build reported `0 changed this build` once the 11 static page sources were
  copied in — the lastmod map loaded correctly and nothing drifted.
- After the edit, exactly **two** of the 64 generated pages differ from baseline:
  `pdf-to-word.html`, `image-to-pdf.html`. No shared page touched, `compress-image.html`
  byte-identical.
- Generator reported `2 changed this build` and named exactly `/image-to-pdf` and
  `/pdf-to-word`.
- `public/sitemap.xml` diff is **two lines**, both `2026-09-10` → `2026-09-14`. Still
  75 URLs. Distribution now 11 × 09-05, 48 × 09-10, 1 × 09-11, 4 × 09-12, 6 × 09-13,
  5 × 09-14.
- `public/robots.txt` byte-identical.
- FAQPage JSON-LD parses as valid JSON on both (12 / 13 questions), and the **visible
  accordion count matches the schema count exactly** on both pages. WebApplication and
  BreadcrumbList also valid.
- Tag balance clean on both (`p`, `h2`, `h3`, `ul`, `ol`, `li`, `strong`, `em`, `a`,
  `div`, `section` all matched).
- No backticks, no `${`, no `undefined`, no placeholder text in output.
- **Every internal `href` checked against `src/toolSlugs.js`** — all resolve. (The
  link checker flags `/favicon.svg`; it is a site asset present in the baseline too.)
- Titles 50 / 57 ch; descriptions 143 / 151 ch — within limits.
- Device mtimes re-checked immediately before committing and unchanged from staging
  (`generate-seo-pages.mjs` 1789386616192) — no concurrent session this run.

### Ranking observed (2026-09-14, 9 PM run)
**onlinetoolsweb.com does not appear for any of the three keyword clusters.** Checked
`pdf to word converter free online`, `image to pdf converter online free jpg to pdf`,
`compress image to 50kb online free`, plus site-scoped
`"onlinetoolsweb.com" pdf to word image to pdf compress image` and
`onlinetoolsweb pdf to word converter browser no upload`. Absent, not low-ranked.
**Five consecutive runs now agree: indexing, not copy, is the binding constraint.**
Search Console coverage status remains the single highest-value thing for Kathir to check.

### Competitive picture (research done this run)
**pdf to word** — tools.pdf24.org (~1,100 words, 1 FAQ, German servers, 1 hour deletion,
"No limits", offers Text-only / Embedded-SVG / Complete modes, no OCR mentioned),
smallpdf.com (~1,100 words, 7 FAQs, TLS, 1 hour deletion, GDPR + ISO 27001, OCR is Pro,
claims fonts/formatting/layouts intact), adobe.com (~2,200 words, 7 FAQs, server-side,
deleted unless signed in, handles scans, "formatting will look as expected"),
ilovepdf.com (~800 words, no FAQ, OCR Premium only, 14 languages), plus foxit, xodo,
wondershare, freeconvert, gonitro, pdffiller.
**The one to watch: pdfedit.com/pdf-to-word** — ~3,200 words, 10 FAQs, and it is a
*client-side* competitor running the same honest playbook ("Everything runs 100% locally
in your browser… we don't have any servers for your files", two modes, an explicit
"What Browser-Based Conversion Can and Can't Preserve" section, and a head-to-head
comparison block against iLovePDF/Adobe/Smallpdf/Nitro). The no-upload angle is **not**
unclaimed on this keyword — mytools.com ranks on it too. His page is now competitive on
depth (1,725 words) but pdfedit is deeper and has the comparison block he lacks.

**image to pdf / jpg to pdf** — ilovepdf.com (~800 words, no FAQ, Fit/A4/Letter, three
margin settings, orientation, merge-all option), smallpdf.com (~1,200 words, 6 FAQs,
JPG/PNG/BMP/GIF/HEIC/WebP/TIFF, size+orientation+margins, TLS, 1 hour deletion),
tools.pdf24.org (~2,200 words, 2 FAQs, A0–A6/Letter/Legal, DPI control, seven margin
options, drag-and-drop ordering, explicitly "done in the cloud on our servers"),
canva.com (~1,800 words, 3 FAQs, PDF Standard vs PDF Print, routes into the Canva editor),
plus pdfgear, jpg2pdf.com, dpdf, freepdfconvert.
**Breadth of page-layout options is table stakes here and he has none** — which is why the
page argues the 1:1 sizing as a deliberate quality choice and names the limitation rather
than hiding it. Several small privacy-first competitors already exist on this keyword
(fastprivatepdf.com, offlinefileconverter.com, fwdtools.com, ddaverse, chromacreator), so
"no upload" differentiates him from the big four but not from the long tail.

**compress image to 50kb** — zamzar, duplichecker, imresizer, shrinksnaps,
jpeg-optimizer (two separate pages), tools.aiease.ai, compressjpeg.online. All thin,
none of the majors present. His existing page is already the deepest thing on this SERP.

*Caveat on the schema findings, same as prior runs: they come from fetched-and-converted
page content, which strips `<script>` blocks, so "no FAQPage schema" is strong but not certain.*

### Sources consulted
- https://tools.pdf24.org/en/pdf-to-word
- https://smallpdf.com/pdf-to-word
- https://www.adobe.com/acrobat/online/pdf-to-word.html
- https://www.ilovepdf.com/pdf_to_word
- https://pdfedit.com/pdf-to-word
- https://smallpdf.com/blog/common-issues-in-pdf-to-word-conversion-and-how-to-fix-them
- https://www.ilovepdf.com/jpg_to_pdf
- https://smallpdf.com/jpg-to-pdf
- https://tools.pdf24.org/en/images-to-pdf
- https://www.canva.com/features/jpg-to-pdf-converter/
- https://blog.jpgtopdf.com/jpg-to-pdf-converting-issues/
- https://cleanpdf.net/jpg-to-pdf-high-quality-guide
- https://fastprivatepdf.com/image-to-pdf-free.html
- https://offlinefileconverter.com/image-to-pdf-offline
- https://www.zamzar.com/tools/compress-jpg-50kb/
- https://jpeg-optimizer.com/compress-image-to-50kb/

### Notes for the next run
1. `PAGE_SEO` now covers **16 slugs**: `wordtoexcel`, `ppttotext`, `compress`,
   `pdfcompress`, `texttoppt`, `imagetoexcel`, `wordtotext`, `pdftomarkdown`,
   `imagetoppt`, `exceltocsv`, `heictojpg`, `pdftoppt`, `exceltopdf`, `socialresize`,
   **`pdftoword`, `pdf`**. The other 48 tool pages are still thin auto-derived copy.
2. **Still no HowTo schema anywhere on the site.** Five runs have flagged it. All 16
   custom entries now carry an ordered "How to …" list in `body.blocks` — exactly the
   HowTo shape, with the data already in the generator. Sixteen pages would pick it up
   the moment it is added. **Biggest single site-wide win still on the table.**
3. **New systemic finding worth a sweep:** `image-to-pdf` was titled `Convert to PDF`
   because `toolMeta.label` is the on-site button label, not a keyword. Other tools may
   have the same mismatch — `pdf` (fixed), `resize` → "Resize Image" is fine, but
   `bgremove` ("Remove Background"), `convertformat` ("Convert Image Format") and
   `rotateflip` ("Rotate / Flip Image") are worth checking against what people search.
   A quick audit of all 64 titles against their head terms would likely find two or three
   more pages aimed at nothing.
4. **Consider a comparison block.** pdfedit.com ranks a head-to-head section against the
   big four on the pdf-to-word keyword. None of his 16 pages has one, and it is the
   natural place for the no-upload argument to land hardest.
5. **Unpushed work in the folder now covers:** word-to-excel, ppt-to-text, compress-image,
   compress-pdf, text-to-ppt, image-to-excel, word-to-text, pdf-to-markdown, image-to-ppt,
   excel-to-csv, heic-to-jpg, the per-URL lastmod generator change, pdf-to-ppt,
   excel-to-pdf, social-media-image-resize, **and now pdf-to-word and image-to-pdf** —
   unless Kathir has pushed since 2026-09-13 23:30 UTC. Per the 09-13 23:30 entry he
   merged `seo/2026-09-13-night` into main at ~23:16 UTC, so the first eleven page
   rewrites are on main; the lastmod generator change, the 11:42 run's three pages and
   this run's two pages are what remain outstanding.
