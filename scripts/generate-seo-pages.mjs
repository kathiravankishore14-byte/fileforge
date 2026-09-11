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
