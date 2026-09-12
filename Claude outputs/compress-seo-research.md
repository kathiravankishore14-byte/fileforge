# SEO research — Compress PDF & Compress Image
OnlineToolsWeb / FileForge · 2026-09-12

---

## 1. The headline finding

**Do not chase "compress pdf" or "compress image".** Those SERPs are owned by Adobe, iLovePDF, Smallpdf and TinyPNG — companies with a decade of domain authority and full-time SEO teams. A new site does not take those terms.

**The niche is won one target size at a time.** Look at who actually ranks for size-specific queries — and note the URL pattern:

| Site | URL |
|---|---|
| bigpdf (11zon) | `/compress-pdf/compress-pdf-to-100kb.php` |
| bigpdf (11zon) | `/compress-pdf/compress-pdf-to-200kb.php` |
| Duplichecker | `/compress-pdf-to-100kb.php` |
| SmallSEOTools | `/compress-pdf-to-100kb/` |
| Pi7 | `/compress-pdf-to-200kb` |
| **Adobe itself** | `/acrobat/online/compress-pdf-200kb.html` |
| PixelBatch | `/compress-to-20kb` |

One dedicated page per target size. When Adobe builds these pages too, the pattern is validated.

**This is the single biggest strategic recommendation in this document:** your generator is already a page factory. Generating `/compress-pdf-to-100kb`, `/compress-image-to-20kb` and so on costs you almost nothing and is exactly how this niche is won. Vite auto-discovers every root `.html`, so the pages build and route with no extra config.

---

## 2. The India exam-form cluster is your biggest opportunity

There is an entire micro-industry of Indian sites serving one job: getting a photo and signature down to the exact KB a government exam portal demands.

Sites competing here: `imresizer.in`, `examphotoresize.in`, `photokb.in`, `examtoolkit.in`, `signatureresize.in`, `kuchhbhi.in`, `tools.indgovtjobs.net`, `cgsarkarinaukri.com`.

**Why this matters:** these are low-authority, often single-purpose sites. Unlike Adobe, they are beatable. The volume of them is itself proof the demand is real and recurring — every exam cycle brings a new wave.

### Real specifications (these are content gold)

| Exam | Photo | Signature |
|---|---|---|
| **UPSC** | JPG, 20–200 KB, plain white background, full face visible | JPG, 20–100 KB, 350–500 px, black ink on white |
| **IBPS PO** | JPG/JPEG, 200 × 230 px, 20–50 KB | JPG/JPEG, 140 × 60 px, 10–20 KB |

UPSC also requires three handwritten signatures stacked vertically on one white sheet, scanned as a single JPG.

A page that *states these numbers accurately* and then lets the user hit them in one click is genuinely more useful than what most of these micro-sites offer. Keep a per-exam table and update it each cycle.

---

## 3. ⚠️ A product gap blocks this opportunity

Your target size options (from `main.js`, both the image and PDF compressors) are:

```
30 KB · 50 KB · 100 KB · 300 KB · 1 MB
```

**There is no 10 KB and no 20 KB option.**

IBPS signature requires 10–20 KB. UPSC's floor is 20 KB. Those are among the highest-volume queries in the cluster — and your tool currently cannot serve them. Ranking for "compress image to 20kb" and then failing the user is worse than not ranking.

Second gap: the compress tool has **no pixel-dimension control**. Exam portals demand exact dimensions (200 × 230, 140 × 60). Resize Image is a separate tool, so an exam user has to find and run two tools and hope the second doesn't push the file back over the limit.

**Recommendation before writing any exam-targeted content:**

1. Add 10 KB and 20 KB to both target-size dropdowns (a one-line change each)
2. Consider a combined "resize + compress to target KB" flow, or an exam-preset mode (pick "IBPS PO signature" → 140×60 px, ≤20 KB, JPG). That preset idea is your differentiator — almost nobody does dimensions and KB together in one step.

Content first, product second is the wrong order here. Fix the dropdown, then publish.

---

## 4. What your tools genuinely do well (write about these)

I read the implementations. These are real, specific claims your competitors cannot copy-paste:

### Image compressor (`fitJpegToTargetSize`)

- Binary search on JPEG quality between 0.05 and 0.92, across six resolution steps (100%, 80%, 60%, 45%, 30%, 15%)
- Tries **highest quality at largest resolution first**, and only reduces resolution when quality alone can't reach the target — so you get the best-looking file that fits, not just a file that fits
- Falls back to the smallest achievable result and *says so honestly* when a target is impossible ("Best possible: 62KB — this image can't quite reach 50KB without losing too much detail")
- **Live estimate before you commit.** The size shown is produced by actually running the real search, not a guess. Almost every competitor makes you upload, wait, and only then discover the result. This is your single best UX differentiator — lead with it.

### PDF compressor (pdf-lib)

- Recompresses embedded JPEGs at decreasing quality; only scales image pixel dimensions if minimum quality still isn't enough
- Strips tool-fingerprint metadata
- Garbage-collects objects nothing references any more — leftovers from previous editors' incremental saves. **This is what lets a text-only PDF shrink at all**, and most compressors don't do it
- **Text and vectors are never touched** — text stays sharp at any compression level. A genuinely strong, honest claim
- Has a verification fallback: if the garbage-collected file doesn't reopen cleanly, it redoes the pass without GC

### Both

- 100% in-browser. For exam forms this is a real argument, not boilerplate: your photo, signature and ID documents never leave your device.

---

## 5. Keyword map

### Compress PDF

| Priority | Keyword | Notes |
|---|---|---|
| — | compress pdf | Skip. Adobe/iLovePDF/Smallpdf own it |
| High | compress pdf to 100kb | Own page |
| High | compress pdf to 200kb | Own page. Adobe targets this |
| High | compress pdf to 50kb | Your current page already aims here |
| Med | compress pdf to 500kb / 1mb | Own pages |
| Med | reduce pdf file size online free | Body copy |
| Med | compress pdf without losing quality | Body copy — your text/vector claim answers this directly |
| Med | compress pdf for email attachment | Body copy, use-case section |
| Low | compress scanned pdf | Body copy — be honest about scans (see §6) |

### Compress Image

| Priority | Keyword | Notes |
|---|---|---|
| — | compress image / image compressor | Skip. TinyPNG et al. |
| **Highest** | compress image to 20kb | Own page. **Needs the 20KB option added first** |
| **Highest** | compress image to 50kb | Your current page aims here |
| High | compress image to 100kb | Own page |
| High | compress photo for exam form / sarkari form | Own page — the India cluster |
| High | resize signature to 10kb / 20kb | **Needs 10KB option + dimension control** |
| Med | compress jpeg online free | Body copy |
| Med | reduce image size in kb | Body copy |
| Med | compress image without losing quality | Body copy |
| Low | compress image for website / page speed | Body copy — a different, more technical audience |

---

## 6. Honesty checks before publishing

**"Compress PDF to 50KB" may over-promise.** A scanned multi-page PDF realistically cannot reach 50 KB at readable quality. The image tool handles this gracefully with its "best possible" message; confirm the PDF tool does the same, and consider whether 100 KB is the more honest default for the PDF page. Ranking for a promise you can't keep produces bounces, and bounces cost you the ranking anyway.

**Say what compression can't do.** The PPT page's "What it does not do" section was the right instinct and works here too: a PDF that is pure text won't shrink much (there's little to squeeze); a photo already at 40 KB won't get meaningfully smaller without visible damage.

---

## 7. Suggested page structure (both pages)

Same shape as Word to Excel and PPT to Text:

1. **H1 + intro** — lead with target size and the live-estimate differentiator
2. **How to compress to an exact size** — numbered steps
3. **What target size should I choose?** — a table of common requirements (exam forms, email limits, web upload caps). This is the section that earns links
4. **How the compression actually works** — the quality/resolution search; text and vectors untouched. Builds trust, targets "without losing quality"
5. **What it can't do** — honest limits
6. **Who uses this** — exam applicants, job seekers, students, people emailing attachments, web developers
7. **Privacy** — nothing uploaded, and why that matters for ID documents
8. **Related tools** — internal links (resize, convert format, merge, split)
9. **FAQ** — 8 questions, mirroring the size-specific long-tails

---

## 8. Recommended order of work

1. Add 10 KB and 20 KB target options to both compressors *(product, small)*
2. Verify what the PDF compressor realistically achieves on a scanned file; adjust the page's default target/title if needed
3. Write the two main pages: `/compress-pdf` and `/compress-image`
4. Generate size-variant pages from the same `PAGE_SEO` system: `compress-pdf-to-100kb`, `compress-pdf-to-200kb`, `compress-image-to-20kb`, `compress-image-to-100kb`
5. Add an exam-preset mode + a dedicated exam-form landing page — the biggest prize, and the most product work

---

## Sources

- Adobe compress-to-200KB page — https://www.adobe.com/in/acrobat/online/compress-pdf-200kb.html
- bigpdf size-specific pages — https://bigpdf.11zon.com/en/compress-pdf/compress-pdf-to-100kb.php
- SmallSEOTools — https://smallseotools.com/compress-pdf-to-100kb/
- Pi7 PDF compressor — https://pdf.pi7.org/compress-pdf-to-200kb
- UPSC photo & signature guidelines — https://vajiramandravi.com/upsc-exam/upsc-photo-and-signature-guidelines/
- IBPS PO photo & signature size — https://guidely.in/blog/ibps-po-photo-and-signature-size-a
- Exam-form compressor competitors — https://pixelbatch.io/compress-to-20kb · https://imresizer.in/ · https://examphotoresize.in/
