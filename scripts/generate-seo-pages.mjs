#!/usr/bin/env node
// ================= DEDICATED TOOL PAGE GENERATOR =================
// Generates one fully static, indexable HTML page per tool (e.g.
// /resize-image.html) from the site's own existing tool data (main.js)
// plus the canonical slug map (src/toolSlugs.js). Also regenerates
// sitemap.xml and robots.txt from the same data, so the URL list,
// internal links, and sitemap can never drift out of sync with the
// actual tool list — add/remove a tool in toolMeta + toolSlugs.js and
// rerun this script.
//
// Run with:  node scripts/generate-seo-pages.mjs
//
// This is a build-time content generator, not a runtime router: each
// output file is a real, complete, self-contained HTML document — no
// server-side rendering or rewrite rules are required to serve it.
import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractMainData } from './extract-main-data.mjs';
import { TOOL_SLUGS } from '../src/toolSlugs.js';
import { popularIllustrationSvg, STEP_ICONS } from './illustrations.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE_ORIGIN = 'https://onlinetoolsweb.com';
// One shared branded social-preview image (1200x630, the standard og:image
// size) for every page — a per-tool image isn't worth the maintenance
// burden this phase, and a single accurate, on-brand image beats a
// missing or generic one everywhere it's shared.
const OG_IMAGE_URL = `${SITE_ORIGIN}/images/social-preview.jpg`;
// <lastmod> value written for every sitemap URL. Bump this by hand when
// page content meaningfully changes — a date that moves on every build
// is noise search engines quickly learn to ignore.
const SITE_LASTMOD = '2026-09-11';

const { toolMeta, categoryNavConfig, pageUrlMap, categoryLabels, categoryIcons, toolIconOverrides } =
  extractMainData(resolve(ROOT, 'src/main.js'));

// ---------- format helpers ----------
const ACCEPT_FORMAT_LABELS = {
  'image/*': 'JPG, PNG, WebP and other common image formats',
  'image/jpeg,image/png,image/webp': 'JPG, PNG and WebP images',
  '.pdf': 'PDF files',
  '.docx': 'Word (.docx) files',
  '.xlsx,.xls,.csv': 'Excel (.xlsx, .xls) and CSV files',
  '.xlsx,.xls': 'Excel (.xlsx, .xls) files',
  '.pptx': 'PowerPoint (.pptx) files',
  '.heic,.heif': 'iPhone HEIC/HEIF photos',
  '.zip': 'ZIP archives',
  '*/*': 'any file type',
};

function acceptLabel(accept) {
  return ACCEPT_FORMAT_LABELS[accept] || null;
}

// ---------- related tools ----------
// Prefer tools from the same CATEGORY_NAV_CONFIG group (tightest
// relevance), then fall back to other tools in the same category,
// excluding the tool itself, capped at 6.
function relatedKeysFor(key, meta) {
  const config = categoryNavConfig[meta.category];
  let ordered = [];
  if (config) {
    const ownGroup = config.groups.find((g) => g.tools.includes(key));
    if (ownGroup) ordered.push(...ownGroup.tools.filter((k) => k !== key));
    ordered.push(...config.top3.filter((k) => k !== key && !ordered.includes(k)));
    config.groups.forEach((g) => {
      g.tools.forEach((k) => { if (k !== key && !ordered.includes(k)) ordered.push(k); });
    });
  }
  // Same-category fallback (covers excel/word/ppt, which have no
  // CATEGORY_NAV_CONFIG entry since they're small flat lists).
  Object.keys(toolMeta).forEach((k) => {
    if (k !== key && toolMeta[k].category === meta.category && !ordered.includes(k)) ordered.push(k);
  });
  // Fallback for a tool that is the only one in its category (e.g.
  // ppttotext is the sole 'ppt' entry), which would otherwise render
  // with no Popular and no Related Tools section at all — leaving the
  // page with zero contextual internal links. A PAGE_SEO entry can name
  // its own related keys by hand to fill that gap.
  if (!ordered.length && PAGE_SEO[key]?.relatedKeys) {
    ordered = PAGE_SEO[key].relatedKeys.filter((k) => k !== key);
  }
  return ordered.filter((k) => toolMeta[k] && !toolMeta[k].comingSoon).slice(0, 6);
}


// ---------- hand-written long-form SEO content ----------
// Per-tool editorial copy for pages we're actively trying to rank. Each
// entry may override the auto-derived title/description/h1/intro, replace
// the generated FAQ list outright, and supply a `body` block rendered as
// an extra <section class="tp-section tp-content"> between "How it works"
// and "Related Tools".
//
// Values here are author-written HTML and are deliberately NOT escaped, so
// inline <strong>, <em> and <a> work. Never put user input in this map.
//
// To add another tool: copy the wordtoexcel entry, change the key to the
// toolMeta key, and rerun `node scripts/generate-seo-pages.mjs`.
const PAGE_SEO = {
  wordtoexcel: {
    title: `Word to Excel Converter Online Free | OnlineToolsWeb`,
    description: `Free Word to Excel converter online. Turn tables in your .docx into a clean .xlsx spreadsheet in seconds — no signup, no upload, works in any browser.`,
    appName: `Word to Excel Converter | OnlineToolsWeb`,
    h1: `Word to Excel Converter — Online and Free`,
    intro: `Convert Word to Excel online free with no signup and no software to install. Drop in a .docx file and this Word to Excel converter pulls every table straight into a downloadable .xlsx spreadsheet — rows, columns and cells intact — so you never have to copy and paste a table by hand again.`,
    faq: [
      {
        q: `Is the Word to Excel converter free to use?`,
        a: `Yes. Converting Word to Excel on OnlineToolsWeb is completely free — no trial period, no credit card and no locked premium export. Optional premium features may be introduced later for advanced workflows like batch processing, but this tool's core functionality stays free.`,
      },
      {
        q: `How do I convert Word to Excel online for free?`,
        a: `Open this page, drop your .docx file into the upload box, check the preview and download the .xlsx file. It's free, there's no signup, and nothing is uploaded to a server.`,
      },
      {
        q: `Can I convert Word to Excel without installing software?`,
        a: `Yes. This Word to Excel converter runs entirely in your web browser, so there is nothing to download, install or update — on Windows, Mac, Android or iPhone.`,
      },
      {
        q: `Is my file safe when I convert Word to Excel?`,
        a: `Yes. Your file is processed entirely on your own device and is never uploaded anywhere, so confidential documents like contracts, invoices and payroll sheets never leave your computer.`,
      },
      {
        q: `Will my formatting be kept when I convert Word to Excel?`,
        a: `Table structure — rows, columns and cell contents — is preserved. Page-level Word styling such as fonts, colours, images, headers and footers isn't carried into the spreadsheet, because Excel stores data in a grid rather than a printed page.`,
      },
      {
        q: `Does the Word to Excel converter work on mobile?`,
        a: `Yes. It works in Chrome, Safari, Firefox and Edge on phones and tablets, the same way it works on a laptop.`,
      },
      {
        q: `Can I convert an old .doc file to Excel?`,
        a: `This tool accepts Word (.docx) files. To convert an older .doc file, open it in Word or Google Docs and save it as .docx first, then bring it back here.`,
      },
      {
        q: `Is there a limit on file size or the number of conversions?`,
        a: `No. Because the conversion happens on your own device, there's no server quota — you can convert as many Word files to Excel as you need.`,
      },
    ],
    body: {
      h2: `Word to Excel converter — free, private and online`,
      blocks: [
        { p: `Searching for a <strong>Word to Excel converter online free</strong> usually means one thing: you have a .docx file with tables in it, and you need that data in a spreadsheet you can actually sort, total and filter. This tool does exactly that job — in your browser, in a few seconds, without an account.` },

        { h3: `How to convert Word to Excel online free` },
        { ol: [
          `<strong>Upload your Word file.</strong> Drag your .docx onto the box above, or tap <em>Browse files</em> to pick it from your device. Nothing is sent to a server — the conversion runs inside your browser.`,
          `<strong>Let the converter read your tables.</strong> The tool scans the document and detects every table in it, keeping each row and column exactly where it was.`,
          `<strong>Check the preview.</strong> You'll see how the spreadsheet will look before you commit, so you can spot a stray header or a merged cell early.`,
          `<strong>Download your Excel file.</strong> Save the finished .xlsx and open it in Microsoft Excel, Google Sheets, LibreOffice Calc or Apple Numbers.`,
        ] },
        { p: `The whole process takes a few seconds, and you can convert Word to Excel as many times as you like — there's no daily limit and no account to create.` },

        { h3: `Why use this free Word to Excel converter` },
        { ul: [
          `<strong>Completely free.</strong> No trial period, no credit card, no locked “premium” export. Convert Word to Excel online free, every time.`,
          `<strong>No signup or email required.</strong> Most Word to Excel converters ask for an email before they hand over the file. This one doesn't.`,
          `<strong>Your file never leaves your device.</strong> The conversion happens locally in your browser, so confidential invoices, payroll sheets, student marks and client data stay private.`,
          `<strong>No watermarks, no file-size games.</strong> The spreadsheet you download is the complete one.`,
          `<strong>Works on any device.</strong> Windows, Mac, Linux, Android and iPhone — if it runs a modern browser, it runs this Word to Excel converter. Nothing to download or install.`,
          `<strong>Instant results.</strong> No upload queue, no waiting for a server to free up.`,
        ] },

        { h3: `What this Word to Excel converter handles` },
        { p: `The tool is built around the job most people actually mean when they search for a way to convert a Word document to Excel: <strong>getting tables out of a .docx and into a spreadsheet</strong>.` },
        { ul: [
          `Every table in the document becomes rows and cells in the .xlsx file`,
          `Column and row order is preserved exactly as it appears in Word`,
          `Numbers land in cells as numbers, so you can total, sort and filter them straight away`,
          `Multiple tables in one document are kept separate and clearly laid out`,
          `Header rows stay at the top where you expect them`,
        ] },
        { p: `Because Word is a page-layout format and Excel is a grid, heavy visual styling — page borders, fonts, colours, images, headers and footers — isn't carried across. You get clean, usable data rather than a picture of your document.` },

        { h3: `Who uses a Word to Excel converter` },
        { ul: [
          `<strong>Students and researchers</strong> moving survey results or data tables out of a report and into a sheet for charts and calculations`,
          `<strong>Teachers</strong> turning a list of marks typed in Word into a gradebook`,
          `<strong>Accountants and small-business owners</strong> pulling line items from invoices, quotes and expense statements`,
          `<strong>HR and admin teams</strong> converting attendance registers, shift rosters and candidate lists`,
          `<strong>Anyone</strong> who was handed a Word file when they really needed a spreadsheet`,
        ] },

        { h3: `Word to Excel converter vs copy and paste` },
        { p: `You <em>can</em> select a table in Word, copy it, and paste it into Excel. It works for one small table. It falls apart when the document has ten tables, when rows are merged, when numbers paste in as text, or when you have twenty documents to get through. A Word to Excel converter does the whole file in one pass and keeps the cell structure consistent — which is why it's usually faster even for a single document.` },

        { h3: `Tips for a cleaner conversion` },
        { ul: [
          `Save your file as <strong>.docx</strong> first. If you have an older .doc file, open it in Word or Google Docs and save it in the newer format.`,
          `Make sure your data is in a <strong>real Word table</strong>, not text lined up with tabs or spaces — real tables convert far more accurately.`,
          `Remove blank rows and stray notes inside tables before converting, so you don't have to clean them up in Excel afterwards.`,
          `If a table spans several pages, keep it as one continuous table rather than splitting it.`,
        ] },

        { h3: `Related spreadsheet and document tools` },
        { p: `Working the other way round or with a different format? You can also <a href="/pdf-to-excel">convert PDF to Excel</a>, <a href="/excel-to-pdf">turn an Excel file into a PDF</a>, <a href="/image-to-excel">pull a table out of a screenshot</a> or <a href="/word-to-pdf">convert Word to PDF</a> — all free and all running in your browser.` },
      ],
    },
  },
  ppttotext: {
    title: `PPT to Text Converter Online Free | OnlineToolsWeb`,
    description: `Free PPT to Text converter. Extract all the text from a PowerPoint (.pptx) into a plain .txt file, slide by slide — no signup, no upload, runs in your browser.`,
    appName: `PPT to Text Converter | OnlineToolsWeb`,
    h1: `PPT to Text Converter — Online and Free`,
    intro: `Pull every word out of a slide deck in seconds. This free PPT to Text converter reads your .pptx file and writes out the text of each slide as a plain .txt file, clearly labelled slide by slide — no signup, no software, and your deck never leaves your device.`,
    relatedKeys: ['texttoppt', 'wordtotext', 'pdftoppt', 'pdftomarkdown', 'imagetoppt', 'wordcounter'],
    faq: [
      {
        q: `Is the PPT to Text converter free to use?`,
        a: `Yes. Extracting text from a PowerPoint on OnlineToolsWeb is completely free, with no trial, no credit card and no signup. Optional premium features may be added later for advanced workflows like batch processing, but this tool's core functionality stays free.`,
      },
      {
        q: `How do I extract text from a PowerPoint online?`,
        a: `Drop your .pptx file into the box on this page. The converter reads each slide in order, pulls out every piece of text on it, and hands you a .txt file to download. The whole thing happens in your browser — nothing is uploaded.`,
      },
      {
        q: `What does the downloaded text file look like?`,
        a: `Plain text, in slide order, with a clear "--- Slide 1 ---", "--- Slide 2 ---" header before each slide's content. That makes it easy to see which words came from which slide, and easy to search, paste or edit afterwards.`,
      },
      {
        q: `Does it extract speaker notes as well?`,
        a: `No. This tool reads the text that appears on the slides themselves — titles, bullet points, text boxes and tables. Speaker notes are stored separately inside a PowerPoint file and are not included in the output.`,
      },
      {
        q: `Can I convert an old .ppt file to text?`,
        a: `This converter accepts the modern .pptx format. If you have an older .ppt file, open it in PowerPoint, Google Slides or LibreOffice Impress and save it as .pptx first, then bring it back here.`,
      },
      {
        q: `Will it read text that is inside an image on a slide?`,
        a: `No. Text baked into a picture or screenshot is part of the image, not the slide's text, so it can't be extracted this way. Only real, editable text on the slide is picked up.`,
      },
      {
        q: `Is my presentation safe when I convert PPT to text?`,
        a: `Yes. Your deck is opened and read entirely on your own device and is never uploaded to a server, so confidential pitch decks, internal reports and unpublished research stay private.`,
      },
      {
        q: `Does the PPT to Text converter work on mobile?`,
        a: `Yes. It runs in Chrome, Safari, Firefox and Edge on phones and tablets exactly as it does on a laptop, with nothing to install.`,
      },
    ],
    body: {
      h2: `PPT to Text converter — pull the words out of any slide deck`,
      blocks: [
        { p: `A slide deck is a terrible place to keep text you actually need to use. You can't search it properly, you can't paste it into a document without dragging in fonts and boxes, and reading fifty slides just to find one sentence is a waste of an afternoon. A <strong>PPT to Text converter</strong> solves that in one step: hand it a .pptx, get back a clean .txt file with every word, in slide order.` },

        { h3: `How to convert PPT to text online free` },
        { ol: [
          `<strong>Add your PowerPoint file.</strong> Drag your .pptx onto the box above, or tap <em>Browse files</em> to choose it. The file is opened in your browser — it is never uploaded.`,
          `<strong>The converter reads each slide in order.</strong> It walks through slide 1, 2, 3 and so on, collecting the text from every title, bullet, text box and table it finds.`,
          `<strong>Download your .txt file.</strong> You get a plain text file you can open in Notepad, TextEdit, Word, Google Docs, or paste anywhere you like.`,
        ] },

        { h3: `What the text file actually looks like` },
        { p: `The output is deliberately simple and readable. Each slide's text is written out under its own header, so you always know where a line came from:` },
        { ul: [
          `<strong>Slide markers.</strong> Every slide starts with a <em>--- Slide 1 ---</em>, <em>--- Slide 2 ---</em> line, so a 60-slide deck stays navigable.`,
          `<strong>Original slide order.</strong> Slides are processed in their real deck order, not the order shapes happen to be stored in the file.`,
          `<strong>All on-slide text.</strong> Titles, bullet points, text boxes and table cells are all collected.`,
          `<strong>Plain .txt, nothing proprietary.</strong> No fonts, no layout, no formatting to strip out later — just the words.`,
        ] },

        { h3: `What people use a PPT to Text converter for` },
        { ul: [
          `<strong>Making notes from lecture slides.</strong> Students turn a term's worth of decks into searchable text they can revise from, summarise or print.`,
          `<strong>Feeding a deck into an AI tool.</strong> ChatGPT, Claude and similar tools work far better with clean text than with a slide file — this is the fastest way to get there.`,
          `<strong>Translation.</strong> Extract the text, translate it, then rebuild the deck — much quicker than editing inside PowerPoint box by box.`,
          `<strong>Word counts and proofreading.</strong> Copy-editors and reviewers want the words in one place, not spread across slides.`,
          `<strong>Repurposing a deck.</strong> Turning a presentation into a blog post, report, script or handout starts with getting the text out.`,
          `<strong>Searching and archiving.</strong> A .txt file is indexable and searchable by your operating system in a way a .pptx really isn't.`,
        ] },

        { h3: `What it does not do` },
        { p: `Being straight about the limits saves you a wasted upload:` },
        { ul: [
          `<strong>Speaker notes are not included.</strong> PowerPoint stores notes separately from the slides, and this tool reads the slides.`,
          `<strong>Text inside images isn't read.</strong> If a slide has a screenshot with words in it, those words are pixels, not text. That needs OCR, not extraction.`,
          `<strong>Formatting is not preserved.</strong> That's the point — you're asking for plain text. Bold, colours, fonts and positions are all dropped.`,
          `<strong>.ppt (the old format) isn't accepted.</strong> Save it as .pptx first in PowerPoint, Google Slides or LibreOffice Impress.`,
        ] },

        { h3: `Why use this converter instead of copying slides by hand` },
        { p: `Selecting every text box across forty slides and pasting them one at a time is the kind of task that takes twenty minutes and produces mistakes — skipped boxes, lost ordering, stray formatting pasted along with the words. A converter does the full deck in one pass and keeps the slide order intact. It is also the only sane option when you have several decks to get through.` },

        { h3: `Free, private and browser-based` },
        { ul: [
          `<strong>No signup or email.</strong> Most PPT to Text converters want an address before they hand over your file. This one doesn't.`,
          `<strong>Nothing is uploaded.</strong> The conversion runs locally in your browser, which matters when the deck is an unreleased pitch, a client report or unpublished research.`,
          `<strong>No file limits or watermarks.</strong> Convert as many decks as you need.`,
          `<strong>Works anywhere.</strong> Windows, Mac, Linux, Android and iPhone — any modern browser, nothing to install.`,
        ] },

        { h3: `Related presentation and text tools` },
        { p: `Going the other way or working with a different format? You can also <a href="/text-to-ppt">turn plain text into slides</a>, <a href="/pdf-to-ppt">convert a PDF into a PowerPoint</a>, <a href="/word-to-text">extract plain text from a Word document</a>, <a href="/pdf-to-markdown">convert a PDF to Markdown</a> or <a href="/word-counter">count the words</a> once you have your text — all free and all running in your browser.` },
      ],
    },
  },
  // Compress Image — title/h1/intro deliberately NOT overridden here: the
  // existing heroCopy in main.js already targets "compress image to 50kb"
  // and there's no reason to churn a working long-tail target. This entry
  // adds the body copy and the size-specific FAQ set only.
  compress: {
    relatedKeys: ['resize', 'convertformat', 'crop', 'pdf', 'socialresize', 'heictojpg'],
    faq: [
      {
        q: `How do I compress an image to an exact KB size?`,
        a: `Drop your photo into the box above and pick a target from the list — 30KB, 50KB, 100KB, 300KB or 1MB. Before you commit to anything you'll see a live estimate of the size you'd actually get, then press Compress and download the result.`,
      },
      {
        q: `Is the image compressor free?`,
        a: `Yes, completely — no signup, no email, no watermark and no limit on how many images you compress. Optional premium features may be added later for advanced workflows like batch processing, but this tool's core functionality stays free.`,
      },
      {
        q: `Will compressing ruin the quality of my photo?`,
        a: `The tool works hard to avoid that. It searches for the highest JPEG quality that still fits inside your target size, and only reduces the pixel dimensions if quality alone can't get there. You get the best-looking file that fits, not just any file that fits.`,
      },
      {
        q: `What size should I compress my image to?`,
        a: `It depends where it's going. Online forms and ID photo uploads usually ask for 50KB or 100KB. Email attachments are comfortable at 300KB. For a website, aim at 100–300KB so pages stay fast. If a form states a maximum, pick the option at or just under it.`,
      },
      {
        q: `What if my image can't reach the size I picked?`,
        a: `You'll be told, plainly. Instead of silently handing you a blurry file, the tool reports the smallest size it could reach — for example "Best possible: 62KB" — so you can decide whether to accept it or choose a larger target.`,
      },
      {
        q: `What format is the compressed image?`,
        a: `A JPEG. JPEG is what makes big size reductions possible, and it's the format most forms and portals ask for. If you need PNG or WebP instead, use the Convert Image Format tool after compressing.`,
      },
      {
        q: `Are my photos uploaded to a server?`,
        a: `No. The compression runs entirely inside your browser using your own device's processing power. Your photo is never uploaded, which matters when it's an ID photo, a passport photo or anything personal.`,
      },
      {
        q: `Does the image compressor work on a phone?`,
        a: `Yes. It runs in Chrome, Safari, Firefox and Edge on Android and iPhone just as it does on a laptop, with nothing to install.`,
      },
    ],
    body: {
      h2: `Compress an image to an exact file size, free`,
      blocks: [
        { p: `Most image compressors give you a vague "low / medium / high" slider and leave you guessing. That's useless when a form refuses anything over 50KB. This tool works the other way round: <strong>you name the file size you need, and it finds the best quality that fits</strong>.` },

        { h3: `How to compress an image to a target size` },
        { ol: [
          `<strong>Add your image.</strong> Drag a JPG, PNG or WebP onto the box above, or tap <em>Browse files</em>.`,
          `<strong>Pick your target size.</strong> Choose 30KB, 50KB, 100KB, 300KB or 1MB. 50KB is the default because it's the most commonly requested limit for form and ID uploads.`,
          `<strong>Check the live estimate.</strong> Before you commit, the page shows the size you would actually get and how much smaller that is — so there are no surprises after the fact.`,
          `<strong>Compress and download.</strong> Your file is ready in seconds.`,
        ] },

        { h3: `See the result before you commit` },
        { p: `This is the part most compressors get wrong. Elsewhere you upload the file, wait, and only then find out whether the result is usable. Here the estimate shown under the dropdown is produced by <strong>actually running the real compression search</strong> — it is the true achievable size, not a guess. Change the target and the estimate updates. You only press Compress once you already know what you're getting.` },

        { h3: `What target size should I choose?` },
        { ul: [
          `<strong>Online forms and ID photo uploads</strong> — usually 50KB or 100KB. Check the form's stated maximum and pick the option at or just below it.`,
          `<strong>Email attachments</strong> — 300KB is comfortable and keeps several photos well under any mailbox limit.`,
          `<strong>Website and blog images</strong> — 100KB to 300KB. Large images are one of the most common causes of slow pages.`,
          `<strong>Messaging and social uploads</strong> — 300KB or 1MB, since these platforms recompress anyway.`,
          `<strong>Absolute smallest</strong> — 30KB, when a strict limit matters more than fine detail.`,
        ] },

        { h3: `How the compression actually works` },
        { p: `The tool searches rather than guesses. It starts at near-maximum JPEG quality and full resolution, and checks whether that already fits your target — if it does, you keep every pixel. If not, it narrows in on the highest quality that fits. Only when even the lowest usable quality is still too big does it begin reducing the image's actual dimensions, stepping down through 80%, 60%, 45%, 30% and 15% of the original size.` },
        { p: `The order matters: quality is sacrificed before resolution, and resolution is only touched as a last resort. That's why the output tends to look noticeably better than a tool that simply crushes everything to a fixed quality setting.` },

        { h3: `What it can't do` },
        { ul: [
          `<strong>It can't beat physics.</strong> A large, detailed photograph cannot become 30KB and still look good. When a target is unreachable the tool says so and gives you the smallest file it could produce, rather than pretending.`,
          `<strong>It won't shrink an already-small image.</strong> If your file is already under the target it's handed back untouched — recompressing would cost quality for no benefit.`,
          `<strong>It doesn't set exact pixel dimensions.</strong> If you need a specific width and height, use the Resize Image tool.`,
          `<strong>The output is always JPEG.</strong> Transparency in a PNG will be lost, since JPEG has no transparent background.`,
        ] },

        { h3: `Who uses an image compressor` },
        { ul: [
          `<strong>Anyone filling in an online application</strong> where the photo upload is capped at a fixed size`,
          `<strong>Job seekers and students</strong> attaching photos and documents to portals that reject anything larger`,
          `<strong>People emailing photos</strong> that bounce back as too large`,
          `<strong>Website owners and bloggers</strong> whose pages load slowly because of oversized images`,
          `<strong>Anyone sending holiday photos</strong> over a slow or metered connection`,
        ] },

        { h3: `Private by design` },
        { p: `Your image is compressed inside your own browser, on your own device. It is never uploaded to a server, never stored, and never seen by anyone else — which is exactly what you want when the photo is an ID, a passport photo or a personal document. There's no account to create and no email to hand over.` },

        { h3: `Related image tools` },
        { p: `Need something else? You can <a href="/resize-image">resize an image to exact dimensions</a>, <a href="/convert-image-format">convert between JPG, PNG and WebP</a>, <a href="/crop-image">crop a photo</a>, <a href="/image-to-pdf">turn images into a PDF</a> or <a href="/social-media-image-resize">resize for Instagram and YouTube</a> — all free, all in your browser.` },
      ],
    },
  },

  // Compress PDF — as with `compress` above, the existing heroCopy in
  // main.js already targets "compress pdf to 50kb", so only body copy and
  // FAQs are supplied here.
  pdfcompress: {
    relatedKeys: ['pdfmerge', 'pdfsplit', 'pdftoword', 'pdfextract', 'pdftojpg', 'pdfdelete'],
    faq: [
      {
        q: `How do I compress a PDF to a specific size?`,
        a: `Drop your PDF into the box above and choose a target — 30KB, 50KB, 100KB, 300KB or 1MB. The tool recompresses the images inside the file and trims data nothing is using, aiming for the best quality that fits your target, then gives you the file to download.`,
      },
      {
        q: `Is the PDF compressor free?`,
        a: `Yes. Compressing PDFs here is free with no signup, no email and no watermark on the result. Optional premium features may be added later for advanced workflows like batch processing, but this tool's core functionality stays free.`,
      },
      {
        q: `Will compressing blur the text in my PDF?`,
        a: `No. Text and vector graphics are never touched — they're left exactly as they were, so they stay perfectly sharp at any zoom level and remain selectable and searchable. Only the images embedded in the document are recompressed.`,
      },
      {
        q: `Can every PDF be compressed to 50KB?`,
        a: `No, and the tool is honest about it. A long scanned document simply contains too much image data to fit in 50KB at readable quality. In that case you're shown the smallest size it could reach and told why, so you can pick a larger target instead. PDFs that are mostly text usually shrink comfortably.`,
      },
      {
        q: `Why didn't my text-only PDF get much smaller?`,
        a: `There's little to squeeze. Compression works mainly by recompressing images, and a text-only file has none. It can still shrink somewhat — the tool removes leftover objects that previous editors left behind and strips metadata — but don't expect a dramatic reduction.`,
      },
      {
        q: `Does compressing remove pages or change the layout?`,
        a: `No. Every page, its order and its layout stay exactly as they were. Only the data inside the file changes. To remove pages, use the Delete Pages or Extract Pages tools instead.`,
      },
      {
        q: `Is my PDF uploaded to a server?`,
        a: `No. The entire compression happens in your browser on your own device. Your file is never uploaded, which matters for contracts, bank statements, medical records, ID documents and anything else confidential.`,
      },
      {
        q: `Does it work on mobile?`,
        a: `Yes, in Chrome, Safari, Firefox and Edge on phones and tablets, with nothing to install. Very large scanned PDFs will naturally take longer on a phone than on a laptop.`,
      },
    ],
    body: {
      h2: `Compress a PDF to a target file size — free and private`,
      blocks: [
        { p: `Nearly every PDF compressor asks you to pick "low, medium or high" compression and hope. That's no help when a portal rejects anything over 100KB. This tool inverts it: <strong>you choose the file size you need, and it works out how to get there</strong> — without ever touching your text.` },

        { h3: `How to compress a PDF to an exact size` },
        { ol: [
          `<strong>Add your PDF.</strong> Drag the file onto the box above or tap <em>Browse files</em>. It's opened in your browser, not uploaded.`,
          `<strong>Choose your target size.</strong> 30KB, 50KB, 100KB, 300KB or 1MB.`,
          `<strong>Compress.</strong> The tool scans the embedded images, recompresses them, and clears out data nothing references any more.`,
          `<strong>Download.</strong> You're told exactly what happened — the old and new size, the percentage saved, how many images were recompressed, and that your text was left untouched.`,
        ] },

        { h3: `Your text stays sharp` },
        { p: `This is the difference that matters most. Some compressors flatten pages into images, which makes text fuzzy, unselectable and unsearchable — fine for a photo album, disastrous for a contract or a CV. Here, <strong>text and vector graphics are never re-encoded</strong>. They come out exactly as they went in: crisp at any zoom, still selectable, still searchable, still copy-pasteable. Only the photographs and scans inside the document are recompressed.` },

        { h3: `How the compression actually works` },
        { p: `Three things happen to your file:` },
        { ul: [
          `<strong>Embedded images are recompressed.</strong> The tool starts at high quality and steps down only as far as it must to reach your target. If even the lowest quality isn't enough, it then reduces the images' pixel dimensions as a last resort.`,
          `<strong>Unused objects are removed.</strong> PDFs accumulate junk — leftovers from previous editors saving changes incrementally, fragments nothing in the document points to any more. Clearing these out is the main reason a PDF with no images can shrink at all, and most compressors skip it entirely.`,
          `<strong>Tool-fingerprint metadata is stripped.</strong> Small, but it also removes traces of which software touched the file.`,
        ] },
        { p: `Every result is verified before you get it: if the cleaned-up file doesn't reopen perfectly, the tool automatically redoes the pass more conservatively. You never receive a smaller file that won't open.` },

        { h3: `What target size should I choose?` },
        { ul: [
          `<strong>Online forms and portal uploads</strong> — 50KB or 100KB is the usual cap. Pick the option at or just under the stated limit.`,
          `<strong>Email attachments</strong> — 300KB keeps you comfortably within any mailbox limit, even with several files.`,
          `<strong>Scanned documents</strong> — start at 300KB or 1MB. Scans are photographs of pages, so they carry far more data than they look like they should.`,
          `<strong>Mostly-text documents</strong> — 50KB or 100KB is usually easy to hit.`,
        ] },

        { h3: `What it can't do` },
        { ul: [
          `<strong>It can't make a long scanned document tiny.</strong> Fifty scanned pages will not become 50KB and still be readable. You'll be told the smallest size achievable rather than handed something unusable.`,
          `<strong>It won't shrink a file already under your target.</strong> The original is handed straight back — recompressing would cost quality for nothing.`,
          `<strong>Some image formats can't be recompressed further.</strong> If a PDF's images are already in a format the tool can't re-encode, savings will be limited, and the result message says so.`,
          `<strong>It doesn't remove pages.</strong> If the real problem is length, Delete Pages or Split PDF will do more than compression can.`,
        ] },

        { h3: `Who uses a PDF compressor` },
        { ul: [
          `<strong>Applicants uploading documents</strong> to portals with strict file-size limits`,
          `<strong>Job seekers</strong> whose CV or certificate scans are rejected as too large`,
          `<strong>Students</strong> submitting assignments and scanned reports`,
          `<strong>Anyone emailing a document</strong> that bounced back as too big`,
          `<strong>Offices</strong> archiving scanned paperwork without filling the drive`,
        ] },

        { h3: `Private by design` },
        { p: `Your PDF never leaves your computer. Everything — reading the file, recompressing the images, writing the new version — happens inside your browser. Nothing is uploaded, nothing is stored, and there's no account to create. For contracts, bank statements, medical records and ID documents, that's the only sensible way to do it.` },

        { h3: `Related PDF tools` },
        { p: `You can also <a href="/merge-pdf">merge several PDFs into one</a>, <a href="/split-pdf">split a PDF by page range</a>, <a href="/delete-pdf-pages">delete pages</a>, <a href="/extract-pdf-pages">pull specific pages out</a>, <a href="/pdf-to-word">convert a PDF to Word</a> or <a href="/pdf-to-jpg">export pages as images</a> — all free and all running in your browser.` },
      ],
    },
  },
};

// ---------- per-tool SEO content derivation ----------
function deriveSeo(key, meta) {
  const slug = TOOL_SLUGS[key];
  // A tool can override the auto-derived <title>/meta-description via
  // heroCopy.title / heroCopy.metaDescription (see toolMeta in main.js)
  // to target a specific search phrase — used for tools with a known
  // high-intent long-tail query (e.g. a target file-size search) the
  // generic "<Label> Online Free" title wouldn't otherwise capture.
  // meta.label itself is left untouched since it also drives on-site
  // UI (nav, cards, buttons) where that phrasing wouldn't fit.
  // PAGE_SEO (hand-written, highest priority) > heroCopy (main.js) > auto.
  const page = PAGE_SEO[key] || {};
  const title = page.title || meta.heroCopy?.title || `${meta.label} Online Free | OnlineToolsWeb`;
  const privacyClause = meta.usesServer
    ? 'Free, fast AI processing, no signup, nothing stored.'
    : 'Free, private, and runs right in your browser: no upload, no signup.';
  let description = page.description || meta.heroCopy?.metaDescription || `${meta.desc} ${privacyClause}`;
  if (!page.description && description.length > 158) description = meta.usesServer ? `${meta.desc} No signup, nothing stored.` : `${meta.desc} No upload, no signup, runs in your browser.`;
  // A tool can supply its own hand-written hero copy (see toolMeta in
  // main.js) when the generic auto-derived phrasing undersells it —
  // used for Remove Background, which leads with real use cases rather
  // than the generic "drop or select your file" pattern.
  const h1 = page.h1 || meta.heroCopy?.h1 || `${meta.label} Online`;
  // Trimmed to a two-line hero: the tool's own value line, then one short
  // action line. The trust badges just below the hero already carry the
  // "runs in your browser, nothing uploaded" promise, so the intro no
  // longer has to restate it.
  const actionHint = meta.noFile
    ? 'Fill in the details'
    : (meta.multiFile ? 'Drop your files' : 'Drop your file');
  const intro = page.intro || meta.heroCopy?.intro || `${meta.desc} ${actionHint} and get your result in seconds.`;

  const faq = [];
  faq.push({
    q: `Is ${meta.label} free to use?`,
    a: `Yes, core OnlineToolsWeb tools are free to use, including ${meta.label}. Optional premium features may be introduced later for advanced workflows like batch processing or saved presets, but this tool's core functionality stays free.`,
  });
  faq.push({
    q: `Do I need to install anything to use ${meta.label}?`,
    a: `No installation needed. ${meta.label} runs directly in your browser on any modern desktop or mobile browser, just open this page and use it.`,
  });
  if (meta.noFile) {
    faq.push({
      q: `Does ${meta.label} store or send what I enter?`,
      a: `No. ${meta.label} runs entirely in your browser: nothing you type or generate here is uploaded or saved on a server.`,
    });
  } else if (meta.usesServer) {
    faq.push({
      q: `Is my file safe when I use ${meta.label}?`,
      a: `Your photo is sent securely to our server, which uses remove.bg to process the cutout. The photo is auto-deleted from their servers afterward. See our Privacy Policy for the full details. If our server is ever unavailable, ${meta.label} automatically falls back to an AI model that runs right in your browser instead, so nothing leaves your device at all.`,
    });
  } else {
    faq.push({
      q: `Is my file safe when I use ${meta.label}?`,
      a: `Yes. ${meta.label} processes your file entirely on your own device. It's never uploaded anywhere, so no one else ever sees it.`,
    });
  }
  const formatLabel = acceptLabel(meta.accept);
  if (formatLabel) {
    faq.push({
      q: `What file types does ${meta.label} support?`,
      a: `${meta.label} works with ${formatLabel}.`,
    });
  }

  const steps = meta.noFile
    ? [
        `Open ${meta.label} on this page.`,
        'Enter the details or paste your content.',
        'Click the action button: processing happens instantly in your browser.',
        'Copy or download your result.',
      ]
    : [
        `Open ${meta.label} and drop your ${meta.multiFile ? 'files' : 'file'}, or click to browse.`,
        'Adjust the available settings if needed.',
        meta.usesServer
          ? 'Run the tool: your photo is sent to our server for AI processing, with an automatic in-browser fallback if it’s unavailable.'
          : 'Run the tool: everything processes right in your browser, nothing is uploaded.',
        'Download your result, or process another file.',
      ];

  // A PAGE_SEO entry with its own `faq` replaces the generated list
  // outright (rather than appending), so a hand-tuned page controls both
  // the visible accordion and the FAQPage JSON-LD in one place.
  const finalFaq = page.faq && page.faq.length ? page.faq : faq;
  const appName = page.appName || `${meta.label} | OnlineToolsWeb`;
  return { slug, title, description, h1, intro, faq: finalFaq, steps, appName, body: page.body || null };
}

// ---------- HTML building blocks ----------
function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Mirrors renderIconBadge() in src/main.js so related-tools cards match
// the main tool grid exactly: a tool with its own override glyph always
// renders that alone; a genuine cross-format conversion (iconTo !==
// category) renders the two-icon "from → to" badge instead of a single
// generic category icon.
function toolIconBadgeHtml(key, meta) {
  // width/height="40" — a Phase 3 CLS hint mirroring renderIconBadge() in
  // src/main.js. CSS still decides the real rendered size; every icon is
  // square, so a fixed 1:1 hint holds true in every context it's used.
  const override = toolIconOverrides[key];
  if (override) return `<img src="${override}" alt="" width="40" height="40" />`;
  const fromIcon = categoryIcons[meta.category] || '/icons/icon-utilities.svg';
  const toCategory = meta.iconTo;
  if (!toCategory || toCategory === meta.category) return `<img src="${fromIcon}" alt="" width="40" height="40" />`;
  const toIcon = categoryIcons[toCategory] || '/icons/icon-utilities.svg';
  return `<img src="${fromIcon}" alt="" width="40" height="40" /><span class="arrow">→</span><img src="${toIcon}" alt="" width="40" height="40" />`;
}

// Optional row of use-case icons under the hero (e.g. Headshots,
// E-commerce, Marketing) — only rendered when a tool's toolMeta entry
// supplies a `useCases` array. Mirrors the pattern remove.bg and
// similar tools use to frame a single feature around who it's for.
function useCasesHtml(meta) {
  if (!meta.useCases || !meta.useCases.length) return '';
  const items = meta.useCases.map((u) => `
    <div class="tp-usecase">
      <span class="icon icon-${esc(u.icon)} tp-usecase-icon" aria-hidden="true"></span>
      <span class="tp-usecase-label">${esc(u.label)}</span>
    </div>`).join('');
  return `<div class="tp-usecases">${items}</div>`;
}

function relatedToolsHtml(key, meta) {
  const related = relatedKeysFor(key, meta);
  if (!related.length) return '';
  const cards = related.map((rk) => {
    const rMeta = toolMeta[rk];
    const rSlug = TOOL_SLUGS[rk];
    if (!rSlug) return '';
    const catLabel = categoryLabels[rMeta.category] || rMeta.category;
    // Same row-card markup as toolCardHtml() in main.js (icon, category
    // eyebrow, title, description, arrow) — one card system across the
    // whole site, runtime-rendered grids and these statically-generated
    // Related Tools sections alike.
    return `
      <a class="tool-card cat-${rMeta.category}" href="/${rSlug}">
        <div class="tool-icon-badge">${toolIconBadgeHtml(rk, rMeta)}</div>
        <div class="tool-card-body">
          <span class="tool-card-cat">${esc(catLabel)}</span>
          <h3>${esc(rMeta.label)}</h3>
          ${rMeta.desc ? `<p>${esc(rMeta.desc)}</p>` : ''}
        </div>
        <span class="icon icon-arrow-right tool-card-arrow" aria-hidden="true"></span>
      </a>`;
  }).join('');
  return `
    <section class="tp-section tp-related" data-reveal>
      <h2>Related Tools</h2>
      <div class="tool-grid tp-related-grid">${cards}</div>
    </section>`;
}

function faqHtml(faq) {
  // <details>/<summary> — native expand/collapse, full keyboard support,
  // and no ARIA to hand-maintain. The answer text is still plain DOM
  // content either way, so search engines index it exactly as before;
  // only the default-collapsed *presentation* changes.
  const items = faq.map((f) => `
        <details class="faq-item">
          <summary class="faq-question">${esc(f.q)}</summary>
          <p class="faq-answer">${esc(f.a)}</p>
        </details>`).join('');
  return `
    <section class="tp-section faq-section" id="faq" data-reveal>
      <div class="faq-inner">
        <h2>Frequently Asked Questions</h2>
        <div class="faq-list">${items}</div>
      </div>
    </section>`;
}

// Four colorful, gently-animated character icons in a fixed 1-2-3-4 row —
// same everywhere, cycling the site's own category colors so the row
// itself is colorful without needing per-tool tuning.
const STEP_COLORS = ['image', 'excel', 'word', 'pdf'];
function stepsCartoonHtml() {
  const items = STEP_ICONS.map((step, i) => {
    const arrow = i < STEP_ICONS.length - 1 ? `<span class="tp-step-arrow" aria-hidden="true">→</span>` : '';
    return `
        <div class="tp-step" style="--step-color: var(--category-${STEP_COLORS[i]});">
          <div class="tp-step-icon-wrap">
            <span class="tp-step-icon" style="--step-delay: ${(i * 0.15).toFixed(2)}s;">${step.svg}</span>
            <span class="tp-step-num">${i + 1}</span>
          </div>
          <span class="tp-step-label">${esc(step.label)}</span>
        </div>
        ${arrow}`;
  }).join('');
  return `
    <section class="tp-section tp-steps" data-reveal>
      <h2>How it works</h2>
      <div class="tp-steps-row">${items}</div>
    </section>`;
}

// "Popular in {category}" — three other tools from the same category,
// image-left/text-right alternating with the homepage's editorial
// sections, each paired with a cartoon illustration (see
// scripts/illustrations.mjs) instead of a plain icon glyph.
function popularToolsHtml(key, meta) {
  const related = relatedKeysFor(key, meta).slice(0, 3);
  if (!related.length) return '';
  const catLabel = categoryLabels[meta.category] || meta.category;
  const items = related.map((rk, i) => {
    const rMeta = toolMeta[rk];
    const rSlug = TOOL_SLUGS[rk];
    if (!rSlug) return '';
    const reverse = i % 2 === 1 ? ' popular-item-reverse' : '';
    return `
        <a class="popular-item${reverse}" href="/${rSlug}">
          <div class="popular-item-visual cat-${rMeta.category}">
            <div class="popular-item-glow" aria-hidden="true"></div>
            <div class="popular-item-icon">${popularIllustrationSvg(rk, rMeta)}</div>
          </div>
          <div class="popular-item-copy">
            <span class="tool-card-cat">${esc(categoryLabels[rMeta.category] || rMeta.category)}</span>
            <h3>${esc(rMeta.label)}</h3>
            ${rMeta.desc ? `<p>${esc(rMeta.desc)}</p>` : ''}
            <span class="popular-item-cta">Open tool <span class="icon icon-arrow-right" aria-hidden="true"></span></span>
          </div>
        </a>`;
  }).join('');
  return `
    <section class="tp-section tp-popular" data-reveal>
      <h2>Popular in ${esc(catLabel)}</h2>
      <div class="popular-showcase">${items}</div>
    </section>`;
}


// Hand-written long-form copy block for pages that have a PAGE_SEO entry
// with a `body` (see PAGE_SEO above). Rendered between "How it works" and
// "Related Tools" so the editorial copy sits above the link sections but
// below the tool itself — visitors still land straight on the dropzone.
// Content is author-written HTML and is intentionally not escaped.
function seoContentHtml(seo) {
  if (!seo.body || !seo.body.blocks || !seo.body.blocks.length) return '';
  const blocks = seo.body.blocks.map((b) => {
    if (b.h3) return `      <h3>${b.h3}</h3>`;
    if (b.p) return `      <p>${b.p}</p>`;
    if (b.ul) return `      <ul>\n${b.ul.map((li) => `        <li>${li}</li>`).join('\n')}\n      </ul>`;
    if (b.ol) return `      <ol>\n${b.ol.map((li) => `        <li>${li}</li>`).join('\n')}\n      </ol>`;
    return '';
  }).filter(Boolean).join('\n');
  return `
    <section class="tp-section tp-content" data-reveal>
      <h2>${seo.body.h2}</h2>
${blocks}
    </section>`;
}

function jsonLd(key, meta, seo, categoryUrl) {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: categoryLabels[meta.category] || meta.category, item: `${SITE_ORIGIN}${categoryUrl}` },
      { '@type': 'ListItem', position: 3, name: meta.label, item: `${SITE_ORIGIN}/${seo.slug}` },
    ],
  };
  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: seo.appName,
    url: `${SITE_ORIGIN}/${seo.slug}`,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any (runs in browser)',
    description: seo.description,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: seo.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  return [breadcrumb, app, faqPage].map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`).join('\n    ');
}

function dropZoneHtml(key, meta) {
  const needsFile = !meta.noFile && key !== 'pdfcompare';
  if (!needsFile) return '';
  const formatLabel = acceptLabel(meta.accept);
  const acceptAttr = meta.accept && meta.accept !== '*/*' ? ` accept="${esc(meta.accept)}"` : '';
  const noun = meta.multiFile ? 'files' : 'file';
  return `
    <div class="tp-dropzone" id="tpDropZone">
      <input type="file" id="tpFileInput" aria-label="Choose ${esc(noun)} to ${esc(meta.label.toLowerCase())}"${meta.multiFile ? ' multiple' : ''}${acceptAttr} />
      <span class="icon icon-upload tp-dropzone-icon" aria-hidden="true"></span>
      <p class="tp-dropzone-text">
        <span class="drop-text-desktop">Drop your ${noun} here</span>
        <span class="drop-text-mobile">Choose a file</span>
      </p>
      <button type="button" class="tp-dropzone-browse-btn">Browse files</button>
      ${formatLabel ? `<p class="tp-dropzone-formats">Accepts: ${esc(formatLabel)}</p>` : ''}
    </div>`;
}

function buildPage(key) {
  const meta = toolMeta[key];
  const seo = deriveSeo(key, meta);
  if (!seo.slug) return null;
  const categoryUrl = pageUrlMap[meta.category] || '/';
  const canonical = `${SITE_ORIGIN}/${seo.slug}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(seo.title)}</title>
    <meta name="description" content="${esc(seo.description)}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(seo.title)}" />
    <meta property="og:description" content="${esc(seo.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:site_name" content="OnlineToolsWeb" />
    <meta property="og:image" content="${OG_IMAGE_URL}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="OnlineToolsWeb — fast, secure, everyday file tools that run entirely in your browser" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(seo.title)}" />
    <meta name="twitter:description" content="${esc(seo.description)}" />
    <meta name="twitter:image" content="${OG_IMAGE_URL}" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
    ${jsonLd(key, meta, seo, categoryUrl)}
  </head>
  <body class="tool-landing-page" data-tool-landing="${key}">
    <!--HEADER-->

    <!-- Visible breadcrumb nav intentionally removed per request: the
         BreadcrumbList JSON-LD above (jsonLd()) still carries this same
         hierarchy for search engines, so nothing is lost for SEO. -->

    <main id="main-content" tabindex="-1">
    <section class="hero tp-hero">
      <h1>${esc(seo.h1)}</h1>
      <p>${esc(seo.intro)}</p>
      <div class="tp-trust">
        <span class="tp-trust-badge"><span class="icon icon-shield-check" aria-hidden="true"></span> Private processing</span>
        <span class="tp-trust-badge"><span class="icon icon-user-x" aria-hidden="true"></span> No sign-up</span>
        <span class="tp-trust-badge"><span class="icon icon-globe" aria-hidden="true"></span> Works in any browser</span>
      </div>
      ${(meta.noFile || key === 'pdfcompare') ? `<button type="button" class="config-action-btn tp-open-btn" id="tpOpenToolBtn">Open ${esc(meta.label)} →</button>` : ''}
      ${useCasesHtml(meta)}
    </section>

    ${dropZoneHtml(key, meta)}

    <div class="modal-backdrop hidden" id="modalBackdrop">
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-header">
          <h2 id="modalTitle">${esc(meta.label)}</h2>
          <button class="modal-close" id="modalClose" aria-label="Close">✕</button>
        </div>
        <div class="modal-body" id="modalBody"></div>
      </div>
    </div>

    ${popularToolsHtml(key, meta)}
    ${stepsCartoonHtml()}${seoContentHtml(seo)}
    ${relatedToolsHtml(key, meta)}
    ${faqHtml(seo.faq)}
    </main>

    <!--FOOTER-->

    <script type="module" src="/src/bootstrap.js"></script>
  </body>
</html>
`;
}

// ---------- run ----------
const routingMap = [];
let written = 0;
Object.keys(toolMeta).forEach((key) => {
  const html = buildPage(key);
  if (!html) { console.warn(`SKIP (no slug): ${key}`); return; }
  const meta = toolMeta[key];
  const seo = deriveSeo(key, meta);
  const outPath = resolve(ROOT, `${seo.slug}.html`);
  writeFileSync(outPath, html, 'utf-8');
  written++;
  const oldUrl = `${pageUrlMap[meta.category] || '/'}?tool=${key}`;
  routingMap.push({ key, label: meta.label, category: meta.category, slug: seo.slug, oldUrl, title: seo.title, h1: seo.h1, description: seo.description });
});

console.log(`Generated ${written} tool pages.`);

// ---------- sitemap.xml ----------
const staticPages = [
  { loc: '/', priority: '1.0' },
  { loc: '/pdf', priority: '0.8' },
  { loc: '/image', priority: '0.8' },
  { loc: '/excel', priority: '0.8' },
  { loc: '/word', priority: '0.8' },
  { loc: '/ppt', priority: '0.8' },
  { loc: '/other-tools', priority: '0.8' },
];
// Informational pages linked from the site footer. They belong in the
// sitemap — they were previously missing, so they relied entirely on
// crawlers following footer links — but at a low priority, since a
// search result should land on a tool ahead of the terms page.
const infoPages = [
  { loc: '/about', priority: '0.3' },
  { loc: '/contact', priority: '0.3' },
  { loc: '/privacy-policy', priority: '0.3' },
  { loc: '/terms-of-service', priority: '0.3' },
];
const toolPages = routingMap.map((r) => ({ loc: `/${r.slug}`, priority: '0.7' }));
const allPages = [...staticPages, ...toolPages, ...infoPages];
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map((p) => `  <url>\n    <loc>${SITE_ORIGIN}${p.loc}</loc>\n    <lastmod>${SITE_LASTMOD}</lastmod>\n    <priority>${p.priority}</priority>\n  </url>`).join('\n')}
</urlset>
`;
writeFileSync(resolve(ROOT, 'public/sitemap.xml'), sitemapXml, 'utf-8');
console.log(`Wrote sitemap.xml with ${allPages.length} URLs.`);

// ---------- robots.txt ----------
const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
writeFileSync(resolve(ROOT, 'public/robots.txt'), robotsTxt, 'utf-8');
console.log('Wrote robots.txt.');

// ---------- routing/SEO map (for review) ----------
writeFileSync(resolve(ROOT, 'scripts/routing-map.json'), JSON.stringify(routingMap, null, 2), 'utf-8');
console.log('Wrote scripts/routing-map.json (routing + SEO map for review).');
