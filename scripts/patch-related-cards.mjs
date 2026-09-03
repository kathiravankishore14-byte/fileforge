#!/usr/bin/env node
// ================= RELATED-TOOLS CARD PATCHER =================
// Surgically replaces the "Related Tools" card markup inside every
// already-generated static tool page (merge-pdf.html, etc.) with the
// current .tool-card row layout (icon, category label, title,
// description, arrow) — the same shape toolCardHtml() renders at
// runtime in src/main.js.
//
// This is deliberately NOT a full rerun of generate-seo-pages.mjs:
// several tool pages (merge-pdf, compress-pdf, split-pdf, and others)
// carry hand-authored long-form SEO prose (.tp-content — "How this
// tool works", "Privacy and local processing", "Practical
// limitations", etc.) that the generator's buildPage() template does
// not know how to produce. Regenerating those files from scratch would
// silently delete that unique content. Instead this script finds each
// file's <section class="tp-section tp-related">...</section> block
// and replaces only that block, leaving every other byte of the file
// untouched.
//
// Run with: node scripts/patch-related-cards.mjs
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractMainData } from './extract-main-data.mjs';
import { TOOL_SLUGS } from '../src/toolSlugs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { toolMeta, categoryNavConfig, categoryLabels, categoryIcons, toolIconOverrides } =
  extractMainData(resolve(ROOT, 'src/main.js'));

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
  Object.keys(toolMeta).forEach((k) => {
    if (k !== key && toolMeta[k].category === meta.category && !ordered.includes(k)) ordered.push(k);
  });
  return ordered.filter((k) => toolMeta[k] && !toolMeta[k].comingSoon).slice(0, 6);
}

function toolIconBadgeHtml(key, meta) {
  const override = toolIconOverrides[key];
  if (override) return `<img src="${override}" alt="" />`;
  const fromIcon = categoryIcons[meta.category] || '/icons/icon-utilities.svg';
  const toCategory = meta.iconTo;
  if (!toCategory || toCategory === meta.category) return `<img src="${fromIcon}" alt="" />`;
  const toIcon = categoryIcons[toCategory] || '/icons/icon-utilities.svg';
  return `<img src="${fromIcon}" alt="" /><span class="arrow">→</span><img src="${toIcon}" alt="" />`;
}

function relatedToolsHtml(key, meta) {
  const related = relatedKeysFor(key, meta);
  if (!related.length) return '';
  const cards = related.map((rk) => {
    const rMeta = toolMeta[rk];
    const rSlug = TOOL_SLUGS[rk];
    if (!rSlug) return '';
    const catLabel = categoryLabels[rMeta.category] || rMeta.category;
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
  return `<section class="tp-section tp-related" data-reveal>
      <h2>Related Tools</h2>
      <div class="tool-grid tp-related-grid">${cards}</div>
    </section>`;
}

// [^>]* tolerates any extra attributes on the opening tag (e.g.
// data-reveal, added by a later pass) — a literal ">" here would stop
// matching the moment any such attribute got added, silently turning
// every future run of this script into a no-op.
const RELATED_SECTION_RE = /<section class="tp-section tp-related"[^>]*>[\s\S]*?<\/section>/;

let patched = 0;
let skippedNoFile = 0;
let skippedNoMatch = 0;
let removed = 0;

Object.keys(toolMeta).forEach((key) => {
  const meta = toolMeta[key];
  const slug = TOOL_SLUGS[key];
  if (!slug) return;
  const filePath = resolve(ROOT, `${slug}.html`);
  if (!existsSync(filePath)) { skippedNoFile++; console.warn(`SKIP (no file): ${slug}.html`); return; }

  const html = readFileSync(filePath, 'utf-8');
  const newSection = relatedToolsHtml(key, meta);
  const hasSection = RELATED_SECTION_RE.test(html);

  if (!hasSection) {
    if (newSection) console.warn(`SKIP (no existing tp-related section to replace): ${slug}.html`);
    skippedNoMatch++;
    return;
  }

  const updated = html.replace(RELATED_SECTION_RE, newSection || '<!-- no related tools -->');
  if (updated === html) { skippedNoMatch++; return; }
  writeFileSync(filePath, updated, 'utf-8');
  patched++;
  if (!newSection) removed++;
});

console.log(`Patched Related Tools cards in ${patched} file(s).`);
if (removed) console.log(`  (${removed} of those now have no related tools.)`);
if (skippedNoFile) console.log(`Skipped ${skippedNoFile} tool(s) with no generated file.`);
if (skippedNoMatch) console.log(`Skipped ${skippedNoMatch} file(s) with no matching tp-related section.`);
