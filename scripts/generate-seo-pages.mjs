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
const SITE_LASTMOD = '2026-09-13';

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
