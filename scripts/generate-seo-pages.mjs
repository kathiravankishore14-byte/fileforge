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
import { createHash } from 'crypto';
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
// The date stamped on pages whose content ACTUALLY CHANGED in this build.
// Bump this by hand to today's date whenever you edit page copy.
//
// It is no longer written to every URL. Each URL now carries its own
// <lastmod>, tracked in scripts/page-lastmod.json: a page keeps the date
// it last genuinely changed, and only picks up this value when its
// content fingerprint moves. A sitemap where all 75 dates advance
// together tells Google nothing, so Google learns to ignore the field —
// which is exactly backwards when three pages have just been rewritten
// and you want those three to stand out.
const SITE_LASTMOD = '2026-09-14';

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
  pdftoword: {
    title: `PDF to Word Converter Online Free | OnlineToolsWeb`,
    description: `Free PDF to Word converter. Pull the text out of a PDF into an editable .docx file — runs in your browser, so the PDF never leaves your device.`,
    appName: `PDF to Word Converter | OnlineToolsWeb`,
    h1: `PDF to Word Converter — Online and Free`,
    intro: `Drop a PDF here and get back an editable Word document in seconds. This free PDF to Word converter reads the text out of every page and writes it into a .docx you can open and edit — no signup, no watermark, and the PDF never leaves your device, because the whole conversion happens inside your browser.`,
    relatedKeys: ['pdftomarkdown', 'pdftoexcel', 'pdftojpg', 'pdftoppt', 'wordtopdf', 'pdfcompress'],
    faq: [
      {
        q: `How do I convert a PDF to Word?`,
        a: `Drop your PDF onto the box at the top of this page, or tap Browse files and pick it. The text is pulled out page by page and a .docx file downloads straight away. There is nothing to set up and nothing to sign in to.`,
      },
      {
        q: `Is the PDF to Word converter free?`,
        a: `Yes — free with no signup, no email, no daily limit and no watermark on the Word file. The conversion runs on your own computer rather than on a server, so there is no hosting cost to recover from you.`,
      },
      {
        q: `Is my PDF uploaded to a server?`,
        a: `No. Your file is read and converted entirely inside your browser, on your own device. Nothing is uploaded, nothing is stored and nothing is deleted an hour later, because nothing was ever sent anywhere. Most converters upload your file and promise to delete it afterwards — here there is nothing to promise.`,
      },
      {
        q: `Does it keep the original formatting and layout?`,
        a: `No, and it is better to say so plainly. This tool extracts the <strong>text</strong> and writes it into a clean Word document with a heading for each page. Fonts, colours, columns, images, tables as tables, headers and footers are not rebuilt. If you need the Word file to look like the PDF, open the PDF directly in Microsoft Word, which attempts a full layout rebuild. If you want the words so you can edit, quote or reuse them, this is faster and gives you a document without the broken text boxes a layout rebuild usually leaves behind.`,
      },
      {
        q: `Can it convert a scanned PDF?`,
        a: `No. A scanned PDF is a photograph of a page — there is no text inside it to extract, only pixels, so you will get an empty or near-empty Word file. Reading text out of a picture needs OCR, which this tool does not do. If your PDF was scanned or photographed, you need an OCR tool instead. A quick way to check: open the PDF and try to select a sentence with your mouse. If nothing highlights, it is a scan.`,
      },
      {
        q: `Will tables come across as tables?`,
        a: `No. Table text is extracted, but it arrives as ordinary text rather than a Word table with rows and cells. If the table is what you actually need, use <a href="/pdf-to-excel">PDF to Excel</a> instead — that tool works out the row and column positions and gives you a real spreadsheet grid.`,
      },
      {
        q: `What about images in the PDF?`,
        a: `Images are not carried into the Word file. Only text is extracted. If you need the pictures, <a href="/pdf-to-jpg">PDF to JPG</a> renders every page as an image you can crop.`,
      },
      {
        q: `Is there a file size limit?`,
        a: `No fixed limit is set. The practical ceiling is your own device's memory, since the whole PDF is held in the browser while it is read. Ordinary documents of a few dozen pages are no trouble. A very large PDF — several hundred pages, or one packed with high-resolution scans — may be slow or may run out of memory, in which case use <a href="/split-pdf">Split PDF</a> to break it up first.`,
      },
      {
        q: `Does the Word file open in Microsoft Word?`,
        a: `Yes. The output is a standard .docx, the same format Word has used since 2007. It opens in Microsoft Word, and also in Google Docs, LibreOffice Writer, Apple Pages and WPS Office.`,
      },
      {
        q: `Can I convert several PDFs at once?`,
        a: `One file at a time. Each conversion is quick and there is no queue or upload to wait through, so a handful is not much work — but there is no batch mode here.`,
      },
      {
        q: `Does it work on a phone?`,
        a: `Yes. It runs in Chrome, Safari, Firefox and Edge on Android and iPhone exactly as it does on a laptop, with nothing to install. Very large PDFs are more likely to strain a phone's memory than a computer's.`,
      },
      {
        q: `Can I convert a password-protected PDF?`,
        a: `Not directly — the text cannot be read while the file is locked. If you know the password, remove it first with <a href="/unlock-pdf">Unlock PDF</a>, then convert the unlocked copy.`,
      },
    ],
    body: {
      h2: `Convert PDF to Word, free and without uploading`,
      blocks: [
        { p: `Most PDF to Word converters send your file to a server, run it through a layout engine and hand back a Word document that <em>looks</em> like the PDF — until you click into it and find the text trapped in dozens of floating boxes. This tool does something narrower and more honest: it takes the text out and gives you a clean, editable Word document. <strong>Nothing is uploaded, because the conversion runs inside your own browser.</strong>` },

        { h3: `How to convert a PDF to Word` },
        { ol: [
          `<strong>Add your PDF.</strong> Drag it onto the box above, or tap <em>Browse files</em> and choose it.`,
          `<strong>Wait a moment.</strong> The page is read one page at a time — you will see the progress as it goes.`,
          `<strong>Download the .docx.</strong> It saves with the same name as your PDF and opens in Word, Google Docs, LibreOffice or Pages.`,
        ] },

        { h3: `What you get, exactly` },
        { p: `Being specific here saves you a wasted download. The Word file contains a <strong>Page 1</strong>, <strong>Page 2</strong> and so on heading for each page of the PDF, with that page's text underneath it. The page headings make it easy to find your way around a long document and easy to delete once you have moved the text where you want it.` },
        { ul: [
          `<strong>What comes across:</strong> all the readable text, in reading order, page by page.`,
          `<strong>What does not:</strong> fonts, type sizes, colours, columns, images, tables as tables, headers, footers and page numbering.`,
        ] },
        { p: `That is a deliberate trade. A layout rebuild that gets 80 percent right often costs more time to clean up than retyping the formatting yourself, and it is where most complaints about PDF to Word conversion come from. Plain text in a plain document is predictable.` },

        { h3: `When this tool is the right one` },
        { ul: [
          `<strong>You need to reuse the words</strong> — quoting a report, moving a policy into a new template, lifting a contract clause.`,
          `<strong>You want to edit content, not appearance</strong> — rewriting a CV, updating last year's document, correcting a typo in something you no longer have the source file for.`,
          `<strong>You are feeding the text somewhere else</strong> — a proposal, an email, a translation tool, a summary.`,
          `<strong>The document is confidential</strong> — a contract, a payslip, a medical letter, an ID document. Nothing leaves your device, so there is no server copy to worry about.`,
        ] },

        { h3: `When to use something else` },
        { ul: [
          `<strong>You need the Word file to look like the PDF.</strong> Open the PDF in Microsoft Word itself — Word will attempt a full layout reconstruction. Expect to tidy up afterwards.`,
          `<strong>Your PDF is a scan or a photo.</strong> There is no text layer to extract. You need OCR, which this tool does not do.`,
          `<strong>You want the tables.</strong> <a href="/pdf-to-excel">PDF to Excel</a> detects the row and column structure and gives you a real grid.`,
          `<strong>You want the pages as pictures.</strong> <a href="/pdf-to-jpg">PDF to JPG</a> renders each page as an image.`,
          `<strong>You want plain text or Markdown.</strong> <a href="/pdf-to-markdown">PDF to Markdown</a> gives you the same text without the Word wrapper.`,
        ] },

        { h3: `How to tell if your PDF will convert` },
        { p: `Open the PDF and try to select a line of text with your mouse or finger. If the text highlights, it has a text layer and this tool will extract it. If nothing highlights and you can only draw a box over the page, the page is an image and you will need OCR. This one check predicts the result better than anything else.` },

        { h3: `Why "no upload" matters here` },
        { p: `PDFs are the format people use for the documents they would least like to hand over: contracts, bank statements, medical letters, tenancy agreements, scanned passports. The usual online converter uploads that file to a company's servers, converts it there, and deletes it after an hour or a day. That is a reasonable arrangement and most of these companies are careful — but it is still a copy of your document on someone else's computer.` },
        { p: `Here the conversion is done by your browser, using your own device's processor. The file is opened locally and the Word document is built locally. There is no upload step, no account, and no retention policy to read, because there is nothing held anywhere to retain.` },

        { h3: `Does it work offline?` },
        { p: `The page has to load first, which needs a connection. Once it has loaded, the conversion itself uses no network at all — you could disconnect and it would still work. That is a useful way to prove to yourself that nothing is being sent.` },

        { h3: `Related PDF tools` },
        { p: `Working with the same file? You can also <a href="/pdf-to-excel">pull tables into Excel</a>, <a href="/pdf-to-markdown">convert a PDF to Markdown</a>, <a href="/pdf-to-jpg">save every page as a JPG</a>, <a href="/pdf-to-ppt">turn pages into slides</a>, <a href="/compress-pdf">compress a PDF</a> or <a href="/merge-pdf">merge several PDFs</a> — all free, all in your browser.` },
      ],
    },
  },

  pdf: {
    title: `Image to PDF Converter — JPG to PDF Free | OnlineToolsWeb`,
    description: `Free image to PDF converter. Combine JPG, PNG or WebP photos into one PDF at full quality, in the order you choose — in your browser, nothing uploaded.`,
    appName: `Image to PDF Converter | OnlineToolsWeb`,
    h1: `Image to PDF Converter — JPG, PNG and WebP`,
    intro: `Turn photos into a PDF without uploading them anywhere. Drop one image or a whole set, drag them into the order you want, and this free image to PDF converter builds a single PDF at the pictures' full original resolution — no signup, no watermark, and nothing ever leaves your device.`,
    relatedKeys: ['compress', 'resize', 'crop', 'imagetoppt', 'convertformat', 'pdfmerge'],
    faq: [
      {
        q: `How do I convert an image to PDF?`,
        a: `Drop your picture onto the box at the top of this page, or tap Browse files. If you add several images you can drag them into the order you want first. Press Convert to PDF and the file downloads immediately.`,
      },
      {
        q: `Can I put several images into one PDF?`,
        a: `Yes. Add as many as you like and they become one PDF with one image per page, in the order shown in the list. Drag a row up or down to change the order before you convert. A single image gives you a one-page PDF named after the file; several give you a multi-page PDF.`,
      },
      {
        q: `Which image formats can I convert?`,
        a: `JPG and JPEG, PNG and WebP all work, along with any other image format your browser can open. If you have an iPhone .heic photo, run it through <a href="/heic-to-jpg">HEIC to JPG</a> first, since most browsers cannot decode HEIC directly.`,
      },
      {
        q: `Will my images lose quality in the PDF?`,
        a: `No resolution is thrown away. Each PDF page is built at the image's own pixel dimensions, so a 4000 x 3000 photo stays a 4000 x 3000 photo — nothing is shrunk down to fit a page size. This is the usual cause of blurry results elsewhere: many converters scale every picture to fit A4, and a large photo squeezed onto A4 and then printed back up looks soft.`,
      },
      {
        q: `Can I choose A4 or Letter page size?`,
        a: `Not here. Every page is sized to match its image exactly, which is why there are no white borders and no cropping. The trade-off is that you cannot force A4, Letter or a fixed margin. If you need standard paper sizes, size the picture first with <a href="/resize-image">Resize Image</a>, or use a tool built around page layout.`,
      },
      {
        q: `Are my photos uploaded to a server?`,
        a: `No. The PDF is assembled inside your browser on your own device, and nothing is sent anywhere. That matters more than it sounds for this particular tool — the images people turn into PDFs are usually ID cards, certificates, bank letters, prescriptions and signed forms.`,
      },
      {
        q: `Is it free, and is there a watermark?`,
        a: `Free, with no signup, no email and no daily limit, and there is no watermark on the PDF. Nothing is added to your pages at all.`,
      },
      {
        q: `What happens to a PNG with a transparent background?`,
        a: `The transparency is not carried into the PDF — images are embedded in the page as JPEG data, which has no transparent background. The picture itself converts fine; just expect the see-through areas to be filled in rather than transparent. If you need transparency preserved, a PDF built from images is the wrong container for it.`,
      },
      {
        q: `Do portrait and landscape photos mix properly?`,
        a: `Yes. Each page takes its own orientation from its own image — a landscape photo produces a landscape page and a portrait one a portrait page, in the same PDF. Nothing is rotated or letterboxed to make them match.`,
      },
      {
        q: `How many images can I add at once?`,
        a: `There is no fixed limit, but every image is held in your device's memory while the PDF is built, so very large batches can get heavy. Past about 22 files the page warns you. If you are combining a hundred photos, do it in a few smaller PDFs and join them with <a href="/merge-pdf">Merge PDF</a>.`,
      },
      {
        q: `My PDF came out very large. How do I shrink it?`,
        a: `That is the cost of keeping full resolution — phone photos are several megabytes each, and a ten-page PDF of them will be tens of megabytes. Run the finished file through <a href="/compress-pdf">Compress PDF</a>, or compress the pictures first with <a href="/compress-image">Compress Image</a> and then convert.`,
      },
      {
        q: `Does it work on a phone?`,
        a: `Yes, in Chrome, Safari, Firefox and Edge on Android and iPhone, with nothing to install. Converting photos straight from your camera roll on the phone itself is one of the most common ways this tool gets used.`,
      },
      {
        q: `Can I scan a document with my camera instead?`,
        a: `Yes — <a href="/scan-to-pdf">Scan to PDF</a> uses your device camera to capture pages one at a time and builds the PDF from those. Use it when the document is on paper in front of you rather than already in your photo library.`,
      },
    ],
    body: {
      h2: `Convert images to PDF, free and without uploading`,
      blocks: [
        { p: `A form wants one PDF and you have five photos. A college portal will not take a JPG. You need to email a certificate and a picture looks careless. Turning images into a PDF is a small job that comes up constantly — and it should not require handing your documents to a website. <strong>This converter runs entirely in your browser, so your pictures never leave your device.</strong>` },

        { h3: `How to convert images to PDF` },
        { ol: [
          `<strong>Add your images.</strong> Drag them onto the box above, or tap <em>Browse files</em> and select several at once.`,
          `<strong>Put them in order.</strong> Drag any row in the list up or down. The order in the list is the page order in the PDF.`,
          `<strong>Convert.</strong> Press the button and the PDF downloads — one image per page, full resolution, no watermark.`,
        ] },

        { h3: `Full resolution, no shrinking to fit` },
        { p: `The most common complaint about image to PDF converters is that the result looks blurry or soft. The usual cause is the page size: the converter defaults to A4, and every picture is scaled down to fit inside it. Do that to a photo and then print or zoom, and the softness shows.` },
        { p: `This tool sizes each page to its image instead. A 4000 x 3000 photo produces a page that <em>is</em> 4000 x 3000 at one-to-one scale. Nothing is resampled, nothing is downscaled, and there are no white margins around the edge because the picture fills the page exactly.` },
        { p: `The honest cost of that choice: you do not get to pick A4, Letter or a margin, and a PDF made from mixed photos will have pages of different sizes. If a form insists on a specific paper size, resize the images to matching dimensions first with <a href="/resize-image">Resize Image</a>, then convert.` },

        { h3: `What people use this for` },
        { ul: [
          `<strong>Application and portal uploads</strong> that accept a PDF but reject a JPG — degree certificates, mark sheets, ID cards, address proof.`,
          `<strong>Turning a set of photographed pages into one document</strong> so it arrives as a single attachment instead of eight.`,
          `<strong>Receipts and expense claims</strong> — a month of photographed receipts as one PDF is far easier to file than a folder of images.`,
          `<strong>Signed forms</strong> photographed after printing and signing, sent back as a proper document.`,
          `<strong>Screenshots</strong> collected into a single readable file for a report or a bug write-up.`,
        ] },

        { h3: `Page order, and why it is worth checking` },
        { p: `Images are converted in the order they appear in the list, and phones do not always hand files over in the order you took them — names like IMG_0451 and IMG_451 sort in ways you would not expect. Drag the rows into the right order before converting. It takes a second and saves rebuilding the PDF.` },

        { h3: `File size: what to expect` },
        { p: `Keeping every pixel means the PDF is as big as the pictures inside it. Modern phone photos are commonly 3 to 8 MB each, so a ten-page PDF can land somewhere between 30 and 80 MB. That is correct behaviour, not a fault — but it is too big for most email limits and many upload forms.` },
        { p: `Two ways to fix it, depending on what you need. Run the finished PDF through <a href="/compress-pdf">Compress PDF</a> and pick a target size, which is the quickest route. Or compress the images first with <a href="/compress-image">Compress Image</a> — useful when a form specifies a maximum size per page, and the route to take when the form is strict about it.` },

        { h3: `Nothing is uploaded` },
        { p: `Look at what actually goes through an image to PDF converter: identity documents, certificates, bank letters, prescriptions, signed contracts, photos of children's school forms. Those are the files least suited to being uploaded to a service you found through a search result.` },
        { p: `This tool never uploads them. Your browser reads the images from your device, builds the PDF using your device's own processor, and hands you the file. There is no server involved in the conversion, no account, and no copy held anywhere afterwards. Once the page has loaded you can even disconnect from the internet and it will still work — which is the simplest proof that nothing is being sent.` },

        { h3: `Related image and PDF tools` },
        { p: `You can also <a href="/compress-image">compress an image to a target size</a>, <a href="/resize-image">resize to exact dimensions</a>, <a href="/crop-image">crop a photo</a>, <a href="/heic-to-jpg">convert iPhone HEIC photos to JPG</a>, <a href="/image-to-ppt">put images onto slides</a>, <a href="/merge-pdf">merge PDFs</a> or <a href="/scan-to-pdf">scan pages with your camera</a> — all free, all in your browser.` },
      ],
    },
  },

  pdftoppt: {
    title: `PDF to PPT Converter Online Free | OnlineToolsWeb`,
    description: `Free PDF to PPT converter. Turn every page of a PDF into a PowerPoint slide in your browser — no upload, no signup, the file stays on your device.`,
    appName: `PDF to PPT Converter | OnlineToolsWeb`,
    h1: `PDF to PPT Converter — Online and Free`,
    intro: `Turn a PDF back into a slide deck. Drop in a PDF and every page becomes a slide in a .pptx you can open in PowerPoint, Google Slides or Keynote — no signup, nothing to install, and the file never leaves your device.`,
    relatedKeys: ['pdftojpg', 'pdftoword', 'ppttotext', 'imagetoppt', 'texttoppt', 'pdfextract'],
    faq: [
      {
        q: `Is the PDF to PPT converter free?`,
        a: `Yes. Converting a PDF to PowerPoint here is free with no signup, no trial and no daily cap. Nothing is held back for a paid tier, because the conversion runs on your own machine rather than on a server someone has to pay for.`,
      },
      {
        q: `How do I convert a PDF to PowerPoint online?`,
        a: `Drop your PDF onto the box on this page, or tap Browse files. Each page is rendered and added as a slide, and the .pptx downloads when it is done. There is no upload wait and no queue.`,
      },
      {
        q: `Will the text on the slides be editable?`,
        a: `No, and this is the one thing worth knowing before you start. Each slide holds a picture of the PDF page, so you cannot click into a heading and retype it. In exchange, nothing moves: the layout, fonts and spacing arrive exactly as they look in the PDF, which is the part that usually breaks in converters that try to rebuild editable text. If you need the words back, <a href="/pdf-to-word">convert the PDF to Word</a> and paste them in.`,
      },
      {
        q: `Is my PDF uploaded to a server?`,
        a: `No. Your browser opens the PDF, draws each page and builds the .pptx on your own device. Nothing is sent anywhere, so there is no server copy sitting behind a one-hour deletion timer. For a board pack, a client proposal or anything under an NDA, that is the difference that matters.`,
      },
      {
        q: `What slide size do I get?`,
        a: `Standard 16:9 widescreen, the default in PowerPoint and Google Slides since 2013. Each page image is placed to fill the whole slide edge to edge, with no border.`,
      },
      {
        q: `My PDF is portrait A4 — how will that look?`,
        a: `Every slide is 16:9 widescreen, so a tall portrait page is fitted to that wider shape and will look horizontally stretched. The tool is at its best on PDFs that started life as a deck. If you have a portrait document and want the pages to keep their proportions, <a href="/pdf-to-jpg">export the pages as JPGs</a> and place them on slides yourself.`,
      },
      {
        q: `Can I choose which pages become slides?`,
        a: `Every page in the PDF becomes a slide. To convert only part of a document, <a href="/extract-pdf-pages">pull out the pages you want</a> or <a href="/split-pdf">split the PDF</a> first, then convert the shorter file.`,
      },
      {
        q: `Is there a file size or page limit?`,
        a: `The tool does not impose one. Because the work happens on your device, the real ceiling is your browser's memory, and a long PDF takes longer because every page has to be drawn. A twenty or thirty page deck is no trouble; a few hundred pages is worth splitting up first.`,
      },
      {
        q: `Will the .pptx open in Google Slides and Keynote?`,
        a: `Yes. It is an ordinary PowerPoint file, so PowerPoint, Google Slides, Keynote, LibreOffice Impress and WPS all open it. You can upload it straight to Google Drive without converting anything again.`,
      },
      {
        q: `Can I convert several PDFs at once?`,
        a: `One PDF at a time. Each conversion starts immediately, though, so there is no queue to wait through — pick the next file and go again.`,
      },
      {
        q: `What about a password-protected PDF?`,
        a: `A PDF that asks for a password before it will open cannot be read, so the conversion will fail. Remove the password first — in your PDF reader, or with the <a href="/unlock-pdf">unlock PDF tool</a> if you already know it — and then convert.`,
      },
      {
        q: `Does it work on a phone?`,
        a: `Yes. It runs in Chrome, Safari, Firefox and Edge on phones and tablets just as it does on a laptop, with nothing to install. A very long PDF will be slower on a phone, because the same page-drawing work has to happen on a smaller processor.`,
      },
    ],
    body: {
      h2: `PDF to PPT converter — every page becomes a slide`,
      blocks: [
        { p: `Someone sends you the PDF of a deck and asks you to present it. Or you need three pages of a report in front of a room. A <strong>PDF to PPT converter</strong> gets you there: each page of the PDF comes across as a slide in a real .pptx file that PowerPoint, Google Slides and Keynote all open.` },

        { h3: `How to convert PDF to PPT online free` },
        { ol: [
          `<strong>Add your PDF.</strong> Drag it onto the box above or tap <em>Browse files</em>. It is read by your own browser and never uploaded.`,
          `<strong>Wait while the slides are built.</strong> Each page is drawn and added in turn, and the counter tells you which page it is on.`,
          `<strong>Download the .pptx.</strong> It is named after your PDF and ready to open or drop into Google Drive.`,
        ] },

        { h3: `What you get, stated plainly` },
        { p: `Most converters on this search promise fully editable slides and then deliver text boxes in the wrong places. This tool does something simpler and says so up front:` },
        { ul: [
          `<strong>One slide per page.</strong> A twelve-page PDF gives you a twelve-slide deck, in order.`,
          `<strong>The layout is exact.</strong> Each slide carries a picture of the page, so fonts, charts, logos and spacing look the way they look in the PDF. Nothing reflows.`,
          `<strong>The text is not editable.</strong> You cannot click into a heading and retype it. That is the trade for the point above.`,
          `<strong>16:9 widescreen slides.</strong> The standard size, filled edge to edge.`,
          `<strong>A genuine .pptx.</strong> Not a renamed PDF — a real PowerPoint file that opens anywhere.`,
        ] },

        { h3: `When picture slides are the right answer` },
        { ul: [
          `<strong>Presenting a deck you only have as a PDF.</strong> The usual case, and the one this handles best — the deck was widescreen to begin with, so it comes back looking right.`,
          `<strong>Dropping pages into a bigger deck.</strong> Convert, then copy the slides you need into your own presentation.`,
          `<strong>Showing a document on a projector.</strong> Slide view and a clicker beat scrolling a PDF in front of a room.`,
          `<strong>Annotating over the top.</strong> Draw arrows, boxes and notes on the slide without touching the original document.`,
          `<strong>Keeping a layout that must not move.</strong> Approved artwork, a signed page, a designed report — a picture cannot reflow.`,
        ] },

        { h3: `When you want something else instead` },
        { p: `If the goal is to rewrite the words rather than show them, <a href="/pdf-to-word">PDF to Word</a> gets you editable text to paste into your slides. If you need the pages as plain images to place by hand, use <a href="/pdf-to-jpg">PDF to JPG</a>. If you only want a few pages, <a href="/extract-pdf-pages">extract those pages</a> first. And to go the other way — a deck you want to read as text — try <a href="/ppt-to-text">PPT to text</a>.` },

        { h3: `Free, private and browser-based` },
        { ul: [
          `<strong>No signup or email.</strong> No account needed to convert your own file.`,
          `<strong>Nothing is uploaded.</strong> The PDF is opened and the slides are built on your machine. There is no server copy at all, so there is nothing to delete later.`,
          `<strong>No watermarks or page caps.</strong> Convert as many PDFs as you need.`,
          `<strong>Works anywhere.</strong> Windows, Mac, Linux, Android and iPhone — any modern browser, nothing to install.`,
        ] },
      ],
    },
  },

  exceltopdf: {
    title: `Excel to PDF Converter Online Free | OnlineToolsWeb`,
    description: `Free Excel to PDF converter. Turn an .xlsx, .xls or .csv sheet into a clean PDF table in your browser — no upload, no signup, no Excel needed.`,
    appName: `Excel to PDF Converter | OnlineToolsWeb`,
    h1: `Excel to PDF Converter — Online and Free`,
    intro: `Turn a spreadsheet into a PDF anyone can open. Drop in an .xlsx, .xls or .csv, check the preview of the first rows, and download a tidy PDF table — no signup, no copy of Excel needed, and the file never leaves your device.`,
    relatedKeys: ['exceltocsv', 'wordtopdf', 'pdftoexcel', 'imagetoexcel', 'wordtoexcel', 'htmltopdf'],
    faq: [
      {
        q: `Is the Excel to PDF converter free?`,
        a: `Yes. Converting a spreadsheet to PDF here is free with no signup, no trial and no daily limit. The conversion runs on your own machine, so there is no server cost to recover behind a paywall.`,
      },
      {
        q: `How do I convert Excel to PDF online?`,
        a: `Drop your .xlsx, .xls or .csv onto the box on this page. The tool shows you the sheet name, how many rows it found and the first five rows, so you can check you have the right file. Press Convert and the PDF downloads.`,
      },
      {
        q: `Will my columns get cut off at the edge of the page?`,
        a: `No. This is the usual complaint about saving a spreadsheet as a PDF from Excel itself, where anything past the print area slides onto a second page or disappears. Here the table is laid out to fit the width of the page, so every column is on the page. Wide text wraps inside its column instead of pushing the table off the edge.`,
      },
      {
        q: `Do I get portrait or landscape?`,
        a: `It is chosen for you from the shape of your data. A sheet with more than eight columns comes out landscape so the columns have room; anything narrower comes out portrait. There is nothing to set.`,
      },
      {
        q: `Does it keep my colours, fonts and cell formatting?`,
        a: `No. What you get is a clean, readable table — your headings in a header row, your values in the rows beneath — not a picture of your worksheet. Cell fills, custom fonts, borders, conditional formatting and merged cells are not carried over. If you need the sheet to look exactly as it does on screen, use Excel's own Save as PDF.`,
      },
      {
        q: `My workbook has several sheets — what happens to them?`,
        a: `The first sheet in the workbook is the one converted. If you need a different sheet, open the workbook in Excel, move that sheet to the front or copy it into a new file, and convert that.`,
      },
      {
        q: `Do formulas come across?`,
        a: `You get the results, not the formulas. A cell holding =SUM(A1:A10) appears in the PDF as the number it works out to, which is what you want in a document meant to be read rather than recalculated.`,
      },
      {
        q: `Does it work without Microsoft Excel installed?`,
        a: `Yes, and that is one of the main reasons to use it. The spreadsheet is read directly in your browser, so you can turn an .xlsx into a PDF on a machine with no Office licence, on a Chromebook, or on a phone.`,
      },
      {
        q: `Can it convert a CSV to PDF as well?`,
        a: `Yes. CSV files are accepted alongside .xlsx and the older .xls, and they are laid out the same way — the first row becomes the header, the rest become the table.`,
      },
      {
        q: `What happens to charts, images and pivot tables?`,
        a: `They are not included. The conversion works from the cell values, so a chart, a floating image or a pivot table has nowhere to go in the output. To put a chart in a PDF, copy it as a picture and use <a href="/image-to-pdf">image to PDF</a>.`,
      },
      {
        q: `What if the table runs over more than one page?`,
        a: `It carries on across as many pages as it needs, and the header row is repeated at the top of each one — so you can still tell what column you are looking at on page four.`,
      },
      {
        q: `Is my spreadsheet uploaded anywhere?`,
        a: `No. The workbook is opened, read and turned into a PDF by your own browser, and nothing is sent to a server. That matters for payroll, customer lists, pricing and anything covered by an NDA — there is no copy on someone else's machine at all.`,
      },
      {
        q: `Is there a file size or row limit?`,
        a: `The tool does not impose one. Because the work happens on your device, the practical ceiling is your browser's memory. Ordinary business sheets, including ones running to thousands of rows, convert without trouble — the PDF simply gets longer.`,
      },
      {
        q: `Does it work on mobile?`,
        a: `Yes. It runs in Chrome, Safari, Firefox and Edge on phones and tablets exactly as it does on a laptop, with nothing to install.`,
      },
    ],
    body: {
      h2: `Excel to PDF converter — turn a sheet into a document anyone can open`,
      blocks: [
        { p: `A spreadsheet is for working in. A PDF is for sending. The moment numbers have to go to a client, a landlord, a committee or a customer, the .xlsx is the wrong object to hand over — it can be edited by accident, it needs the right software, and it looks different on every screen. An <strong>Excel to PDF converter</strong> turns the sheet into one fixed document that opens the same way everywhere.` },

        { h3: `How to convert Excel to PDF online free` },
        { ol: [
          `<strong>Add your spreadsheet.</strong> Drag an .xlsx, .xls or .csv onto the box above, or tap <em>Browse files</em>. It is read in your browser — never uploaded.`,
          `<strong>Check the preview.</strong> You get the sheet name, the total row count and the first five rows as a table. A few seconds here saves converting last month's file by mistake.`,
          `<strong>Press Convert.</strong> The PDF downloads, named after your spreadsheet.`,
        ] },

        { h3: `The cut-off column problem` },
        { p: `Ask around and the single most common complaint about turning a spreadsheet into a PDF is columns that vanish off the right-hand edge, or a table that breaks across two pages with three columns stranded on the second. That happens because Excel prints to a fixed page and lets whatever does not fit spill over. This tool lays the table out to the width of the page instead: the columns are sized to fit, long text wraps inside its cell, and a sheet with more than eight columns is turned landscape automatically. Nothing falls off the edge.` },

        { h3: `What the PDF contains` },
        { ul: [
          `<strong>Your first row as a header.</strong> Set apart at the top of the table and repeated on every page.`,
          `<strong>Every value from the sheet.</strong> Text, numbers and dates as they appear in the cells.`,
          `<strong>Formula results.</strong> The computed number, not the formula behind it.`,
          `<strong>Automatic orientation.</strong> Portrait for narrow sheets, landscape for wide ones.`,
          `<strong>No cell formatting.</strong> Fills, custom fonts, borders, conditional formatting and merged cells are not carried over.`,
          `<strong>No charts, images or pivot tables.</strong> The conversion works from cell values, so worksheet objects are left out.`,
        ] },

        { h3: `What people convert Excel to PDF for` },
        { ul: [
          `<strong>Sending figures to someone outside the company.</strong> A PDF cannot be edited by accident on the way.`,
          `<strong>Attaching a schedule or price list to an email.</strong> It opens on any phone, with no spreadsheet app involved.`,
          `<strong>Printing.</strong> One predictable layout instead of fighting print settings.`,
          `<strong>Filing a record.</strong> A fixed snapshot of what the numbers said on the day.`,
          `<strong>Handing data to someone with no Office licence.</strong> Every device can open a PDF.`,
          `<strong>Putting a table into a larger report.</strong> Convert the sheet, then <a href="/merge-pdf">merge it with the other pages</a>.`,
        ] },

        { h3: `Free, private and browser-based` },
        { ul: [
          `<strong>No signup or email.</strong> No account needed to convert your own spreadsheet.`,
          `<strong>Nothing is uploaded.</strong> Financial models, salary schedules and customer lists stay on your machine — no server copy, nothing to delete later.`,
          `<strong>No Excel required.</strong> Works on a Chromebook, a borrowed laptop or a phone.`,
          `<strong>No watermarks or daily caps.</strong> Convert as many sheets as you need.`,
        ] },

        { h3: `Related spreadsheet and PDF tools` },
        { p: `You can also <a href="/excel-to-csv">save a sheet as plain CSV</a>, <a href="/pdf-to-excel">pull tables back out of a PDF</a>, <a href="/word-to-excel">get a table out of a Word document</a>, <a href="/image-to-excel">turn a picture of a table into a spreadsheet</a>, <a href="/word-to-pdf">convert a Word file to PDF</a> or <a href="/compress-pdf">shrink a PDF before emailing it</a> — all free and all running in your browser.` },
      ],
    },
  },

  socialresize: {
    title: `Social Media Image Resizer Online Free | OnlineToolsWeb`,
    description: `Free social media image resizer. Crop a photo to Instagram post, Instagram story, YouTube thumbnail or Facebook cover size — in your browser, no upload.`,
    appName: `Social Media Image Resizer | OnlineToolsWeb`,
    h1: `Social Media Image Resizer — Online and Free`,
    intro: `Get a picture to the exact size a platform wants. Drop in a photo, pick Instagram post, Instagram story, YouTube thumbnail or Facebook cover, and download it cropped to those pixels — no signup, no upload, and the photo never leaves your device.`,
    relatedKeys: ['resize', 'crop', 'compress', 'convertformat', 'memecreator', 'collagemaker'],
    faq: [
      {
        q: `Is the social media image resizer free?`,
        a: `Yes. Resizing here is free with no signup, no watermark and no daily limit. The work happens on your own machine, so there is nothing to charge for.`,
      },
      {
        q: `What sizes can I resize to?`,
        a: `Four presets, each the size the platform actually asks for: Instagram post at 1080 x 1080 pixels, Instagram story at 1080 x 1920, YouTube thumbnail at 1280 x 720 and Facebook cover at 820 x 312. Pick one from the dropdown and press Resize.`,
      },
      {
        q: `Does it stretch or squash my photo?`,
        a: `No. The picture is scaled until it covers the target size and then trimmed to fit, so the proportions never change — a face stays a face rather than turning oval. The trade is that some of the edges are cropped away.`,
      },
      {
        q: `Part of my picture got cut off — why?`,
        a: `Because the shape you started with and the shape you asked for are different, and something has to give. The crop is taken from the centre. If the part you care about sits off to one side, <a href="/crop-image">crop the image yourself first</a>, roughly to the right shape, then run it through here.`,
      },
      {
        q: `What if I need a size that is not on the list?`,
        a: `Use <a href="/resize-image">resize image</a> and type any width and height you like — that covers LinkedIn banners, X headers, Pinterest pins, TikTok covers and anything else a platform changes its mind about next month.`,
      },
      {
        q: `Does it change my file format?`,
        a: `No. A PNG comes back as a PNG and a JPG as a JPG. If you want to switch formats, <a href="/convert-image-format">convert the image</a> before or after resizing.`,
      },
      {
        q: `Is my photo uploaded anywhere?`,
        a: `No. The image is loaded, cropped and re-saved by your own browser, and nothing is sent to a server. Nobody else ever holds a copy of the picture — which is worth having for client work, product shots before launch, or photographs of people.`,
      },
      {
        q: `My image is smaller than the size I picked — what happens?`,
        a: `It is scaled up to fill the frame, and it will look softer for it, because the extra pixels have to be invented. Start from the largest version you have. For a YouTube thumbnail at 1280 x 720, anything under about 1280 pixels wide will look noticeably soft on a big screen.`,
      },
      {
        q: `Can I resize several photos at once?`,
        a: `One image at a time. Each resize is instant, though — there is no upload and no queue — so a set of posts goes quickly.`,
      },
      {
        q: `Will Instagram crop my picture again after I upload it?`,
        a: `Not at these sizes. A 1080 x 1080 square and a 1080 x 1920 story are both shapes Instagram accepts as they are, so it has no reason to trim anything. Most re-cropping happens when people upload an odd shape and let the app decide.`,
      },
      {
        q: `Is there a file size limit?`,
        a: `The tool does not impose one. Because the work happens on your device, the practical ceiling is your browser's memory, and ordinary camera and phone photos are nowhere near it.`,
      },
      {
        q: `The file came out larger than the original — can I shrink it?`,
        a: `Yes. Resizing changes the pixel dimensions, not how hard the file is compressed, so a re-saved image can end up bigger. Run it through <a href="/compress-image">compress image</a> afterwards to bring the file size down.`,
      },
      {
        q: `Does it work on a phone?`,
        a: `Yes, and that is often where it makes most sense. It runs in Chrome, Safari, Firefox and Edge on phones and tablets with nothing to install, so you can size a photo for a story on the device that took it.`,
      },
    ],
    body: {
      h2: `Social media image resizer — the right pixels for each platform`,
      blocks: [
        { p: `Every platform wants a different shape, and the one thing they agree on is that they will crop your picture for you if you do not. Usually badly. A <strong>social media image resizer</strong> settles it before you upload: you pick the size the platform asks for, and the picture comes back at exactly those pixels.` },

        { h3: `The four sizes, and what they are for` },
        { ul: [
          `<strong>Instagram post — 1080 x 1080.</strong> The square feed post. Still the safest shape for anything that needs to read well as a thumbnail.`,
          `<strong>Instagram story — 1080 x 1920.</strong> Full-screen vertical, also the right shape for a Reels cover or a WhatsApp status.`,
          `<strong>YouTube thumbnail — 1280 x 720.</strong> The 16:9 frame YouTube shows beside every video title.`,
          `<strong>Facebook cover — 820 x 312.</strong> The wide banner across the top of a page or profile.`,
        ] },

        { h3: `How to resize an image for social media` },
        { ol: [
          `<strong>Add your picture.</strong> Drag a JPG, PNG or WebP onto the box above, or tap <em>Browse files</em>. It is read in your browser — never uploaded.`,
          `<strong>Pick a preset.</strong> Instagram post, Instagram story, YouTube thumbnail or Facebook cover.`,
          `<strong>Press Resize.</strong> The image is scaled to cover the frame, trimmed from the centre, and downloaded at the exact pixel size.`,
        ] },

        { h3: `Crop to fill, not stretch to fit` },
        { p: `There are three ways to force a picture into a different shape, and only one of them looks right. Stretching distorts everything — faces go wide, circles go oval. Adding bars keeps the whole picture but wastes the frame and looks like a mistake on a feed. This tool does the third: it scales the image up until it covers the frame completely, then trims the overhang from the edges, keeping the middle. Proportions stay true and the frame is filled. The cost is the edges, so if your subject is not near the centre, <a href="/crop-image">crop it roughly yourself first</a> and then resize.` },

        { h3: `Getting a sharp result` },
        { ul: [
          `<strong>Start big.</strong> Upscaling invents pixels and softens the picture. Use the original, not a version already shrunk for a chat app.`,
          `<strong>Mind the subject's position.</strong> The crop is centred, so a face or logo at the far edge may be trimmed.`,
          `<strong>Check text.</strong> Small lettering that survives at full size can blur once the picture is scaled down to 820 pixels wide.`,
          `<strong>Compress last.</strong> Resize first, then <a href="/compress-image">compress</a> if the file needs to be smaller — doing it the other way round wastes quality.`,
        ] },

        { h3: `Free, private and browser-based` },
        { ul: [
          `<strong>No signup, no watermark.</strong> Nothing is stamped on your picture and no account is needed.`,
          `<strong>Nothing is uploaded.</strong> Photographs of people, unreleased product shots and client work stay on your device. There is no server copy at all.`,
          `<strong>No daily limit.</strong> Resize as many pictures as you want.`,
          `<strong>Works anywhere.</strong> Windows, Mac, Linux, Android and iPhone — any modern browser, nothing to install.`,
        ] },

        { h3: `Related image tools` },
        { p: `You can also <a href="/resize-image">resize to any custom width and height</a>, <a href="/crop-image">crop by hand</a>, <a href="/compress-image">make a file smaller</a>, <a href="/convert-image-format">switch between JPG, PNG and WebP</a>, <a href="/watermark-image">add a watermark</a> or <a href="/collage-maker">build a collage</a> — all free and all running in your browser.` },
      ],
    },
  },

  imagetoppt: {
    title: `Image to PPT Converter Online Free | OnlineToolsWeb`,
    description: `Free image to PPT converter. Turn JPG or PNG pictures into PowerPoint slides, one image per slide — no signup, and nothing leaves your browser.`,
    appName: `Image to PPT Converter | OnlineToolsWeb`,
    h1: `Image to PPT Converter — Online and Free`,
    intro: `Turn a folder of pictures into a PowerPoint deck. Drop in your JPG or PNG files and this free image to PPT converter puts each one on its own 16:9 slide and hands you a .pptx — no signup, nothing to install, and your photos never leave your device.`,
    relatedKeys: ['pdf', 'texttoppt', 'ppttotext', 'pdftoppt', 'crop', 'collagemaker'],
    faq: [
      {
        q: `Is the image to PPT converter free?`,
        a: `Yes, completely. There is no signup, no trial, no credit card and no slide quota. Many image-to-PowerPoint tools are priced per slide or per month; this one is not, because the conversion runs on your own computer and costs nothing to serve.`,
      },
      {
        q: `How do I turn images into PowerPoint slides?`,
        a: `Drop your pictures onto the box on this page, or tap Browse files and pick several at once. You will see them listed with a running file count and total size. Press Create Slides and a .pptx downloads with one image on each slide.`,
      },
      {
        q: `Can I convert several images at once?`,
        a: `Yes. Select as many pictures as you like and each one becomes its own slide in a single presentation. You can also use the Add files button to bring in more after the first batch.`,
      },
      {
        q: `What slide size does it use?`,
        a: `Standard 16:9 widescreen — 10 by 5.63 inches, which is what PowerPoint, Google Slides and Keynote have used by default for years. Your deck will fill a modern laptop screen or projector without black bars down the sides.`,
      },
      {
        q: `Will my images be stretched?`,
        a: `Each picture is placed edge to edge across the whole slide, so anything that is not already 16:9 is stretched to fit. For photos that matters: a tall phone photo will look wide. If the shape is important, <a href="/crop-image">crop the picture to 16:9</a> first, then bring it here.`,
      },
      {
        q: `Can I edit the text inside the slides afterwards?`,
        a: `No. Your picture is placed on the slide as a picture, so any words in it stay part of the image. This is a converter, not an AI slide rebuilder — it does not read the text off your image and turn it into editable text boxes. If that is what you need, look for a tool that advertises OCR or "editable PPTX" specifically.`,
      },
      {
        q: `Which image formats can I use?`,
        a: `Anything your browser can display: JPG, PNG, WebP, GIF and BMP all work. If you have iPhone photos, run them through the <a href="/heic-to-jpg">HEIC to JPG converter</a> first, since .heic is not a web image format.`,
      },
      {
        q: `Will the file open in Google Slides or Keynote?`,
        a: `Yes. The output is an ordinary .pptx, the same format PowerPoint saves. Google Slides and Keynote both import it, and so do LibreOffice Impress and WPS Office.`,
      },
      {
        q: `What order do the slides come out in?`,
        a: `The same order the files are listed on screen, which is the order they were added. If you want a different sequence, the quickest fix is to reorder the slides in PowerPoint or Google Slides after downloading — dragging one slide is faster than re-picking the files.`,
      },
      {
        q: `Are my images uploaded anywhere?`,
        a: `No. The pictures are read and the .pptx is built by your own browser, and nothing is sent to a server. Screenshots of internal dashboards, product photos before launch, scans of paperwork — none of it travels, so there is no retention policy to take on trust.`,
      },
      {
        q: `Is there a limit on how many images I can add?`,
        a: `The tool does not impose one. Because the deck is built on your device, the ceiling is your own browser's memory — past about twenty files you will see a note that a large batch can use a lot of it. If a very big batch struggles, split it into two decks and merge them in PowerPoint.`,
      },
      {
        q: `Does it work on a phone?`,
        a: `Yes. It runs in Chrome, Safari, Firefox and Edge on Android and iPhone the same way it does on a laptop, with nothing to install.`,
      },
    ],
    body: {
      h2: `Image to PPT converter — put your pictures on PowerPoint slides`,
      blocks: [
        { p: `Building a deck out of photos is tedious work: new slide, insert picture, drag to the corners, stretch to the edges, repeat forty times. An <strong>image to PPT converter</strong> does the repetitive part in one pass — every picture you hand it comes back as its own full-bleed slide in a normal .pptx file you can then edit like any other presentation.` },

        { h3: `How to convert images to PPT online free` },
        { ol: [
          `<strong>Add your pictures.</strong> Drag them onto the box above, or tap <em>Browse files</em> and multi-select. They are read in your browser — nothing is uploaded.`,
          `<strong>Check the list.</strong> Every file appears as a card with the total count and size, so you can see at a glance that nothing is missing. Use <em>Add files</em> to include more.`,
          `<strong>Press Create Slides.</strong> A .pptx downloads with one image per slide, ready to open in PowerPoint, Google Slides or Keynote.`,
        ] },

        { h3: `Two different things get called "image to PPT"` },
        { p: `It is worth knowing which one you are looking for, because the SERP mixes them up and the price tag differs by a lot:` },
        { ul: [
          `<strong>Placing pictures on slides</strong> — what this tool does. The image stays an image. Fast, free, unlimited, and exactly right for photo decks, screenshot walkthroughs, scanned handouts and portfolio reviews.`,
          `<strong>Rebuilding a slide from a screenshot</strong> — what the AI "editable PPTX" services sell. They try to read the text, guess the fonts and hand back editable text boxes. Useful when you have lost the original deck and only have a picture of it, but the output is a reconstruction, and those tools are generally paid and priced per slide.`,
        ] },

        { h3: `What people use it for` },
        { ul: [
          `<strong>Photo decks.</strong> A site visit, an event, a property tour — dozens of pictures, one per slide, in minutes.`,
          `<strong>Screenshot walkthroughs.</strong> Step-by-step software guides and training material, where each screen is a slide and you add your notes afterwards.`,
          `<strong>Scanned handouts.</strong> Turn photographed pages into a deck you can present or share.`,
          `<strong>Design and portfolio review.</strong> Get mockups in front of a room without rebuilding them in PowerPoint.`,
          `<strong>A starting frame.</strong> Some people just want the pictures placed so they can drop captions and arrows on top in PowerPoint.`,
        ] },

        { h3: `Getting the crop right first` },
        { p: `Because every image is stretched across the full 16:9 slide, pictures that are already roughly widescreen look best. Phone photos taken upright are the common problem — they will be pulled sideways. Two ways round it: <a href="/crop-image">crop to 16:9</a> before converting, or accept the stretch for rough-and-ready decks where the picture is a reference rather than the point. If you want several photos on one slide instead, <a href="/collage-maker">build a collage</a> first and convert that single image.` },

        { h3: `Free, private and browser-based` },
        { ul: [
          `<strong>No signup or email.</strong> No account wall between you and your own pictures.`,
          `<strong>Nothing is uploaded.</strong> The .pptx is assembled on your device, which matters when the images are unreleased work, client material or anything from an internal system.`,
          `<strong>No watermarks, no slide caps.</strong> Build as many decks as you like.`,
          `<strong>Works everywhere.</strong> Windows, Mac, Linux, Android and iPhone — any modern browser.`,
        ] },

        { h3: `Related presentation and image tools` },
        { p: `You can also <a href="/image-to-pdf">turn the same pictures into a PDF</a>, <a href="/text-to-ppt">build slides from plain text</a>, <a href="/pdf-to-ppt">convert a PDF into slides</a>, <a href="/ppt-to-text">pull the text out of a PowerPoint</a>, <a href="/crop-image">crop an image</a> or <a href="/collage-maker">make a collage</a> — all free, all in your browser.` },
      ],
    },
  },

  exceltocsv: {
    title: `Excel to CSV Converter Online Free | OnlineToolsWeb`,
    description: `Free Excel to CSV converter. Turn an .xlsx or .xls sheet into a plain .csv in your browser — no upload, no signup, your data stays on your device.`,
    appName: `Excel to CSV Converter | OnlineToolsWeb`,
    h1: `Excel to CSV Converter — Online and Free`,
    intro: `Get a spreadsheet out of Excel and into plain CSV. Drop in an .xlsx or .xls file, check the preview of the first rows, and download a .csv — no signup, nothing to install, and the file never leaves your device.`,
    relatedKeys: ['exceltopdf', 'wordtoexcel', 'imagetoexcel', 'pdftoexcel', 'htmltoexcel', 'jsonformatter'],
    faq: [
      {
        q: `Is the Excel to CSV converter free?`,
        a: `Yes. Converting a spreadsheet to CSV here is free with no signup, no trial and no daily limit. Nothing is held back behind an upgrade, because the conversion runs on your own machine.`,
      },
      {
        q: `How do I convert Excel to CSV online?`,
        a: `Drop your .xlsx or .xls file onto the box on this page. The tool shows you the sheet name, how many rows it found and the first five rows, so you can check you have the right file. Press Convert and the .csv downloads.`,
      },
      {
        q: `My workbook has several sheets — what happens to them?`,
        a: `A CSV file holds exactly one table, so it cannot carry a whole workbook. This tool converts the first sheet in the workbook. If you need another sheet, open the workbook in Excel, move that sheet to the front or copy it into a new file, and convert that.`,
      },
      {
        q: `Do formulas come across?`,
        a: `You get the results, not the formulas. A cell containing =SUM(A1:A10) arrives in the CSV as the number it worked out to. That is how CSV works everywhere — the format has no concept of a formula — and it is usually what you want, since the file is normally headed for an import somewhere.`,
      },
      {
        q: `Does it accept old .xls files as well as .xlsx?`,
        a: `Yes, both. The modern .xlsx format and the older binary .xls from pre-2007 Excel are each read directly, with no need to open and re-save first.`,
      },
      {
        q: `What happens to formatting, colours and charts?`,
        a: `They are dropped. CSV is plain text — just values separated by commas — so cell colours, fonts, borders, merged cells, conditional formatting, charts and images do not survive. If you need the look preserved, <a href="/excel-to-pdf">export the sheet to PDF</a> instead.`,
      },
      {
        q: `Why do accented characters look wrong when I open the CSV in Excel?`,
        a: `That is Excel guessing the encoding, not a fault in the file. The .csv is written as UTF-8, and Excel on Windows often assumes something else when you double-click a CSV. Open Excel first, then use Data, then From Text/CSV, pick the file, and set File Origin to UTF-8. Google Sheets, Numbers and most databases read it correctly without any of this.`,
      },
      {
        q: `What about cells that contain commas or line breaks?`,
        a: `They are quoted properly. A cell holding "Smith, John" is written surrounded by quotation marks so it stays one field, and quotation marks inside a cell are escaped. Anything reading standard CSV will put the columns back exactly as they were.`,
      },
      {
        q: `Is my spreadsheet uploaded anywhere?`,
        a: `No. The workbook is opened and read by your own browser and nothing is sent to a server. That is the difference that matters for payroll, customer lists, patient data or anything under an NDA — there is no copy sitting on someone else's machine waiting for a deletion timer.`,
      },
      {
        q: `Is there a file size limit?`,
        a: `The tool does not impose one. Because the work happens on your device rather than on a server, the practical ceiling is your own browser's memory. Ordinary business spreadsheets, including ones with tens of thousands of rows, are no trouble.`,
      },
      {
        q: `Can I convert several workbooks at once?`,
        a: `Files are converted one at a time. Each conversion is quick, though, because there is no upload wait and no queue — you pick the next file and go.`,
      },
      {
        q: `What can open a CSV file?`,
        a: `Almost everything. Excel, Google Sheets, Numbers, LibreOffice Calc, any text editor, and effectively every database, CRM, accounting package and analytics tool that has an import button. That universality is the whole reason CSV is still the default handover format.`,
      },
      {
        q: `Does it work on mobile?`,
        a: `Yes. It runs in Chrome, Safari, Firefox and Edge on phones and tablets exactly as it does on a laptop, with nothing to install.`,
      },
    ],
    body: {
      h2: `Excel to CSV converter — turn a sheet into plain comma-separated values`,
      blocks: [
        { p: `Sooner or later something asks you for a CSV. An import screen, a database load, a mail-merge, a client's system that will not touch .xlsx. An <strong>Excel to CSV converter</strong> strips the workbook down to the thing those systems actually want: rows of values, separated by commas, in a file any tool written in the last forty years can read.` },

        { h3: `How to convert Excel to CSV online free` },
        { ol: [
          `<strong>Add your spreadsheet.</strong> Drag an .xlsx or .xls onto the box above, or tap <em>Browse files</em>. It is read in your browser — never uploaded.`,
          `<strong>Check the preview.</strong> You get the sheet name, the total row count and the first five rows laid out as a table. Thirty seconds here saves converting the wrong file.`,
          `<strong>Press Convert.</strong> The .csv downloads, named after your original file and ready to import anywhere.`,
        ] },

        { h3: `What CSV keeps, and what it cannot` },
        { p: `CSV is deliberately minimal. Knowing the trade before you convert avoids surprises at the other end:` },
        { ul: [
          `<strong>All the values.</strong> Text, numbers and dates come through as they appear in the sheet.`,
          `<strong>Formula results, not formulas.</strong> The computed value lands in the cell; the formula itself does not exist in CSV.`,
          `<strong>Proper quoting.</strong> Commas, quotation marks and line breaks inside a cell are escaped so columns do not shift.`,
          `<strong>One sheet only.</strong> CSV is a single table by definition — the first sheet in the workbook is the one converted.`,
          `<strong>No formatting.</strong> Colours, fonts, borders, column widths, merged cells and conditional formatting are all dropped.`,
          `<strong>No charts, images or pivot tables.</strong> Those are workbook objects, not data, and have nowhere to go in a text file.`,
        ] },

        { h3: `What people convert Excel to CSV for` },
        { ul: [
          `<strong>Importing into another system.</strong> CRMs, e-commerce platforms, email tools, accounting software and payroll systems almost all take CSV and many take nothing else.`,
          `<strong>Loading into a database.</strong> Every database has a bulk CSV loader; almost none read .xlsx directly.`,
          `<strong>Feeding a script.</strong> Python, R and shell tools read CSV in one line. Parsing a workbook needs a library.`,
          `<strong>Handing data to someone without Excel.</strong> A CSV opens on any machine, with no licence involved.`,
          `<strong>Version control and diffs.</strong> Two CSVs can be compared line by line; two .xlsx files are zip archives and cannot.`,
          `<strong>Archiving.</strong> Plain text will still be readable long after the current spreadsheet formats have moved on.`,
        ] },

        { h3: `The encoding trap, and how to avoid it` },
        { p: `The single most common complaint about any CSV export is names and accents arriving as garbled characters in Excel. The file is almost always fine — UTF-8 is the right encoding and it is what this tool writes — and the problem is that Excel on Windows guesses a legacy encoding when you double-click a .csv. The reliable route is to open Excel first, go to <em>Data</em> then <em>From Text/CSV</em>, choose the file, and set <em>File Origin</em> to UTF-8 in the preview dialog. Google Sheets, Numbers, LibreOffice and virtually every database read UTF-8 correctly with no extra steps.` },

        { h3: `Free, private and browser-based` },
        { ul: [
          `<strong>No signup or email.</strong> No account needed to convert your own spreadsheet.`,
          `<strong>Nothing is uploaded.</strong> Financial models, customer lists and HR data stay on your machine — there is no server copy at all, so nothing to delete later.`,
          `<strong>No row caps or watermarks.</strong> Convert as many workbooks as you need.`,
          `<strong>Works anywhere.</strong> Windows, Mac, Linux, Android and iPhone — any modern browser, nothing to install.`,
        ] },

        { h3: `Related spreadsheet tools` },
        { p: `You can also <a href="/excel-to-pdf">save a sheet as a PDF</a>, <a href="/word-to-excel">pull tables out of a Word document</a>, <a href="/image-to-excel">turn a picture of a table into a spreadsheet</a>, <a href="/pdf-to-excel">get tables out of a PDF</a>, <a href="/html-to-excel">convert an HTML table</a> or <a href="/json-formatter">tidy up JSON</a> — all free and all running in your browser.` },
      ],
    },
  },

  heictojpg: {
    title: `HEIC to JPG Converter Online Free | OnlineToolsWeb`,
    description: `Free HEIC to JPG converter. Turn an iPhone .heic photo into a JPG that opens anywhere — no signup, no upload, and the photo stays on your device.`,
    appName: `HEIC to JPG Converter | OnlineToolsWeb`,
    h1: `HEIC to JPG Converter — Online and Free`,
    intro: `Your iPhone saves photos as .heic and half the world cannot open them. Drop one here and this free HEIC to JPG converter gives you back an ordinary JPG that works everywhere — no signup, nothing to install, and the photo never leaves your device.`,
    relatedKeys: ['convertformat', 'compress', 'resize', 'pdf', 'crop', 'grayscale'],
    faq: [
      {
        q: `Is the HEIC to JPG converter free?`,
        a: `Yes, with no signup, no trial and no daily photo count. There are no watermarks on the JPG either. Converting runs on your own device, so there is no server bill to pass on to you.`,
      },
      {
        q: `How do I convert a HEIC photo to JPG?`,
        a: `Drop the .heic file onto the box on this page, or tap Browse files and pick it. It converts immediately and the JPG downloads with the same name. There is nothing to configure.`,
      },
      {
        q: `Why won't Windows or Android open my iPhone photos?`,
        a: `HEIC is Apple's default photo format since iOS 11. It stores the same picture in about half the space of a JPG, which is why Apple uses it, but support elsewhere is patchy — Windows needs an extra codec from the Microsoft Store, and plenty of websites, email clients and older Android phones simply reject the file. Converting to JPG sidesteps all of that.`,
      },
      {
        q: `Does converting lose image quality?`,
        a: `A little, in the way any JPG does. The photo is saved at 90 percent JPEG quality, which is the usual high-quality setting and is visually hard to tell from the original on screen or in print. The file will usually be larger than the .heic, because JPG is a less efficient format.`,
      },
      {
        q: `Can I convert a whole batch of photos at once?`,
        a: `Photos are converted one at a time here. For a handful that is fine, since each one takes a moment and there is no upload or queue. For hundreds of holiday photos a desktop batch tool will be less clicking.`,
      },
      {
        q: `Does it accept .heif files too?`,
        a: `Yes. Both .heic and .heif are accepted — they are the same underlying format with different extensions, and the tool reads either.`,
      },
      {
        q: `Are my photos uploaded anywhere?`,
        a: `No. The file is decoded and re-saved by your own browser, and nothing is sent to a server. Phone photos are personal by default — family, documents, whiteboards, things photographed at work — and none of it travels here.`,
      },
      {
        q: `Is the date and location information kept?`,
        a: `Do not count on it. The JPG is written fresh from the decoded picture, so EXIF details such as capture date, camera settings and GPS location may not carry across. Keep the original .heic if that information matters to you — and be aware that stripping location is often exactly what people want before sharing a photo.`,
      },
      {
        q: `What happens to a Live Photo?`,
        a: `You get the still frame as a JPG. The short video that makes a Live Photo move is stored by the iPhone as a separate file alongside the .heic, so it is not part of what gets converted here.`,
      },
      {
        q: `How do I get the HEIC files off my iPhone in the first place?`,
        a: `AirDrop to a Mac keeps them as .heic. To a Windows PC, connect by cable and copy from the DCIM folder, or email the photo to yourself and save the attachment. Note that iOS sometimes converts to JPG automatically when transferring — if what lands on your PC is already a .jpg, you are done.`,
      },
      {
        q: `Can I stop my iPhone saving HEIC altogether?`,
        a: `Yes. Go to Settings, then Camera, then Formats, and choose Most Compatible instead of High Efficiency. New photos will be saved as JPG from then on. Photos already in your library stay as .heic, which is what this converter is for.`,
      },
      {
        q: `Does it work on a phone?`,
        a: `Yes. It runs in Chrome, Safari, Firefox and Edge on Android and iPhone the same as on a laptop, with nothing to install.`,
      },
    ],
    body: {
      h2: `HEIC to JPG converter — open iPhone photos anywhere`,
      blocks: [
        { p: `You email a photo from your iPhone and the person at the other end says they cannot open it. You upload one to a form and it is rejected. The culprit is <strong>HEIC</strong>, the format Apple has used by default since iOS 11 — technically better than JPG, supported by far less software. A <strong>HEIC to JPG converter</strong> hands you back the universal version of the same picture.` },

        { h3: `How to convert HEIC to JPG online free` },
        { ol: [
          `<strong>Add your photo.</strong> Drag the .heic or .heif file onto the box above, or tap <em>Browse files</em>. It is read in your browser — never uploaded.`,
          `<strong>Wait a second.</strong> The picture is decoded and re-saved as a JPG on your own device.`,
          `<strong>Download the JPG.</strong> Same filename, .jpg extension, ready for email, uploads, printing or anywhere else.`,
        ] },

        { h3: `Why iPhone photos cause trouble` },
        { ul: [
          `<strong>Windows needs a codec.</strong> Photo viewers on Windows often cannot show a .heic until the HEIF extension is installed from the Microsoft Store.`,
          `<strong>Android support is inconsistent.</strong> Newer phones manage; older ones and many gallery apps do not.`,
          `<strong>Web forms reject it.</strong> Job applications, insurance claims and government portals typically accept JPG and PNG only.`,
          `<strong>Older software has never heard of it.</strong> Print shops, photo kiosks, CMSs and design tools that predate 2017 expect a JPG.`,
          `<strong>Email recipients get stuck.</strong> The photo arrives, but nothing on their machine will open it.`,
        ] },

        { h3: `What you gain and what you give up` },
        { p: `HEIC stores a photo in roughly half the space of an equivalent JPG, so the converted file will usually be bigger. That is the price of universal compatibility, and for a single photo it is nothing. The picture itself is saved at 90 percent JPEG quality — the standard high-quality setting, and not something you will spot by eye. If the resulting file is larger than you want for email or a website, <a href="/compress-image">compress the JPG</a> or <a href="/resize-image">resize it</a> afterwards.` },

        { h3: `Privacy is the part worth thinking about` },
        { p: `Phone photos are personal in a way that other files often are not. A camera roll holds family pictures, documents photographed instead of scanned, whiteboards from work, screenshots of private messages. Most HEIC converters upload your photo to a server and promise to delete it in some number of hours. This one does not upload anything at all — the decode and the JPG encode both happen inside your browser, so there is nothing to delete, nothing logged, and no retention policy to take on faith.` },

        { h3: `Free, private and browser-based` },
        { ul: [
          `<strong>No signup or email.</strong> No account wall in front of your own photos.`,
          `<strong>Nothing is uploaded.</strong> The conversion is local, start to finish.`,
          `<strong>No watermarks or photo caps.</strong> Convert as many as you need, one after another.`,
          `<strong>Works anywhere.</strong> Windows, Mac, Linux, Android and iPhone — any modern browser, nothing to install.`,
        ] },

        { h3: `Related image tools` },
        { p: `Once you have a JPG you can <a href="/compress-image">shrink it for email</a>, <a href="/resize-image">resize it to fit</a>, <a href="/crop-image">crop it</a>, <a href="/convert-image-format">convert it to PNG or WebP</a>, <a href="/image-to-pdf">turn a set of photos into a PDF</a> or <a href="/grayscale-image-converter">make it black and white</a> — all free and all running in your browser.` },
      ],
    },
  },

  wordtotext: {
    title: `Word to Text Converter Online Free | OnlineToolsWeb`,
    description: `Free Word to Text converter. Turn a .docx into a plain .txt file in your browser — no upload, no signup, and your document never leaves your device.`,
    appName: `Word to Text Converter | OnlineToolsWeb`,
    h1: `Word to Text Converter — Online and Free`,
    intro: `Get the words out of a Word document in one step. This free Word to Text converter reads your .docx file and saves its text as a clean .txt file — no signup, no software to install, and your document never leaves your device.`,
    relatedKeys: ['wordtoexcel', 'wordtopdf', 'ppttotext', 'pdftomarkdown', 'wordcounter', 'caseconverter'],
    faq: [
      {
        q: `Is the Word to Text converter free to use?`,
        a: `Yes. Converting a Word document to plain text on OnlineToolsWeb is completely free, with no trial, no credit card and no signup. There are no watermarks and no daily conversion count.`,
      },
      {
        q: `How do I convert a Word document to plain text online?`,
        a: `Drop your .docx file into the box on this page. You get a short preview of the text so you can check you picked the right file, then press Convert and download the .txt. The whole thing happens inside your browser.`,
      },
      {
        q: `Can I see the text before I download it?`,
        a: `Yes. Once the file is loaded, the first few hundred characters are shown on the page. It is a quick sanity check — useful when you have several similarly named drafts and want to be sure which one you are converting.`,
      },
      {
        q: `Which Word formats does it accept?`,
        a: `The modern .docx format, which is what Word, Google Docs and LibreOffice have saved by default for years. If you have an older .doc file, open it and re-save it as .docx first, then bring it back here.`,
      },
      {
        q: `What happens to formatting, images and tables?`,
        a: `Plain text keeps the words and drops everything else. Fonts, sizes, colours, bold, headings and page layout are all removed, and images are not carried over. Text inside a table is read out as lines of text, but the table grid itself is not kept.`,
      },
      {
        q: `Will accented characters and non-English text survive?`,
        a: `Yes. The .txt file is written as UTF-8, so accents, umlauts, Greek, Cyrillic, Indic scripts, CJK characters and symbols come through as they were. Open it in an editor set to UTF-8 and it will look right.`,
      },
      {
        q: `Are headers, footers and comments included?`,
        a: `No. The converter reads the body of the document — paragraphs, lists and table text. Page headers and footers, footnote panes and tracked comments live in separate parts of a .docx file and are not part of the output.`,
      },
      {
        q: `Is my document uploaded anywhere?`,
        a: `No. The file is opened and read by your own browser, and nothing is sent to a server. That matters for contracts, medical letters, HR documents and unpublished manuscripts — there is no copy on someone else's machine to delete later.`,
      },
      {
        q: `Is there a file size limit?`,
        a: `The tool does not impose one. Because the work happens on your device rather than on a server, the practical ceiling is your own browser's memory, and ordinary documents — even long reports with hundreds of pages — are no problem.`,
      },
      {
        q: `Can I convert several Word files at once?`,
        a: `Files are converted one at a time. For a handful of documents that is still quick, since each conversion takes a moment and needs no upload or download wait.`,
      },
      {
        q: `What can I open the .txt file with?`,
        a: `Anything. Notepad on Windows, TextEdit on Mac, any code editor, Word, Google Docs, or a paste straight into an email or a chat box. A .txt file has no proprietary parts, which is exactly why it is a good archive format.`,
      },
      {
        q: `Does the Word to Text converter work on mobile?`,
        a: `Yes. It runs in Chrome, Safari, Firefox and Edge on phones and tablets the same way it does on a laptop, with nothing to install.`,
      },
    ],
    body: {
      h2: `Word to Text converter — turn a .docx into clean plain text`,
      blocks: [
        { p: `A .docx file is a zip archive full of XML: styles, fonts, revision history, relationships between parts. Most of the time you only want the sentences. A <strong>Word to Text converter</strong> throws away the container and hands you the words in a .txt file you can search, diff, paste, script against or archive without worrying about which version of Word opens it.` },

        { h3: `How to convert Word to text online free` },
        { ol: [
          `<strong>Add your Word file.</strong> Drag the .docx onto the box above, or tap <em>Browse files</em> to pick it. The file is read in your browser — it is never uploaded.`,
          `<strong>Check the preview.</strong> The first few hundred characters appear on the page so you can confirm it is the right document.`,
          `<strong>Press Convert and download the .txt.</strong> You get a plain text file, ready to open in any editor or paste anywhere.`,
        ] },

        { h3: `What comes through, and what does not` },
        { p: `Plain text is a deliberate reduction, so it helps to know in advance what you will be looking at:` },
        { ul: [
          `<strong>All the body text.</strong> Paragraphs, headings and list items come through in document order.`,
          `<strong>Table text, without the grid.</strong> The words in each cell are read out; rows and columns are not redrawn.`,
          `<strong>UTF-8 encoding.</strong> Accented and non-Latin characters are preserved rather than mangled into question marks.`,
          `<strong>No formatting.</strong> Bold, italics, fonts, colours, sizes, indents and page breaks are all dropped — that is the point of plain text.`,
          `<strong>No images.</strong> Pictures, charts and shapes are not text and are not carried over.`,
          `<strong>No headers, footers or comments.</strong> Those live in separate parts of the file and stay behind.`,
        ] },

        { h3: `What people use a Word to Text converter for` },
        { ul: [
          `<strong>Pasting into something that hates Word formatting.</strong> A CMS, a ticket, an email client or a code comment — plain text pastes without dragging in fonts and stray styles.`,
          `<strong>Feeding text to an AI tool.</strong> ChatGPT, Claude and similar tools work better with clean text than with a .docx, and converting locally means the document itself never travels.`,
          `<strong>Word counts and proofreading.</strong> One flat file is easier to count, grep and read line by line than a styled document.`,
          `<strong>Version comparison.</strong> Two .txt files can be diffed with any text tool; two .docx files cannot.`,
          `<strong>Scripting and data work.</strong> A .txt input is trivial for Python, shell tools or a spreadsheet import to read.`,
          `<strong>Long-term archiving.</strong> Plain text will still open in thirty years without a licence for anything.`,
        ] },

        { h3: `.doc, .docx and why the old format needs a detour` },
        { p: `The old binary .doc format from pre-2007 Word is a different file structure entirely, and this converter does not read it. The fix takes a moment: open the .doc in Word, Google Docs or LibreOffice Writer, choose <em>Save as</em> and pick .docx, then convert that. Anything saved by Word in the last decade and a half is already .docx.` },

        { h3: `Free, private and browser-based` },
        { ul: [
          `<strong>No signup or email.</strong> Plenty of converters want an address before they hand your file back. This one does not.`,
          `<strong>Nothing is uploaded.</strong> The conversion runs locally, so confidential documents stay on your machine and there is nothing to trust a deletion policy with.`,
          `<strong>No watermarks or conversion caps.</strong> Convert as many documents as you need.`,
          `<strong>Works anywhere.</strong> Windows, Mac, Linux, Android and iPhone — any modern browser, nothing to install.`,
        ] },

        { h3: `Related Word and text tools` },
        { p: `Need a different output? You can also <a href="/word-to-excel">pull a Word document's tables into Excel</a>, <a href="/word-to-pdf">save a Word file as PDF</a>, <a href="/ppt-to-text">extract the text from a PowerPoint</a>, <a href="/pdf-to-markdown">convert a PDF to Markdown</a>, <a href="/word-counter">count the words</a> or <a href="/case-converter">change the text case</a> — all free and all running in your browser.` },
      ],
    },
  },
  pdftomarkdown: {
    title: `PDF to Markdown Converter Online Free | OnlineToolsWeb`,
    description: `Free PDF to Markdown converter. Turn a PDF into a plain .md file with a heading per page — no signup, nothing uploaded, runs in your browser.`,
    appName: `PDF to Markdown Converter | OnlineToolsWeb`,
    h1: `PDF to Markdown Converter — Online and Free`,
    intro: `Turn a PDF into a Markdown file in seconds. This free PDF to Markdown converter reads the text of every page and writes it to a .md file with a heading marking each page — handy when you need portable plain text for notes, a docs repo or an AI tool. It runs in your browser, so the PDF is never uploaded.`,
    relatedKeys: ['pdftoword', 'pdftoexcel', 'wordtotext', 'ppttotext', 'pdftojpg', 'wordcounter'],
    faq: [
      {
        q: `Is the PDF to Markdown converter free to use?`,
        a: `Yes. Converting a PDF to Markdown here is completely free, with no trial, no credit card and no signup. There is no watermark and no cap on how many files you convert.`,
      },
      {
        q: `How do I convert a PDF to Markdown online?`,
        a: `Drop your PDF into the box on this page. The converter reads each page in order and builds a Markdown file from the text it finds, then hands you a .md file to download. Nothing is uploaded — the work happens in your browser.`,
      },
      {
        q: `What does the Markdown file look like?`,
        a: `Each page becomes a section: a level-two Markdown heading reading "Page 1", "Page 2" and so on, followed by that page's text split into paragraphs. It is deliberately plain, so it renders cleanly in any Markdown editor and is easy to tidy by hand.`,
      },
      {
        q: `Does it keep headings, bold text and links?`,
        a: `No. The output is plain Markdown: page headings plus paragraph text. A PDF stores glyphs and positions rather than a document outline, so real heading levels, bold and italic runs, and clickable links are not reconstructed. If you need those, convert the PDF to Word instead and export Markdown from there.`,
      },
      {
        q: `Will tables come out as Markdown tables?`,
        a: `No. Table cells are read as text and end up as ordinary lines, not as Markdown table syntax. For tabular data it is far better to use the PDF to Excel tool, which is built to reconstruct rows and columns.`,
      },
      {
        q: `What about two-column or magazine-style PDFs?`,
        a: `Text is read in the order the PDF stores it, which for complex multi-column layouts can interleave columns or drop a sidebar into the middle of a paragraph. Simple single-column documents — reports, papers, contracts, ebooks — convert cleanly.`,
      },
      {
        q: `Can I convert a scanned PDF to Markdown?`,
        a: `No. A scanned page is a picture, so there is no text layer to read and the output would be empty. This tool needs a text-based PDF, the kind produced by exporting from Word, Google Docs, LaTeX or a browser's print-to-PDF.`,
      },
      {
        q: `Why convert a PDF to Markdown before using it with an AI tool?`,
        a: `Language models read text, not page layout, and a Markdown file gives them the words without the PDF container, which usually means cleaner answers and fewer wasted tokens. Converting here also means the PDF itself is never uploaded anywhere, so a confidential document stays on your device and you decide what gets pasted into a chat.`,
      },
      {
        q: `Is my PDF uploaded to a server?`,
        a: `No. The file is opened and read by your own browser and nothing is sent anywhere. There is no copy on a server, so there is no retention window to worry about — which matters for contracts, invoices, research and internal reports.`,
      },
      {
        q: `Is there a file size or page limit?`,
        a: `The tool does not set one. Since the conversion runs on your device instead of a server, the real limit is your browser's memory, and long documents are handled page by page.`,
      },
      {
        q: `Can I convert several PDFs at once?`,
        a: `Files are converted one at a time. Each one takes only a moment though, because there is no upload or queue to wait on.`,
      },
      {
        q: `What can I open a .md file with?`,
        a: `Any text editor, plus anything Markdown-aware: VS Code, Obsidian, Notion, Typora, GitHub, GitLab and most static site generators. A .md file is just plain text, so nothing special is needed to read it.`,
      },
      {
        q: `Does the PDF to Markdown converter work on mobile?`,
        a: `Yes. It works in Chrome, Safari, Firefox and Edge on phones and tablets exactly as it does on a desktop, with nothing to install.`,
      },
    ],
    body: {
      h2: `PDF to Markdown converter — plain, portable text from any PDF`,
      blocks: [
        { p: `Markdown has quietly become the format everything else agrees on: docs repos, wikis, static sites, note apps and AI tools all read it happily. PDFs are the opposite — fixed pages designed for printing, awkward to reuse. A <strong>PDF to Markdown converter</strong> bridges the two by lifting the text out of the pages and writing it into a .md file you can edit, commit, search or paste anywhere.` },

        { h3: `How to convert PDF to Markdown online free` },
        { ol: [
          `<strong>Add your PDF.</strong> Drag it onto the box above or tap <em>Browse files</em>. The file is read in your browser and never uploaded.`,
          `<strong>The converter walks the pages in order.</strong> It reads the text layer of page 1, then page 2, and so on, splitting it into paragraphs as it goes.`,
          `<strong>Download your .md file.</strong> Open it in VS Code, Obsidian, Notion, a Markdown preview, or paste it straight into whatever needs the text.`,
        ] },

        { h3: `What the Markdown file contains` },
        { ul: [
          `<strong>One section per page.</strong> Every page gets a level-two heading — Page 1, Page 2, Page 3 — so you can always tell where a passage came from.`,
          `<strong>Paragraph breaks.</strong> Runs of text are separated into paragraphs instead of arriving as one solid wall.`,
          `<strong>Original reading order.</strong> Pages are processed front to back, not shuffled.`,
          `<strong>Plain Markdown only.</strong> No HTML, no front matter, no proprietary syntax — it renders in any Markdown tool and is easy to clean up by hand.`,
        ] },

        { h3: `PDF to Markdown for AI tools and RAG pipelines` },
        { p: `Most of the demand for this conversion now comes from people preparing documents for a language model. The reasoning is simple: a model works with text, and handing it a stripped-down Markdown file rather than a PDF removes a layer of guesswork and wastes fewer tokens on layout noise. Markdown is also the easiest format to chunk for a retrieval pipeline, because the page headings give you natural split points.` },
        { p: `The part worth pausing on is privacy. Uploading a PDF to a conversion service before you feed it to an AI tool means two third parties have seen it instead of one. Here the conversion happens inside your browser, so the document never leaves your device and you choose exactly which text gets pasted onward.` },

        { h3: `What it does not do` },
        { p: `Being clear about the limits saves you a wasted conversion:` },
        { ul: [
          `<strong>No structure detection.</strong> Real heading levels, bold and italic runs, lists and links are not reconstructed — you get page headings and paragraph text.`,
          `<strong>No Markdown tables.</strong> Table cells become ordinary lines. Use <a href="/pdf-to-excel">PDF to Excel</a> when the data matters.`,
          `<strong>No OCR.</strong> A scanned PDF has no text layer, so there is nothing to read.`,
          `<strong>Multi-column layouts can interleave.</strong> Text is taken in the order the PDF stores it, which suits ordinary single-column documents best.`,
          `<strong>Images are not extracted.</strong> If you need the pictures, <a href="/pdf-to-jpg">convert the pages to JPG</a> instead.`,
        ] },

        { h3: `What people use it for` },
        { ul: [
          `<strong>Moving documentation into a repo.</strong> A PDF manual becomes .md files that can be committed, reviewed and diffed like code.`,
          `<strong>Research notes.</strong> Papers and reports turn into text you can quote, highlight and link from a notes app.`,
          `<strong>Preparing context for an AI assistant or RAG index.</strong> Clean text in, better answers out.`,
          `<strong>Rewriting a PDF as a web page or blog post.</strong> Markdown is one step from HTML, unlike a PDF.`,
          `<strong>Searching and archiving.</strong> A .md file is indexed by your operating system and readable forever.`,
        ] },

        { h3: `Free, private and browser-based` },
        { ul: [
          `<strong>No signup or email.</strong> No account, no verification step, no newsletter.`,
          `<strong>Nothing is uploaded.</strong> The PDF is processed locally, so there is no server copy and no retention policy to read.`,
          `<strong>No watermarks or conversion limits.</strong> Convert as many PDFs as you like.`,
          `<strong>Works anywhere.</strong> Windows, Mac, Linux, Android and iPhone — any modern browser.`,
        ] },

        { h3: `Related PDF and text tools` },
        { p: `Need a different format? You can also <a href="/pdf-to-word">convert a PDF to an editable Word document</a>, <a href="/pdf-to-excel">pull PDF tables into Excel</a>, <a href="/pdf-to-jpg">turn pages into images</a>, <a href="/word-to-text">extract plain text from a Word file</a>, <a href="/ppt-to-text">extract the text from a PowerPoint</a> or <a href="/word-counter">count the words</a> — all free and all running in your browser.` },
      ],
    },
  },
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
    description: `Free PPT to Text converter. Pull every word out of a PowerPoint (.pptx) into a plain .txt file, slide by slide — no signup, nothing uploaded.`,
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
        a: `Drop your photo into the box above and pick a target from the list — 10KB, 20KB, 30KB, 50KB, 100KB, 300KB or 1MB. Before you commit to anything you'll see a live estimate of the size you'd actually get, then press Compress and download the result.`,
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
        a: `It depends where it's going. Government exam portals usually want 10–20KB for a signature and 20–50KB for a photo. Other online forms and ID uploads ask for 50KB or 100KB. Email attachments are comfortable at 300KB. For a website, aim at 100–300KB so pages stay fast. If a form states a maximum, pick the option at or just under it.`,
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
          `<strong>Pick your target size.</strong> Choose 10KB, 20KB, 30KB, 50KB, 100KB, 300KB or 1MB. 50KB is the default because it's the most commonly requested limit for form and ID uploads — but 10KB and 20KB are there for exam signatures and photos.`,
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
          `<strong>Government exam forms</strong> — 10KB or 20KB, the sizes most application portals demand for signatures and photos (see the table below).`,
          `<strong>Absolute smallest</strong> — 10KB, when a strict limit matters more than fine detail.`,
        ] },

        { h3: `Sizes Indian government exam forms ask for` },
        { p: `Application portals are strict about this, and a rejected upload can cost you a form. These are the limits the main exams publish — always check the current notification, since they do change between cycles:` },
        { ul: [
          `<strong>UPSC</strong> — photo 20–200KB, signature 20–100KB, both JPG on a plain white background. The signature must be 350–500 pixels wide, in black ink.`,
          `<strong>IBPS PO</strong> — photo 200 × 230 pixels at 20–50KB, signature 140 × 60 pixels at 10–20KB, both JPG.`,
          `<strong>Most SSC and state exams</strong> — photo 20–50KB, signature 10–20KB, JPG.`,
        ] },
        { p: `Pick 10KB for a signature or 20KB for a photo and this tool will find the best quality that fits. If the form also specifies exact pixel dimensions, run <a href="/resize-image">Resize Image</a> first to set the width and height, then compress.` },

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
        a: `Drop your PDF into the box above and choose a target — 10KB, 20KB, 30KB, 50KB, 100KB, 300KB or 1MB. The tool recompresses the images inside the file and trims data nothing is using, aiming for the best quality that fits your target, then gives you the file to download.`,
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
          `<strong>Choose your target size.</strong> 10KB, 20KB, 30KB, 50KB, 100KB, 300KB or 1MB. Small targets suit text-only documents; scans need more room.`,
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
  texttoppt: {
    title: `Text to PPT Converter Online Free | OnlineToolsWeb`,
    description: `Paste your text, get a PowerPoint. A blank line starts a new slide and the first line becomes its title. Free, no signup, and nothing is uploaded.`,
    appName: `Text to PPT Converter | OnlineToolsWeb`,
    h1: `Text to PPT Converter — Free and Online`,
    intro: `Paste your text and download a PowerPoint file. Separate slides with a blank line: the first line of each block becomes the slide title and the lines under it become bullets. Everything runs in your browser, so nothing you type is uploaded.`,
    faq: [
      {
        q: `Is the Text to PPT converter free to use?`,
        a: `Yes. Turning text into a PowerPoint on OnlineToolsWeb is completely free — no trial, no credit card and no locked export. Optional premium features may be introduced later for advanced workflows like batch processing, but this tool's core functionality stays free.`,
      },
      {
        q: `How do I convert text into PowerPoint slides?`,
        a: `Paste or type your text into the box, then press Generate PPTX. Leave a blank line between slides: the first line of each block becomes the slide title, and every line under it becomes a bullet on that slide. The .pptx file downloads straight away.`,
      },
      {
        q: `Does this use AI to write my presentation?`,
        a: `No. It doesn't write content, pick images or invent slides — it takes text you have already written and builds the slide structure from it. That makes it predictable: what you paste is exactly what ends up on the slides, with no made-up facts to check.`,
      },
      {
        q: `Do I need to install anything or create an account?`,
        a: `No. The converter runs directly in your browser on any modern desktop or mobile browser. There is nothing to download, no signup, and no email address to hand over before you get your file.`,
      },
      {
        q: `Does the tool store or send what I type?`,
        a: `No. The presentation is built on your own device and never leaves it, so lecture notes, meeting agendas and client material stay private. Nothing you type here is uploaded or saved on a server.`,
      },
      {
        q: `Can I edit the slides after I download them?`,
        a: `Yes. You get a normal .pptx file, not an image or a PDF. Open it in PowerPoint, Google Slides, Keynote or LibreOffice Impress and edit every title, bullet and layout as usual.`,
      },
      {
        q: `Can I add a theme, template or images?`,
        a: `Not in this tool — the slides come out plain, with a bold title and bulleted text. Apply a look after downloading: in PowerPoint use the Design tab, or in Google Slides use Theme. Because the text sits in real placeholders, a theme restyles the whole deck in one click.`,
      },
      {
        q: `How many slides can I make at once?`,
        a: `As many as you have blocks of text. The tool adds one slide per block, and since the work happens on your own device there is no server quota and no daily limit.`,
      },
      {
        q: `Does the Text to PPT converter work on mobile?`,
        a: `Yes. It works in Chrome, Safari, Firefox and Edge on phones and tablets exactly as it does on a laptop, which is handy for turning notes into a deck on the way to a class or meeting.`,
      },
      {
        q: `What file do I get at the end?`,
        a: `A PowerPoint file named presentation.pptx. It is a standard Office file, so it opens in Microsoft PowerPoint and in every common alternative without conversion.`,
      },
    ],
    body: {
      h2: `Text to PPT converter — turn an outline into slides`,
      blocks: [
        { p: `Most searches for a <strong>text to PPT converter</strong> come down to one job: you already have the words — notes, an outline, a list of talking points — and you need them laid out as PowerPoint slides without typing each one by hand. This tool does that job in your browser, in a few seconds, with no account.` },

        { h3: `How to convert text to PPT` },
        { ol: [
          `<strong>Open the tool above</strong> and paste your text into the box. There's no file to upload — you can type straight into it.`,
          `<strong>Put a blank line between slides.</strong> Each block of text becomes one slide.`,
          `<strong>Put the slide title on the first line</strong> of each block. Every line below it becomes a bullet point on that slide.`,
          `<strong>Press Generate PPTX</strong> and the presentation downloads to your device, ready to open and edit.`,
        ] },

        { h3: `How to format your text` },
        { p: `The formatting rule is deliberately simple — one blank line between slides, title on top:` },
        { p: `<code>Quarterly results<br>Revenue up 12%<br>Two new regions opened</code><br><br><code>Next quarter<br>Hire two engineers<br>Ship the mobile app</code>` },
        { p: `That input produces two slides. The first is titled "Quarterly results" with two bullets under it; the second is titled "Next quarter" with two bullets. A block with only one line becomes a title-only slide, which is useful for section dividers.` },

        { h3: `Why use this text to PPT converter` },
        { ul: [
          `<strong>Completely free.</strong> No trial, no credit card, no watermark on the deck you download.`,
          `<strong>No signup or email.</strong> Most text-to-slides sites ask you to create an account before they hand over the file. This one doesn't.`,
          `<strong>Your text never leaves your device.</strong> The .pptx is built locally in your browser, so unpublished results, internal agendas and student work stay private.`,
          `<strong>Real, editable slides.</strong> The output is a genuine .pptx with text in proper placeholders — not an image of a slide.`,
          `<strong>Works on any device.</strong> Windows, Mac, Linux, Android and iPhone. Nothing to install or update.`,
          `<strong>Predictable.</strong> One block in, one slide out. No AI rewriting your wording or padding the deck with filler.`,
        ] },

        { h3: `A converter, not an AI slide generator` },
        { p: `Most tools ranking for this search are AI presentation makers: you give them a topic and they invent the content, the images and the layout. This is a different thing, and worth knowing before you start. It converts text <em>you</em> wrote into slides, exactly as written. If you want a machine to draft the presentation for you, this isn't that tool. If you already have your notes and want them on slides in ten seconds without an account, credits or a subscription, this is faster and there is nothing to fact-check afterwards.` },

        { h3: `Who uses a text to PPT converter` },
        { ul: [
          `<strong>Students</strong> turning lecture notes or an essay outline into a presentation the night before a seminar`,
          `<strong>Teachers and trainers</strong> converting a lesson plan or workshop outline into slides`,
          `<strong>Managers</strong> putting a meeting agenda on screen without opening PowerPoint and formatting each slide`,
          `<strong>Developers and writers</strong> who keep notes in plain text or Markdown and need a deck from them`,
          `<strong>Anyone</strong> who finds typing into PowerPoint slower than typing into a text box`,
        ] },

        { h3: `After you download the deck` },
        { ul: [
          `Apply a theme in PowerPoint (Design tab) or Google Slides (Theme) to restyle every slide at once.`,
          `Drag in images, charts and logos where they help — the text placeholders leave room for them.`,
          `Reorder slides in the thumbnail pane; nothing in the file is locked.`,
          `Need a handout instead? Paste the same text into our <a href="/text-to-pdf">text to PDF tool</a>.`,
        ] },

        { h3: `Related text and presentation tools` },
        { p: `Working with slides or plain text elsewhere? You can also <a href="/ppt-to-text">pull the text back out of a PowerPoint</a>, <a href="/pdf-to-ppt">turn a PDF into slides</a>, <a href="/image-to-ppt">build a deck from images</a>, <a href="/text-to-pdf">make a PDF from text</a> or <a href="/word-counter">check your word count</a> — all free and all running in your browser.` },
      ],
    },
  },
  imagetoexcel: {
    title: `Image to Excel Converter Online Free | OnlineToolsWeb`,
    description: `Free image to Excel converter. Turn a photo or screenshot of a table into an .xlsx spreadsheet — the text is read on your device, never uploaded.`,
    appName: `Image to Excel Converter | OnlineToolsWeb`,
    h1: `Image to Excel Converter — Online and Free`,
    intro: `Convert a picture of a table into a spreadsheet. Drop in a JPG, PNG or screenshot and the table is read on your own device, then written into a downloadable .xlsx file — no upload, no signup and no page limit.`,
    faq: [
      {
        q: `Is the Image to Excel converter free to use?`,
        a: `Yes. Converting an image to Excel on OnlineToolsWeb is completely free — no credit card, no page credits and no locked export. Optional premium features may be introduced later for advanced workflows like batch processing, but this tool's core functionality stays free.`,
      },
      {
        q: `Is my image uploaded anywhere?`,
        a: `No. The text recognition runs inside your browser on your own device, so the picture is never sent to a server. That matters for the things people usually photograph — invoices, payslips, bank statements, medical forms and marksheets — because none of it leaves your computer or phone.`,
      },
      {
        q: `Do I need to install anything?`,
        a: `No installation needed. Image to Excel runs directly in your browser on any modern desktop or mobile browser — just open this page and use it.`,
      },
      {
        q: `What image formats does it support?`,
        a: `JPG, PNG, WebP and other common image formats. If you have an iPhone HEIC photo, run it through the free HEIC to JPG converter on this site first, then bring the JPG back here.`,
      },
      {
        q: `Can I convert a screenshot of a table to Excel?`,
        a: `Yes, and screenshots usually give the best results. Screen captures are sharp, straight and evenly lit, which is exactly what the text recognition needs. A photo of a printed page works too, as long as it's in focus and shot square-on.`,
      },
      {
        q: `Is there a file size limit or a limit on how many images I can convert?`,
        a: `No. Because everything happens on your own device there is no server quota and no daily cap. Very large images simply take a little longer, since your own processor is doing the reading.`,
      },
      {
        q: `Can it read handwriting?`,
        a: `No. The tool is built for printed or typed text — a scanned table, a screenshot, a photo of a report. Handwritten notes won't convert reliably, so those still need to be typed in by hand.`,
      },
      {
        q: `What languages can it read?`,
        a: `English. The text recognition is set up for English characters, so tables in English convert well while other scripts won't be read accurately. Numbers and standard punctuation are handled as part of that.`,
      },
      {
        q: `How accurate is image to Excel conversion?`,
        a: `It depends almost entirely on the picture. A sharp, straight, well-lit image of a printed table with clear gaps between the columns converts cleanly. A blurry, tilted or low-contrast photo will produce mistakes. Always compare the spreadsheet against the original image before you use the numbers.`,
      },
      {
        q: `Why did my table come out in the wrong columns?`,
        a: `Columns are detected from the visible gaps between them, so anything that blurs those gaps confuses the split — a tilted photo, text that runs into the next column, or extra page content around the table. Crop the image down to just the table, shoot it square-on, and convert again.`,
      },
      {
        q: `Will the file open in Google Sheets?`,
        a: `Yes. You get a standard .xlsx file, so it opens in Microsoft Excel, Google Sheets, LibreOffice Calc and Apple Numbers, and every cell is editable.`,
      },
      {
        q: `Does the Image to Excel converter work on mobile?`,
        a: `Yes. It works in Chrome, Safari, Firefox and Edge on phones and tablets, so you can photograph a table and convert it without moving the picture to a computer first.`,
      },
    ],
    body: {
      h2: `Image to Excel converter — free, private and in your browser`,
      blocks: [
        { p: `Searching for an <strong>image to Excel converter</strong> usually means you're staring at a table you can't select: a screenshot someone sent on WhatsApp, a scanned report, a photo of a printed price list. This tool reads the table out of the picture and writes it into an .xlsx spreadsheet you can sort, total and edit — without uploading the image anywhere.` },

        { h3: `How to convert an image to Excel` },
        { ol: [
          `<strong>Add your image.</strong> Drag a JPG, PNG or WebP onto the box above, or tap <em>Browse files</em> to pick it from your device or camera roll.`,
          `<strong>Let it read the table.</strong> The tool finds the rows and columns from the spacing in the image, then reads each cell one at a time. Nothing is sent to a server — the recognition runs on your own device.`,
          `<strong>Download the spreadsheet.</strong> Save the .xlsx and open it in Excel, Google Sheets, LibreOffice Calc or Apple Numbers.`,
          `<strong>Check it against the image.</strong> Text recognition is never perfect. Scan the sheet for odd characters before you rely on the numbers.`,
        ] },

        { h3: `Why use this image to Excel converter` },
        { ul: [
          `<strong>Your image never leaves your device.</strong> Almost every other image-to-Excel site uploads your file, processes it on a server and promises to delete it later. Here there is no upload at all, so an invoice, payslip or medical form stays on your own machine.`,
          `<strong>No signup and no page credits.</strong> No account, no email, no "3 free pages this month" meter.`,
          `<strong>No file-size cap.</strong> Free tiers on server-based converters commonly stop at around 10 MB. This one has no cap, because there is no server.`,
          `<strong>No upload queue.</strong> There is no server to wait for and no file to send up a slow connection — the work starts the moment you drop the image in.`,
          `<strong>Editable output.</strong> Real cells in a real .xlsx file — not an image pasted into a sheet.`,
          `<strong>Any device.</strong> Windows, Mac, Linux, Android and iPhone, with nothing to install.`,
        ] },

        { h3: `What converts well — and what doesn't` },
        { p: `Being straight about this saves you time. The tool reads <strong>printed or typed English text</strong> and finds columns from the blank space between them. That means:` },
        { ul: [
          `<strong>Works well:</strong> screenshots of spreadsheets and web tables, scanned reports, clear photos of printed invoices, marksheets and price lists`,
          `<strong>Works less well:</strong> photos taken at an angle, low-light or blurry shots, tables with columns crammed together, faint or coloured text on a busy background`,
          `<strong>Not supported:</strong> handwriting, and scripts other than English`,
        ] },

        { h3: `Tips for a cleaner conversion` },
        { ul: [
          `<strong>Crop to the table.</strong> Remove headings, logos and page edges so only the grid is left — this is the single biggest improvement you can make.`,
          `<strong>Shoot square-on.</strong> Hold the camera parallel to the page rather than at an angle, or use a scanner app that straightens the page for you.`,
          `<strong>Get the light even.</strong> Avoid shadows across the page and glare from a flash.`,
          `<strong>Use the biggest version you have.</strong> A full-resolution screenshot reads far better than a small one that's been resized or re-shared through chat.`,
          `<strong>Take a screenshot instead of a photo</strong> whenever the table is already on a screen.`,
        ] },

        { h3: `Who uses an image to Excel converter` },
        { ul: [
          `<strong>Accountants and small-business owners</strong> pulling line items off photographed invoices, bills and receipts`,
          `<strong>Students and researchers</strong> lifting a data table out of a scanned paper or a slide photo`,
          `<strong>Teachers</strong> turning a printed marksheet into a gradebook`,
          `<strong>Admin and data-entry teams</strong> digitising attendance registers, stock lists and old paper records`,
          `<strong>Anyone</strong> sent a screenshot of a table when they needed the actual numbers`,
        ] },

        { h3: `Image to Excel vs retyping by hand` },
        { p: `For five rows, typing is fine. For a fifty-row stock list it isn't, and hand-typed numbers carry their own error rate — transposed digits are easy to make and hard to spot. Converting gives you every row in one pass and leaves you proofreading instead of transcribing, which is faster and easier to check against the original.` },

        { h3: `Related image and spreadsheet tools` },
        { p: `Need something else from the same picture or file? You can also <a href="/pdf-to-excel">convert a PDF to Excel</a>, <a href="/word-to-excel">pull tables out of a Word document</a>, <a href="/excel-to-csv">turn a spreadsheet into CSV</a>, <a href="/heic-to-jpg">convert an iPhone HEIC photo to JPG</a> or <a href="/crop-image">crop the image first</a> — all free and all running in your browser.` },
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

// ---------- per-URL <lastmod> tracking ----------
// scripts/page-lastmod.json maps each sitemap URL to the fingerprint of
// its content at the time it last changed, plus the date of that change.
// On every build we re-fingerprint each page: an unchanged fingerprint
// keeps its recorded date, a changed (or new) one takes SITE_LASTMOD.
// The file is committed, so a fresh clone or a CI build produces the
// same dates rather than declaring the whole site modified today.
//
// Tool pages are fingerprinted on their page-specific content (the
// derived SEO object plus the PAGE_SEO override and the toolMeta fields
// the auto-derived copy reads), NOT on the rendered HTML — otherwise a
// header or footer tweak would bump all 64 dates at once and put us
// straight back where we started. Static and info pages have no such
// separation, so those are fingerprinted on their source file.
const LASTMOD_PATH = resolve(ROOT, 'scripts/page-lastmod.json');
let previousLastmod = {};
try {
  previousLastmod = JSON.parse(readFileSync(LASTMOD_PATH, 'utf-8'));
} catch {
  previousLastmod = {}; // first run, or the file was deleted — everything is "new"
}
const nextLastmod = {};
// URLs whose fingerprint actually moved in THIS build — not merely those
// whose stored date happens to equal SITE_LASTMOD from an earlier one.
const changedThisRun = [];

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

// Records this URL's fingerprint and returns the date its <lastmod>
// should carry: the stored date if nothing changed, otherwise today's.
function resolveLastmod(loc, hash) {
  const prev = previousLastmod[loc];
  const unchanged = prev && prev.hash === hash;
  const lastmod = unchanged ? prev.lastmod : SITE_LASTMOD;
  nextLastmod[loc] = { hash, lastmod };
  if (!unchanged) changedThisRun.push(loc);
  return lastmod;
}

function fileFingerprint(relPath) {
  try {
    // Line endings are normalised first: this repo is edited on Windows
    // with git's autocrlf on, so the same file can be CRLF in one
    // working tree and LF in another. Hashing the raw bytes would make
    // all 11 static pages claim a change on a fresh clone.
    return fingerprint(readFileSync(resolve(ROOT, relPath), 'utf-8').replace(/\r\n/g, '\n'));
  } catch {
    // Missing source file: return a stable placeholder rather than a
    // fresh value each run, so a page we cannot read does not flap its
    // date on every single build.
    console.warn(`lastmod: cannot read ${relPath} — date will not update for it`);
    return 'unreadable';
  }
}

// ---------- run ----------
const routingMap = [];
const toolFingerprints = {};
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
  // Everything that can change this page's visible copy, and nothing
  // that is shared with the other 63 pages.
  toolFingerprints[seo.slug] = fingerprint([
    seo,
    PAGE_SEO[key] || null,
    { label: meta.label, desc: meta.desc, accept: meta.accept || null, usesServer: !!meta.usesServer, heroCopy: meta.heroCopy || null },
  ]);
});

console.log(`Generated ${written} tool pages.`);

// ---------- sitemap.xml ----------
const staticPages = [
  { loc: '/', priority: '1.0', src: 'index.html' },
  { loc: '/pdf', priority: '0.8', src: 'pdf.html' },
  { loc: '/image', priority: '0.8', src: 'image.html' },
  { loc: '/excel', priority: '0.8', src: 'excel.html' },
  { loc: '/word', priority: '0.8', src: 'word.html' },
  { loc: '/ppt', priority: '0.8', src: 'ppt.html' },
  { loc: '/other-tools', priority: '0.8', src: 'other-tools.html' },
];
// Informational pages linked from the site footer. They belong in the
// sitemap — they were previously missing, so they relied entirely on
// crawlers following footer links — but at a low priority, since a
// search result should land on a tool ahead of the terms page.
const infoPages = [
  { loc: '/about', priority: '0.3', src: 'about.html' },
  { loc: '/contact', priority: '0.3', src: 'contact.html' },
  { loc: '/privacy-policy', priority: '0.3', src: 'privacy-policy.html' },
  { loc: '/terms-of-service', priority: '0.3', src: 'terms-of-service.html' },
];
const toolPages = routingMap.map((r) => ({ loc: `/${r.slug}`, priority: '0.7', hash: toolFingerprints[r.slug] }));
const allPages = [...staticPages, ...toolPages, ...infoPages];
// Resolve each URL's own <lastmod> before rendering. Order matters only
// in that every URL must be visited, so nextLastmod ends up complete and
// pages dropped from the sitemap fall out of the store on their own.
const datedPages = allPages.map((p) => ({
  ...p,
  lastmod: resolveLastmod(p.loc, p.hash || fileFingerprint(p.src)),
}));
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${datedPages.map((p) => `  <url>\n    <loc>${SITE_ORIGIN}${p.loc}</loc>\n    <lastmod>${p.lastmod}</lastmod>\n    <priority>${p.priority}</priority>\n  </url>`).join('\n')}
</urlset>
`;
writeFileSync(resolve(ROOT, 'public/sitemap.xml'), sitemapXml, 'utf-8');
console.log(`Wrote sitemap.xml with ${allPages.length} URLs (${changedThisRun.length} changed this build).`);
if (changedThisRun.length) console.log(`  now dated ${SITE_LASTMOD}: ${changedThisRun.join(', ')}`);

// Sorted so the committed file has a stable, reviewable diff.
const sortedLastmod = Object.fromEntries(Object.keys(nextLastmod).sort().map((k) => [k, nextLastmod[k]]));
writeFileSync(LASTMOD_PATH, JSON.stringify(sortedLastmod, null, 2) + '\n', 'utf-8');
console.log(`Wrote scripts/page-lastmod.json (${Object.keys(sortedLastmod).length} URLs tracked).`);

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
