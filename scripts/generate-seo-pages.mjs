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

// ---------- per-tool SEO content derivation ----------
function deriveSeo(key, meta) {
  const slug = TOOL_SLUGS[key];
  const title = `${meta.label} Online Free | OnlineToolsWeb`;
  const privacyClause = meta.usesServer
    ? 'Free, fast AI processing, no signup, nothing stored.'
    : 'Free, private, and runs right in your browser: no upload, no signup.';
  let description = `${meta.desc} ${privacyClause}`;
  if (description.length > 158) description = meta.usesServer ? `${meta.desc} No signup, nothing stored.` : `${meta.desc} No upload, no signup, runs in your browser.`;
  // A tool can supply its own hand-written hero copy (see toolMeta in
  // main.js) when the generic auto-derived phrasing undersells it —
  // used for Remove Background, which leads with real use cases rather
  // than the generic "drop or select your file" pattern.
  const h1 = meta.heroCopy?.h1 || `${meta.label} Online`;
  // Trimmed to a two-line hero: the tool's own value line, then one short
  // action line. The trust badges just below the hero already carry the
  // "runs in your browser, nothing uploaded" promise, so the intro no
  // longer has to restate it.
  const actionHint = meta.noFile
    ? 'Fill in the details'
    : (meta.multiFile ? 'Drop your files' : 'Drop your file');
  const intro = meta.heroCopy?.intro || `${meta.desc} ${actionHint} and get your result in seconds.`;

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

  return { slug, title, description, h1, intro, faq, steps };
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
  const override = toolIconOverrides[key];
  if (override) return `<img src="${override}" alt="" />`;
  const fromIcon = categoryIcons[meta.category] || '/icons/icon-utilities.svg';
  const toCategory = meta.iconTo;
  if (!toCategory || toCategory === meta.category) return `<img src="${fromIcon}" alt="" />`;
  const toIcon = categoryIcons[toCategory] || '/icons/icon-utilities.svg';
  return `<img src="${fromIcon}" alt="" /><span class="arrow">→</span><img src="${toIcon}" alt="" />`;
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
    name: `${meta.label} | OnlineToolsWeb`,
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
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${esc(seo.title)}" />
    <meta name="twitter:description" content="${esc(seo.description)}" />
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
    ${stepsCartoonHtml()}
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
const toolPages = routingMap.map((r) => ({ loc: `/${r.slug}`, priority: '0.7' }));
const allPages = [...staticPages, ...toolPages];
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map((p) => `  <url>\n    <loc>${SITE_ORIGIN}${p.loc}</loc>\n    <priority>${p.priority}</priority>\n  </url>`).join('\n')}
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
