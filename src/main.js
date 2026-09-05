import { TOOL_SLUGS, toolUrl } from './toolSlugs.js';
import './style.css';
import { PREMIUM_CTA_ENABLED, PREMIUM_BENEFITS, PREMIUM_CTA_HREF } from './config.js';
import { adSlotHtml, mountAdSlots } from './adSlots.js';
import {
  trackSearchStarted, trackSearchResultsShown, trackSearchNoResults,
  trackToolOpened, trackProcessingStarted, trackProcessingCompleted, trackProcessingFailed,
  trackResultDownloaded, trackRelatedToolOpened, trackPremiumCtaViewed, trackPremiumCtaClicked,
} from './analytics.js';

// Reverse of TOOL_SLUGS (key -> slug), used to resolve which tool a
// statically-generated "Related Tools" link (href="/some-slug") points to
// for the related_tool_opened analytics event — those links are plain
// <a href> tags baked in by scripts/generate-seo-pages.mjs and carry no
// data-tool attribute the way runtime-rendered tool cards do.
const SLUG_TO_KEY = Object.fromEntries(Object.entries(TOOL_SLUGS).map(([key, slug]) => [slug, key]));

// ================= STALE DEPLOY RECOVERY =================
// Every build gets new content-hashed chunk filenames (e.g. the AI model
// bundle behind "Remove Background"). Cloudflare Workers static assets
// replaces the whole asset set on each deploy, so a tab left open from
// before the latest deploy can end up asking for a chunk that no longer
// exists ("Failed to fetch dynamically imported module..."). Vite fires
// 'vite:preloadError' whenever one of these lazy imports 404s — recover
// automatically with a single reload instead of leaving the user stuck.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  if (!sessionStorage.getItem('ff-reloaded-after-preload-error')) {
    sessionStorage.setItem('ff-reloaded-after-preload-error', 'true');
    window.location.reload();
  }
});

// ================= TOOL DATA (shared across every page) =================
const CATEGORY_ICONS = {
  image: '/icons/icon-image.svg', word: '/icons/icon-word.svg', excel: '/icons/icon-excel.svg',
  pdf: '/icons/icon-pdf.svg', text: '/icons/icon-text.svg', ppt: '/icons/icon-ppt.svg', utilities: '/icons/icon-utilities.svg',
};

// "Other Tools" (utilities) bundles together many unrelated one-off
// tools that all otherwise share the same generic category icon — so
// each one gets its own distinct glyph here instead, keyed by tool
// key. renderIconBadge() checks this first for the "from" icon before
// falling back to CATEGORY_ICONS, so every other category is untouched.
//
// Image and PDF tools that stay within their own category (iconTo ===
// category) also got their own unique glyph below for the same reason
// — otherwise every plain image/PDF tool renders the exact same generic
// category icon. Tools that genuinely convert to a different format
// (e.g. Convert to PDF, PDF to Word, Image to Excel) are deliberately
// left OUT of this map: those already get a distinctive two-icon
// "from → to" badge from renderIconBadge(), so adding an override there
// would just hide that badge behind a single icon instead.
const TOOL_ICON_OVERRIDES = {
  qrcode: '/icons/icon-tool-qrcode.svg',
  passwordgen: '/icons/icon-tool-passwordgen.svg',
  jsonformatter: '/icons/icon-tool-jsonformatter.svg',
  base64: '/icons/icon-tool-base64.svg',
  loremipsum: '/icons/icon-tool-loremipsum.svg',
  unitconverter: '/icons/icon-tool-unitconverter.svg',
  gpacalculator: '/icons/icon-tool-gpacalculator.svg',
  citationgen: '/icons/icon-tool-citationgen.svg',
  randomgen: '/icons/icon-tool-randomgen.svg',
  zipfiles: '/icons/icon-tool-zipfiles.svg',
  unzipfiles: '/icons/icon-tool-unzipfiles.svg',
  invoicegen: '/icons/icon-tool-invoicegen.svg',
  resumebuilder: '/icons/icon-tool-resumebuilder.svg',
  htmltopdf: '/icons/icon-tool-htmltopdf.svg',
  htmltoexcel: '/icons/icon-tool-htmltoexcel.svg',
  texttoppt: '/icons/icon-tool-texttoppt.svg',
  textopdf: '/icons/icon-tool-textopdf.svg',
  wordcounter: '/icons/icon-tool-wordcounter.svg',
  caseconverter: '/icons/icon-tool-caseconverter.svg',
  aisummarizer: '/icons/icon-tool-aisummarizer.svg',

  // Image tools (same-category only — see note above)
  resize: '/icons/icon-tool-resize.svg',
  compress: '/icons/icon-tool-compress.svg',
  crop: '/icons/icon-tool-crop.svg',
  convertformat: '/icons/icon-tool-convertformat.svg',
  rotateflip: '/icons/icon-tool-rotateflip.svg',
  watermarkimage: '/icons/icon-tool-watermarkimage.svg',
  bgremove: '/icons/icon-tool-bgremove.svg',
  colorpalette: '/icons/icon-tool-colorpalette.svg',
  socialresize: '/icons/icon-tool-socialresize.svg',
  grayscale: '/icons/icon-tool-grayscale.svg',
  sepia: '/icons/icon-tool-sepia.svg',
  blurimage: '/icons/icon-tool-blurimage.svg',
  heictojpg: '/icons/icon-tool-heictojpg.svg',
  memecreator: '/icons/icon-tool-memecreator.svg',
  collagemaker: '/icons/icon-tool-collagemaker.svg',

  // PDF tools (same-category only — see note above)
  pdfmerge: '/icons/icon-tool-pdfmerge.svg',
  pdfrotate: '/icons/icon-tool-pdfrotate.svg',
  pdfpagenumbers: '/icons/icon-tool-pdfpagenumbers.svg',
  pdfextract: '/icons/icon-tool-pdfextract.svg',
  pdfdelete: '/icons/icon-tool-pdfdelete.svg',
  pdfwatermark: '/icons/icon-tool-pdfwatermark.svg',
  pdfsplit: '/icons/icon-tool-pdfsplit.svg',
  pdfcompress: '/icons/icon-tool-pdfcompress.svg',
  pdfprotect: '/icons/icon-tool-pdfprotect.svg',
  pdfcrop: '/icons/icon-tool-pdfcrop.svg',
  pdfunlock: '/icons/icon-tool-pdfunlock.svg',
  pdfsign: '/icons/icon-tool-pdfsign.svg',
  scantopdf: '/icons/icon-tool-scantopdf.svg',
  pdfcompare: '/icons/icon-tool-pdfcompare.svg',
  pdfedit: '/icons/icon-tool-pdfedit.svg',
};

const toolMeta = {
  resize: { label: 'Resize Image', desc: 'Set exact pixel dimensions for any photo.', needsConfig: true, accept: 'image/*', category: 'image', iconTo: 'image' },
  compress: { label: 'Compress Image', desc: 'Shrink file size with a quality slider.', needsConfig: true, accept: 'image/*', category: 'image', iconTo: 'image' },
  crop: { label: 'Crop Image', desc: 'Trim an image down to the area you need.', needsConfig: true, accept: 'image/*', category: 'image', iconTo: 'image' },
  pdf: { label: 'Convert to PDF', desc: 'Turn one or more images into a PDF.', needsConfig: true, multiFile: true, accept: 'image/*', category: 'image', iconTo: 'pdf' },
  imagetoexcel: { label: 'Image to Excel', desc: 'Extract tabular data from a photo.', needsConfig: false, accept: 'image/*', category: 'image', iconTo: 'excel' },
  imagetoppt: { label: 'Image to PPT', desc: 'Place one or more images onto slides.', needsConfig: true, multiFile: true, accept: 'image/*', category: 'image', iconTo: 'ppt' },
  convertformat: { label: 'Convert Image Format', desc: 'Switch between JPG, PNG, and WebP.', needsConfig: true, accept: 'image/*', category: 'image', iconTo: 'image' },
  rotateflip: { label: 'Rotate / Flip Image', desc: 'Fix orientation or mirror a photo.', needsConfig: true, accept: 'image/*', category: 'image', iconTo: 'image' },
  watermarkimage: { label: 'Watermark Image', desc: 'Stamp text across a photo.', needsConfig: true, accept: 'image/*', category: 'image', iconTo: 'image' },
  bgremove: {
    label: 'Remove Background', desc: 'AI cutout, no green screen needed.', needsConfig: true,
    accept: 'image/jpeg,image/png,image/webp', category: 'image', iconTo: 'image',
    // Custom landing-page hero copy (overrides the auto-generated one in
    // generate-seo-pages.mjs) — leads with real use cases the way the
    // established background-removal tools in this space do, in our own
    // words, with our own product's actual differentiator (touch-up
    // brush + background swap, both free) called out explicitly.
    heroCopy: {
      h1: 'Remove Image Background: Free & Automatic',
      intro: 'One tool for e-commerce photos, headshots, marketing graphics, and logos. Drop a photo and the AI finds the subject in seconds, then compare it against the original with a slider and swap in a new background color or image before you download. Nothing leaves your browser.',
    },
    useCases: [
      { icon: 'user', label: 'Headshots' },
      { icon: 'shopping-bag', label: 'E-commerce' },
      { icon: 'camera', label: 'Photographers' },
      { icon: 'megaphone', label: 'Marketing' },
      { icon: 'laptop', label: 'Developers' },
      { icon: 'palette', label: 'Graphic design' },
    ],
  },
  colorpalette: { label: 'Color Palette Extractor', desc: 'Pull the dominant colors from a photo.', needsConfig: true, accept: 'image/*', category: 'image', iconTo: 'image' },
  socialresize: { label: 'Social Media Resize', desc: 'Preset sizes for Instagram, YouTube, and more.', needsConfig: true, accept: 'image/*', category: 'image', iconTo: 'image' },
  grayscale: { label: 'Grayscale Converter', desc: 'Convert a photo to black and white.', needsConfig: true, accept: 'image/*', category: 'image', iconTo: 'image' },
  sepia: { label: 'Sepia / Vintage Filter', desc: 'Give a photo a warm, aged tone.', needsConfig: true, accept: 'image/*', category: 'image', iconTo: 'image' },
  blurimage: { label: 'Blur Image', desc: 'Soften part or all of a photo.', needsConfig: true, accept: 'image/*', category: 'image', iconTo: 'image' },
  heictojpg: { label: 'HEIC to JPG', desc: 'Convert iPhone photos to a universal format.', needsConfig: false, accept: '.heic,.heif', category: 'image', iconTo: 'image' },
  memecreator: { label: 'Meme Creator', desc: 'Add top and bottom caption text.', needsConfig: true, accept: 'image/*', category: 'image', iconTo: 'image' },
  collagemaker: { label: 'Collage Maker', desc: 'Combine several photos into a grid.', needsConfig: true, multiFile: true, accept: 'image/*', category: 'image', iconTo: 'image' },

  wordtoexcel: { label: 'Word to Excel', desc: 'Pull tables from a Word doc into a spreadsheet.', needsConfig: true, accept: '.docx', category: 'word', iconTo: 'excel' },
  wordtopdf: { label: 'Word to PDF', desc: 'Turn a DOCX file into a PDF.', needsConfig: true, accept: '.docx', category: 'word', iconTo: 'pdf' },
  wordtotext: { label: 'Word to Text', desc: 'Extract plain text from a Word doc.', needsConfig: true, accept: '.docx', category: 'word', iconTo: 'text' },

  exceltopdf: { label: 'Excel to PDF', desc: 'Convert a spreadsheet into a PDF table.', needsConfig: true, accept: '.xlsx,.xls,.csv', category: 'excel', iconTo: 'pdf' },
  exceltocsv: { label: 'Excel to CSV', desc: 'Export a sheet as plain CSV.', needsConfig: true, accept: '.xlsx,.xls', category: 'excel', iconTo: 'excel' },

  pdfmerge: { label: 'Merge PDFs', desc: 'Combine PDFs in the order you choose.', needsConfig: true, multiFile: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdfrotate: { label: 'Rotate PDF Pages', desc: 'Rotate every page in a PDF.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdfpagenumbers: { label: 'Add Page Numbers', desc: 'Stamp page numbers onto a PDF.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdfextract: { label: 'Extract Pages', desc: 'Pull specific pages into a new PDF.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdfdelete: { label: 'Delete Pages', desc: 'Remove specific pages from a PDF.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdfwatermark: { label: 'Watermark PDF', desc: 'Stamp text across every page.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdfsplit: { label: 'Split PDF', desc: 'Break a PDF into separate files by page range.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdfcompress: { label: 'Compress PDF', desc: 'Shrink file size by recompressing images and trimming unused data. Text and vectors stay untouched.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdftoword: { label: 'PDF to Word', desc: 'Extract text into an editable Word document.', needsConfig: false, accept: '.pdf', category: 'pdf', iconTo: 'word' },
  pdftoexcel: { label: 'PDF to Excel', desc: 'Pull tabular data into a spreadsheet.', needsConfig: false, accept: '.pdf', category: 'pdf', iconTo: 'excel' },
  pdftojpg: { label: 'PDF to JPG', desc: 'Export every page as an image.', needsConfig: false, accept: '.pdf', category: 'pdf', iconTo: 'image' },
  pdftoppt: { label: 'PDF to PowerPoint', desc: 'Turn each page into a slide.', needsConfig: false, accept: '.pdf', category: 'pdf', iconTo: 'ppt' },
  pdfprotect: { label: 'Protect PDF', desc: 'Add a password to a PDF.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdfcrop: { label: 'Crop PDF', desc: 'Trim the margins of every page.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdfunlock: { label: 'Unlock PDF', desc: 'Remove a password you already know.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdftomarkdown: { label: 'PDF to Markdown', desc: 'Convert pages into basic Markdown text.', needsConfig: false, accept: '.pdf', category: 'pdf', iconTo: 'text' },
  pdfsign: { label: 'Sign PDF', desc: 'Draw a signature and place it on a page.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdfedit: { label: 'Edit PDF', desc: 'Add, cover, and replace text or images on any page.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  scantopdf: { label: 'Scan to PDF', desc: 'Capture pages with your camera.', noFile: true, category: 'pdf', iconTo: 'pdf' },
  pdfcompare: { label: 'Compare PDF', desc: 'See text differences between two PDFs.', needsConfig: true, compareFiles: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },

  ppttotext: { label: 'PPT to Text', desc: 'Extract all text from a slide deck.', needsConfig: false, accept: '.pptx', category: 'ppt', iconTo: 'text' },

  // These 4 used to be their own "Text" category; Text was folded into
  // Other Tools (utilities), so their `category` now points there too —
  // that's what drives their icon badge, grid placement, and nav entry.
  texttoppt: { label: 'Text to PPT', desc: 'Turn pasted text into slides.', noFile: true, category: 'utilities', iconTo: 'ppt' },
  textopdf: { label: 'Text to PDF', desc: 'Turn pasted text into a PDF.', noFile: true, category: 'utilities', iconTo: 'pdf' },
  wordcounter: { label: 'Word Counter', desc: 'Count words and characters instantly.', noFile: true, category: 'utilities', iconTo: 'text' },
  caseconverter: { label: 'Case Converter', desc: 'Switch between upper, lower, and title case.', noFile: true, category: 'utilities', iconTo: 'text' },

  qrcode: { label: 'QR Code Generator', desc: 'Turn a link or text into a QR code.', noFile: true, category: 'utilities', iconTo: 'utilities' },
  passwordgen: { label: 'Password Generator', desc: 'Create a strong random password.', noFile: true, category: 'utilities', iconTo: 'utilities' },
  jsonformatter: { label: 'JSON Formatter', desc: 'Pretty-print and validate JSON.', noFile: true, category: 'utilities', iconTo: 'utilities' },
  base64: { label: 'Base64 Encode/Decode', desc: 'Convert text to and from Base64.', noFile: true, category: 'utilities', iconTo: 'utilities' },
  loremipsum: { label: 'Lorem Ipsum Generator', desc: 'Generate placeholder paragraphs.', noFile: true, category: 'utilities', iconTo: 'utilities' },
  unitconverter: { label: 'Unit Converter', desc: 'Convert length, weight, and temperature.', noFile: true, category: 'utilities', iconTo: 'utilities' },
  gpacalculator: { label: 'GPA / CGPA Calculator', desc: 'Calculate your grade point average.', noFile: true, category: 'utilities', iconTo: 'utilities' },
  citationgen: { label: 'Citation Generator', desc: 'Format a source in APA, MLA, or Chicago.', noFile: true, category: 'utilities', iconTo: 'utilities' },
  randomgen: { label: 'Random Generator', desc: 'Generate a random number or string.', noFile: true, category: 'utilities', iconTo: 'utilities' },
  zipfiles: { label: 'Zip Files', desc: 'Bundle multiple files into one archive.', needsConfig: true, multiFile: true, accept: '*/*', category: 'utilities', iconTo: 'utilities' },
  unzipfiles: { label: 'Unzip Archive', desc: 'Extract files from a zip archive.', needsConfig: false, accept: '.zip', category: 'utilities', iconTo: 'utilities' },
  invoicegen: { label: 'Invoice Generator', desc: 'Build and download a simple invoice.', noFile: true, category: 'utilities', iconTo: 'pdf' },
  resumebuilder: { label: 'Resume Builder', desc: 'Build and download a simple resume.', noFile: true, category: 'utilities', iconTo: 'pdf' },
  htmltopdf: { label: 'HTML to PDF', desc: 'Paste HTML code and export it as a PDF.', noFile: true, category: 'utilities', iconTo: 'pdf' },
  htmltoexcel: { label: 'HTML to Excel', desc: 'Extract tables from HTML into a spreadsheet.', noFile: true, category: 'utilities', iconTo: 'excel' },
  aisummarizer: { label: 'Content Paraphraser', desc: 'Reword and condense text privately, right in your browser.', noFile: true, category: 'utilities', iconTo: 'text' },
};

// Key order here drives display order wherever categories are listed
// end-to-end (the "Categories" nav dropdown on category pages, etc.):
// PDF, Image, Excel, Word, PPT, then Other Tools (utilities) last.
// "text" is gone as a category — its 4 tools moved into "utilities" below.
const categoryTools = {
  pdf: ['pdfmerge', 'pdfrotate', 'pdfpagenumbers', 'pdfextract', 'pdfdelete', 'pdfwatermark', 'pdftoword', 'pdftoexcel', 'pdftojpg', 'pdftoppt', 'pdfprotect', 'pdfcrop', 'pdfunlock', 'pdftomarkdown', 'pdfsign', 'pdfedit', 'scantopdf', 'pdfcompare', 'pdfsplit', 'pdfcompress'],
  image: ['resize', 'compress', 'crop', 'pdf', 'imagetoexcel', 'imagetoppt', 'convertformat', 'rotateflip', 'watermarkimage', 'bgremove', 'colorpalette', 'socialresize', 'grayscale', 'sepia', 'blurimage', 'heictojpg', 'memecreator', 'collagemaker'],
  excel: ['exceltopdf', 'exceltocsv'],
  word: ['wordtoexcel', 'wordtopdf', 'wordtotext'],
  ppt: ['ppttotext'],
  utilities: ['qrcode', 'passwordgen', 'jsonformatter', 'base64', 'loremipsum', 'unitconverter', 'gpacalculator', 'citationgen', 'randomgen', 'zipfiles', 'unzipfiles', 'invoicegen', 'resumebuilder', 'htmltopdf', 'htmltoexcel', 'aisummarizer', 'texttoppt', 'textopdf', 'wordcounter', 'caseconverter'],
};

// "All Tools" needs to actually look like all tools from the very first
// screen — not just be technically correct once you click "Show all
// tools". Object.keys(toolMeta) happens to list every "image" tool
// before the first "word" one, and the grid only shows its first 18
// cells by default (see TOOL_GRID_VISIBLE_LIMIT) — so a flat key order
// put 17 image cards on screen and nothing else, even though the "All
// Tools" tab was correctly marked active. Round-robining one tool per
// category at a time guarantees that first visible page spans every
// category, matching what "All Tools" actually promises.
function allToolKeysInterleaved() {
  const queues = Object.values(categoryTools).map((keys) => keys.slice());
  const result = [];
  let tookAny = true;
  while (tookAny) {
    tookAny = false;
    for (const q of queues) {
      if (q.length) { result.push(q.shift()); tookAny = true; }
    }
  }
  return result;
}

// ================= HOMEPAGE POPULAR TOOLS =================
// A manually maintained editorial pick, not analytics or click-count
// driven — kept in sync by hand with the same tools already curated in
// each category dropdown's "Popular" group (CATEGORY_NAV_CONFIG's
// top3, below) and the footer's "Popular Tools" column
// (partials/_footer.html). Six tools, spanning the site's two busiest
// categories (image, PDF) plus one cross-category utility staple.
const HOMEPAGE_POPULAR_TOOLS = ['resize', 'compress', 'pdfmerge', 'pdftoword', 'qrcode', 'pdfcompress'];

// Resolves a .category-bar chip's data-filter value to the tool keys it
// should show in #toolGrid. "popular" is a special case — it isn't a
// real category in categoryTools, it's the same curated
// HOMEPAGE_POPULAR_TOOLS list used to back the chip.
function getFilterKeys(cat) {
  if (cat === 'all') return allToolKeysInterleaved();
  if (cat === 'popular') return HOMEPAGE_POPULAR_TOOLS;
  return categoryTools[cat] || [];
}

// ================= RECENTLY USED TOOLS =================
// Up to 5 tool routes (just the internal tool key — never a filename,
// file content, or anything else about what the visitor processed),
// kept in localStorage on the visitor's own device only. Nothing here
// is sent anywhere; a "Clear history" control removes it entirely.
const RECENT_TOOLS_KEY = 'otw-recent-tools';
const RECENT_TOOLS_MAX = 5;

function getRecentTools() {
  let keys = [];
  try {
    keys = JSON.parse(localStorage.getItem(RECENT_TOOLS_KEY) || '[]');
  } catch { /* localStorage unavailable or corrupt value — just show nothing */ }
  if (!Array.isArray(keys)) return [];
  // Filter out any key that no longer exists (a tool removed since the
  // visitor's last visit) or that duplicates the featured Popular row,
  // so the two shelves don't just repeat each other.
  return keys.filter((k) => toolMeta[k] && !toolMeta[k].comingSoon).slice(0, RECENT_TOOLS_MAX);
}

function recordRecentTool(key) {
  if (!toolMeta[key]) return;
  try {
    let keys = JSON.parse(localStorage.getItem(RECENT_TOOLS_KEY) || '[]');
    if (!Array.isArray(keys)) keys = [];
    keys = [key, ...keys.filter((k) => k !== key)].slice(0, RECENT_TOOLS_MAX);
    localStorage.setItem(RECENT_TOOLS_KEY, JSON.stringify(keys));
  } catch { /* privacy mode / storage disabled — recently-used just won't persist */ }
}

function renderRecentTools() {
  const section = document.querySelector('#recentToolsSection');
  const gridEl = document.querySelector('#recentToolsGrid');
  if (!section || !gridEl) return; // only present on the homepage
  const keys = getRecentTools();
  if (!keys.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  gridEl.innerHTML = keys.map((key) => toolCardHtml(key, false)).join('');
  gridEl.querySelectorAll('.tool-card[data-tool]').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      handleToolCardClick(card.dataset.tool, card);
    });
  });
}

function wireRecentToolsClear() {
  const btn = document.querySelector('#recentToolsClear');
  if (!btn) return;
  btn.addEventListener('click', () => {
    try { localStorage.removeItem(RECENT_TOOLS_KEY); } catch { /* ignore */ }
    renderRecentTools();
  });
}

// ================= ICON BADGE RENDERING =================
// Small curved-arrow stamp added to every two-icon overlap badge (see
// .icon-overlap-arrow in style.css for positioning) — positioned lower
// and further right than a first pass, directly over the seam where
// the front ("from") icon and back ("to") icon actually overlap, so
// the curve visibly runs from one icon into the other rather than
// sitting in the corner gap above them. The arrowhead is a solid
// filled triangle, not a stroked chevron.
const ICON_OVERLAP_ARROW_SVG = `<svg class="icon-overlap-arrow" viewBox="0 0 20 24" aria-hidden="true"><path d="M4 22C2 14 6 6 13 5" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" /><polygon points="17,3 11.5,4.5 14,9" fill="var(--blue)" /></svg>`;

function renderIconBadge(fromCategory, toCategory, toolKey) {
  // A tool-specific icon (Other Tools) already fully identifies that one
  // tool on its own — pairing it with a destination-format overlay would
  // just bury the custom glyph behind the (now much larger) overlap
  // badge, so it always renders alone, ignoring toCategory.
  // width/height="40" is a Phase 3 CLS hint, not the rendered size — CSS
  // always wins the actual box (40px in a plain tool card, 16px/13px when
  // this same markup renders inside .mega-menu-badge — see style.css).
  // Every one of these icons is square, so a fixed 1:1 hint is correct in
  // every context it's reused in; only the true render size ever changes.
  const overrideIcon = toolKey && TOOL_ICON_OVERRIDES[toolKey];
  if (overrideIcon) {
    return `<img src="${overrideIcon}" alt="" width="40" height="40" />`;
  }
  const fromIcon = CATEGORY_ICONS[fromCategory];
  const toIcon = CATEGORY_ICONS[toCategory];
  if (!toCategory || fromCategory === toCategory) {
    return `<img src="${fromIcon}" alt="" width="40" height="40" />`;
  }
  return `<img src="${fromIcon}" alt="" width="40" height="40" /><span class="arrow">→</span><img src="${toIcon}" alt="" width="40" height="40" />${ICON_OVERLAP_ARROW_SVG}`;
}

// ================= TOOL GRID RENDERING =================
// Icon + name cards, background tinted per category, no description
// text. Only the first 3 rows (6 per row = 18 cells) show by default;
// when there are more tools than that, the 18th cell becomes a "⋯
// Tools" tile that reveals the rest on click, so the grid still reads
// as exactly 3 full rows either way.
const TOOL_GRID_VISIBLE_ROWS = 3;
const TOOL_GRID_COLUMNS = 6;
const TOOL_GRID_VISIBLE_LIMIT = TOOL_GRID_VISIBLE_ROWS * TOOL_GRID_COLUMNS;

function toolCardHtml(key, hidden) {
  const meta = toolMeta[key];
  if (!meta) return '';
  const iconHtml = renderIconBadge(meta.category, meta.iconTo, key);
  const hiddenClass = hidden ? ' tool-card-hidden' : '';
  const catClass = ` cat-${meta.category}`;
  const catLabel = CATEGORY_LABELS[meta.category] || meta.category;
  if (meta.comingSoon) {
    return `
      <div class="tool-card${catClass} coming-soon${hiddenClass}">
        <div class="tool-icon-badge">${iconHtml}</div>
        <div class="tool-card-body">
          <span class="tool-card-cat">${catLabel}</span>
          <h3>${meta.label}</h3>
          ${meta.desc ? `<p>${meta.desc}</p>` : ''}
        </div>
      </div>
    `;
  }
  // A real <a href> to the tool's dedicated URL — crawlable and
  // shareable on its own — but the click is still intercepted below so
  // the existing "route to the drop zone if no file is ready yet" flow
  // keeps working exactly as before for real users. Same row layout as
  // .popular-tool-card (category label, title, description, arrow) —
  // one card system across the whole site, not a separate style here.
  return `
    <a class="tool-card${catClass}${hiddenClass}" href="${toolUrl(key) || '#'}" data-tool="${key}">
      <div class="tool-icon-badge">${iconHtml}</div>
      <div class="tool-card-body">
        <span class="tool-card-cat">${catLabel}</span>
        <h3>${meta.label}</h3>
        ${meta.desc ? `<p>${meta.desc}</p>` : ''}
      </div>
      <span class="icon icon-arrow-right tool-card-arrow" aria-hidden="true"></span>
    </a>
  `;
}

function renderToolGrid(containerEl, toolKeys) {
  const needsMore = toolKeys.length > TOOL_GRID_VISIBLE_LIMIT;
  // Reserve the last of the 18 visible cells for the "more" tile, so
  // 17 real tools + 1 tile still fill exactly 3 rows.
  const shownKeys = needsMore ? toolKeys.slice(0, TOOL_GRID_VISIBLE_LIMIT - 1) : toolKeys;
  const hiddenKeys = needsMore ? toolKeys.slice(TOOL_GRID_VISIBLE_LIMIT - 1) : [];

  let html = shownKeys.map((key) => toolCardHtml(key, false)).join('')
    + hiddenKeys.map((key) => toolCardHtml(key, true)).join('');

  if (needsMore) {
    html += `
      <div class="tool-card tool-grid-more-tile" id="toolGridMore" role="button" tabindex="0" aria-label="Show all tools">
        <div class="tool-icon-badge"><span class="tool-grid-more-dots">⋯</span></div>
        <div class="tool-card-body">
          <h3>Show all tools</h3>
          <p>See the rest of this category.</p>
        </div>
      </div>
    `;
  }

  containerEl.innerHTML = html;

  containerEl.querySelectorAll('.tool-card[data-tool]').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      handleToolCardClick(card.dataset.tool, card);
    });
  });

  const moreTile = containerEl.querySelector('#toolGridMore');
  if (moreTile) {
    const reveal = () => {
      containerEl.querySelectorAll('.tool-card-hidden').forEach((card) => card.classList.remove('tool-card-hidden'));
      moreTile.remove();
    };
    moreTile.addEventListener('click', reveal);
    moreTile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); }
    });
  }
}

function handleToolCardClick(toolKey, card) {
  const meta = toolMeta[toolKey];
  if (!meta) return;
  trackToolOpened(toolKey, 'card');
  clearResultPage(); // starting a new tool from anywhere restores a clean grid if a result page was showing
  // openToolModal is the single source of truth for what happens next:
  // opens in place if the tool needs no file (or one is already ready),
  // otherwise sends the visitor to that tool's own dedicated page, which
  // has its own upload panel.
  openToolModal(toolKey, card);
}

// ================= MODAL CORE =================
let currentFile = null;
let cropperInstance = null;
let currentImg = null;
let currentToolKey = null;
let lastFocusedElement = null;
let pendingHeroFile = null;
let renderGeneration = 0;

const backdrop = document.querySelector('#modalBackdrop');
const modalTitle = document.querySelector('#modalTitle');
const modalBody = document.querySelector('#modalBody');
const modalClose = document.querySelector('#modalClose');
const modalBox = document.querySelector('.modal-box');

function openToolModal(toolKey, triggerEl, initialMultiFiles) {
  const meta = toolMeta[toolKey];
  if (!meta) return;
  recordRecentTool(toolKey); // tool key only — never the file the visitor is about to process
  clearResultPage(); // starting a new tool from anywhere restores the hero/dropzone if a result page was showing

  // Decide BEFORE opening anything: if this tool needs a file and none is ready, redirect to the
  // big blue drop zone instead of opening a modal with its own separate upload box.
  const hasReadySingleFile = !meta.multiFile && pendingHeroFile && validateFileType(pendingHeroFile, meta.accept);
  const hasReadyMultiFiles = meta.multiFile && initialMultiFiles && initialMultiFiles.length > 0;
  const needsFile = !meta.noFile && toolKey !== 'pdfcompare';

  if (needsFile && !hasReadySingleFile && !hasReadyMultiFiles) {
    // No shared upload zone lives on this page (homepage/category pages
    // only show search + the tool grid) — send the visitor to the
    // tool's own dedicated page, which has its own upload panel right
    // below the fold.
    const url = toolUrl(toolKey);
    if (url) window.location.href = url;
    return;
  }

  currentToolKey = toolKey;
  currentFile = null;
  lastFocusedElement = triggerEl || document.activeElement;

  modalTitle.textContent = meta.label;
  backdrop.classList.remove('hidden');
  requestAnimationFrame(() => backdrop.classList.add('visible'));
  document.body.classList.add('modal-open');
  history.pushState({ tool: toolKey }, '', `?tool=${toolKey}`);

  if (meta.noFile) {
    renderNoFileTool(toolKey);
  } else if (toolKey === 'pdfcompare') {
    renderCompareTool();
  } else if (meta.multiFile) {
    renderMultiFileTool(initialMultiFiles);
  } else {
    const carriedFile = pendingHeroFile;
    pendingHeroFile = null;
    renderModalShell();
    handleFiles([carriedFile]);
  }
  modalClose.focus();
}

function closeToolModal(skipHistory) {
  backdrop.classList.remove('visible');
  document.body.classList.remove('modal-open');
  setTimeout(() => backdrop.classList.add('hidden'), 150);
  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
  if (!skipHistory) {
    const url = new URL(window.location);
    url.searchParams.delete('tool');
    history.pushState({}, '', url.pathname);
  }
  if (lastFocusedElement) lastFocusedElement.focus();
}

// Informational pages (About, Contact, Privacy Policy, Terms of
// Service) carry the shared header/footer but no tool modal markup —
// guard this module-level wiring so importing main.js there doesn't
// throw before any of the page-specific init functions even run.
if (backdrop && modalClose) {
  modalClose.addEventListener('click', () => closeToolModal());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeToolModal(); });
}
document.addEventListener('keydown', (e) => {
  if (backdrop && !backdrop.classList.contains('hidden')) {
    if (e.key === 'Escape') { closeToolModal(); return; }
    if (e.key === 'Tab') {
      const focusables = modalBox.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  }
});
window.addEventListener('popstate', () => {
  const params = new URLSearchParams(window.location.search);
  const tool = params.get('tool');
  if (tool && toolMeta[tool]) {
    currentToolKey = tool;
    currentFile = null;
    modalTitle.textContent = toolMeta[tool].label;
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => backdrop.classList.add('visible'));
    document.body.classList.add('modal-open');
    if (toolMeta[tool].noFile) {
      renderNoFileTool(tool);
    } else {
      closeToolModal(true);
      handleToolCardClick(tool, null);
    }
  } else {
    closeToolModal(true);
  }
});

// ---------- Upload state (with idle bird) ----------
// Once a file is picked, the modal becomes a two-pane workspace: the left
// pane (#configPreview) is reserved purely for previewing/working on the
// file, the right pane (#configArea) is a sidebar holding every control,
// info line, and action/download button. See renderSingleFileConfig(),
// renderMultiFileTool(), showResultState(), and showBgRemoveTouchUpState()
// for how each screen fills those two panes.
function renderModalShell() {
  modalBody.innerHTML = `
    <div class="upload-row">
      <video class="bird-video" src="/bird/bird-idle.mp4" autoplay loop muted playsinline></video>
    </div>
    <div class="tp-workspace" id="tpWorkspace">
      <div class="tp-preview-pane" id="configPreview"></div>
      <aside class="tp-sidebar" id="configArea"></aside>
    </div>
  `;
}

function validateFileType(file, acceptString) {
  if (!acceptString) return true;
  const acceptList = acceptString.split(',').map((s) => s.trim().toLowerCase());
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return acceptList.some((pattern) => {
    if (pattern.startsWith('.')) return fileName.endsWith(pattern);
    if (pattern.endsWith('/*')) return fileType.startsWith(pattern.replace('/*', '/'));
    return fileType === pattern;
  });
}

function showTypeRejection(toolLabel, acceptString) {
  const readable = acceptString.replace(/\./g, '').replace(/,/g, ', ').toUpperCase();
  const area = document.querySelector('#configArea');
  if (!area) return;
  area.insertAdjacentHTML('beforeend', `
    <p style="color: var(--red-dark); margin-top: 12px; font-size: 0.88rem;">
      That file doesn't look like a supported type for ${toolLabel}. Expected: ${readable}. Try a different file.
    </p>
  `);
}

function handleFiles(fileList) {
  const meta = toolMeta[currentToolKey];
  if (meta.multiFile) {
    const files = Array.from(fileList).filter((f) => {
      if (!validateFileType(f, meta.accept)) {
        showTypeRejection(meta.label, meta.accept);
        return false;
      }
      return true;
    });
    if (files.length) renderMultiFileTool(files);
    return;
  }

  const file = fileList[0];
  if (!validateFileType(file, meta.accept)) {
    showTypeRejection(meta.label, meta.accept);
    return;
  }

  const uploadRow = modalBody.querySelector('.upload-row');
  if (uploadRow) uploadRow.style.display = 'none';

  currentFile = file;
  if (meta.needsConfig) {
    renderSingleFileConfig();
  } else {
    runSimpleTool();
  }
}

function showPreviewImage(file) {
  const pane = document.querySelector('#configPreview') || document.querySelector('#configArea');
  const existingImg = pane.querySelector('.preview-img');
  if (existingImg) existingImg.remove();
  const url = URL.createObjectURL(file);
  const img = document.createElement('img');
  img.src = url;
  img.className = 'preview-img';
  pane.prepend(img);
  currentImg = img;
}

// ---------- Processing state (with loading bird) ----------
// Set by showProcessingState(), read by showResultState()/showErrorState()
// to compute file_processing_completed's durationMs — never anything more
// than a timestamp, so it carries no file information itself.
let processingStartedAt = null;

function showProcessingState(captionText) {
  processingStartedAt = performance.now();
  trackProcessingStarted(currentToolKey);
  modalBody.innerHTML = `
    <div class="processing-row">
      <video class="bird-video" src="/bird/bird-loading.mp4" autoplay loop muted playsinline></video>
      <p class="processing-status" id="processingCaption" aria-live="polite">${captionText || 'Working...'}</p>
      <div class="progress-bar-track" id="progressBarTrack" style="display:none;">
        <div class="progress-bar-fill" id="progressBarFill"></div>
      </div>
    </div>
  `;
}

function updateProcessingCaption(text) {
  const el = document.querySelector('#processingCaption');
  if (el) el.textContent = text;
}

function updateProcessingProgress(percent, text) {
  const track = document.querySelector('#progressBarTrack');
  const fill = document.querySelector('#progressBarFill');
  if (track) track.style.display = 'block';
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (text) updateProcessingCaption(text);
}

// Human-readable file size, e.g. 482 -> "482 B", 15400 -> "15 KB", 3200000 -> "3.2 MB".
function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------- Toast confirmations (post-upload workspace only) ----------
// A brief, dismissable confirmation for an action that has no other visible
// feedback (a download starting, a file leaving the grid). Stacks if more
// than one fires in quick succession; each clears itself after ~2.6s.
let toastHost = null;
function showToast(message, icon) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'tp-toast-host';
    // role="status" + aria-live="polite": a screen reader announces each
    // toast (e.g. "Downloading file.pdf") without interrupting whatever
    // the visitor is doing, the same way the toast is visually a brief,
    // non-blocking confirmation rather than a modal.
    toastHost.setAttribute('role', 'status');
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const toast = document.createElement('div');
  toast.className = 'tp-toast';
  toast.innerHTML = `<span class="tp-toast-icon">${icon || '✓'}</span><span>${message}</span>`;
  toastHost.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 250);
  }, 2600);
}

// ---------- Result state ----------
// Shown as a normal section of the page — not inside the modal — so the
// site header/nav and footer stay visible around it, the way a dedicated
// result page would on its own URL. closeToolModal() below is what makes
// that possible; everything else just builds a page section and swaps it
// in where the hero/upload UI was.
const RESULT_RING_RADIUS = 52;
const RESULT_RING_CIRCUMFERENCE = 2 * Math.PI * RESULT_RING_RADIUS;

function clearResultPage() {
  const page = document.querySelector('#toolResultPage');
  if (page) page.remove();
  document.body.classList.remove('tool-result-active');
}

function showResultState(blob, filename, extraNote) {
  closeToolModal(false);
  const durationMs = processingStartedAt !== null ? performance.now() - processingStartedAt : undefined;
  processingStartedAt = null;
  trackProcessingCompleted(currentToolKey, durationMs);
  const url = URL.createObjectURL(blob);
  const meta = toolMeta[currentToolKey];

  // Most tools don't have a meaningful "% smaller" — the ring only shows
  // up for the ones that do (compress-pdf, compress-image, ...), parsed
  // straight out of the same note text the stat pill already shows.
  const percentMatch = extraNote && extraNote.match(/(\d+)%\s*smaller/i);
  const percent = percentMatch ? Math.max(0, Math.min(100, parseInt(percentMatch[1], 10))) : null;
  const ringOffset = percent === null ? RESULT_RING_CIRCUMFERENCE : RESULT_RING_CIRCUMFERENCE * (1 - percent / 100);
  const ringHtml = percent === null ? '' : `
    <div class="result-ring-wrap">
      <svg class="result-ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="result-ring-track" cx="60" cy="60" r="${RESULT_RING_RADIUS}" />
        <circle class="result-ring-progress" cx="60" cy="60" r="${RESULT_RING_RADIUS}"
          style="stroke-dasharray:${RESULT_RING_CIRCUMFERENCE}; stroke-dashoffset:${ringOffset};" />
      </svg>
      <div class="result-ring-label">
        <span class="result-ring-percent">${percent}%</span>
        <span class="result-ring-caption">smaller</span>
      </div>
    </div>
  `;

  // Up to 6 other tools from the same category — "Continue to…", same as
  // the rest of the site's tool grids (reuses .tool-grid, already a
  // 6-column layout, so these look identical to every other tool grid).
  const continueKeys = meta ? (categoryTools[meta.category] || []).filter((k) => k !== currentToolKey).slice(0, 6) : [];
  const continueHtml = continueKeys.length ? `
    <div class="tp-result-continue">
      <h2>Continue to&hellip;</h2>
      <div class="tool-grid tp-result-continue-grid">
        ${continueKeys.map((k) => toolCardHtml(k, false)).join('')}
      </div>
    </div>
  ` : '';

  // Restrained continuation area — deliberately BELOW "Continue to…", so
  // it never competes with the result/download or with finding another
  // tool. Feedback first (closest to the task just finished), then the
  // honest "planned" premium note (see src/config.js — no product exists
  // yet, so no button/price/trial appears), then the ad slot last and
  // furthest from every primary action (inert today — see src/adSlots.js).
  const extrasHtml = `
    <div class="tp-result-extras">
      ${renderFeedbackControlHtml()}
      ${renderPremiumNoteHtml()}
      ${adSlotHtml('adSlotToolResult', 'rectangle')}
    </div>
  `;

  const page = document.createElement('section');
  page.className = 'tp-result-page';
  page.id = 'toolResultPage';
  page.innerHTML = `
    <div class="tp-result-inner">
      <h1 class="tp-result-heading">${meta ? meta.label : 'Your file'} is ready!</h1>
      <div class="tp-workspace tp-result-main${percent === null ? ' no-ring' : ''}">
        <div class="tp-preview-pane">
          <div class="result-preview-wrap" id="resultPreviewWrap">
            <p class="result-preview-caption">Loading preview…</p>
          </div>
        </div>
        <aside class="tp-sidebar">
          ${ringHtml}
          <a href="${url}" download="${filename}" class="download-btn"><span class="icon icon-download" aria-hidden="true"></span> Download ${filename}</a>
          <div class="result-done-badge"><span class="result-done-check">✓</span> Done</div>
          ${extraNote ? `<p class="result-stat-pill">${extraNote}</p>` : ''}
          <p class="result-filename">${filename} <span class="result-filesize">· ${formatBytes(blob.size)}</span></p>
          <button class="reset-btn" id="resetToolBtn">Process another file</button>
        </aside>
      </div>
      ${continueHtml}
      ${extrasHtml}
    </div>
  `;

  clearResultPage(); // in case one was already showing (shouldn't normally happen, but stay safe)
  const heroEl = document.querySelector('.hero');
  if (heroEl) heroEl.insertAdjacentElement('afterend', page);
  else document.body.appendChild(page);
  document.body.classList.add('tool-result-active');
  page.scrollIntoView({ behavior: 'smooth', block: 'start' });

  renderResultPreview(blob, url);
  page.querySelector('.download-btn').addEventListener('click', () => {
    trackResultDownloaded(currentToolKey);
    showToast(`Downloading ${filename}`, '<span class="icon icon-download" aria-hidden="true"></span>');
  });
  page.querySelector('#resetToolBtn').addEventListener('click', () => {
    currentFile = null;
    clearResultPage();
    handleToolCardClick(currentToolKey, lastFocusedElement);
  });
  wireResultExtras(page);
  mountAdSlots();
}

// ---------- Result-page continuation extras (feedback / premium / ads) ----------
// Non-deceptive by construction: PREMIUM_CTA_ENABLED is false (see
// src/config.js), so this renders plain description text with no button,
// price, or "Start trial" action — exactly the brief's fallback
// requirement for when the underlying product doesn't exist yet.
function renderPremiumNoteHtml() {
  const benefits = PREMIUM_BENEFITS.slice(0, 5);
  const benefitsText = benefits.length > 1
    ? `${benefits.slice(0, -1).join(', ')}, and ${benefits[benefits.length - 1]}`
    : (benefits[0] || '');
  const ctaHtml = (PREMIUM_CTA_ENABLED && PREMIUM_CTA_HREF)
    ? `<a class="tp-premium-note-cta" href="${PREMIUM_CTA_HREF}" id="premiumCtaLink">Learn about advanced workflows <span class="icon icon-arrow-right" aria-hidden="true"></span></a>`
    : '';
  return `
    <div class="tp-premium-note" id="premiumNote">
      <span class="tp-premium-note-icon" aria-hidden="true">&#10022;</span>
      <div>
        <h3>Advanced workflows are planned</h3>
        <p>Everything you just used is free, with no account and no upload. We're exploring optional features for heavier workflows &mdash; ${benefitsText} &mdash; for people who need more than one file at a time. Nothing to buy today, and nothing about the free tools changes.</p>
        ${ctaHtml}
      </div>
    </div>
  `;
}

function renderFeedbackControlHtml() {
  return `
    <div class="tp-feedback" id="resultFeedback">
      <span id="resultFeedbackLabel">Was this result what you expected?</span>
      <div class="tp-feedback-buttons">
        <button type="button" class="tp-feedback-btn" id="resultFeedbackYes" aria-label="Yes, this was helpful">&#128578;</button>
        <button type="button" class="tp-feedback-btn" id="resultFeedbackNo" aria-label="No, this wasn't what I expected">&#128577;</button>
      </div>
    </div>
  `;
}

function wireResultExtras(page) {
  // Feedback is UI-only — there is no backend to send it to, so it never
  // claims to be stored or reviewed. It just confirms the tap and moves
  // on, which is the honest version of this control until a real
  // destination for the feedback exists.
  const feedbackEl = page.querySelector('#resultFeedback');
  if (feedbackEl) {
    const yesBtn = feedbackEl.querySelector('#resultFeedbackYes');
    const noBtn = feedbackEl.querySelector('#resultFeedbackNo');
    const respond = (btn) => {
      [yesBtn, noBtn].forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      showToast('Thanks for letting us know');
    };
    yesBtn?.addEventListener('click', () => respond(yesBtn));
    noBtn?.addEventListener('click', () => respond(noBtn));
  }

  // premium_cta_viewed fires once the note actually scrolls into view,
  // not merely once it exists in the DOM — this section sits below the
  // fold on most result pages, so a render-time "viewed" event would
  // overcount visitors who never scrolled that far.
  const premiumEl = page.querySelector('#premiumNote');
  if (premiumEl && 'IntersectionObserver' in window) {
    const toolKeyAtRender = currentToolKey;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { trackPremiumCtaViewed(toolKeyAtRender); io.disconnect(); }
      });
    }, { threshold: 0.5 });
    io.observe(premiumEl);
  }
  page.querySelector('#premiumCtaLink')?.addEventListener('click', () => trackPremiumCtaClicked(currentToolKey));
}

// Shows what the output actually looks like before the user downloads it.
// Images render directly; PDFs render page 1 via pdf.js (same renderer used
// for input previews); everything else (docx/xlsx/pptx/zip/text/etc.) falls
// back to a simple "ready to download" line since there's no visual to show.
async function renderResultPreview(blob, url) {
  const wrap = document.querySelector('#resultPreviewWrap');
  if (!wrap) return;
  const type = blob.type || '';

  if (type.startsWith('image/')) {
    wrap.innerHTML = `<img src="${url}" class="preview-img result-preview-img" alt="Result preview" />`;
    return;
  }

  if (type === 'application/pdf') {
    try {
      const pdfjsLib = await getPdfjsLib();
      const bytes = await blob.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
      const page = await pdfDoc.getPage(1);
      const canvas = await renderPdfPageToCanvas(page, 1.0);
      const freshWrap = document.querySelector('#resultPreviewWrap');
      if (!freshWrap) return; // user already moved on (reset/closed) while this was loading
      const img = document.createElement('img');
      img.className = 'preview-img result-preview-img';
      img.alt = 'Result preview';
      img.src = canvas.toDataURL('image/jpeg', 0.85);
      freshWrap.innerHTML = '';
      freshWrap.appendChild(img);
      if (pdfDoc.numPages > 1) {
        freshWrap.insertAdjacentHTML('beforeend', `<p class="result-preview-caption">Page 1 of ${pdfDoc.numPages} shown</p>`);
      }
    } catch {
      const freshWrap = document.querySelector('#resultPreviewWrap');
      if (freshWrap) freshWrap.innerHTML = `<p class="result-preview-caption"><span class="icon icon-file" aria-hidden="true"></span> Preview unavailable</p>`;
    }
    return;
  }

  const kindLabel = type || 'File';
  wrap.innerHTML = `<p class="result-preview-caption"><span class="icon icon-package" aria-hidden="true"></span> ${kindLabel} ready to download</p>`;
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the processed image.'));
    img.src = URL.createObjectURL(blob);
  });
}

// Draws `img` into `ctx` at size (w,h) using cover-fit (fills the whole
// area, cropping overflow) — used for a user-supplied background photo,
// same fit behavior as CSS `background-size: cover`.
function drawImageCover(ctx, img, w, h) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// Renders the chosen background (transparent / solid color / uploaded
// photo) alone onto its own canvas, sized to (w,h). Kept separate from
// the composited result so an erase mark can reveal exactly the right
// replacement pixel for whatever background is currently selected,
// instead of just punching a transparent hole regardless of background.
function renderBgLayer(bgChoice, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (bgChoice && bgChoice.type === 'color') {
    ctx.fillStyle = bgChoice.value;
    ctx.fillRect(0, 0, w, h);
  } else if (bgChoice && bgChoice.type === 'image' && bgChoice.img) {
    drawImageCover(ctx, bgChoice.img, w, h);
  }
  // type === 'transparent' (or no choice yet): leave fully transparent.
  return canvas;
}

// Combines the AI cutout with the chosen background: the cutout is drawn
// over the background layer, so transparent AI pixels reveal the chosen
// background automatically via normal alpha compositing.
async function composeBgRemoveResult(cutoutBlob, bgChoice) {
  const cutoutImg = await loadImageFromBlob(cutoutBlob);
  const w = cutoutImg.naturalWidth;
  const h = cutoutImg.naturalHeight;

  const bgCanvas = renderBgLayer(bgChoice, w, h);

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d');
  octx.drawImage(bgCanvas, 0, 0);
  octx.drawImage(cutoutImg, 0, 0, w, h);

  return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
}

// ---------- Remove Background: touch-up screen (shown after the AI runs) ----------
// A single before/after slider is the whole review step: drag to compare,
// pick a background swatch, download. No manual brush/marking step —
// the AI cutout (already edge-feathered) is trusted as the result.
async function showBgRemoveTouchUpState(cutoutBlob, sourceFile) {
  const sourceUrl = URL.createObjectURL(sourceFile);

  modalBody.innerHTML = `
    <div class="tp-workspace">
      <div class="tp-preview-pane">
        <div class="bgr-compare" id="bgrCompare">
          <div class="bgr-compare-after bgremove-checkerboard" id="bgrAfterLayer">
            <img class="bgr-compare-img" id="bgrAfterImg" alt="Result preview" />
          </div>
          <div class="bgr-compare-before" id="bgrBeforeLayer">
            <img class="bgr-compare-img" src="${sourceUrl}" alt="Original photo" />
          </div>
          <div class="bgr-compare-handle" id="bgrHandle" role="slider" aria-label="Comparison slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" tabindex="0"><span class="bgr-compare-grip"></span></div>
          <span class="bgr-compare-tag bgr-compare-tag-before">Before</span>
          <span class="bgr-compare-tag bgr-compare-tag-after">After</span>
        </div>
      </div>
      <aside class="tp-sidebar">
        <p class="result-preview-caption">Drag the slider to compare, pick a background below, then download.</p>

        <div class="bgr-bg-options" id="bgrBgOptions">
          <span class="bgr-bg-label">Background</span>
          <button type="button" class="bgr-swatch bgr-swatch-transparent active" data-bg-type="transparent" title="Transparent" aria-label="Transparent"></button>
          <button type="button" class="bgr-swatch" data-bg-type="color" data-bg-value="#FFFFFF" style="background:#FFFFFF" title="White" aria-label="White"></button>
          <button type="button" class="bgr-swatch" data-bg-type="color" data-bg-value="#000000" style="background:#000000" title="Black" aria-label="Black"></button>
          <button type="button" class="bgr-swatch" data-bg-type="color" data-bg-value="#378ADD" style="background:#378ADD" title="Blue" aria-label="Blue"></button>
          <button type="button" class="bgr-swatch" data-bg-type="color" data-bg-value="#EAF3DE" style="background:#EAF3DE" title="Light green" aria-label="Light green"></button>
          <label class="bgr-swatch bgr-swatch-custom" title="Custom color" aria-label="Custom color">
            <span class="icon icon-palette" aria-hidden="true"></span><input type="color" id="bgrCustomColor" value="#E24B4A" />
          </label>
          <label class="bgr-swatch bgr-swatch-upload" title="Upload a background photo" aria-label="Upload a background photo">
            <span class="icon icon-image" aria-hidden="true"></span><input type="file" accept="image/*" id="bgrUploadInput" hidden />
          </label>
        </div>

        <button type="button" class="download-btn" id="bgDownloadBtn" style="border:none; cursor:pointer;">Download result</button>
        <button class="reset-btn" id="resetToolBtn">Convert another file</button>
      </aside>
    </div>
  `;

  const afterImg = document.querySelector('#bgrAfterImg');
  const afterLayer = document.querySelector('#bgrAfterLayer');

  let bgChoice = { type: 'transparent' };
  let currentAfterUrl = null;

  // Re-renders the compare slider's "after" side from the current cutout +
  // background choice. Called on init and after each background change.
  async function renderComparePreview() {
    const blob = await composeBgRemoveResult(cutoutBlob, bgChoice);
    const url = URL.createObjectURL(blob);
    afterImg.src = url;
    if (currentAfterUrl) URL.revokeObjectURL(currentAfterUrl);
    currentAfterUrl = url;
    afterLayer.classList.toggle('bgremove-checkerboard', bgChoice.type === 'transparent');
  }
  renderComparePreview();

  // ---- Compare slider drag ----
  const compareEl = document.querySelector('#bgrCompare');
  const beforeLayer = document.querySelector('#bgrBeforeLayer');
  const handle = document.querySelector('#bgrHandle');
  let sliderDragging = false;

  const setSlider = (pct) => {
    const clamped = Math.max(0, Math.min(100, pct));
    beforeLayer.style.clipPath = `inset(0 ${100 - clamped}% 0 0)`;
    handle.style.left = `${clamped}%`;
    handle.setAttribute('aria-valuenow', String(Math.round(clamped)));
  };
  setSlider(50);

  const pctFromEvent = (e) => {
    const rect = compareEl.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * 100;
  };
  handle.addEventListener('pointerdown', (e) => {
    sliderDragging = true;
    handle.setPointerCapture(e.pointerId);
  });
  compareEl.addEventListener('pointermove', (e) => {
    if (!sliderDragging) return;
    setSlider(pctFromEvent(e));
  });
  ['pointerup', 'pointercancel'].forEach((evt) => {
    handle.addEventListener(evt, () => { sliderDragging = false; });
  });
  handle.addEventListener('keydown', (e) => {
    const current = Number(handle.getAttribute('aria-valuenow')) || 50;
    if (e.key === 'ArrowLeft') setSlider(current - 5);
    else if (e.key === 'ArrowRight') setSlider(current + 5);
  });

  // ---- Background swatches ----
  const swatches = document.querySelectorAll('.bgr-swatch[data-bg-type]');
  const setActiveSwatch = (el) => {
    swatches.forEach((s) => s.classList.remove('active'));
    if (el) el.classList.add('active');
  };
  swatches.forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.bgType;
      bgChoice = type === 'color' ? { type: 'color', value: btn.dataset.bgValue } : { type: 'transparent' };
      setActiveSwatch(btn);
      renderComparePreview();
    });
  });
  document.querySelector('#bgrCustomColor').addEventListener('input', (e) => {
    bgChoice = { type: 'color', value: e.target.value };
    setActiveSwatch(document.querySelector('.bgr-swatch-custom'));
    renderComparePreview();
  });
  document.querySelector('#bgrUploadInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = await loadImageFromBlob(file);
    bgChoice = { type: 'image', img };
    setActiveSwatch(document.querySelector('.bgr-swatch-upload'));
    renderComparePreview();
  });

  document.querySelector('#bgDownloadBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Preparing…';
    try {
      const finalBlob = await composeBgRemoveResult(cutoutBlob, bgChoice);
      const filename = bgChoice.type === 'transparent'
        ? `no-bg-${sourceFile.name.split('.')[0]}.png`
        : `new-bg-${sourceFile.name.split('.')[0]}.png`;
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(`Downloading ${filename}`, '<span class="icon icon-download" aria-hidden="true"></span>');
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      showErrorState(err.message);
      return;
    }
    btn.disabled = false;
    btn.textContent = originalLabel;
  });

  document.querySelector('#resetToolBtn').addEventListener('click', () => {
    currentFile = null;
    closeToolModal(false);
    handleToolCardClick(currentToolKey, lastFocusedElement);
  });
}

// errorType is a coarse, hand-picked bucket (e.g. 'unsupported_format',
// 'incorrect_password') — NEVER the raw `message` shown to the visitor,
// since a handful of dependencies occasionally interpolate a detected
// value into their thrown Error#message and this file has no way to
// audit every library's every error path. Defaults to a single generic
// bucket for the many call sites that haven't been given a specific one.
function showErrorState(message, errorType) {
  processingStartedAt = null;
  trackProcessingFailed(currentToolKey, errorType || 'processing_error');
  modalBody.innerHTML = `
    <div class="result-box" role="alert">
      <video class="bird-video" src="/bird/bird-idle.mp4" autoplay loop muted playsinline style="margin: 0 auto 12px;"></video>
      <p style="color: var(--red-dark);">${message}</p>
      <button class="reset-btn" id="errorBackBtn">Try again</button>
    </div>
  `;
  document.querySelector('#errorBackBtn').addEventListener('click', () => {
    closeToolModal(false);
    handleToolCardClick(currentToolKey, lastFocusedElement);
  });
}

// ================= SIMPLE (no-config) TOOLS =================
async function runSimpleTool() {
  showProcessingState('Working...');
  try {
    let blob, filename, extraNote = '';
    if (currentToolKey === 'imagetoexcel') {
      blob = await imageToExcelBlob(currentFile);
      filename = `${currentFile.name.split('.')[0]}.xlsx`;
    } else if (currentToolKey === 'heictojpg') {
      const heic2any = (await import('heic2any')).default;
      blob = await heic2any({ blob: currentFile, toType: 'image/jpeg', quality: 0.9 });
      filename = `${currentFile.name.split('.')[0]}.jpg`;
    } else if (currentToolKey === 'ppttotext') {
      blob = await pptToTextBlob(currentFile);
      filename = `${currentFile.name.split('.')[0]}.txt`;
    } else if (currentToolKey === 'unzipfiles') {
      await runUnzipFlow(currentFile);
      return;
    } else if (currentToolKey === 'pdftoword') {
      await runPdfToWord(currentFile);
      return;
    } else if (currentToolKey === 'pdftoexcel') {
      await runPdfToExcel(currentFile);
      return;
    } else if (currentToolKey === 'pdftojpg') {
      await runPdfToJpg(currentFile);
      return;
    } else if (currentToolKey === 'pdftoppt') {
      await runPdfToPpt(currentFile);
      return;
    } else if (currentToolKey === 'pdftomarkdown') {
      await runPdfToMarkdown(currentFile);
      return;
    }
    await minWait(1200);
    showResultState(blob, filename, extraNote);
  } catch (err) {
    showErrorState(err.message);
  }
}

function minWait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reliable image-to-PDF page sizing: jsPDF's 'px' unit combined with a format array
// produces inconsistent scaling depending on orientation/addPage vs constructor.
// Converting to points (jsPDF's real native unit) avoids that unit-handling bug entirely.
const PX_TO_PT = 0.75; // standard 96dpi-css-px to pt conversion

async function newImagePdf(pxWidth, pxHeight) {
  const { jsPDF } = await import('jspdf');
  const ptW = pxWidth * PX_TO_PT;
  const ptH = pxHeight * PX_TO_PT;
  const isLandscape = pxWidth > pxHeight;
  // jsPDF's own docs: for landscape orientation, format array must be given as [height, width] (swapped)
  const format = isLandscape ? [ptH, ptW] : [ptW, ptH];
  return new jsPDF({ unit: 'pt', orientation: isLandscape ? 'landscape' : 'portrait', format });
}

function addImagePdfPage(pdf, pxWidth, pxHeight) {
  const ptW = pxWidth * PX_TO_PT;
  const ptH = pxHeight * PX_TO_PT;
  const isLandscape = pxWidth > pxHeight;
  const format = isLandscape ? [ptH, ptW] : [ptW, ptH];
  pdf.addPage(format, isLandscape ? 'landscape' : 'portrait');
}

function drawImageOnPdfPage(pdf, imgSource, pxWidth, pxHeight) {
  pdf.addImage(imgSource, 'JPEG', 0, 0, pxWidth * PX_TO_PT, pxHeight * PX_TO_PT);
}

// ---------- Table grid detection: find row/column boundaries by analyzing ink density ----------
function loadImageForGrid(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = URL.createObjectURL(file);
  });
}

function findGapBands(inkProfile, minGapSize, noiseFloor) {
  // Returns [start, end] pixel ranges of CONTENT (non-gap) bands, given a per-pixel ink-density array
  const floor = noiseFloor || 0;
  const bands = [];
  let inContent = false;
  let contentStart = 0;
  let gapRun = 0;
  for (let i = 0; i < inkProfile.length; i++) {
    const hasInk = inkProfile[i] > floor;
    if (hasInk) {
      if (!inContent) { inContent = true; contentStart = i; }
      gapRun = 0;
    } else {
      gapRun++;
      if (inContent && gapRun >= minGapSize) {
        bands.push([contentStart, i - gapRun + 1]);
        inContent = false;
      }
    }
  }
  if (inContent) bands.push([contentStart, inkProfile.length]);
  return bands;
}

function getInkProfile(ctx, width, height, axis) {
  // axis: 'row' = ink count per horizontal row, 'col' = ink count per vertical column
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const size = axis === 'row' ? height : width;
  const profile = new Array(size).fill(0);

  // Determine each row's dominant (background) color by sampling, so we can detect
  // "ink" as deviation from local background — handles both dark-on-light and light-on-dark text.
  // Coarser bucketing (>> 5, i.e. 32 buckets/channel) so JPEG compression noise falls into the same bucket.
  const rowBg = new Array(height);
  for (let y = 0; y < height; y++) {
    const counts = {};
    for (let x = 0; x < width; x += 4) {
      const idx = (y * width + x) * 4;
      const key = `${d[idx] >> 5},${d[idx + 1] >> 5},${d[idx + 2] >> 5}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    let bestKey = null, bestCount = -1;
    for (const k in counts) { if (counts[k] > bestCount) { bestCount = counts[k]; bestKey = k; } }
    rowBg[y] = bestKey ? bestKey.split(',').map((v) => parseInt(v) * 32) : [255, 255, 255];
  }

  const threshold = 100; // higher tolerance — JPEG compression noise can shift flat areas by 20-40 easily, real text is a much bigger jump
  for (let y = 0; y < height; y++) {
    const [bgR, bgG, bgB] = rowBg[y];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dist = Math.abs(d[idx] - bgR) + Math.abs(d[idx + 1] - bgG) + Math.abs(d[idx + 2] - bgB);
      if (dist > threshold) {
        if (axis === 'row') profile[y]++; else profile[x]++;
      }
    }
  }
  return profile;
}

function looksNumeric(text) {
  const cleaned = text.replace(/\s/g, '');
  if (!cleaned) return false;
  const digitCount = (cleaned.match(/[0-9]/g) || []).length;
  return digitCount / cleaned.length > 0.5;
}

async function ocrCell(canvas, x, y, w, h) {
  const Tesseract = (await import('tesseract.js')).default;
  const makeBlob = async (scale, smooth, extraPad) => {
    const pad = extraPad || 0;
    const px = Math.max(0, x - pad);
    const py = Math.max(0, y - pad);
    const pw = Math.min(canvas.width - px, w + pad * 2);
    const ph = Math.min(canvas.height - py, h + pad * 2);
    const cellCanvas = document.createElement('canvas');
    cellCanvas.width = pw * scale;
    cellCanvas.height = ph * scale;
    const ctx = cellCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = !!smooth;
    if (smooth) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, px, py, pw, ph, 0, 0, pw * scale, ph * scale);

    // Normalize: convert to grayscale, and invert if the cell has a dark background
    // (e.g. white text on a colored header) — Tesseract is far more reliable on black-on-white.
    const imgData = ctx.getImageData(0, 0, cellCanvas.width, cellCanvas.height);
    const d = imgData.data;
    let totalLum = 0;
    for (let i = 0; i < d.length; i += 4) {
      totalLum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }
    const avgLum = totalLum / (d.length / 4);
    const invert = avgLum < 128;
    for (let i = 0; i < d.length; i += 4) {
      let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (invert) gray = 255 - gray;
      d[i] = d[i + 1] = d[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
    return new Promise((res) => cellCanvas.toBlob(res, 'image/png'));
  };

  const runOcr = async (scale, smooth, extraOptions, extraPad) => {
    const blob = await makeBlob(scale, smooth, extraPad);
    const { data } = await Tesseract.recognize(blob, 'eng', { tessedit_pageseg_mode: '7', ...extraOptions });
    return { text: data.text.trim().replace(/\n+/g, ' '), confidence: data.confidence || 0 };
  };

  try {
    // Pass 1: smooth-upscaled, standard single-line mode
    const first = await runOcr(3, true);
    if (!first.text) return '';

    const candidates = [first];

    if (looksNumeric(first.text)) {
      // Digit-only pass — removes letter/digit ambiguity entirely (6 can't be misread as G, 0 as O).
      // Higher upscale + a couple pixels of padding — a decimal point is a tiny mark, easy for OCR to
      // drop if it's clipped right at the crop edge or too small to register as a real character.
      candidates.push(await runOcr(8, true, { tessedit_char_whitelist: '0123456789.,$%' }, 2));
    } else if (first.confidence < 75) {
      // Low-confidence text cell — try single-word mode at higher resolution as an alternate reading
      candidates.push(await runOcr(5, true, { tessedit_pageseg_mode: '8' }));
    }

    // Pick whichever candidate Tesseract itself was most confident in
    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0].text;
  } catch {
    return '';
  }
}

async function imageToExcelBlob(file) {
  const XLSX = await import('xlsx');
  const Tesseract = (await import('tesseract.js')).default;
  const img = await loadImageForGrid(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const rowProfile = getInkProfile(ctx, canvas.width, canvas.height, 'row');
  const minRowGap = Math.max(3, Math.round(canvas.height * 0.005));
  const rowNoiseFloor = Math.max(2, Math.round(canvas.width * 0.01)); // ignore rows with only a handful of stray noisy pixels
  const rowBands = findGapBands(rowProfile, minRowGap, rowNoiseFloor);

  // Safety fallback: if grid detection finds an unreasonable structure, fall back to whole-image OCR
  if (rowBands.length < 1 || rowBands.length > 60) {
    const { data: { text } } = await Tesseract.recognize(file, 'eng', { tessedit_pageseg_mode: '4' });
    const rows = text.split('\n').filter((l) => l.trim()).map((line) => line.trim().split(/\s{2,}|\t/));
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    return new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
  }

  const grid = [];
  let cellCount = 0;
  const totalEstimate = rowBands.length * 6; // rough estimate for progress messaging
  for (let r = 0; r < rowBands.length; r++) {
    const [ry0, ry1] = rowBands[r];
    const rowHeight = ry1 - ry0;
    const colCtx = document.createElement('canvas').getContext('2d');
    colCtx.canvas.width = canvas.width;
    colCtx.canvas.height = rowHeight;
    colCtx.drawImage(canvas, 0, ry0, canvas.width, rowHeight, 0, 0, canvas.width, rowHeight);
    const colProfile = getInkProfile(colCtx, canvas.width, rowHeight, 'col');
    const minColGap = Math.max(4, Math.round(canvas.width * 0.008));
    const colNoiseFloor = Math.max(2, Math.round(rowHeight * 0.1));
    const colBands = findGapBands(colProfile, minColGap, colNoiseFloor);

    const rowCells = [];
    for (let c = 0; c < colBands.length; c++) {
      const [cx0, cx1] = colBands[c];
      cellCount++;
      updateProcessingCaption(`Reading cell ${cellCount} (row ${r + 1} of ${rowBands.length})...`);
      const padding = 2;
      const text = await ocrCell(
        canvas,
        Math.max(0, cx0 - padding), Math.max(0, ry0 - padding),
        Math.min(canvas.width, cx1 - cx0 + padding * 2), Math.min(canvas.height, ry1 - ry0 + padding * 2)
      );
      rowCells.push(text);
    }
    grid.push(rowCells);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(grid);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/octet-stream' });
}

async function wordToExcelBlob(file) {
  const mammoth = (await import('mammoth')).default;
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = doc.querySelectorAll('table');
  const workbook = XLSX.utils.book_new();
  if (tables.length > 0) {
    tables.forEach((table, i) => {
      const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
        Array.from(tr.querySelectorAll('td, th')).map((cell) => cell.textContent.trim())
      );
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), `Table${i + 1}`);
    });
  } else {
    const paragraphs = Array.from(doc.querySelectorAll('p')).map((p) => [p.textContent.trim()]).filter((r) => r[0]);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(paragraphs), 'Sheet1');
  }
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/octet-stream' });
}

async function wordToPdfBlob(file) {
  const mammoth = (await import('mammoth')).default;
  const { jsPDF } = await import('jspdf');
  const arrayBuffer = await file.arrayBuffer();
  const { value: text } = await mammoth.extractRawText({ arrayBuffer });
  const pdf = new jsPDF();
  const lines = pdf.splitTextToSize(text, 180);
  let y = 15;
  lines.forEach((line) => { if (y > 280) { pdf.addPage(); y = 15; } pdf.text(line, 15, y); y += 7; });
  return pdf.output('blob');
}

async function wordToTextBlob(file) {
  const mammoth = (await import('mammoth')).default;
  const arrayBuffer = await file.arrayBuffer();
  const { value: text } = await mammoth.extractRawText({ arrayBuffer });
  return new Blob([text], { type: 'text/plain' });
}

async function excelToPdfBlob(file) {
  const XLSX = await import('xlsx');
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
  const pdf = new jsPDF({ orientation: rows[0] && rows[0].length > 8 ? 'landscape' : 'portrait' });
  autoTable(pdf, { head: [rows[0]], body: rows.slice(1), styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] } });
  return pdf.output('blob');
}

async function excelToCsvBlob(file) {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
  return new Blob([csv], { type: 'text/csv' });
}

async function pptToTextBlob(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => parseInt(a.match(/slide(\d+)\.xml/)[1]) - parseInt(b.match(/slide(\d+)\.xml/)[1]));
  let fullText = '';
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('text');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const textNodes = doc.getElementsByTagName('a:t');
    const slideText = Array.from(textNodes).map((n) => n.textContent).join(' ');
    fullText += `--- Slide ${i + 1} ---\n${slideText}\n\n`;
  }
  return new Blob([fullText], { type: 'text/plain' });
}

async function runUnzipFlow(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((f) => !f.dir);
  const extracted = [];
  for (let i = 0; i < entries.length; i++) {
    updateProcessingCaption(`Extracting file ${i + 1} of ${entries.length}...`);
    const blob = await entries[i].async('blob');
    extracted.push({ name: entries[i].name, blob });
  }
  await minWait(600);
  modalBody.innerHTML = `
    <div class="tp-workspace">
      <div class="tp-preview-pane tp-preview-pane-list">
        <div class="extracted-file-list">
          ${extracted.map((f) => {
            const url = URL.createObjectURL(f.blob);
            return `<div class="extracted-file-row"><span class="extracted-file-name"><span class="icon icon-file" aria-hidden="true"></span> ${f.name}</span><a href="${url}" download="${f.name}" class="extracted-file-download">Download</a></div>`;
          }).join('')}
        </div>
      </div>
      <aside class="tp-sidebar">
        <div class="result-done-badge"><span class="result-done-check">✓</span> Done</div>
        <p class="result-stat-pill">Extracted ${extracted.length} file${extracted.length === 1 ? '' : 's'}</p>
        <button class="reset-btn" id="resetToolBtn">Convert another file</button>
      </aside>
    </div>
  `;
  document.querySelector('#resetToolBtn').addEventListener('click', () => {
    closeToolModal(false);
    handleToolCardClick(currentToolKey, lastFocusedElement);
  });
}

// ================= SINGLE-FILE CONFIG TOOLS =================
function renderSingleFileConfig() {
  renderGeneration++;
  const myGeneration = renderGeneration;
  const area = document.querySelector('#configArea'); // right sidebar: controls, info, action button
  const previewPane = document.querySelector('#configPreview'); // left pane: preview/working area only
  area.innerHTML = '';
  if (previewPane) previewPane.innerHTML = '';
  const previewTarget = previewPane || area; // fall back gracefully if the shell markup is ever missing the pane
  if (currentToolKey === 'pdfedit') {
    // Edit PDF builds its own multi-page canvas + overlay editor straight
    // into previewTarget below — skip every generic preview branch here.
  } else if (currentFile.type.startsWith('image/')) {
    showPreviewImage(currentFile);
  } else if (currentFile.type === 'application/pdf' && currentToolKey !== 'pdfcompress' && currentToolKey !== 'pdfrotate') {
    previewTarget.insertAdjacentHTML('beforeend', `<div id="genericPdfPreviewWrap" style="text-align:center;"><p style="color:var(--text-muted); font-size:0.85rem;">Loading preview...</p></div>`);
    (async () => {
      try {
        const pdfjsLib = await getPdfjsLib();
        const bytes = await currentFile.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
        const page = await pdfDoc.getPage(1);
        const canvas = await renderPdfPageToCanvas(page, 1.0);
        if (myGeneration !== renderGeneration) return; // a newer render started while we were loading — discard
        const wrap = document.querySelector('#genericPdfPreviewWrap');
        if (!wrap) return;
        const img = document.createElement('img');
        img.className = 'preview-img';
        img.src = canvas.toDataURL('image/jpeg', 0.85);
        wrap.innerHTML = '';
        wrap.appendChild(img);
        if (pdfDoc.numPages > 1) {
          wrap.insertAdjacentHTML('beforeend', `<p style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">Page 1 of ${pdfDoc.numPages} shown</p>`);
        }
      } catch {
        const wrap = document.querySelector('#genericPdfPreviewWrap');
        if (wrap) wrap.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;"><span class="icon icon-file" aria-hidden="true"></span> ${currentFile.name} (preview unavailable)</p>`;
      }
    })();
  } else {
    previewTarget.insertAdjacentHTML('beforeend', `<p class="tp-generic-file-line" style="font-size:0.92rem; color: var(--text-muted);"><span class="icon icon-file" aria-hidden="true"></span> ${currentFile.name}</p>`);
  }

  if (currentToolKey === 'compress') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Quality
          <select id="cfgQuality">
            <option value="0.3">Low (smallest file)</option>
            <option value="0.6" selected>Medium</option>
            <option value="0.9">Extraordinary (largest file)</option>
          </select>
        </label>
        <button class="config-action-btn" id="cfgApply">Compress</button>
      </div>
      <p class="tp-live-hint" id="compressLiveHint">Estimating…</p>
    `);
    const qualitySelect = document.querySelector('#cfgQuality');
    const liveHint = document.querySelector('#compressLiveHint');
    // Real, not simulated: actually compresses at the selected quality
    // right now so the size estimate shown is the true output size, not
    // a guess — just without committing to the full processing screen.
    let livePreviewGeneration = 0;
    const updateCompressLivePreview = () => {
      if (!currentImg.naturalWidth) return; // preview image hasn't finished loading yet — the load handler below will retry
      const myPreview = ++livePreviewGeneration;
      const quality = parseFloat(qualitySelect.value);
      const originalKB = currentFile.size / 1024;
      const canvas = document.createElement('canvas');
      canvas.width = currentImg.naturalWidth;
      canvas.height = currentImg.naturalHeight;
      canvas.getContext('2d').drawImage(currentImg, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob || myPreview !== livePreviewGeneration) return; // a newer selection has since been made
        const newKB = blob.size / 1024;
        const pct = Math.round(100 - (newKB / originalKB) * 100);
        liveHint.innerHTML = `Estimated size: <strong>${newKB.toFixed(0)}KB</strong>${pct > 0 ? ` <span class="tp-live-good">(${pct}% smaller)</span>` : ' (similar size)'}`;
      }, 'image/jpeg', quality);
    };
    qualitySelect.addEventListener('change', updateCompressLivePreview);
    if (currentImg.complete && currentImg.naturalWidth) updateCompressLivePreview();
    else currentImg.addEventListener('load', updateCompressLivePreview, { once: true });
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      const quality = parseFloat(document.querySelector('#cfgQuality').value); // captured before the DOM gets wiped
      const originalKB = currentFile.size / 1024;
      const canvas = document.createElement('canvas');
      canvas.width = currentImg.naturalWidth;
      canvas.height = currentImg.naturalHeight;
      canvas.getContext('2d').drawImage(currentImg, 0, 0);
      canvas.toBlob(async (blob) => {
        const newKB = blob.size / 1024;
        const pct = Math.round(100 - (newKB / originalKB) * 100);
        const note = `${originalKB.toFixed(0)}KB → ${newKB.toFixed(0)}KB (${pct > 0 ? pct + '% smaller' : 'similar size'})`;
        showProcessingState('Compressing...');
        await minWait(700);
        showResultState(blob, `compressed-${currentFile.name.split('.')[0]}.jpg`, note);
      }, 'image/jpeg', quality);
    });
  }

  if (currentToolKey === 'resize') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Width (px) <input type="number" id="cfgWidth" placeholder="800" /></label>
        <label>Height (px) <input type="number" id="cfgHeight" placeholder="600" /></label>
        <button class="config-action-btn" id="cfgApply">Resize</button>
      </div>
      <p class="tp-live-hint" id="resizeLiveHint">Enter a width and height to preview the new size.</p>
    `);
    const widthInput = document.querySelector('#cfgWidth');
    const heightInput = document.querySelector('#cfgHeight');
    const liveHint = document.querySelector('#resizeLiveHint');
    const updateResizeLivePreview = () => {
      const origW = currentImg.naturalWidth;
      const origH = currentImg.naturalHeight;
      const w = parseInt(widthInput.value);
      const h = parseInt(heightInput.value);
      if (!w || !h || !origW || !origH) {
        liveHint.textContent = 'Enter a width and height to preview the new size.';
        currentImg.style.transform = '';
        return;
      }
      // Purely visual — scales the on-screen preview to suggest relative
      // size. drawImage() at apply-time always uses the image's real
      // pixel data, so this never affects the actual output.
      const scale = Math.max(0.4, Math.min(1.5, Math.sqrt((w * h) / (origW * origH))));
      currentImg.style.transform = `scale(${scale})`;
      const stretched = Math.abs((origW / origH) - (w / h)) / (origW / origH) > 0.05;
      liveHint.innerHTML = `New size: <strong>${w} × ${h}px</strong>${stretched ? ' <span class="tp-live-warn"><span class="icon icon-alert-triangle" aria-hidden="true"></span> different aspect ratio: image will stretch</span>' : ''}`;
    };
    widthInput.addEventListener('input', updateResizeLivePreview);
    heightInput.addEventListener('input', updateResizeLivePreview);
    if (!currentImg.complete || !currentImg.naturalWidth) currentImg.addEventListener('load', updateResizeLivePreview, { once: true });
    document.querySelector('#cfgApply').addEventListener('click', () => {
      const w = parseInt(document.querySelector('#cfgWidth').value);
      const h = parseInt(document.querySelector('#cfgHeight').value);
      if (!w || !h) return;
      currentImg.style.transform = '';
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(currentImg, 0, 0, w, h);
      canvas.toBlob((blob) => processAndShow(blob, `resized-${currentFile.name}`), currentFile.type);
    });
  }

  else if (currentToolKey === 'crop') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel"><button class="config-action-btn" id="cfgApply">Apply Crop</button></div>
    `);
    setTimeout(async () => {
      if (myGeneration !== renderGeneration) return; // a newer render has since started — skip this stale init
      if (cropperInstance) cropperInstance.destroy();
      const { default: Cropper } = await import('cropperjs');
      await import('cropperjs/dist/cropper.css');
      if (myGeneration !== renderGeneration) return; // re-check: the render could have moved on while the import was in flight
      cropperInstance = new Cropper(currentImg, { viewMode: 1, autoCropArea: 0.8 });
    }, 50);
    document.querySelector('#cfgApply').addEventListener('click', () => {
      if (!cropperInstance) return;
      cropperInstance.getCroppedCanvas().toBlob((blob) => {
        cropperInstance.destroy(); cropperInstance = null;
        processAndShow(blob, `cropped-${currentFile.name}`);
      }, currentFile.type);
    });
  }

  else if (currentToolKey === 'convertformat') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Format
          <select id="cfgFormat"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select>
        </label>
        <label>Quality (for JPG/WebP)
          <select id="cfgFormatQuality">
            <option value="0.3">Low (smallest file)</option>
            <option value="0.6" selected>Medium</option>
            <option value="0.9">Extraordinary (largest file)</option>
          </select>
        </label>
        <button class="config-action-btn" id="cfgApply">Convert</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', () => {
      const mime = document.querySelector('#cfgFormat').value;
      const quality = parseFloat(document.querySelector('#cfgFormatQuality').value); // captured before the DOM gets wiped
      const ext = mime.split('/')[1];
      const canvas = document.createElement('canvas');
      canvas.width = currentImg.naturalWidth; canvas.height = currentImg.naturalHeight;
      canvas.getContext('2d').drawImage(currentImg, 0, 0);
      canvas.toBlob((blob) => processAndShow(blob, `${currentFile.name.split('.')[0]}.${ext}`), mime, quality);
    });
  }

  else if (currentToolKey === 'rotateflip') {
    let rotation = 0, flipH = false, flipV = false;
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <button type="button" id="rotL">⟲ Left</button>
        <button type="button" id="rotR">⟳ Right</button>
        <button type="button" id="flH">↔ Flip H</button>
        <button type="button" id="flV">↕ Flip V</button>
        <button class="config-action-btn" id="cfgApply">Save</button>
      </div>
    `);
    const preview = () => { currentImg.style.transform = `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`; };
    document.querySelector('#rotL').addEventListener('click', () => { rotation = (rotation - 90 + 360) % 360; preview(); });
    document.querySelector('#rotR').addEventListener('click', () => { rotation = (rotation + 90) % 360; preview(); });
    document.querySelector('#flH').addEventListener('click', () => { flipH = !flipH; preview(); });
    document.querySelector('#flV').addEventListener('click', () => { flipV = !flipV; preview(); });
    document.querySelector('#cfgApply').addEventListener('click', () => {
      const swap = rotation === 90 || rotation === 270;
      const w = swap ? currentImg.naturalHeight : currentImg.naturalWidth;
      const h = swap ? currentImg.naturalWidth : currentImg.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.translate(w / 2, h / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(currentImg, -currentImg.naturalWidth / 2, -currentImg.naturalHeight / 2);
      canvas.toBlob((blob) => processAndShow(blob, `rotated-${currentFile.name}`), currentFile.type || 'image/jpeg');
    });
  }

  else if (currentToolKey === 'watermarkimage') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Text <input type="text" id="cfgWmText" placeholder="e.g. DRAFT" /></label>
        <button class="config-action-btn" id="cfgApply">Apply</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', () => {
      const text = document.querySelector('#cfgWmText').value.trim() || 'OnlineToolsWeb';
      const canvas = document.createElement('canvas');
      canvas.width = currentImg.naturalWidth; canvas.height = currentImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(currentImg, 0, 0);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${Math.round(canvas.width / 15)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 8);
      ctx.fillText(text, 0, 0);
      ctx.restore();
      canvas.toBlob((blob) => processAndShow(blob, `watermarked-${currentFile.name}`), currentFile.type || 'image/jpeg');
    });
  }

  else if (currentToolKey === 'grayscale') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Intensity <input type="range" id="cfgIntensity" min="0" max="100" value="100" /> <span id="cfgIntensityVal">100%</span></label>
        <button class="config-action-btn" id="cfgApply">Apply</button>
      </div>
    `);
    const slider = document.querySelector('#cfgIntensity');
    const valLabel = document.querySelector('#cfgIntensityVal');
    slider.addEventListener('input', () => { valLabel.textContent = `${slider.value}%`; });
    document.querySelector('#cfgApply').addEventListener('click', () => {
      const intensity = parseInt(slider.value) / 100; // captured before the DOM gets wiped
      const canvas = document.createElement('canvas');
      canvas.width = currentImg.naturalWidth; canvas.height = currentImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(currentImg, 0, 0);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const avg = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        px[i] = px[i] * (1 - intensity) + avg * intensity;
        px[i + 1] = px[i + 1] * (1 - intensity) + avg * intensity;
        px[i + 2] = px[i + 2] * (1 - intensity) + avg * intensity;
      }
      ctx.putImageData(d, 0, 0);
      canvas.toBlob((blob) => processAndShow(blob, `grayscale-${currentFile.name}`), currentFile.type || 'image/jpeg');
    });
  }

  else if (currentToolKey === 'sepia') {
    area.insertAdjacentHTML('beforeend', `<div class="config-panel"><button class="config-action-btn" id="cfgApply">Apply</button></div>`);
    document.querySelector('#cfgApply').addEventListener('click', () => {
      const canvas = document.createElement('canvas');
      canvas.width = currentImg.naturalWidth; canvas.height = currentImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(currentImg, 0, 0);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        px[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        px[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        px[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      }
      ctx.putImageData(d, 0, 0);
      canvas.toBlob((blob) => processAndShow(blob, `sepia-${currentFile.name}`), currentFile.type || 'image/jpeg');
    });
  }

  else if (currentToolKey === 'blurimage') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Intensity <input type="range" id="cfgBlur" min="1" max="20" value="6" /></label>
        <button class="config-action-btn" id="cfgApply">Apply</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', () => {
      const amt = document.querySelector('#cfgBlur').value;
      const canvas = document.createElement('canvas');
      canvas.width = currentImg.naturalWidth; canvas.height = currentImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.filter = `blur(${amt}px)`;
      ctx.drawImage(currentImg, 0, 0);
      canvas.toBlob((blob) => processAndShow(blob, `blurred-${currentFile.name}`), currentFile.type || 'image/jpeg');
    });
  }

  else if (currentToolKey === 'bgremove') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel"><button class="config-action-btn" id="cfgApply">Remove Background</button></div>
      <p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px;">First use downloads an AI model, just once, cached after. You'll get a before/after slider to check the result before downloading.</p>
    `);
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      showProcessingState('Downloading AI model...');
      let cutoutBlob;
      try {
        cutoutBlob = await removeBackgroundOrmbg(currentFile, (pct) => {
          updateProcessingProgress(pct, `Downloading AI model... ${pct}%`);
        });
      } catch (err) {
        showErrorState(`Couldn't remove the background: ${err && err.message ? err.message : err}`);
        return;
      }
      // Edge refinement (a guided filter against the original photo) now
      // happens inside removeBackgroundOrmbg itself, using the full-
      // resolution image as its guide — doing it here on the already-
      // composited, lower-detail cutout would be too late to help.
      showBgRemoveTouchUpState(cutoutBlob, currentFile);
    });
  }

  else if (currentToolKey === 'colorpalette') {
    area.insertAdjacentHTML('beforeend', `<div class="config-panel"><button class="config-action-btn" id="cfgApply">Extract Palette</button></div>`);
    document.querySelector('#cfgApply').addEventListener('click', () => {
      const sample = document.createElement('canvas');
      sample.width = 60; sample.height = 60;
      sample.getContext('2d').drawImage(currentImg, 0, 0, 60, 60);
      const data = sample.getContext('2d').getImageData(0, 0, 60, 60).data;
      const buckets = {};
      for (let i = 0; i < data.length; i += 4) {
        const key = `${Math.round(data[i] / 32) * 32},${Math.round(data[i + 1] / 32) * 32},${Math.round(data[i + 2] / 32) * 32}`;
        buckets[key] = (buckets[key] || 0) + 1;
      }
      const top = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k.split(',').map(Number));
      const out = document.createElement('canvas');
      out.width = 480; out.height = 100;
      const ctx = out.getContext('2d');
      const sw = 480 / top.length;
      top.forEach(([r, g, b], i) => {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(i * sw, 0, sw, 70);
      });
      out.toBlob((blob) => processAndShow(blob, `palette-${currentFile.name.split('.')[0]}.png`));
    });
  }

  else if (currentToolKey === 'socialresize') {
    const presets = { 'ig-post': [1080, 1080], 'ig-story': [1080, 1920], 'yt-thumb': [1280, 720], 'fb-cover': [820, 312] };
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Preset
          <select id="cfgPreset">
            <option value="ig-post">Instagram Post</option>
            <option value="ig-story">Instagram Story</option>
            <option value="yt-thumb">YouTube Thumbnail</option>
            <option value="fb-cover">Facebook Cover</option>
          </select>
        </label>
        <button class="config-action-btn" id="cfgApply">Resize</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', () => {
      const [w, h] = presets[document.querySelector('#cfgPreset').value];
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(w / currentImg.naturalWidth, h / currentImg.naturalHeight);
      const sw = currentImg.naturalWidth * scale, sh = currentImg.naturalHeight * scale;
      ctx.drawImage(currentImg, (w - sw) / 2, (h - sh) / 2, sw, sh);
      canvas.toBlob((blob) => processAndShow(blob, `social-${currentFile.name}`), currentFile.type || 'image/jpeg');
    });
  }

  else if (currentToolKey === 'memecreator') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Top text <input type="text" id="cfgTop" /></label>
        <label>Bottom text <input type="text" id="cfgBottom" /></label>
        <button class="config-action-btn" id="cfgApply">Generate</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', () => {
      const top = document.querySelector('#cfgTop').value.trim().toUpperCase();
      const bottom = document.querySelector('#cfgBottom').value.trim().toUpperCase();
      const canvas = document.createElement('canvas');
      canvas.width = currentImg.naturalWidth; canvas.height = currentImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(currentImg, 0, 0);
      const fontSize = Math.round(canvas.width / 12);
      ctx.font = `bold ${fontSize}px Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = fontSize / 12;
      if (top) { ctx.strokeText(top, canvas.width / 2, fontSize * 1.1); ctx.fillText(top, canvas.width / 2, fontSize * 1.1); }
      if (bottom) { ctx.strokeText(bottom, canvas.width / 2, canvas.height - fontSize * 0.5); ctx.fillText(bottom, canvas.width / 2, canvas.height - fontSize * 0.5); }
      canvas.toBlob((blob) => processAndShow(blob, `meme-${currentFile.name.split('.')[0]}.png`));
    });
  }

  else if (currentToolKey === 'imagetoppt') {
    area.insertAdjacentHTML('beforeend', `<div class="config-panel"><button class="config-action-btn" id="cfgApply">Generate PPTX</button></div>`);
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      showProcessingState('Building your slide...');
      const pptxgen = (await import('pptxgenjs')).default;
      const pptx = new pptxgen();
      const slide = pptx.addSlide();
      slide.addImage({ path: URL.createObjectURL(currentFile), x: 0, y: 0, w: 10, h: 5.63 });
      const blob = await pptx.write('blob');
      await minWait(800);
      showResultState(blob, 'image-slide.pptx');
    });
  }

  else if (currentToolKey === 'pdf') {
    // single-image path when only one file was dropped on this multiFile-capable tool
    area.insertAdjacentHTML('beforeend', `<div class="config-panel"><button class="config-action-btn" id="cfgApply">Convert to PDF</button></div>`);
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      const w = currentImg.naturalWidth, h = currentImg.naturalHeight;
      const pdf = await newImagePdf(w, h);
      drawImageOnPdfPage(pdf, currentImg, w, h);
      processAndShow(pdf.output('blob'), `${currentFile.name.split('.')[0]}.pdf`);
    });
  }

  else if (currentToolKey === 'pdfrotate') {
    area.insertAdjacentHTML('beforeend', `
      <div id="pdfPreviewWrap" style="text-align:center; margin-top:10px;"><p style="color:var(--text-muted); font-size:0.85rem;">Loading preview...</p></div>
      <div class="config-panel">
        <button type="button" id="rotLeftBtn">⟲ Rotate Left</button>
        <button type="button" id="rotRightBtn">⟳ Rotate Right</button>
      </div>
      <div class="config-panel"><button class="config-action-btn" id="cfgApply">Apply Rotation</button></div>
    `);

    let cumulativeAngle = 0; // normalized to 0/90/180/270, positive = clockwise
    const previewImg = document.createElement('img');
    previewImg.className = 'preview-img';
    previewImg.style.transition = 'transform 0.15s ease';

    (async () => {
      try {
        const pdfjsLib = await getPdfjsLib();
        const bytes = await currentFile.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
        const page = await pdfDoc.getPage(1);
        const canvas = await renderPdfPageToCanvas(page, 1.0);
        previewImg.src = canvas.toDataURL('image/jpeg', 0.85);
        const wrap = document.querySelector('#pdfPreviewWrap');
        wrap.innerHTML = '';
        wrap.appendChild(previewImg);
      } catch {
        document.querySelector('#pdfPreviewWrap').innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;"><span class="icon icon-file" aria-hidden="true"></span> ${currentFile.name} (preview unavailable)</p>`;
      }
    })();

    function updatePreviewRotation() {
      previewImg.style.transform = `rotate(${cumulativeAngle}deg)`;
    }
    document.querySelector('#rotLeftBtn').addEventListener('click', () => {
      cumulativeAngle = (cumulativeAngle - 90 + 360) % 360;
      updatePreviewRotation();
    });
    document.querySelector('#rotRightBtn').addEventListener('click', () => {
      cumulativeAngle = (cumulativeAngle + 90) % 360;
      updatePreviewRotation();
    });

    document.querySelector('#cfgApply').addEventListener('click', async () => {
      const angleToApply = cumulativeAngle; // captured BEFORE showProcessingState wipes the DOM
      if (angleToApply === 0) { showErrorState('Rotate the preview left or right first, then apply.'); return; }
      showProcessingState('Rotating your PDF...');
      try {
        const { PDFDocument, degrees } = await import('pdf-lib');
        const bytes = await currentFile.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        doc.getPages().forEach((p) => p.setRotation(degrees((p.getRotation().angle + angleToApply) % 360)));
        const outBytes = await doc.save();
        await minWait(500);
        showResultState(new Blob([outBytes], { type: 'application/pdf' }), `rotated-${currentFile.name}`);
      } catch (err) { showErrorState(err.message); }
    });
  }

  else if (currentToolKey === 'pdfpagenumbers') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Position
          <select id="cfgPos"><option value="bottom-center">Bottom Center</option><option value="bottom-right">Bottom Right</option></select>
        </label>
        <button class="config-action-btn" id="cfgApply">Add Numbers</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      const pos = document.querySelector('#cfgPos').value; // captured BEFORE showProcessingState wipes the DOM
      showProcessingState('Adding page numbers...');
      try {
        const { PDFDocument } = await import('pdf-lib');
        const bytes = await currentFile.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const pages = doc.getPages();
        pages.forEach((p, i) => {
          const { width } = p.getSize();
          const text = `${i + 1} / ${pages.length}`;
          const x = pos === 'bottom-right' ? width - 60 : width / 2 - 15;
          p.drawText(text, { x, y: 20, size: 10 });
        });
        const outBytes = await doc.save();
        await minWait(500);
        showResultState(new Blob([outBytes], { type: 'application/pdf' }), `numbered-${currentFile.name}`);
      } catch (err) { showErrorState(err.message); }
    });
  }

  else if (currentToolKey === 'pdfextract' || currentToolKey === 'pdfdelete') {
    const isExtract = currentToolKey === 'pdfextract';
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Pages (e.g. 1,3,5-7) <input type="text" id="cfgRange" placeholder="1,3,5-7" /></label>
        <button class="config-action-btn" id="cfgApply">${isExtract ? 'Extract' : 'Delete'}</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      const rangeStr = document.querySelector('#cfgRange').value.trim();
      if (!rangeStr) return;
      showProcessingState(isExtract ? 'Extracting pages...' : 'Removing pages...');
      try {
        const { PDFDocument } = await import('pdf-lib');
        const bytes = await currentFile.arrayBuffer();
        const src = await PDFDocument.load(bytes);
        const total = src.getPageCount();
        const rangeIndices = parsePageRange(rangeStr, total);
        const keepIndices = isExtract
          ? rangeIndices
          : Array.from({ length: total }, (_, i) => i).filter((i) => !rangeIndices.includes(i));
        const outDoc = await PDFDocument.create();
        const pages = await outDoc.copyPages(src, keepIndices);
        pages.forEach((p) => outDoc.addPage(p));
        const outBytes = await outDoc.save();
        await minWait(500);
        showResultState(new Blob([outBytes], { type: 'application/pdf' }), `${isExtract ? 'extracted' : 'deleted-pages'}-${currentFile.name}`);
      } catch (err) { showErrorState(err.message); }
    });
  }

  else if (currentToolKey === 'pdfwatermark') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Text <input type="text" id="cfgWmText" placeholder="e.g. CONFIDENTIAL" /></label>
        <button class="config-action-btn" id="cfgApply">Apply</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      const text = document.querySelector('#cfgWmText').value.trim() || 'OnlineToolsWeb';
      showProcessingState('Applying watermark...');
      try {
        const { PDFDocument, degrees } = await import('pdf-lib');
        const bytes = await currentFile.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        doc.getPages().forEach((p) => {
          const { width, height } = p.getSize();
          p.drawText(text, { x: width / 2 - text.length * 6, y: height / 2, size: 40, opacity: 0.25, rotate: degrees(45) });
        });
        const outBytes = await doc.save();
        await minWait(500);
        showResultState(new Blob([outBytes], { type: 'application/pdf' }), `watermarked-${currentFile.name}`);
      } catch (err) { showErrorState(err.message); }
    });
  }

  else if (currentToolKey === 'pdfprotect') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Password <input type="password" id="cfgPassword" placeholder="Choose a password" /></label>
        <button class="config-action-btn" id="cfgApply">Protect</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      const password = document.querySelector('#cfgPassword').value;
      if (!password) return;
      showProcessingState('Encrypting your PDF...');
      try {
        const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt-lite');
        const bytes = new Uint8Array(await currentFile.arrayBuffer());
        const encrypted = await encryptPDF(bytes, password);
        await minWait(500);
        showResultState(new Blob([encrypted], { type: 'application/pdf' }), `protected-${currentFile.name}`);
      } catch (err) { showErrorState(err.message); }
    });
  }

  else if (currentToolKey === 'pdfcrop') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Top (pt) <input type="number" id="cfgTop" value="20" /></label>
        <label>Bottom (pt) <input type="number" id="cfgBottom" value="20" /></label>
        <label>Left (pt) <input type="number" id="cfgLeft" value="20" /></label>
        <label>Right (pt) <input type="number" id="cfgRight" value="20" /></label>
        <button class="config-action-btn" id="cfgApply">Crop</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      const top = parseFloat(document.querySelector('#cfgTop').value) || 0;
      const bottom = parseFloat(document.querySelector('#cfgBottom').value) || 0;
      const left = parseFloat(document.querySelector('#cfgLeft').value) || 0;
      const right = parseFloat(document.querySelector('#cfgRight').value) || 0;
      showProcessingState('Cropping your PDF...');
      try {
        const { PDFDocument } = await import('pdf-lib');
        const bytes = await currentFile.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        doc.getPages().forEach((p) => {
          const { width, height } = p.getSize();
          p.setCropBox(left, bottom, width - left - right, height - top - bottom);
        });
        const outBytes = await doc.save();
        await minWait(500);
        showResultState(new Blob([outBytes], { type: 'application/pdf' }), `cropped-${currentFile.name}`);
      } catch (err) { showErrorState(err.message); }
    });
  }

  else if (currentToolKey === 'pdfunlock') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Password <input type="password" id="cfgPassword" placeholder="Enter the current password" /></label>
        <button class="config-action-btn" id="cfgApply">Unlock</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      const password = document.querySelector('#cfgPassword').value;
      if (!password) return;
      showProcessingState('Removing password...');
      try {
        const { decryptPDF } = await import('@pdfsmaller/pdf-decrypt');
        const bytes = new Uint8Array(await currentFile.arrayBuffer());
        const decrypted = await decryptPDF(bytes, password);
        await minWait(500);
        showResultState(new Blob([decrypted], { type: 'application/pdf' }), `unlocked-${currentFile.name}`);
      } catch (err) { showErrorState('Incorrect password, or this file uses an unsupported encryption type.'); }
    });
  }

  else if (currentToolKey === 'pdfsign') {
    area.insertAdjacentHTML('beforeend', `
      <p style="font-size:0.9rem; color:var(--text-muted); margin-top:10px;">Draw your signature below:</p>
      <canvas id="sigCanvas" width="400" height="150" style="border:1px solid var(--border); border-radius:8px; touch-action:none; width:100%; max-width:400px;"></canvas>
      <div class="config-panel">
        <button type="button" id="clearSig">Clear</button>
        <button class="config-action-btn" id="cfgApply">Sign PDF</button>
      </div>
    `);
    const canvas = document.querySelector('#sigCanvas');
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1B2430';
    let drawing = false;
    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      return { x: cx * scaleX, y: cy * scaleX };
    }
    function start(e) { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function move(e) { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
    function end() { drawing = false; }
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); });
    canvas.addEventListener('touchend', end);
    document.querySelector('#clearSig').addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));

    document.querySelector('#cfgApply').addEventListener('click', async () => {
      showProcessingState('Placing your signature...');
      try {
        const { PDFDocument } = await import('pdf-lib');
        const sigDataUrl = canvas.toDataURL('image/png');
        const sigBytes = await (await fetch(sigDataUrl)).arrayBuffer();
        const bytes = await currentFile.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const pngImage = await doc.embedPng(sigBytes);
        const pages = doc.getPages();
        const lastPage = pages[pages.length - 1];
        const { width } = lastPage.getSize();
        const sigWidth = 150;
        const sigHeight = (pngImage.height / pngImage.width) * sigWidth;
        lastPage.drawImage(pngImage, { x: width - sigWidth - 40, y: 40, width: sigWidth, height: sigHeight });
        const outBytes = await doc.save();
        await minWait(500);
        showResultState(new Blob([outBytes], { type: 'application/pdf' }), `signed-${currentFile.name}`);
      } catch (err) { showErrorState(err.message); }
    });
  }

  // ---------- Edit PDF ----------
  // A true "rewrite the existing content stream" editor isn't feasible
  // in-browser (or anywhere, really — no PDF tool actually reconstructs
  // original fonts/layout). This gives the same "cover & replace" model
  // every free PDF editor actually uses under the hood: draw a white box
  // over anything you want gone, then drop new text or an image on top —
  // plus freely add brand-new text/images anywhere, on any page. Every
  // element lives in PDF point coordinates (not screen pixels), so it
  // survives page navigation and re-renders at any zoom/scale.
  else if (currentToolKey === 'pdfedit') {
    // pdf-lib symbols are loaded lazily (only this tool needs them) and shared
    // via these closure-scoped bindings between drawWrappedText() below and
    // the #cfgApply handler further down, which is what actually populates them.
    let PDFDocument, rgb, StandardFonts;
    area.insertAdjacentHTML('beforeend', `
      <p class="tp-live-hint" id="pdfeditHint">Add text, an image, or a white "cover" box, then drag it into place. Click an element to edit, move, or resize it.</p>
      <div class="config-panel pdfedit-toolbar">
        <button type="button" id="peAddText">+ Text</button>
        <button type="button" id="peAddImage">+ Image</button>
        <button type="button" id="peAddCover">▭ Cover</button>
      </div>
      <input type="file" id="peImageInput" accept="image/*" style="display:none;" />
      <div class="config-panel pdfedit-sel-panel" id="pdfeditSelPanel"></div>
      <div class="config-panel pdfedit-page-nav">
        <button type="button" id="pePrevPage" aria-label="Previous page">‹</button>
        <span id="pePageIndicator">Page 1</span>
        <button type="button" id="peNextPage" aria-label="Next page">›</button>
      </div>
      <div class="config-panel"><button class="config-action-btn" id="cfgApply">Save PDF</button></div>
    `);
    previewTarget.insertAdjacentHTML('beforeend', `<div class="pdfedit-wrap" id="pdfeditWrap"><p class="tp-live-hint">Loading page…</p></div>`);

    // ---- state, scoped to this one tool activation ----
    const myEditGeneration = renderGeneration; // stale-render guard, same pattern used elsewhere in this file
    let pdfjsDocRef = null;
    let pageCount = 1;
    let pageIdx = 0;
    let renderScale = 1;
    let pageWpt = 612;
    let pageHpt = 792;
    const pagesData = {}; // pageIdx -> array of element objects, all coords/sizes in PDF points
    let elCounter = 0;
    let selectedId = null;

    const pageEls = () => (pagesData[pageIdx] = pagesData[pageIdx] || []);
    const findEl = (id) => pageEls().find((e) => e.id === id);
    const ptToPx = (pt) => pt * renderScale;

    function positionDiv(div, el) {
      div.style.left = `${ptToPx(el.xPt)}px`;
      div.style.top = `${ptToPx(pageHpt - el.yPt - el.heightPt)}px`;
      div.style.width = `${ptToPx(el.widthPt)}px`;
      div.style.height = `${ptToPx(el.heightPt)}px`;
    }

    function selectAllText(div) {
      const range = document.createRange();
      range.selectNodeContents(div);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    function renderSelPanel() {
      const panel = document.querySelector('#pdfeditSelPanel');
      if (!panel) return;
      const el = findEl(selectedId);
      if (!el || el.type !== 'text') { panel.innerHTML = ''; return; }
      panel.innerHTML = `
        <label>Font size <input type="range" id="peFontSize" min="8" max="72" value="${el.fontSize}" /></label>
        <label>Color <input type="color" id="peColor" value="${el.color}" /></label>
      `;
      document.querySelector('#peFontSize').addEventListener('input', (e) => {
        el.fontSize = parseInt(e.target.value, 10) || 8;
        const div = document.querySelector(`.pdfedit-el[data-id="${el.id}"]`);
        if (div) div.style.fontSize = `${ptToPx(el.fontSize)}px`;
      });
      document.querySelector('#peColor').addEventListener('input', (e) => {
        el.color = e.target.value;
        const div = document.querySelector(`.pdfedit-el[data-id="${el.id}"]`);
        if (div) div.style.color = el.color;
      });
    }

    function selectElement(id) {
      selectedId = id;
      const overlay = document.querySelector('#pdfeditOverlay');
      if (overlay) overlay.querySelectorAll('.pdfedit-el').forEach((d) => d.classList.toggle('selected', d.dataset.id === id));
      renderSelPanel();
    }

    function deselectAll() {
      selectedId = null;
      const overlay = document.querySelector('#pdfeditOverlay');
      if (overlay) overlay.querySelectorAll('.pdfedit-el').forEach((d) => d.classList.remove('selected'));
      renderSelPanel();
    }

    function deleteElement(id) {
      const arr = pageEls();
      const i = arr.findIndex((e) => e.id === id);
      if (i !== -1) arr.splice(i, 1);
      const div = document.querySelector(`.pdfedit-el[data-id="${id}"]`);
      if (div) div.remove();
      if (selectedId === id) deselectAll();
    }

    // Every element type shares one drag+resize controller: `moveTarget`
    // is what starts a move (the whole box for image/cover, but only a
    // small corner grip for text — otherwise every click-to-place-your-
    // caret inside the text would instead start dragging the box).
    function wireDragResize(div, el, moveTarget, handle) {
      let mode = null;
      let startClientX = 0;
      let startClientY = 0;
      let startXPt = 0;
      let startYPt = 0;
      let startWPt = 0;
      let startHPt = 0;
      let topAnchorPt = 0;

      function begin(e, m) {
        e.stopPropagation();
        mode = m;
        startClientX = e.clientX;
        startClientY = e.clientY;
        startXPt = el.xPt;
        startYPt = el.yPt;
        startWPt = el.widthPt;
        startHPt = el.heightPt;
        topAnchorPt = pageHpt - (el.yPt + el.heightPt); // distance from page top to box top — kept fixed while resizing
        div.setPointerCapture(e.pointerId);
        selectElement(el.id);
      }

      moveTarget.addEventListener('pointerdown', (e) => { if (e.target === handle) return; begin(e, 'drag'); });
      handle.addEventListener('pointerdown', (e) => begin(e, 'resize'));

      div.addEventListener('pointermove', (e) => {
        if (!mode) return;
        const dxPt = (e.clientX - startClientX) / renderScale;
        const dyPt = (e.clientY - startClientY) / renderScale;
        if (mode === 'drag') {
          el.xPt = Math.max(0, Math.min(startXPt + dxPt, pageWpt - el.widthPt));
          el.yPt = Math.max(0, Math.min(startYPt - dyPt, pageHpt - el.heightPt));
        } else {
          // Bottom-right handle: top-left corner stays anchored, so the
          // box grows/shrinks toward the bottom-right on screen — which
          // in PDF coordinates (y-up) means the bottom edge (yPt) moves,
          // not the top.
          el.widthPt = Math.max(14, Math.min(startWPt + dxPt, pageWpt - startXPt));
          el.heightPt = Math.max(10, Math.min(startHPt + dyPt, pageHpt - topAnchorPt));
          el.yPt = pageHpt - topAnchorPt - el.heightPt;
        }
        positionDiv(div, el);
      });

      function stop(e) {
        if (!mode) return;
        mode = null;
        try { div.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      }
      div.addEventListener('pointerup', stop);
      div.addEventListener('pointercancel', stop);
    }

    function createElDiv(el) {
      const overlay = document.querySelector('#pdfeditOverlay');
      if (!overlay) return null;
      const div = document.createElement('div');
      div.className = `pdfedit-el pdfedit-el-${el.type}`;
      div.dataset.id = el.id;
      positionDiv(div, el);

      let moveTarget = div;
      if (el.type === 'text') {
        div.contentEditable = 'true';
        div.spellcheck = false;
        div.textContent = el.text;
        div.style.fontSize = `${ptToPx(el.fontSize)}px`;
        div.style.color = el.color;
        div.addEventListener('input', () => { el.text = div.innerText; });
        div.addEventListener('focus', () => selectElement(el.id));
        const grip = document.createElement('span');
        grip.className = 'pdfedit-grip';
        grip.setAttribute('aria-hidden', 'true');
        div.appendChild(grip);
        moveTarget = grip;
      } else if (el.type === 'image') {
        const img = document.createElement('img');
        img.src = el.imgUrl;
        img.draggable = false;
        img.alt = '';
        div.appendChild(img);
      }

      const handle = document.createElement('span');
      handle.className = 'pdfedit-handle';
      handle.setAttribute('aria-hidden', 'true');
      div.appendChild(handle);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'pdfedit-del-btn';
      delBtn.setAttribute('aria-label', 'Delete element');
      delBtn.innerHTML = '✕';
      delBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteElement(el.id); });
      div.appendChild(delBtn);

      wireDragResize(div, el, moveTarget, handle);
      div.addEventListener('pointerdown', (e) => {
        if (e.target === handle || e.target === delBtn) return;
        selectElement(el.id);
      });
      overlay.appendChild(div);
      return div;
    }

    async function renderPage(idx) {
      if (myEditGeneration !== renderGeneration) return;
      pageIdx = Math.max(0, Math.min(idx, pageCount - 1));
      const wrap = document.querySelector('#pdfeditWrap');
      if (!wrap) return;
      wrap.innerHTML = '<p class="tp-live-hint">Loading page…</p>';
      try {
        const page = await pdfjsDocRef.getPage(pageIdx + 1);
        const vp1 = page.getViewport({ scale: 1 });
        pageWpt = vp1.width;
        pageHpt = vp1.height;
        const stageMaxW = Math.min((wrap.parentElement && wrap.parentElement.clientWidth) || 700, 720);
        renderScale = Math.max(0.3, Math.min(2, stageMaxW / pageWpt));
        const canvas = await renderPdfPageToCanvas(page, renderScale);
        if (myEditGeneration !== renderGeneration) return;
        canvas.className = 'pdfedit-canvas';
        wrap.innerHTML = '';
        const stage = document.createElement('div');
        stage.className = 'pdfedit-stage';
        stage.style.width = `${canvas.width}px`;
        stage.style.height = `${canvas.height}px`;
        const overlay = document.createElement('div');
        overlay.className = 'pdfedit-overlay';
        overlay.id = 'pdfeditOverlay';
        overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) deselectAll(); });
        stage.appendChild(canvas);
        stage.appendChild(overlay);
        wrap.appendChild(stage);
        pageEls().forEach(createElDiv);
        const indicator = document.querySelector('#pePageIndicator');
        if (indicator) indicator.textContent = `Page ${pageIdx + 1} of ${pageCount}`;
        const prevBtn = document.querySelector('#pePrevPage');
        const nextBtn = document.querySelector('#peNextPage');
        if (prevBtn) prevBtn.disabled = pageIdx === 0;
        if (nextBtn) nextBtn.disabled = pageIdx === pageCount - 1;
      } catch {
        wrap.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;"><span class="icon icon-file" aria-hidden="true"></span> ${currentFile.name} (preview unavailable)</p>`;
      }
    }

    (async () => {
      try {
        const pdfjsLib = await getPdfjsLib();
        const bytes = await currentFile.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (myEditGeneration !== renderGeneration) return;
        pdfjsDocRef = doc;
        pageCount = doc.numPages;
        await renderPage(0);
      } catch {
        const wrap = document.querySelector('#pdfeditWrap');
        if (wrap) wrap.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;"><span class="icon icon-file" aria-hidden="true"></span> ${currentFile.name} (preview unavailable)</p>`;
      }
    })();

    document.querySelector('#pePrevPage').addEventListener('click', () => renderPage(pageIdx - 1));
    document.querySelector('#peNextPage').addEventListener('click', () => renderPage(pageIdx + 1));

    document.querySelector('#peAddText').addEventListener('click', () => {
      const w = Math.min(200, pageWpt * 0.6);
      const h = 36;
      const el = {
        id: `el${++elCounter}`, type: 'text',
        xPt: (pageWpt - w) / 2, yPt: (pageHpt - h) / 2, widthPt: w, heightPt: h,
        text: 'New text', fontSize: 16, color: '#111111',
      };
      pageEls().push(el);
      const div = createElDiv(el);
      selectElement(el.id);
      if (div) { div.focus(); selectAllText(div); }
    });

    document.querySelector('#peAddCover').addEventListener('click', () => {
      const w = Math.min(220, pageWpt * 0.6);
      const h = Math.min(60, pageHpt * 0.15);
      const el = {
        id: `el${++elCounter}`, type: 'cover',
        xPt: (pageWpt - w) / 2, yPt: (pageHpt - h) / 2, widthPt: w, heightPt: h,
      };
      pageEls().push(el);
      createElDiv(el);
      selectElement(el.id);
    });

    document.querySelector('#peAddImage').addEventListener('click', () => document.querySelector('#peImageInput').click());
    document.querySelector('#peImageInput').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const url = URL.createObjectURL(file);
      const probe = new Image();
      probe.onload = () => {
        const ratio = (probe.naturalHeight / probe.naturalWidth) || 1;
        let w = Math.min(pageWpt * 0.6, pageWpt);
        let h = w * ratio;
        if (h > pageHpt * 0.8) { h = pageHpt * 0.8; w = h / ratio; }
        const el = {
          id: `el${++elCounter}`, type: 'image',
          xPt: (pageWpt - w) / 2, yPt: (pageHpt - h) / 2, widthPt: w, heightPt: h,
          imgFile: file, imgUrl: url,
        };
        pageEls().push(el);
        createElDiv(el);
        selectElement(el.id);
      };
      probe.src = url;
    });

    function drawWrappedText(page, font, el) {
      const fontSize = el.fontSize;
      const lineHeight = fontSize * 1.2;
      const hex = (el.color || '#111111').replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255 || 0;
      const g = parseInt(hex.substring(2, 4), 16) / 255 || 0;
      const b = parseInt(hex.substring(4, 6), 16) / 255 || 0;
      const color = rgb(r, g, b);
      const lines = [];
      el.text.split('\n').forEach((para) => {
        const words = para.split(/\s+/).filter(Boolean);
        if (!words.length) { lines.push(''); return; }
        let line = '';
        words.forEach((word) => {
          const candidate = line ? `${line} ${word}` : word;
          if (line && font.widthOfTextAtSize(candidate, fontSize) > el.widthPt) {
            lines.push(line);
            line = word;
          } else {
            line = candidate;
          }
        });
        lines.push(line);
      });
      let cursorY = el.yPt + el.heightPt - fontSize;
      for (const line of lines) {
        if (cursorY < el.yPt - lineHeight) break;
        if (line) page.drawText(line, { x: el.xPt, y: cursorY, size: fontSize, font, color });
        cursorY -= lineHeight;
      }
    }

    async function reencodeImageToPng(file) {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        return new Uint8Array(await blob.arrayBuffer());
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    document.querySelector('#cfgApply').addEventListener('click', async () => {
      const hasAny = Object.values(pagesData).some((arr) => arr && arr.length);
      if (!hasAny) { showErrorState('Add at least one text box, image, or cover box before saving.'); return; }
      showProcessingState('Applying your edits...');
      try {
        ({ PDFDocument, rgb, StandardFonts } = await import('pdf-lib'));
        const bytes = await currentFile.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pages = doc.getPages();
        for (const [idxStr, elements] of Object.entries(pagesData)) {
          const idx = parseInt(idxStr, 10);
          const p = pages[idx];
          if (!p || !elements || !elements.length) continue;
          for (const el of elements) {
            if (el.type === 'cover') {
              p.drawRectangle({ x: el.xPt, y: el.yPt, width: el.widthPt, height: el.heightPt, color: rgb(1, 1, 1) });
            } else if (el.type === 'image' && el.imgFile) {
              const imgBytes = new Uint8Array(await el.imgFile.arrayBuffer());
              let embedded;
              try {
                embedded = el.imgFile.type === 'image/png' ? await doc.embedPng(imgBytes) : await doc.embedJpg(imgBytes);
              } catch {
                embedded = await doc.embedPng(await reencodeImageToPng(el.imgFile));
              }
              p.drawImage(embedded, { x: el.xPt, y: el.yPt, width: el.widthPt, height: el.heightPt });
            } else if (el.type === 'text' && el.text && el.text.trim()) {
              drawWrappedText(p, font, el);
            }
          }
        }
        const outBytes = await doc.save();
        await minWait(500);
        showResultState(new Blob([outBytes], { type: 'application/pdf' }), `edited-${currentFile.name}`);
      } catch (err) { showErrorState(err.message); }
    });
  }

  else if (currentToolKey === 'wordtoexcel' || currentToolKey === 'wordtopdf' || currentToolKey === 'wordtotext') {
    area.insertAdjacentHTML('beforeend', `
      <div id="docPreviewWrap" style="margin-top:10px;"><p style="color:var(--text-muted); font-size:0.85rem;">Loading preview...</p></div>
      <div class="config-panel"><button class="config-action-btn" id="cfgApply">Convert</button></div>
    `);
    (async () => {
      try {
        const mammoth = (await import('mammoth')).default;
        const arrayBuffer = await currentFile.arrayBuffer();
        const { value: text } = await mammoth.extractRawText({ arrayBuffer });
        const wrap = document.querySelector('#docPreviewWrap');
        if (wrap) {
          const snippet = text.trim().slice(0, 400);
          wrap.innerHTML = `<p class="doc-label">Preview (first ${snippet.length} characters):</p><p style="font-size:0.9rem; color:var(--text); white-space:pre-wrap; max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; padding:12px;">${snippet}${text.length > 400 ? '…' : ''}</p>`;
        }
      } catch {
        const wrap = document.querySelector('#docPreviewWrap');
        if (wrap) wrap.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;"><span class="icon icon-file" aria-hidden="true"></span> ${currentFile.name} (preview unavailable)</p>`;
      }
    })();
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      showProcessingState('Converting...');
      try {
        let blob, filename;
        if (currentToolKey === 'wordtoexcel') { blob = await wordToExcelBlob(currentFile); filename = `${currentFile.name.split('.')[0]}.xlsx`; }
        else if (currentToolKey === 'wordtopdf') { blob = await wordToPdfBlob(currentFile); filename = `${currentFile.name.split('.')[0]}.pdf`; }
        else { blob = await wordToTextBlob(currentFile); filename = `${currentFile.name.split('.')[0]}.txt`; }
        await minWait(500);
        showResultState(blob, filename);
      } catch (err) { showErrorState(err.message); }
    });
  }

  else if (currentToolKey === 'exceltopdf' || currentToolKey === 'exceltocsv') {
    area.insertAdjacentHTML('beforeend', `
      <div id="sheetPreviewWrap" style="margin-top:10px;"><p style="color:var(--text-muted); font-size:0.85rem;">Loading preview...</p></div>
      <div class="config-panel"><button class="config-action-btn" id="cfgApply">Convert</button></div>
    `);
    (async () => {
      try {
        const XLSX = await import('xlsx');
        const arrayBuffer = await currentFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        const previewRows = rows.slice(0, 5);
        const wrap = document.querySelector('#sheetPreviewWrap');
        if (wrap) {
          const tableHtml = previewRows.map((r) => `<tr>${r.map((cell) => `<td style="padding:4px 8px; border:1px solid var(--border); font-size:0.85rem;">${cell ?? ''}</td>`).join('')}</tr>`).join('');
          wrap.innerHTML = `<p class="doc-label">Sheet "${sheetName}": ${rows.length} row(s) total. Preview of first ${previewRows.length}:</p><div style="overflow-x:auto;"><table style="border-collapse:collapse;">${tableHtml}</table></div>`;
        }
      } catch {
        const wrap = document.querySelector('#sheetPreviewWrap');
        if (wrap) wrap.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;"><span class="icon icon-file" aria-hidden="true"></span> ${currentFile.name} (preview unavailable)</p>`;
      }
    })();
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      showProcessingState('Converting...');
      try {
        let blob, filename;
        if (currentToolKey === 'exceltopdf') { blob = await excelToPdfBlob(currentFile); filename = `${currentFile.name.split('.')[0]}.pdf`; }
        else { blob = await excelToCsvBlob(currentFile); filename = `${currentFile.name.split('.')[0]}.csv`; }
        await minWait(500);
        showResultState(blob, filename);
      } catch (err) { showErrorState(err.message); }
    });
  }

  else if (currentToolKey === 'pdfsplit') {
    area.insertAdjacentHTML('beforeend', `
      <div class="config-panel">
        <label>Groups (e.g. 1-3,4-6,7) <input type="text" id="cfgGroups" placeholder="1-3,4-6,7" /></label>
        <button class="config-action-btn" id="cfgApply">Split</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      const groupsStr = document.querySelector('#cfgGroups').value.trim();
      if (!groupsStr) return;
      showProcessingState('Splitting your PDF...');
      try {
        const { PDFDocument } = await import('pdf-lib');
        const bytes = await currentFile.arrayBuffer();
        const src = await PDFDocument.load(bytes);
        const total = src.getPageCount();
        const groups = groupsStr.split(',').map((g) => g.trim()).filter(Boolean);
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        for (let i = 0; i < groups.length; i++) {
          updateProcessingCaption(`Creating file ${i + 1} of ${groups.length}...`);
          const indices = parsePageRange(groups[i], total);
          const outDoc = await PDFDocument.create();
          const pages = await outDoc.copyPages(src, indices);
          pages.forEach((p) => outDoc.addPage(p));
          const outBytes = await outDoc.save();
          zip.file(`split-${i + 1}.pdf`, outBytes);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        await minWait(300);
        showResultState(zipBlob, `${currentFile.name.split('.')[0]}-split.zip`);
      } catch (err) { showErrorState(err.message); }
    });
  }

  else if (currentToolKey === 'pdfcompress') {
    area.insertAdjacentHTML('beforeend', `
      <p style="font-size:0.85rem; color:var(--text-muted); margin-top:10px;">Recompresses embedded JPEG images and trims unused data and metadata. All text and vector content stays exactly as-is, fully selectable and sharp.</p>
      <div class="config-panel">
        <label>Image quality
          <select id="cfgQuality">
            <option value="0.3">Low (smallest file)</option>
            <option value="0.6" selected>Medium</option>
            <option value="0.9">Extraordinary (largest file)</option>
          </select>
        </label>
        <button class="config-action-btn" id="cfgApply">Compress</button>
      </div>
    `);
    document.querySelector('#cfgApply').addEventListener('click', async () => {
      const quality = parseFloat(document.querySelector('#cfgQuality').value);
      const originalKB = currentFile.size / 1024;
      showProcessingState('Scanning embedded images...');
      try {
        const { PDFDocument, PDFName, PDFRawStream, PDFRef, PDFDict, PDFArray, PDFStream } = await import('pdf-lib');
        const bytes = await currentFile.arrayBuffer();
        const originalPageCount = (await PDFDocument.load(bytes)).getPageCount();

        // Runs the full compress pass — JPEG recompression, then (unless
        // disabled) stripping tool-fingerprint metadata and dropping any
        // object nobody in the document actually points to any more. That
        // last part is what lets a text/vector-only PDF shrink at all:
        // pdf-lib keeps every object it loaded, including leftovers from a
        // prior editor's incremental saves, unless something removes them.
        // `withGc: false` is the safety fallback if that pass ever produces
        // a file that doesn't reopen cleanly — see the validation below.
        async function runCompressPass({ withGc }) {
          const doc = await PDFDocument.load(bytes);

          function decodeAscii85(input) {
            // Strip optional <~ ~> delimiters and whitespace
            let str = new TextDecoder('latin1').decode(input).replace(/^<~/, '').replace(/~>$/, '').replace(/\s/g, '');
            const out = [];
            let tuple = [];
            for (let i = 0; i < str.length; i++) {
              const c = str[i];
              if (c === 'z' && tuple.length === 0) {
                out.push(0, 0, 0, 0);
                continue;
              }
              tuple.push(str.charCodeAt(i) - 33);
              if (tuple.length === 5) {
                let n = 0;
                for (const t of tuple) n = n * 85 + t;
                out.push((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
                tuple = [];
              }
            }
            if (tuple.length > 0) {
              const count = tuple.length;
              while (tuple.length < 5) tuple.push(84);
              let n = 0;
              for (const t of tuple) n = n * 85 + t;
              const bytes4 = [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
              out.push(...bytes4.slice(0, count - 1));
            }
            return new Uint8Array(out);
          }

          const recompressJpeg = (jpegBytes) => new Promise((resolve, reject) => {
            const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              canvas.getContext('2d').drawImage(img, 0, 0);
              canvas.toBlob((newBlob) => {
                URL.revokeObjectURL(url);
                if (!newBlob) { reject(new Error('Could not re-encode image')); return; }
                newBlob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
              }, 'image/jpeg', quality);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode embedded image')); };
            img.src = url;
          });

          let recompressedCount = 0;
          let imagesFound = 0;
          const entries = Array.from(doc.context.enumerateIndirectObjects());
          console.log(`[Compress PDF] Scanning ${entries.length} objects...`);
          for (let i = 0; i < entries.length; i++) {
            const [ref, obj] = entries[i];
            if (!obj || typeof obj.dict === 'undefined') continue;
            const subtype = obj.dict.get(PDFName.of('Subtype'));
            if (!subtype || subtype.toString() !== '/Image') continue;
            imagesFound++;
            let filterObj = obj.dict.get(PDFName.of('Filter'));
            const filterChain = filterObj && filterObj.array ? filterObj.array.map((f) => f.toString()) : filterObj ? [filterObj.toString()] : [];
            console.log(`[Compress PDF] Image #${imagesFound} filter chain:`, filterChain);
            if (!filterChain.length || filterChain[filterChain.length - 1] !== '/DCTDecode') {
              console.log(`[Compress PDF] Skipping — last filter isn't DCTDecode`);
              continue;
            }
            const hasAscii85 = filterChain.includes('/ASCII85Decode');

            updateProcessingCaption(`Recompressing image ${recompressedCount + 1}...`);
            try {
              const originalBytes = obj.contents;
              console.log(`[Compress PDF] originalBytes length: ${originalBytes.length}, hasAscii85: ${hasAscii85}, first bytes:`, Array.from(originalBytes.slice(0, 10)));
              const actualJpegBytes = hasAscii85 ? decodeAscii85(originalBytes) : originalBytes;
              console.log(`[Compress PDF] decoded JPEG bytes length: ${actualJpegBytes.length}, starts with FFD8:`, actualJpegBytes[0] === 0xFF && actualJpegBytes[1] === 0xD8);
              const newBytes = await recompressJpeg(actualJpegBytes);
              console.log(`[Compress PDF] recompressed bytes length: ${newBytes.length} (vs original ${originalBytes.length})`);
              if (newBytes.length < originalBytes.length) {
                const newDict = obj.dict.clone(doc.context);
                newDict.set(PDFName.of('Length'), doc.context.obj(newBytes.length));
                // New bytes are plain JPEG — filter chain must drop ASCII85Decode now that we're not re-encoding to it
                newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
                const newStream = PDFRawStream.of(newDict, newBytes);
                doc.context.assign(ref, newStream);
                recompressedCount++;
              } else {
                console.log(`[Compress PDF] Skipped — new bytes (${newBytes.length}) not smaller than original (${originalBytes.length})`);
              }
            } catch (imgErr) {
              console.log(`[Compress PDF] Image #${imagesFound} failed:`, imgErr.message);
            }
          }
          console.log(`[Compress PDF] Done. Found ${imagesFound} image(s), recompressed ${recompressedCount}.`);

          // Tool-fingerprint metadata (Producer/Creator + the XMP packet) is
          // pure bloat from whatever software last wrote the file — never
          // content the person who has the PDF actually cares about — so
          // it's safe to drop regardless of withGc. Title/Author/Subject/
          // Keywords are left untouched since those ARE user-set content.
          let metadataTrimmed = false;
          try {
            const info = doc.getInfoDict();
            if (info.has(PDFName.of('Producer'))) { info.delete(PDFName.of('Producer')); metadataTrimmed = true; }
            if (info.has(PDFName.of('Creator'))) { info.delete(PDFName.of('Creator')); metadataTrimmed = true; }
            if (doc.catalog.has(PDFName.of('Metadata'))) { doc.catalog.delete(PDFName.of('Metadata')); metadataTrimmed = true; }
          } catch (metaErr) {
            console.log('[Compress PDF] Metadata cleanup skipped:', metaErr.message);
          }

          // Drop objects nothing in the document points to any more — most
          // commonly leftover page/font/image versions from a prior editor's
          // incremental saves. pdf-lib keeps everything it loaded unless we
          // remove it ourselves; this is a plain mark-and-sweep from the
          // document catalog (the same root the actual PDF renderer uses).
          let orphansRemoved = 0;
          if (withGc) {
            try {
              const visited = new Set();
              // Seed with the trailer's own refs (not the resolved dicts) so
              // the Catalog's — and Info dict's — object numbers themselves
              // land in `visited` too. Missing this was the bug caught by
              // the verification step below: the catalog object was reachable
              // in spirit but its own ref never got marked, so the sweep
              // deleted the catalog itself.
              const stack = [];
              if (doc.context.trailerInfo.Root) stack.push(doc.context.trailerInfo.Root);
              if (doc.context.trailerInfo.Info) stack.push(doc.context.trailerInfo.Info);
              const visit = (val) => {
                if (val instanceof PDFRef) {
                  if (visited.has(val)) return;
                  visited.add(val);
                  const resolved = doc.context.lookup(val);
                  if (resolved) stack.push(resolved);
                } else if (val instanceof PDFStream) {
                  stack.push(val.dict);
                } else if (val instanceof PDFDict) {
                  for (const v of val.values()) stack.push(v);
                } else if (val instanceof PDFArray) {
                  for (const v of val.asArray()) stack.push(v);
                }
              };
              while (stack.length) visit(stack.pop());

              for (const [ref] of doc.context.enumerateIndirectObjects()) {
                if (!visited.has(ref)) { doc.context.delete(ref); orphansRemoved++; }
              }
              console.log(`[Compress PDF] GC removed ${orphansRemoved} unreferenced object(s).`);
            } catch (gcErr) {
              console.log('[Compress PDF] GC pass skipped:', gcErr.message);
            }
          }

          updateProcessingCaption('Saving your PDF...');
          const outBytes = await doc.save();
          return { outBytes, recompressedCount, imagesFound, metadataTrimmed, orphansRemoved };
        }

        let result = await runCompressPass({ withGc: true });
        // Safety net: confirm the GC'd file still opens and has every page
        // before trusting it. If a document has some non-standard reference
        // our mark-and-sweep didn't know to follow, fall back to the same
        // pass without object removal rather than risk handing back a file
        // that's smaller but broken.
        if (result.orphansRemoved > 0) {
          try {
            const check = await PDFDocument.load(result.outBytes);
            if (check.getPageCount() !== originalPageCount) throw new Error('page count mismatch');
          } catch (verifyErr) {
            console.log('[Compress PDF] GC output failed verification, redoing without it:', verifyErr.message);
            result = await runCompressPass({ withGc: false });
          }
        }

        const { outBytes, recompressedCount, metadataTrimmed, orphansRemoved } = result;
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const newKB = blob.size / 1024;
        const pct = Math.round(100 - (newKB / originalKB) * 100);
        const savedSomething = pct > 0;
        const extras = [];
        if (recompressedCount > 0) extras.push(`${recompressedCount} image(s) recompressed`);
        if (orphansRemoved > 0) extras.push('unused data removed');
        if (metadataTrimmed) extras.push('metadata cleaned');
        const note = savedSomething
          ? `${originalKB.toFixed(0)}KB → ${newKB.toFixed(0)}KB (${pct}% smaller); ${extras.length ? extras.join(', ') + ', ' : ''}text untouched.`
          : 'This PDF is already about as small as it gets: no embedded JPEGs to recompress and no extra data to trim without changing its content.';
        await minWait(300);
        showResultState(blob, `compressed-${currentFile.name}`, note);
      } catch (err) { showErrorState(err.message); }
    });
  }

  // A few tool branches (PDF rotate, Word/Excel previews) build their own
  // preview wrapper inline rather than through the generic paths above —
  // move those into the left pane too, so every tool's preview ends up on
  // the left and every control/button ends up in the sidebar, regardless
  // of which branch built it.
  if (previewPane) {
    ['#pdfPreviewWrap', '#docPreviewWrap', '#sheetPreviewWrap', '.tp-generic-file-line'].forEach((sel) => {
      area.querySelectorAll(sel).forEach((el) => previewPane.appendChild(el));
    });
    // Nothing had a visual preview for this tool (e.g. Compress PDF) — show
    // a plain file icon so the left pane isn't left empty.
    if (!previewPane.children.length) {
      previewPane.innerHTML = `<div class="tp-file-fallback"><span class="tp-file-fallback-icon"><span class="icon icon-file" aria-hidden="true"></span></span><span>${currentFile.name}</span></div>`;
    }
  }
}

function parsePageRange(rangeStr, maxPages) {
  const indices = new Set();
  rangeStr.split(',').forEach((part) => {
    part = part.trim();
    if (part.includes('-')) {
      const [a, b] = part.split('-').map((n) => parseInt(n.trim()));
      for (let i = a; i <= b; i++) if (i >= 1 && i <= maxPages) indices.add(i - 1);
    } else if (part) {
      const n = parseInt(part);
      if (n >= 1 && n <= maxPages) indices.add(n - 1);
    }
  });
  return Array.from(indices).sort((a, b) => a - b);
}

async function processAndShow(blob, filename) {
  showProcessingState('Working...');
  await minWait(900);
  showResultState(blob, filename);
}

// ================= NO-FILE (TEXT / UTILITY) TOOLS =================
function renderNoFileTool(toolKey) {
  if (toolKey === 'texttoppt') renderTextToPptTool();
  if (toolKey === 'textopdf') renderTextToPdfTool();
  if (toolKey === 'wordcounter') renderWordCounterTool();
  if (toolKey === 'caseconverter') renderCaseConverterTool();
  if (toolKey === 'qrcode') renderQrCodeTool();
  if (toolKey === 'passwordgen') renderPasswordGenTool();
  if (toolKey === 'jsonformatter') renderJsonFormatterTool();
  if (toolKey === 'base64') renderBase64Tool();
  if (toolKey === 'loremipsum') renderLoremIpsumTool();
  if (toolKey === 'unitconverter') renderUnitConverterTool();
  if (toolKey === 'gpacalculator') renderGpaCalculatorTool();
  if (toolKey === 'citationgen') renderCitationGenTool();
  if (toolKey === 'randomgen') renderRandomGenTool();
  if (toolKey === 'invoicegen') renderInvoiceGenTool();
  if (toolKey === 'resumebuilder') renderResumeBuilderTool();
  if (toolKey === 'scantopdf') renderScanToPdfTool();
  if (toolKey === 'htmltopdf') renderHtmlToPdfTool();
  if (toolKey === 'htmltoexcel') renderHtmlToExcelTool();
  if (toolKey === 'aisummarizer') renderContentParaphraserTool();
}

function renderTextToPptTool() {
  modalBody.innerHTML = `
    <p style="font-size:0.92rem; color:var(--text-muted); margin-bottom:8px;">Separate slides with a blank line first line of each block becomes the slide title.</p>
    <textarea id="t2pptText" rows="8" placeholder="Slide 1 title
Bullet point one

Slide 2 title
Another bullet" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;"></textarea>
    <div class="config-panel"><button class="config-action-btn" id="cfgGen">Generate PPTX</button></div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', async () => {
    const text = document.querySelector('#t2pptText').value.trim();
    if (!text) return;
    showProcessingState('Building your slides...');
    const pptxgen = (await import('pptxgenjs')).default;
    const blocks = text.split(/\n\s*\n/);
    const pptx = new pptxgen();
    blocks.forEach((block) => {
      const lines = block.split('\n').filter((l) => l.trim());
      const slide = pptx.addSlide();
      slide.addText(lines[0] || 'Untitled', { x: 0.5, y: 0.4, w: 9, h: 1, fontSize: 28, bold: true });
      if (lines.length > 1) {
        slide.addText(lines.slice(1).map((l) => ({ text: l, options: { bullet: true, breakLine: true } })), { x: 0.5, y: 1.5, w: 9, h: 4.5, fontSize: 18 });
      }
    });
    const blob = await pptx.write('blob');
    await minWait(600);
    showResultState(blob, 'presentation.pptx');
  });
}

function renderTextToPdfTool() {
  modalBody.innerHTML = `
    <textarea id="t2pdfText" rows="10" placeholder="Paste or type your text here..." style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;"></textarea>
    <div class="config-panel"><button class="config-action-btn" id="cfgGen">Generate PDF</button></div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', async () => {
    const text = document.querySelector('#t2pdfText').value.trim();
    if (!text) return;
    showProcessingState('Building your PDF...');
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    const lines = pdf.splitTextToSize(text, 180);
    let y = 15;
    lines.forEach((line) => { if (y > 280) { pdf.addPage(); y = 15; } pdf.text(line, 15, y); y += 7; });
    await minWait(500);
    showResultState(pdf.output('blob'), 'document.pdf');
  });
}

function renderWordCounterTool() {
  modalBody.innerHTML = `
    <textarea id="wcText" rows="10" placeholder="Start typing or paste text..." style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;"></textarea>
    <p id="wcResult" style="margin-top:12px; font-size:1.05rem; color:var(--text);">Words: 0 Characters: 0</p>
  `;
  const textarea = document.querySelector('#wcText');
  textarea.addEventListener('input', () => {
    const text = textarea.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    document.querySelector('#wcResult').textContent = `Words: ${words} Characters: ${text.length}`;
  });
}

function renderCaseConverterTool() {
  modalBody.innerHTML = `
    <textarea id="caseInput" rows="6" placeholder="Enter text..." style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;"></textarea>
    <div class="config-panel">
      <button type="button" id="cUpper">UPPERCASE</button>
      <button type="button" id="cLower">lowercase</button>
      <button type="button" id="cTitle">Title Case</button>
      <button type="button" id="cSentence">Sentence case</button>
    </div>
  `;
  function show(val, kind) {
    if (!val) return;
    showResultState(new Blob([val], { type: 'text/plain' }), `${kind}-text.txt`);
  }
  document.querySelector('#cUpper').addEventListener('click', () => show(document.querySelector('#caseInput').value.toUpperCase(), 'uppercase'));
  document.querySelector('#cLower').addEventListener('click', () => show(document.querySelector('#caseInput').value.toLowerCase(), 'lowercase'));
  document.querySelector('#cTitle').addEventListener('click', () => show(document.querySelector('#caseInput').value.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()), 'title-case'));
  document.querySelector('#cSentence').addEventListener('click', () => {
    const text = document.querySelector('#caseInput').value.toLowerCase();
    show(text.replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase()), 'sentence-case');
  });
}

function renderQrCodeTool() {
  modalBody.innerHTML = `
    <div class="config-panel">
      <input type="text" id="qrInput" placeholder="https://example.com" style="flex:1; min-width:200px;" />
      <button class="config-action-btn" id="cfgGen">Generate</button>
    </div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', async () => {
    const val = document.querySelector('#qrInput').value.trim();
    if (!val) return;
    showProcessingState('Generating your QR code...');
    const QRCode = (await import('qrcode')).default;
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, val, { width: 480 });
    canvas.toBlob((blob) => showResultState(blob, 'qrcode.png'), 'image/png');
  });
}

function renderPasswordGenTool() {
  modalBody.innerHTML = `
    <div class="config-panel">
      <label>Length <input type="number" id="pwLength" value="16" min="4" max="64" /></label>
      <label><input type="checkbox" id="pwUpper" checked /> Uppercase</label>
      <label><input type="checkbox" id="pwNumbers" checked /> Numbers</label>
      <label><input type="checkbox" id="pwSymbols" checked /> Symbols</label>
      <button class="config-action-btn" id="cfgGen">Generate</button>
    </div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', () => {
    const len = parseInt(document.querySelector('#pwLength').value) || 16;
    let chars = 'abcdefghijklmnopqrstuvwxyz';
    if (document.querySelector('#pwUpper').checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (document.querySelector('#pwNumbers').checked) chars += '0123456789';
    if (document.querySelector('#pwSymbols').checked) chars += '!@#$%^&*()_+-=';
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    let pw = '';
    for (let i = 0; i < len; i++) pw += chars[arr[i] % chars.length];
    showResultState(new Blob([pw], { type: 'text/plain' }), 'password.txt');
  });
}

function renderJsonFormatterTool() {
  modalBody.innerHTML = `
    <textarea id="jsonInput" rows="8" placeholder='{"example": true}' style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;"></textarea>
    <div class="config-panel"><button class="config-action-btn" id="cfgGen">Format</button></div>
    <div id="jsonOutWrap"></div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', () => {
    const wrap = document.querySelector('#jsonOutWrap');
    try {
      const pretty = JSON.stringify(JSON.parse(document.querySelector('#jsonInput').value), null, 2);
      showResultState(new Blob([pretty], { type: 'application/json' }), 'formatted.json');
    } catch (err) {
      wrap.innerHTML = `<p style="color:var(--red-dark); margin-top:10px;">Invalid JSON: ${err.message}</p>`;
    }
  });
}

function renderBase64Tool() {
  modalBody.innerHTML = `
    <textarea id="b64Input" rows="6" placeholder="Enter text..." style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;"></textarea>
    <div class="config-panel">
      <button type="button" id="b64Enc">Encode</button>
      <button type="button" id="b64Dec">Decode</button>
    </div>
    <div id="b64OutWrap"></div>
  `;
  function showError(msg) {
    const wrap = document.querySelector('#b64OutWrap');
    wrap.innerHTML = `<p style="color:var(--red-dark); margin-top:10px;">${msg}</p>`;
  }
  document.querySelector('#b64Enc').addEventListener('click', () => {
    try { showResultState(new Blob([btoa(document.querySelector('#b64Input').value)], { type: 'text/plain' }), 'encoded.txt'); }
    catch { showError('Error: cannot encode these characters.'); }
  });
  document.querySelector('#b64Dec').addEventListener('click', () => {
    try { showResultState(new Blob([atob(document.querySelector('#b64Input').value)], { type: 'text/plain' }), 'decoded.txt'); }
    catch { showError('Error: invalid Base64 input.'); }
  });
}

function renderLoremIpsumTool() {
  modalBody.innerHTML = `
    <div class="config-panel">
      <label>Paragraphs <input type="number" id="loremCount" value="3" min="1" max="20" /></label>
      <button class="config-action-btn" id="cfgGen">Generate</button>
    </div>
  `;
  const sentences = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse.',
    'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.',
    'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit.',
  ];
  document.querySelector('#cfgGen').addEventListener('click', () => {
    const count = parseInt(document.querySelector('#loremCount').value) || 3;
    const paragraphs = [];
    for (let i = 0; i < count; i++) {
      const shuffled = [...sentences].sort(() => Math.random() - 0.5);
      paragraphs.push(shuffled.slice(0, 4).join(' '));
    }
    showResultState(new Blob([paragraphs.join('\n\n')], { type: 'text/plain' }), 'lorem-ipsum.txt');
  });
}

function renderUnitConverterTool() {
  const unitGroups = {
    length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mile: 1609.34, yard: 0.9144, foot: 0.3048, inch: 0.0254 },
    weight: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495, ton: 1000 },
  };
  modalBody.innerHTML = `
    <div class="config-panel">
      <label>Category
        <select id="unitCat"><option value="length">Length</option><option value="weight">Weight</option><option value="temperature">Temperature</option></select>
      </label>
    </div>
    <div class="config-panel">
      <label>Value <input type="number" id="unitVal" value="1" /></label>
      <label>From <select id="unitFrom"></select></label>
      <label>To <select id="unitTo"></select></label>
      <button class="config-action-btn" id="cfgGen">Convert</button>
    </div>
    <p id="unitOutput" style="margin-top:10px; font-size:1.05rem;"></p>
  `;
  const catSelect = document.querySelector('#unitCat');
  const fromSelect = document.querySelector('#unitFrom');
  const toSelect = document.querySelector('#unitTo');
  function populate() {
    const cat = catSelect.value;
    if (cat === 'temperature') {
      fromSelect.innerHTML = toSelect.innerHTML = ['Celsius', 'Fahrenheit', 'Kelvin'].map((u) => `<option value="${u}">${u}</option>`).join('');
    } else {
      fromSelect.innerHTML = toSelect.innerHTML = Object.keys(unitGroups[cat]).map((u) => `<option value="${u}">${u}</option>`).join('');
    }
  }
  catSelect.addEventListener('change', populate);
  populate();
  document.querySelector('#cfgGen').addEventListener('click', () => {
    const cat = catSelect.value, val = parseFloat(document.querySelector('#unitVal').value) || 0, from = fromSelect.value, to = toSelect.value;
    let result;
    if (cat === 'temperature') {
      const celsius = from === 'Celsius' ? val : from === 'Fahrenheit' ? (val - 32) * 5 / 9 : val - 273.15;
      result = to === 'Celsius' ? celsius : to === 'Fahrenheit' ? celsius * 9 / 5 + 32 : celsius + 273.15;
    } else {
      result = (val * unitGroups[cat][from]) / unitGroups[cat][to];
    }
    document.querySelector('#unitOutput').textContent = `${val} ${from} = ${result.toFixed(4)} ${to}`;
  });
}

function renderGpaCalculatorTool() {
  modalBody.innerHTML = `
    <div id="gpaRows"></div>
    <div class="config-panel">
      <button type="button" id="addRow">+ Add Course</button>
      <button class="config-action-btn" id="cfgGen">Calculate</button>
    </div>
    <p id="gpaOutput" style="margin-top:10px; font-size:1.1rem;"></p>
  `;
  const rowsEl = document.querySelector('#gpaRows');
  function addRow() {
    const row = document.createElement('div');
    row.className = 'config-panel';
    row.innerHTML = `
      <label>Credits <input type="number" class="gpaCredits" value="3" min="0" /></label>
      <label>Grade (0-4) <input type="number" class="gpaGrade" value="4" min="0" max="4" step="0.1" /></label>
      <button type="button" class="rmRow">✕</button>
    `;
    row.querySelector('.rmRow').addEventListener('click', () => row.remove());
    rowsEl.appendChild(row);
  }
  addRow(); addRow();
  document.querySelector('#addRow').addEventListener('click', addRow);
  document.querySelector('#cfgGen').addEventListener('click', () => {
    const credits = Array.from(document.querySelectorAll('.gpaCredits')).map((el) => parseFloat(el.value) || 0);
    const grades = Array.from(document.querySelectorAll('.gpaGrade')).map((el) => parseFloat(el.value) || 0);
    let totalPoints = 0, totalCredits = 0;
    credits.forEach((c, i) => { totalPoints += c * grades[i]; totalCredits += c; });
    document.querySelector('#gpaOutput').textContent = `Your GPA: ${totalCredits ? (totalPoints / totalCredits).toFixed(3) : '0.000'}`;
  });
}

function renderCitationGenTool() {
  modalBody.innerHTML = `
    <div class="config-panel" style="flex-direction:column; align-items:stretch;">
      <label>Style <select id="citeStyle"><option value="apa">APA</option><option value="mla">MLA</option><option value="chicago">Chicago</option></select></label>
      <label>Author (Last, First) <input type="text" id="citeAuthor" /></label>
      <label>Title <input type="text" id="citeTitle" /></label>
      <label>Year <input type="text" id="citeYear" /></label>
      <label>Publisher / Website <input type="text" id="citePub" /></label>
      <button class="config-action-btn" id="cfgGen" style="margin-top:6px;">Generate Citation</button>
    </div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', () => {
    const style = document.querySelector('#citeStyle').value;
    const author = document.querySelector('#citeAuthor').value.trim();
    const title = document.querySelector('#citeTitle').value.trim();
    const year = document.querySelector('#citeYear').value.trim();
    const pub = document.querySelector('#citePub').value.trim();
    let result = style === 'apa' ? `${author} (${year}). ${title}. ${pub}.`
      : style === 'mla' ? `${author}. "${title}." ${pub}, ${year}.`
      : `${author}. ${title}. ${pub}, ${year}.`;
    showResultState(new Blob([result], { type: 'text/plain' }), 'citation.txt');
  });
}

function renderRandomGenTool() {
  modalBody.innerHTML = `
    <div class="config-panel">
      <label>Type <select id="randType"><option value="number">Random Number</option><option value="string">Random String</option></select></label>
      <label>Min <input type="number" id="randMin" value="1" /></label>
      <label>Max <input type="number" id="randMax" value="100" /></label>
      <button class="config-action-btn" id="cfgGen">Generate</button>
    </div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', () => {
    const type = document.querySelector('#randType').value;
    if (type === 'number') {
      const min = parseInt(document.querySelector('#randMin').value) || 0;
      const max = parseInt(document.querySelector('#randMax').value) || 100;
      const result = Math.floor(Math.random() * (max - min + 1)) + min;
      showResultState(new Blob([`Random number: ${result}`], { type: 'text/plain' }), 'random-number.txt');
    } else {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let str = '';
      for (let i = 0; i < 12; i++) str += chars[Math.floor(Math.random() * chars.length)];
      showResultState(new Blob([`Random string: ${str}`], { type: 'text/plain' }), 'random-string.txt');
    }
  });
}

function renderInvoiceGenTool() {
  modalBody.innerHTML = `
    <div class="config-panel" style="flex-direction:column; align-items:stretch;">
      <label>Your business name <input type="text" id="invFrom" placeholder="Your Company" /></label>
      <label>Bill to <input type="text" id="invTo" placeholder="Client Name" /></label>
      <label>Invoice number <input type="text" id="invNum" placeholder="INV-001" /></label>
      <label>Items (description, qty, price one per line)</label>
      <textarea id="invItems" rows="5" placeholder="Web design, 1, 500
Hosting, 12, 10" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;"></textarea>
      <button class="config-action-btn" id="cfgGen" style="margin-top:6px;">Generate PDF</button>
    </div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', async () => {
    const from = document.querySelector('#invFrom').value.trim() || 'Your Business';
    const to = document.querySelector('#invTo').value.trim() || 'Client';
    const number = document.querySelector('#invNum').value.trim() || 'INV-001';
    const itemLines = document.querySelector('#invItems').value.trim().split('\n').filter((l) => l.trim());
    if (!itemLines.length) return;
    showProcessingState('Building your invoice...');
    const items = itemLines.map((line) => {
      const [desc, qty, price] = line.split(',').map((s) => s.trim());
      return { desc, qty: parseFloat(qty) || 0, price: parseFloat(price) || 0 };
    });
    const total = items.reduce((sum, it) => sum + it.qty * it.price, 0);
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const pdf = new jsPDF();
    pdf.setFontSize(20); pdf.text('INVOICE', 15, 20);
    pdf.setFontSize(11);
    pdf.text(`From: ${from}`, 15, 35);
    pdf.text(`Bill To: ${to}`, 15, 42);
    pdf.text(`Invoice #: ${number}`, 15, 49);
    autoTable(pdf, {
      startY: 58,
      head: [['Description', 'Qty', 'Price', 'Subtotal']],
      body: items.map((it) => [it.desc, it.qty, `$${it.price.toFixed(2)}`, `$${(it.qty * it.price).toFixed(2)}`]),
      foot: [['', '', 'Total', `$${total.toFixed(2)}`]],
      headStyles: { fillColor: [37, 99, 235] },
    });
    await minWait(600);
    showResultState(pdf.output('blob'), `${number}.pdf`);
  });
}

function renderResumeBuilderTool() {
  modalBody.innerHTML = `
    <div class="two-col-form">
      <label class="full-width">Full name <input type="text" id="resName" placeholder="Jane Doe" /></label>
      <label class="full-width">Contact <input type="text" id="resContact" placeholder="jane@email.com 555-1234" /></label>
      <label class="full-width">Summary <textarea id="resSummary" rows="2"></textarea></label>
      <label>Experience <textarea id="resExp" rows="4" placeholder="Job Title Company (2022-2026)"></textarea></label>
      <label>Education <textarea id="resEdu" rows="4" placeholder="Degree University (Year)"></textarea></label>
      <label class="full-width">Skills (comma separated) <input type="text" id="resSkills" placeholder="JavaScript, Design, Communication" /></label>
    </div>
    <div class="config-panel"><button class="config-action-btn" id="cfgGen">Generate PDF</button></div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', async () => {
    const name = document.querySelector('#resName').value.trim() || 'Your Name';
    const contact = document.querySelector('#resContact').value.trim();
    const summary = document.querySelector('#resSummary').value.trim();
    const experience = document.querySelector('#resExp').value.trim();
    const education = document.querySelector('#resEdu').value.trim();
    const skills = document.querySelector('#resSkills').value.trim();
    showProcessingState('Building your resume...');
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    let y = 20;
    pdf.setFontSize(22); pdf.text(name, 15, y); y += 8;
    pdf.setFontSize(10); pdf.text(contact, 15, y); y += 12;
    function section(title, content) {
      if (!content) return;
      pdf.setFontSize(13); pdf.text(title, 15, y); y += 7;
      pdf.setFontSize(10);
      content.split('\n').forEach((line) => {
        pdf.splitTextToSize(line, 180).forEach((wl) => {
          if (y > 280) { pdf.addPage(); y = 20; }
          pdf.text(wl, 15, y); y += 6;
        });
      });
      y += 6;
    }
    section('Summary', summary); section('Experience', experience); section('Education', education); section('Skills', skills);
    await minWait(600);
    showResultState(pdf.output('blob'), `${name.replace(/\s+/g, '-')}-resume.pdf`);
  });
}

// ================= PDF.JS SHARED HELPER =================
// The worker used to be pointed at unpkg.com and fetched over the network
// on every first PDF preview. Any interruption there — an ad blocker,
// a corporate proxy, unpkg being slow/down, even a flaky connection —
// left the worker unable to load, which pdf.js surfaces by falling back
// to a dynamic import() of the same broken URL. Vite's preload-error
// handler (below, "STALE DEPLOY RECOVERY") treats that failure as a stale
// deploy and silently reloads the whole page, wiping out whatever the
// visitor was doing — including, e.g., a compress/rotate/split result
// that had already finished. Bundling the worker locally (so it ships
// from our own domain with every other asset) removes that entire
// external dependency.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let pdfjsLibCache = null;
async function getPdfjsLib() {
  if (pdfjsLibCache) return pdfjsLibCache;
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  pdfjsLibCache = pdfjsLib;
  return pdfjsLib;
}

async function renderPdfPageToCanvas(page, scale) {
  const viewport = page.getViewport({ scale: scale || 1.5 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

async function extractPdfTextPages(file) {
  const pdfjsLib = await getPdfjsLib();
  const bytes = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    updateProcessingCaption(`Reading page ${i} of ${pdfDoc.numPages}...`);
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  return pages;
}

async function extractPdfTableGrid(file) {
  const pdfjsLib = await getPdfjsLib();
  const bytes = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const grid = [];

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    updateProcessingCaption(`Reading page ${p} of ${pdfDoc.numPages}...`);
    const page = await pdfDoc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => it.str.trim())
      .map((it) => ({ text: it.str, x: it.transform[4], y: it.transform[5] }));
    if (!items.length) continue;

    // Group into rows: items with near-identical Y are on the same line
    items.sort((a, b) => b.y - a.y); // top to bottom (PDF y-axis increases upward)
    const rowYTolerance = 3;
    const rows = [];
    let currentRow = [items[0]];
    for (let i = 1; i < items.length; i++) {
      if (Math.abs(items[i].y - currentRow[0].y) <= rowYTolerance) {
        currentRow.push(items[i]);
      } else {
        rows.push(currentRow);
        currentRow = [items[i]];
      }
    }
    rows.push(currentRow);

    // Within each row, sort left to right and merge into columns using an X-gap threshold
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      const cells = [];
      let cell = row[0].text;
      let lastX = row[0].x + row[0].text.length * 4; // rough width estimate
      const colGapThreshold = 10;
      for (let i = 1; i < row.length; i++) {
        if (row[i].x - lastX > colGapThreshold) {
          cells.push(cell.trim());
          cell = row[i].text;
        } else {
          cell += row[i].text;
        }
        lastX = row[i].x + row[i].text.length * 4;
      }
      cells.push(cell.trim());
      grid.push(cells);
    }
  }
  return grid;
}

// ================= NEW PDF TOOL CONFIG RENDERERS =================

async function runPdfToWord(file) {
  showProcessingState('Extracting text...');
  try {
    const pages = await extractPdfTextPages(file);
    const { Document, Packer, Paragraph } = await import('docx');
    const doc = new Document({
      sections: [{
        children: pages.flatMap((text, i) => [
          new Paragraph({ text: `Page ${i + 1}`, heading: 'Heading2' }),
          ...text.split(/\n+/).map((line) => new Paragraph(line)),
        ]),
      }],
    });
    const blob = await Packer.toBlob(doc);
    showResultState(blob, `${file.name.split('.')[0]}.docx`);
  } catch (err) { showErrorState(err.message); }
}

async function runPdfToExcel(file) {
  showProcessingState('Extracting data...');
  try {
    const grid = await extractPdfTableGrid(file);
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.aoa_to_sheet(grid);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    showResultState(new Blob([wbout], { type: 'application/octet-stream' }), `${file.name.split('.')[0]}.xlsx`);
  } catch (err) { showErrorState(err.message); }
}

async function runPdfToJpg(file) {
  showProcessingState('Rendering pages...');
  try {
    const pdfjsLib = await getPdfjsLib();
    const bytes = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    if (pdfDoc.numPages === 1) {
      const page = await pdfDoc.getPage(1);
      const canvas = await renderPdfPageToCanvas(page);
      canvas.toBlob((blob) => showResultState(blob, `${file.name.split('.')[0]}.jpg`), 'image/jpeg', 0.92);
    } else {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        updateProcessingCaption(`Rendering page ${i} of ${pdfDoc.numPages}...`);
        const page = await pdfDoc.getPage(i);
        const canvas = await renderPdfPageToCanvas(page);
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
        zip.file(`page-${i}.jpg`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      showResultState(zipBlob, `${file.name.split('.')[0]}-pages.zip`);
    }
  } catch (err) { showErrorState(err.message); }
}

async function runPdfToPpt(file) {
  showProcessingState('Building slides...');
  try {
    const pdfjsLib = await getPdfjsLib();
    const bytes = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    const pptxgen = (await import('pptxgenjs')).default;
    const pptx = new pptxgen();
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      updateProcessingCaption(`Adding slide ${i} of ${pdfDoc.numPages}...`);
      const page = await pdfDoc.getPage(i);
      const canvas = await renderPdfPageToCanvas(page);
      const slide = pptx.addSlide();
      slide.addImage({ data: canvas.toDataURL('image/jpeg', 0.9), x: 0, y: 0, w: 10, h: 5.63 });
    }
    const blob = await pptx.write('blob');
    showResultState(blob, `${file.name.split('.')[0]}.pptx`);
  } catch (err) { showErrorState(err.message); }
}

async function runPdfToMarkdown(file) {
  showProcessingState('Converting to Markdown...');
  try {
    const pages = await extractPdfTextPages(file);
    const md = pages.map((text, i) => `## Page ${i + 1}\n\n${text.replace(/\s{2,}/g, '\n\n')}`).join('\n\n');
    showResultState(new Blob([md], { type: 'text/markdown' }), `${file.name.split('.')[0]}.md`);
  } catch (err) { showErrorState(err.message); }
}

// ================= CAMERA (Scan to PDF) =================
function renderScanToPdfTool() {
  let mediaStream = null;
  let captures = [];
  modalBody.innerHTML = `
    <video id="scanVideo" autoplay playsinline style="width:100%; border-radius:10px; background:#000;"></video>
    <div class="config-panel">
      <button type="button" class="config-action-btn" id="captureBtn"><span class="icon icon-camera" aria-hidden="true"></span> Capture Page</button>
      <button class="config-action-btn" id="doneScanBtn" disabled>Create PDF (<span id="captureCount">0</span> pages)</button>
    </div>
    <div id="scanThumbs" class="file-list"></div>
    <p id="cameraError" style="color: var(--red-dark); font-size:0.9rem;"></p>
  `;
  const video = document.querySelector('#scanVideo');
  const thumbsEl = document.querySelector('#scanThumbs');
  const countEl = document.querySelector('#captureCount');
  const doneBtn = document.querySelector('#doneScanBtn');

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then((stream) => { mediaStream = stream; video.srcObject = stream; })
    .catch(() => {
      document.querySelector('#cameraError').textContent = "Couldn't access your camera. Check your browser's camera permission for this site.";
    });

  document.querySelector('#captureBtn').addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      captures.push(blob);
      countEl.textContent = captures.length;
      doneBtn.disabled = captures.length < 1;
      const thumb = document.createElement('div');
      thumb.className = 'file-row';
      thumb.innerHTML = `<img class="file-thumb" src="${URL.createObjectURL(blob)}" /><span class="file-name">Page ${captures.length}</span>`;
      thumbsEl.appendChild(thumb);
    }, 'image/jpeg', 0.9);
  });

  doneBtn.addEventListener('click', async () => {
    if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
    showProcessingState('Building your PDF...');
    const loadImg = (blob) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = URL.createObjectURL(blob); });
    const first = await loadImg(captures[0]);
    const pdf = await newImagePdf(first.width, first.height);
    drawImageOnPdfPage(pdf, first, first.width, first.height);
    for (let i = 1; i < captures.length; i++) {
      const img = await loadImg(captures[i]);
      addImagePdfPage(pdf, img.width, img.height);
      drawImageOnPdfPage(pdf, img, img.width, img.height);
    }
    await minWait(600);
    showResultState(pdf.output('blob'), 'scanned.pdf');
  });
}

// ================= COMPARE PDF =================
function simpleLineDiff(linesA, linesB) {
  const m = linesA.length, n = linesB.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = linesA[i] === linesB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const result = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (linesA[i] === linesB[j]) { result.push({ type: 'same', text: linesA[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { result.push({ type: 'removed', text: linesA[i] }); i++; }
    else { result.push({ type: 'added', text: linesB[j] }); j++; }
  }
  while (i < m) { result.push({ type: 'removed', text: linesA[i] }); i++; }
  while (j < n) { result.push({ type: 'added', text: linesB[j] }); j++; }
  return result;
}

function renderCompareTool() {
  let fileA = null, fileB = null;
  modalBody.innerHTML = `
    <div class="config-panel" style="flex-direction:column; align-items:stretch;">
      <label>First PDF <input type="file" id="compareFileA" accept=".pdf" /></label>
      <label>Second PDF <input type="file" id="compareFileB" accept=".pdf" /></label>
      <button class="config-action-btn" id="compareBtn" disabled>Compare</button>
    </div>
    <div id="compareOutput"></div>
  `;
  const btn = document.querySelector('#compareBtn');
  document.querySelector('#compareFileA').addEventListener('change', (e) => { fileA = e.target.files[0]; btn.disabled = !(fileA && fileB); });
  document.querySelector('#compareFileB').addEventListener('change', (e) => { fileB = e.target.files[0]; btn.disabled = !(fileA && fileB); });

  btn.addEventListener('click', async () => {
    showProcessingState('Comparing documents...');
    try {
      const pagesA = await extractPdfTextPages(fileA);
      const pagesB = await extractPdfTextPages(fileB);
      const linesA = pagesA.join('\n').split(/\n+/).filter((l) => l.trim());
      const linesB = pagesB.join('\n').split(/\n+/).filter((l) => l.trim());
      const diff = simpleLineDiff(linesA, linesB);
      const html = diff.map((d) => {
        if (d.type === 'same') return `<p style="margin:2px 0; color:var(--text-muted); font-size:0.88rem;">${d.text}</p>`;
        if (d.type === 'removed') return `<p style="margin:2px 0; background:#FCEBEB; color:var(--red-dark); font-size:0.88rem; text-decoration:line-through;">${d.text}</p>`;
        return `<p style="margin:2px 0; background:#EAF3DE; color:var(--green); font-size:0.88rem;">${d.text}</p>`;
      }).join('');
      await minWait(400);
      modalBody.innerHTML = `
        <div style="max-height:400px; overflow-y:auto; text-align:left; border:1px solid var(--border); border-radius:8px; padding:12px;">${html || '<p>No text differences found.</p>'}</div>
        <button class="reset-btn" id="compareResetBtn" style="margin-top:14px;">Compare different files</button>
      `;
      document.querySelector('#compareResetBtn').addEventListener('click', renderCompareTool);
    } catch (err) { showErrorState(err.message); }
  });
}

// ================= HTML TO PDF =================
function renderHtmlToPdfTool() {
  modalBody.innerHTML = `
    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:8px;">Paste HTML code below. Complex CSS (grid, flexbox, sticky positioning) may not render perfectly.</p>
    <textarea id="h2pInput" rows="8" placeholder="<h1>Hello</h1><p>Some styled content...</p>" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-family:monospace; font-size:0.85rem;"></textarea>
    <div class="config-panel"><button class="config-action-btn" id="cfgGen">Generate PDF</button></div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', async () => {
    const html = document.querySelector('#h2pInput').value.trim();
    if (!html) return;
    showProcessingState('Rendering your HTML...');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed; left:-9999px; top:0; width:800px; background:#fff; padding:20px;';
      container.innerHTML = html;
      document.body.appendChild(container);
      const canvas = await html2canvas(container, { backgroundColor: '#ffffff' });
      document.body.removeChild(container);
      const pdf = await newImagePdf(canvas.width, canvas.height);
      drawImageOnPdfPage(pdf, canvas.toDataURL('image/jpeg', 0.92), canvas.width, canvas.height);
      await minWait(400);
      showResultState(pdf.output('blob'), 'html-export.pdf');
    } catch (err) { showErrorState(err.message); }
  });
}

// ================= HTML TO EXCEL =================
function renderHtmlToExcelTool() {
  modalBody.innerHTML = `
    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:8px;">Paste HTML code containing a table (or any HTML; plain text will be extracted if no table is found).</p>
    <textarea id="h2eInput" rows="8" placeholder="<table><tr><td>Name</td><td>Score</td></tr><tr><td>Alex</td><td>92</td></tr></table>" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-family:monospace; font-size:0.85rem;"></textarea>
    <div class="config-panel"><button class="config-action-btn" id="cfgGen">Generate Excel</button></div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', async () => {
    const html = document.querySelector('#h2eInput').value.trim();
    if (!html) return;
    showProcessingState('Extracting data...');
    try {
      const XLSX = await import('xlsx');
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const tables = doc.querySelectorAll('table');
      const workbook = XLSX.utils.book_new();
      if (tables.length > 0) {
        tables.forEach((table, i) => {
          const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
            Array.from(tr.querySelectorAll('td, th')).map((cell) => cell.textContent.trim())
          );
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), `Table${i + 1}`);
        });
      } else {
        const text = doc.body ? doc.body.textContent.trim() : html;
        const rows = text.split('\n').filter((l) => l.trim()).map((l) => [l.trim()]);
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
      }
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      await minWait(400);
      showResultState(new Blob([wbout], { type: 'application/octet-stream' }), 'html-export.xlsx');
    } catch (err) { showErrorState(err.message); }
  });
}

// ================= BACKGROUND REMOVAL (ORMBG — 100% client-side) =================
// This used to run on the onnxruntime-web build bundled inside
// @huggingface/transformers — and that build turned out to be the real,
// root-level reason background removal never worked on the live site.
// onnxruntime-web stopped shipping a non-threaded WASM binary after v1.18:
// every version since (including the one transformers.js bundles) ships
// ONLY a pthread-based build, and that build's WASM module tries to
// allocate *shared* memory the moment it loads — which requires
// `SharedArrayBuffer`, which browsers only expose on a page sending
// Cross-Origin-Opener-Policy/Cross-Origin-Embedder-Policy headers. This
// site has never sent those, so that allocation threw on every load,
// which is exactly what surfaced as the cryptic "no available backend
// found ... reading 'default'" error — confirmed by reading the actual
// shipped WASM glue code, and then reproduced and fixed in an isolated,
// headless-browser test before this was ever shipped.
//
// The fix: this tool now imports `onnxruntime-web` directly, pinned to
// 1.18.0 — the last release with a genuine non-threaded WASM build — and
// drives the model itself instead of going through transformers.js's
// pipeline() convenience wrapper (which is hard-pinned to the newer,
// threaded-only build internally, with no way to swap just that piece
// out). No COOP/COEP headers, no SharedArrayBuffer, no third-party CDN —
// the WASM runtime is bundled same-origin (see public/onnxruntime/), and
// the only network request left is the one-time model download from
// Hugging Face, over a host already in this site's CSP connect-src. No
// photo is ever sent anywhere; only the model file travels the network.
//
// The model is ORMBG (onnx-community/ormbg-ONNX) — not BiRefNet (its only
// ONNX export is a 224 MB full-precision file with no smaller variant,
// which failed inside onnxruntime-web itself as a raw, untranslated WASM
// exception rather than a clean JS error), and an upgrade from the first
// working version of this tool, which used ISNet (onnx-community/ISNet-ONNX).
// ISNet worked with no crashes, but its edges were visibly noisier/blockier
// than a paid service on real test photos. ORMBG is trained specifically
// on photos with people in them (the common case for this tool — headshots,
// group photos, portraits), shares ISNet's exact architecture and file
// sizes (same ~44 MB quantized / ~176 MB full-precision split, so the same
// size/reliability tradeoffs apply), and is Apache-2.0 licensed. Its
// preprocessing recipe below is copied verbatim from its published
// preprocessor_config.json (not guessed) — resize to 1024x1024, then
// divide raw 0-255 pixel values by 255. Unlike ISNet, this model's config
// has no mean/std centering step at all — do not add one.
//
// The one-time model download is cached in the browser's Cache Storage,
// so it only happens once per browser, not once per photo.
const ORMBG_WASM_PATH = '/onnxruntime/';
const ORMBG_MODEL_CACHE = 'ff-ormbg-model-v1';
const ORMBG_INPUT_SIZE = 1024;
const ORMBG_RESCALE_FACTOR = 1 / 255; // per this model's preprocessor_config.json: do_rescale, no mean/std centering at all
// Tried in order: full precision (~176 MB) first, for the sharpest, least
// noisy mask — quantization measurably softens edge quality on this model.
// 'q8' (quantized, ~44 MB) is the automatic fallback if that ever fails to
// load (a lower-end device, a flaky connection), so a visitor is never left
// without a working result, just a smaller download than usual.
const ORMBG_MODEL_CANDIDATES = [
  { dtype: 'fp32', filename: 'model.onnx' },
  { dtype: 'q8', filename: 'model_quantized.onnx' },
];

async function fetchModelBuffer(url, onProgress) {
  if ('caches' in window) {
    try {
      const cache = await caches.open(ORMBG_MODEL_CACHE);
      const cached = await cache.match(url);
      if (cached) return await cached.arrayBuffer();
    } catch (cacheErr) { /* fall through to a plain network fetch */ }
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Model download failed (HTTP ${resp.status})`);
  const total = Number(resp.headers.get('content-length')) || 0;
  let buffer;
  if (resp.body && total) {
    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress(Math.min(100, Math.round((received / total) * 100)));
    }
    buffer = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  } else {
    buffer = new Uint8Array(await resp.arrayBuffer());
  }
  if ('caches' in window) {
    try {
      const cache = await caches.open(ORMBG_MODEL_CACHE);
      await cache.put(url, new Response(buffer));
    } catch (cacheErr) { /* not fatal — just means it re-downloads next time */ }
  }
  return buffer.buffer;
}

let ormbgSessionPromise = null;
async function getOrmbgSession(onProgress) {
  if (ormbgSessionPromise) return ormbgSessionPromise;
  ormbgSessionPromise = (async () => {
    const ort = await import('onnxruntime-web');
    ort.env.wasm.wasmPaths = ORMBG_WASM_PATH;
    ort.env.wasm.numThreads = 1; // belt-and-suspenders — the non-threaded build never spawns a worker anyway
    let lastErr;
    for (const candidate of ORMBG_MODEL_CANDIDATES) {
      try {
        const url = `https://huggingface.co/onnx-community/ormbg-ONNX/resolve/main/onnx/${candidate.filename}`;
        const buf = await fetchModelBuffer(url, onProgress);
        return await ort.InferenceSession.create(buf, { executionProviders: ['wasm'] });
      } catch (err) {
        console.error(`Remove Background: the ${candidate.dtype} model failed to load —`, err);
        lastErr = err;
      }
    }
    throw lastErr;
  })();
  try {
    return await ormbgSessionPromise;
  } catch (err) {
    ormbgSessionPromise = null; // don't keep a failed attempt cached — let a retry try again
    throw err;
  }
}

// Resizes `img` to ORMBG_INPUT_SIZE x ORMBG_INPUT_SIZE and packs it into a
// channel-first (NCHW) Float32Array — the tensor layout ONNX vision models
// expect. Per this model's published preprocessor_config.json, that's the
// only preprocessing it wants: rescale raw 0-255 pixel values to 0-1. No
// mean/std centering step — do not add one.
function preprocessForOrmbg(img) {
  const size = ORMBG_INPUT_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high'; // a cleaner downscale here means less high-frequency noise for the model to guess an edge from
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const plane = size * size;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    out[i] = data[i * 4] * ORMBG_RESCALE_FACTOR;
    out[plane + i] = data[i * 4 + 1] * ORMBG_RESCALE_FACTOR;
    out[2 * plane + i] = data[i * 4 + 2] * ORMBG_RESCALE_FACTOR;
  }
  return out;
}

// Bilinear resize of a single-channel Float32Array. Used to bring the
// model's low-resolution mask up to the photo's native resolution in full
// float precision, ahead of the guided filter below — an 8-bit canvas
// roundtrip here would throw away exactly the precision that filter uses.
function bilinearResizeFloat32(src, srcW, srcH, dstW, dstH) {
  const out = new Float32Array(dstW * dstH);
  const xRatio = srcW / dstW, yRatio = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const sy = (y + 0.5) * yRatio - 0.5;
    const y0 = Math.max(0, Math.min(srcH - 1, Math.floor(sy)));
    const y1 = Math.min(srcH - 1, y0 + 1);
    const fy = Math.max(0, Math.min(1, sy - y0));
    for (let x = 0; x < dstW; x++) {
      const sx = (x + 0.5) * xRatio - 0.5;
      const x0 = Math.max(0, Math.min(srcW - 1, Math.floor(sx)));
      const x1 = Math.min(srcW - 1, x0 + 1);
      const fx = Math.max(0, Math.min(1, sx - x0));
      const v00 = src[y0 * srcW + x0], v01 = src[y0 * srcW + x1];
      const v10 = src[y1 * srcW + x0], v11 = src[y1 * srcW + x1];
      const top = v00 + (v01 - v00) * fx;
      const bottom = v10 + (v11 - v10) * fx;
      out[y * dstW + x] = top + (bottom - top) * fy;
    }
  }
  return out;
}

// Box blur via a summed-area table (integral image) — O(w*h) to build,
// then O(1) per output pixel regardless of radius. The building block the
// guided filter below is made of; not useful on its own here.
function boxBlurFloat32(src, w, h, radius) {
  if (radius <= 0) return src.slice();
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    const rowBase = (y + 1) * (w + 1);
    const prevRowBase = y * (w + 1);
    for (let x = 0; x < w; x++) {
      rowSum += src[y * w + x];
      integral[rowBase + x + 1] = integral[prevRowBase + x + 1] + rowSum;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(w - 1, x + radius);
      const sum = integral[(y1 + 1) * (w + 1) + (x1 + 1)]
        - integral[y0 * (w + 1) + (x1 + 1)]
        - integral[(y1 + 1) * (w + 1) + x0]
        + integral[y0 * (w + 1) + x0];
      out[y * w + x] = sum / ((y1 - y0 + 1) * (x1 - x0 + 1));
    }
  }
  return out;
}

// Edge-aware upsampling of a low-resolution alpha mask against a
// high-resolution guide image — the guided filter (He, Sun & Tang, 2010),
// the standard technique for exactly this "small mask, big photo"
// mismatch. Unlike a plain blur or resize, it snaps the mask boundary back
// onto real luminance edges in the guide image, so a jagged low-res
// silhouette becomes a crisp one that actually follows real hair/shoulder
// edges in the source photo, instead of the mask's own coarse grid.
function guidedFilterAlpha(guide, alpha, w, h, radius, eps) {
  const guideSq = new Float32Array(w * h);
  const guideAlpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    guideSq[i] = guide[i] * guide[i];
    guideAlpha[i] = guide[i] * alpha[i];
  }
  const meanI = boxBlurFloat32(guide, w, h, radius);
  const meanP = boxBlurFloat32(alpha, w, h, radius);
  const corrI = boxBlurFloat32(guideSq, w, h, radius);
  const corrIP = boxBlurFloat32(guideAlpha, w, h, radius);

  const n = w * h;
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = corrI[i] - meanI[i] * meanI[i];
    const covIP = corrIP[i] - meanI[i] * meanP[i];
    a[i] = covIP / (varI + eps);
    b[i] = meanP[i] - a[i] * meanI[i];
  }
  const meanA = boxBlurFloat32(a, w, h, radius);
  const meanB = boxBlurFloat32(b, w, h, radius);

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = meanA[i] * guide[i] + meanB[i];
  }
  return out;
}

async function removeBackgroundOrmbg(file, onProgress) {
  const ort = await import('onnxruntime-web');
  const session = await getOrmbgSession(onProgress);
  updateProcessingCaption('Removing background...');

  const img = await loadImageFromBlob(file);
  const inputTensor = new ort.Tensor(
    'float32',
    preprocessForOrmbg(img),
    [1, 3, ORMBG_INPUT_SIZE, ORMBG_INPUT_SIZE],
  );
  const results = await session.run({ [session.inputNames[0]]: inputTensor });
  const output = results[session.outputNames[0]];
  const dims = output.dims;
  const maskW = dims[dims.length - 1], maskH = dims[dims.length - 2];
  const raw = output.data;

  // The exported graph may or may not include a final sigmoid — detect
  // which by checking whether the raw values already look like [0,1]
  // probabilities, and only apply sigmoid ourselves if they don't.
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] < min) min = raw[i];
    if (raw[i] > max) max = raw[i];
  }
  const alreadyProbabilities = min >= -0.001 && max <= 1.001;
  const maskProbabilities = new Float32Array(maskW * maskH);
  for (let i = 0; i < maskW * maskH; i++) {
    maskProbabilities[i] = alreadyProbabilities ? raw[i] : 1 / (1 + Math.exp(-raw[i]));
  }

  const outW = img.naturalWidth, outH = img.naturalHeight;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW; outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  outCtx.drawImage(img, 0, 0, outW, outH);
  const outImageData = outCtx.getImageData(0, 0, outW, outH);

  // The mask only exists at ORMBG_INPUT_SIZE (1024x1024) — a plain resize
  // up to the photo's real resolution just interpolates that low-res
  // mask's own blocky edges, which is what reads as a jagged, unconvincing
  // cutout on anything larger than about 1024px. A guided filter (He et
  // al.) instead uses the full-resolution photo itself as a guide, snapping
  // the mask boundary back onto real edges in the photo — hair strands,
  // the sharp line of a shoulder — that the low-res mask alone can't
  // represent. This runs entirely in Canvas/JS, no extra model or network
  // request.
  const upsampledMask = bilinearResizeFloat32(maskProbabilities, maskW, maskH, outW, outH);
  const guideLuma = new Float32Array(outW * outH);
  for (let i = 0; i < outW * outH; i++) {
    guideLuma[i] = (
      outImageData.data[i * 4] * 0.299 +
      outImageData.data[i * 4 + 1] * 0.587 +
      outImageData.data[i * 4 + 2] * 0.114
    ) / 255;
  }
  // Window radius scales with how far the mask had to be upsampled — a
  // photo close to 1024px needs only a small window, a much larger one
  // needs a proportionally larger window to actually reach real edges.
  const guideRadius = Math.max(2, Math.round((Math.max(outW, outH) / ORMBG_INPUT_SIZE) * 4));
  const refinedMask = guidedFilterAlpha(guideLuma, upsampledMask, outW, outH, guideRadius, 1e-3);

  for (let i = 0; i < outW * outH; i++) {
    outImageData.data[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(refinedMask[i] * 255)));
  }
  outCtx.putImageData(outImageData, 0, 0);

  return new Promise((resolve) => outCanvas.toBlob(resolve, 'image/png'));
}

// ================= AI SUMMARIZER =================
let summarizerPipeline = null;
function renderContentParaphraserTool() {
  modalBody.innerHTML = `
    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:8px;">Paste text to paraphrase. First use downloads a small AI model (one-time, cached after); everything runs in your browser, nothing is sent anywhere.</p>
    <textarea id="aiInput" rows="8" placeholder="Paste an article, essay, or long passage here..." style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;"></textarea>
    <div class="config-panel"><button class="config-action-btn" id="cfgGen">Paraphrase</button></div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', async () => {
    const text = document.querySelector('#aiInput').value.trim();
    if (!text) return;
    showProcessingState('Loading AI model...');
    const captionEl = document.querySelector('#overlayCaption') || { textContent: '' };
    try {
      if (!summarizerPipeline) {
        const { pipeline } = await import('@huggingface/transformers');
        summarizerPipeline = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
          progress_callback: (p) => {
            if (p.status === 'progress' && p.progress != null) {
              updateProcessingCaption(`Downloading AI model... ${Math.round(p.progress)}%`);
            } else {
              updateProcessingCaption('Loading AI model...');
            }
          },
        });
      }
      updateProcessingCaption('Paraphrasing...');
      const result = await summarizerPipeline(text, { max_new_tokens: 120, min_new_tokens: 20 });
      const summary = result[0].summary_text;
      await minWait(300);
      showResultState(new Blob([summary], { type: 'text/plain' }), 'paraphrased-text.txt');
    } catch (err) { showErrorState(err.message); }
  });
}

// ================= MULTI-FILE TOOLS =================


function renderMultiFileTool(initialFiles) {
  let files = [...initialFiles];
  const meta = toolMeta[currentToolKey];
  const showReorder = currentToolKey === 'pdfmerge';
  const actionLabel = currentToolKey === 'pdfmerge' ? 'Merge PDF' : currentToolKey === 'zipfiles' ? 'Create ZIP' : currentToolKey === 'collagemaker' ? 'Create Collage' : currentToolKey === 'imagetoppt' ? 'Create Slides' : 'Continue';
  modalBody.innerHTML = `
    <div class="tp-workspace">
      <div class="tp-preview-pane tp-preview-pane-grid">
        <div class="file-grid" id="multiFileList"></div>
      </div>
      <aside class="tp-sidebar">
        <p class="multi-file-summary" id="multiFileSummary"></p>
        <button type="button" class="multi-add-btn" id="addMoreBtn">+ Add files</button>
        <input type="file" id="multiAddInput" multiple accept="${meta.accept || ''}" style="display:none" />
        ${showReorder ? '<p class="multi-file-hint">Drag cards to reorder. Files combine in this order.</p>' : ''}
        <div id="multiWarning" class="batch-warning" style="display:none;"></div>
        <button class="multi-cta-btn" id="multiApply" disabled>${actionLabel}</button>
      </aside>
    </div>
  `;
  const listEl = document.querySelector('#multiFileList');
  const warnEl = document.querySelector('#multiWarning');
  const goBtn = document.querySelector('#multiApply');
  const summaryEl = document.querySelector('#multiFileSummary');

  // Add more files without ever closing this modal. This used to close the
  // modal and redirect to the homepage's #heroDropZone, but that element
  // only exists on index.html/category pages — on the dedicated per-tool
  // SEO landing pages (e.g. /merge-pdf, which use #tpDropZone instead) the
  // modal just closed with nowhere to land, and any file picked afterward
  // started a brand-new batch instead of appending to this one. A plain
  // hidden file input scoped to this modal works identically everywhere.
  const addInput = document.querySelector('#multiAddInput');
  document.querySelector('#addMoreBtn').addEventListener('click', () => addInput.click());
  addInput.addEventListener('change', () => {
    const picked = Array.from(addInput.files || []);
    addInput.value = '';
    if (!picked.length) return;
    const valid = picked.filter((f) => {
      if (!validateFileType(f, meta.accept)) { showTypeRejection(meta.label, meta.accept); return false; }
      return true;
    });
    if (!valid.length) return;
    files.push(...valid);
    renderList();
    showToast(`Added ${valid.length} file${valid.length === 1 ? '' : 's'}`, '+');
  });

  const fileIconClassFor = (f) => {
    const name = f.name.toLowerCase();
    if (name.endsWith('.pdf')) return 'icon-file';
    if (name.endsWith('.docx') || name.endsWith('.doc')) return 'icon-file-text';
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return 'icon-sheet';
    if (name.endsWith('.pptx') || name.endsWith('.ppt')) return 'icon-presentation';
    return 'icon-folder';
  };

  let dragFromIndex = null;

  function renderList() {
    listEl.innerHTML = files.map((f, i) => `
      <div class="file-card" data-idx="${i}" ${showReorder ? 'draggable="true"' : ''}>
        ${showReorder ? `<span class="file-card-order">${i + 1}</span>` : ''}
        <button type="button" class="file-card-remove" data-rm="${i}" aria-label="Remove ${f.name}">✕</button>
        <div class="file-card-thumb">
          ${f.type.startsWith('image/')
            ? `<img src="${URL.createObjectURL(f)}" alt="" onerror="this.parentElement.classList.add('icon','${fileIconClassFor(f)}')" />`
            : `<span class="file-card-icon"><span class="icon ${fileIconClassFor(f)}" aria-hidden="true"></span></span>`}
        </div>
        <span class="file-card-name" title="${f.name}">${f.name}</span>
        <span class="file-card-size">${formatBytes(f.size)}</span>
        ${showReorder ? `<div class="file-card-reorder-btns">
          <button type="button" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move earlier">↑</button>
          <button type="button" data-down="${i}" ${i === files.length - 1 ? 'disabled' : ''} aria-label="Move later">↓</button>
        </div>` : ''}
      </div>
    `).join('');

    listEl.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
      const [removed] = files.splice(+b.dataset.rm, 1);
      renderList();
      if (removed) showToast(`Removed ${removed.name}`, '✕');
    }));
    listEl.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.up; [files[i - 1], files[i]] = [files[i], files[i - 1]]; renderList(); }));
    listEl.querySelectorAll('[data-down]').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.down; [files[i + 1], files[i]] = [files[i], files[i + 1]]; renderList(); }));

    if (showReorder) {
      const cards = listEl.querySelectorAll('.file-card');
      cards.forEach((card) => {
        card.addEventListener('dragstart', () => {
          dragFromIndex = +card.dataset.idx;
          card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        card.addEventListener('dragover', (e) => {
          e.preventDefault();
          card.classList.add('drag-over');
        });
        card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
        card.addEventListener('drop', (e) => {
          e.preventDefault();
          card.classList.remove('drag-over');
          const dropIndex = +card.dataset.idx;
          if (dragFromIndex === null || dragFromIndex === dropIndex) return;
          const [moved] = files.splice(dragFromIndex, 1);
          files.splice(dropIndex, 0, moved);
          dragFromIndex = null;
          renderList();
        });
      });
    }

    warnEl.style.display = files.length > 22 ? 'block' : 'none';
    if (files.length > 22) warnEl.innerHTML = `<span class="icon icon-alert-triangle" aria-hidden="true"></span> ${files.length} files, large batches may use a lot of memory.`;
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    summaryEl.textContent = `${files.length} file${files.length === 1 ? '' : 's'} · ${formatBytes(totalBytes)} total`;
    goBtn.disabled = currentToolKey === 'pdfmerge' ? files.length < 2 : files.length < 1;
  }
  renderList();

  goBtn.addEventListener('click', async () => {
    showProcessingState('Combining your files...');
    try {
      if (currentToolKey === 'pdf') {
        const loadImg = (f) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = URL.createObjectURL(f); });
        const first = await loadImg(files[0]);
        const pdf = await newImagePdf(first.width, first.height);
        drawImageOnPdfPage(pdf, first, first.width, first.height);
        for (let i = 1; i < files.length; i++) {
          updateProcessingCaption(`Processing file ${i + 1} of ${files.length}...`);
          const img = await loadImg(files[i]);
          addImagePdfPage(pdf, img.width, img.height);
          drawImageOnPdfPage(pdf, img, img.width, img.height);
        }
        showResultState(pdf.output('blob'), 'images-combined.pdf');
      } else if (currentToolKey === 'imagetoppt') {
        const pptxgen = (await import('pptxgenjs')).default;
        const pptx = new pptxgen();
        for (let i = 0; i < files.length; i++) {
          updateProcessingCaption(`Adding slide ${i + 1} of ${files.length}...`);
          const slide = pptx.addSlide();
          slide.addImage({ path: URL.createObjectURL(files[i]), x: 0, y: 0, w: 10, h: 5.63 });
        }
        const blob = await pptx.write('blob');
        showResultState(blob, 'images-slides.pptx');
      } else if (currentToolKey === 'collagemaker') {
        const loadImg = (f) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = URL.createObjectURL(f); });
        const cols = Math.ceil(Math.sqrt(files.length));
        const rows = Math.ceil(files.length / cols);
        const cellSize = 400, gap = 6;
        const canvas = document.createElement('canvas');
        canvas.width = cols * cellSize + (cols + 1) * gap;
        canvas.height = rows * cellSize + (rows + 1) * gap;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < files.length; i++) {
          updateProcessingCaption(`Placing image ${i + 1} of ${files.length}...`);
          const img = await loadImg(files[i]);
          const col = i % cols, row = Math.floor(i / cols);
          const x = gap + col * (cellSize + gap), y = gap + row * (cellSize + gap);
          const scale = Math.max(cellSize / img.width, cellSize / img.height);
          const sw = img.width * scale, sh = img.height * scale;
          ctx.save(); ctx.beginPath(); ctx.rect(x, y, cellSize, cellSize); ctx.clip();
          ctx.drawImage(img, x + (cellSize - sw) / 2, y + (cellSize - sh) / 2, sw, sh);
          ctx.restore();
        }
        canvas.toBlob((blob) => showResultState(blob, 'collage.png'));
      } else if (currentToolKey === 'pdfmerge') {
        const { PDFDocument } = await import('pdf-lib');
        const mergedPdf = await PDFDocument.create();
        for (let i = 0; i < files.length; i++) {
          updateProcessingCaption(`Merging file ${i + 1} of ${files.length}...`);
          const bytes = await files[i].arrayBuffer();
          const src = await PDFDocument.load(bytes);
          const pages = await mergedPdf.copyPages(src, src.getPageIndices());
          pages.forEach((p) => mergedPdf.addPage(p));
        }
        const outBytes = await mergedPdf.save();
        showResultState(new Blob([outBytes], { type: 'application/pdf' }), 'merged.pdf');
      } else if (currentToolKey === 'zipfiles') {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        files.forEach((f) => zip.file(f.name, f));
        const blob = await zip.generateAsync({ type: 'blob' });
        showResultState(blob, 'archive.zip');
      }
    } catch (err) { showErrorState(err.message); }
  });
}

// Cloudflare's static-asset routing (html_handling: auto-trailing-slash,
// the default) auto-serves these extensionless URLs from the matching
// *.html file and 307-redirects the .html form to this one — so these
// ARE each category's true canonical URL, not just a display nicety.
const pageUrlMap = { image: '/image', word: '/word', excel: '/excel', pdf: '/pdf', ppt: '/ppt', text: '/other-tools', utilities: '/other-tools' };

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// A tool's own extension list (".pdf", "image/*", ".docx", …) doubles as
// a searchable "format" — normalized down to bare tokens ("pdf", "image",
// "docx") so typing a file extension surfaces the tools that handle it.
function searchableFormats(accept) {
  if (!accept) return [];
  return accept.split(',')
    .map((s) => s.trim().toLowerCase().replace(/^\./, '').replace(/\/\*$/, '').replace(/\*$/, ''))
    .filter(Boolean);
}

// A short list of common alternate phrasings for tools whose everyday
// name doesn't literally appear in their label/description — kept small
// and focused rather than a full synonym dictionary, so search stays
// predictable instead of over-matching.
const SEARCH_ALIASES = {
  compress: ['shrink', 'reduce size', 'make smaller'],
  pdfcompress: ['shrink pdf', 'reduce pdf size'],
  convertformat: ['jpeg', 'png', 'webp'],
  heictojpg: ['iphone photo'],
  bgremove: ['remove bg', 'transparent background', 'cut out'],
  qrcode: ['qr generator'],
  passwordgen: ['random password'],
  gpacalculator: ['cgpa', 'grade calculator'],
  unitconverter: ['metric converter'],
  caseconverter: ['uppercase', 'lowercase', 'title case'],
  base64: ['base 64'],
};

function buildSearchIndex() {
  return Object.entries(toolMeta)
    .filter(([, meta]) => !meta.comingSoon)
    .map(([key, meta]) => ({
      key,
      ...meta,
      categoryLabel: CATEGORY_LABELS[meta.category] || meta.category,
      formats: searchableFormats(meta.accept),
      aliases: SEARCH_ALIASES[key] || [],
    }));
}

// Ranks one tool against a already-lowercased, trimmed query.
// 0 = exact (the whole title/key/an alias matches the query exactly)
// 1 = prefix (the title, or an alias, starts with the query)
// 2 = partial (the query appears anywhere in title, description,
//     category, format, or an alias)
// -1 = no match at all
function rankSearchMatch(t, q) {
  const label = t.label.toLowerCase();
  const aliases = t.aliases.map((a) => a.toLowerCase());
  // Deliberately not matched against t.key here: an internal tool key
  // is unique to exactly one tool and can coincidentally equal a
  // generic search term (the image-to-PDF tool's key is literally
  // "pdf"), which would otherwise register as a false "exact,
  // unambiguous" match and make a broad query like "pdf" silently jump
  // to one tool — the very bug this search was rebuilt to avoid.
  if (label === q || aliases.includes(q)) return 0;
  if (label.startsWith(q) || aliases.some((a) => a.startsWith(q))) return 1;
  const haystack = [label, t.desc.toLowerCase(), t.categoryLabel.toLowerCase(), t.category, ...t.formats, ...aliases].join('   ');
  if (haystack.includes(q)) return 2;
  return -1;
}

// Scores + sorts the whole index against a query, and separately reports
// whether there's a single, unambiguous top-ranked match — the only case
// in which Enter (without an explicit arrow-key selection) should be
// allowed to navigate on its own. A broad query like "pdf" matches many
// tools at the same top tier, so it's deliberately NOT a clear match:
// the visitor gets a results list to choose from instead of a guess.
function searchTools(index, qRaw) {
  const q = qRaw.trim().toLowerCase();
  if (!q) return { matches: [], clearMatch: null };
  const scored = [];
  for (const t of index) {
    const tier = rankSearchMatch(t, q);
    if (tier >= 0) scored.push({ t, tier });
  }
  scored.sort((a, b) => a.tier - b.tier || a.t.label.localeCompare(b.t.label));
  const matches = scored.map((s) => s.t);
  let clearMatch = null;
  if (scored.length) {
    const topTier = scored[0].tier;
    const topMatches = scored.filter((s) => s.tier === topTier);
    if (topMatches.length === 1) clearMatch = topMatches[0].t;
  }
  return { matches, clearMatch };
}

function wireSearch(inputId, resultsId) {
  const input = document.querySelector(`#${inputId}`);
  const resultsEl = document.querySelector(`#${resultsId}`);
  if (!input || !resultsEl) return;
  const index = buildSearchIndex();
  const clearBtn = document.querySelector(`[data-search-clear="${inputId}"]`);
  let debounceTimer;
  let activeIndex = -1;
  let lastClearMatch = null;
  // Fires tool_search_started once per "search session" (the first
  // non-empty keystroke), not once per keystroke — a settled query's
  // result count is tracked separately below, on every debounced render.
  let searchSessionActive = false;

  const setExpanded = (expanded) => input.setAttribute('aria-expanded', String(expanded));
  const updateClearBtn = () => { if (clearBtn) clearBtn.hidden = input.value.length === 0; };

  const closeResults = () => {
    resultsEl.classList.remove('visible');
    setExpanded(false);
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
  };

  const activateItem = (key, cat) => {
    trackToolOpened(key, 'search');
    closeResults();
    input.value = '';
    updateClearBtn();
    if (window.location.pathname.endsWith(pageUrlMap[cat])) {
      openToolModal(key);
    } else {
      window.location.href = toolUrl(key) || `${pageUrlMap[cat]}?tool=${key}`;
    }
  };

  const setActive = (i) => {
    const items = resultsEl.querySelectorAll('.search-result-item');
    items.forEach((el) => { el.classList.remove('active'); el.setAttribute('aria-selected', 'false'); });
    if (i < 0 || i >= items.length) { activeIndex = -1; input.removeAttribute('aria-activedescendant'); return; }
    activeIndex = i;
    items[i].classList.add('active');
    items[i].setAttribute('aria-selected', 'true');
    items[i].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', items[i].id);
  };

  const renderResults = () => {
    const rawValue = input.value;
    const { matches, clearMatch } = searchTools(index, rawValue);
    lastClearMatch = clearMatch;
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');

    if (!rawValue.trim()) {
      closeResults();
      resultsEl.innerHTML = '';
      searchSessionActive = false;
      return;
    }

    if (!searchSessionActive) {
      searchSessionActive = true;
      trackSearchStarted(rawValue, inputId);
    }

    if (!matches.length) {
      trackSearchNoResults(rawValue, inputId);
      resultsEl.innerHTML = `
        <div class="search-no-results">
          <p class="search-no-results-title">No tools found for "${escapeHtml(rawValue.trim())}"</p>
          <p class="search-no-results-hint">Try a different word, or browse tools by category.</p>
        </div>`;
    } else {
      trackSearchResultsShown(rawValue, matches.length, inputId);
      resultsEl.innerHTML = matches.slice(0, 8).map((t, i) => `
        <div class="search-result-item" id="${resultsId}-opt-${i}" role="option" aria-selected="false" data-key="${t.key}" data-cat="${t.category}">
          <img src="${TOOL_ICON_OVERRIDES[t.key] || CATEGORY_ICONS[t.category] || ''}" alt="" width="20" height="24" />
          <span>${escapeHtml(t.label)}</span>
          <span class="search-result-cat">${escapeHtml(t.categoryLabel)}</span>
        </div>
      `).join('');
      resultsEl.querySelectorAll('.search-result-item').forEach((item) => {
        item.addEventListener('click', () => activateItem(item.dataset.key, item.dataset.cat));
      });
    }
    resultsEl.classList.add('visible');
    setExpanded(true);
  };

  input.addEventListener('input', () => {
    updateClearBtn();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderResults, 180);
  });

  // Arrow-key navigation through the results, Enter to open a match,
  // Escape to dismiss the panel (without clearing what was typed).
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (resultsEl.classList.contains('visible')) { e.preventDefault(); closeResults(); }
      return;
    }
    const items = resultsEl.querySelectorAll('.search-result-item');
    if (!items.length || !resultsEl.classList.contains('visible')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1 >= items.length ? 0 : activeIndex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex <= 0 ? items.length - 1 : activeIndex - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) {
        // An explicit arrow-key selection always wins, however many
        // results are showing.
        const target = items[activeIndex];
        if (target) activateItem(target.dataset.key, target.dataset.cat);
      } else if (lastClearMatch) {
        // No explicit selection, but exactly one tool clearly matches
        // best (e.g. "merge pdf") — safe to open it directly.
        activateItem(lastClearMatch.key, lastClearMatch.category);
      }
      // Otherwise the query is ambiguous (e.g. "pdf" matches dozens of
      // tools): do nothing rather than guess. The results list stays
      // open and the query stays put, so the visitor can arrow down or
      // click the tool they actually meant.
    }
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !resultsEl.contains(e.target) && !(clearBtn && clearBtn.contains(e.target))) {
      closeResults();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      updateClearBtn();
      resultsEl.innerHTML = '';
      closeResults();
      searchSessionActive = false;
      input.focus();
    });
  }

  // Blue search button next to the input: focus the field, and if a
  // result set is already showing, open an explicit arrow-key selection
  // or an unambiguous top match — same rule Enter follows above.
  const searchBtn = document.querySelector(`[data-search-btn="${inputId}"]`);
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const items = resultsEl.querySelectorAll('.search-result-item');
      if (items.length && resultsEl.classList.contains('visible')) {
        if (activeIndex >= 0) {
          const target = items[activeIndex];
          if (target) { activateItem(target.dataset.key, target.dataset.cat); return; }
        } else if (lastClearMatch) {
          activateItem(lastClearMatch.key, lastClearMatch.category);
          return;
        }
      }
      input.focus();
    });
  }
}

// Ctrl/Cmd+K focuses the prominent homepage search box; on any other
// page (no #homeSearchInput present) it opens the mobile menu instead
// and focuses the search box there, so the shortcut works everywhere.
function wireSearchShortcut() {
  document.addEventListener('keydown', (e) => {
    if (!(e.key === 'k' && (e.metaKey || e.ctrlKey))) return;
    const homeInput = document.querySelector('#homeSearchInput');
    if (homeInput) {
      e.preventDefault();
      homeInput.focus();
      return;
    }
    const menuBackdrop = document.querySelector('#mobileMenuBackdrop');
    const mobileInput = document.querySelector('#mobileSearchInput');
    if (menuBackdrop && mobileInput) {
      e.preventDefault();
      menuBackdrop.classList.remove('hidden');
      mobileInput.focus();
    }
  });
}

function wireHamburger() {
  const btn = document.querySelector('#hamburgerBtn');
  const menuBackdrop = document.querySelector('#mobileMenuBackdrop');
  const menuClose = document.querySelector('#mobileMenuClose');
  const menuPanel = document.querySelector('#mobileMenuPanel');
  if (!btn || !menuBackdrop) return;

  // Same trap/return-focus pattern as the tool modal (see the keydown
  // handler right after openToolModal/closeToolModal above) — the
  // mobile drawer is just as much a dialog as the tool modal is, so a
  // keyboard user tabbing through it should never land on something
  // behind it, and closing it should hand focus straight back to the
  // hamburger button that opened it.
  let menuTriggerEl = null;

  const openMenu = () => {
    menuTriggerEl = document.activeElement;
    menuBackdrop.classList.remove('hidden');
    document.body.classList.add('modal-open');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Close menu');
    (menuClose || menuPanel)?.focus();
  };
  const closeMenu = () => {
    menuBackdrop.classList.add('hidden');
    document.body.classList.remove('modal-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Open menu');
    (menuTriggerEl || btn).focus();
  };

  btn.addEventListener('click', openMenu);
  menuClose.addEventListener('click', closeMenu);
  menuBackdrop.addEventListener('click', (e) => { if (e.target === menuBackdrop) closeMenu(); });
  // Choosing a destination closes the drawer instead of leaving it open
  // behind the page that just navigated (or, for an in-page anchor like
  // #faq, behind the section it jumped to).
  menuPanel?.querySelectorAll('.mobile-nav-links a').forEach((link) => {
    link.addEventListener('click', () => closeMenu());
  });
  // Obvious, standard close behavior: Esc closes the drawer from anywhere,
  // matching every other dismissible panel/modal on the site. Tab/Shift+Tab
  // are trapped inside the panel while it's open so focus never silently
  // lands on the (still-present, just visually hidden behind the
  // backdrop) page content underneath.
  document.addEventListener('keydown', (e) => {
    if (menuBackdrop.classList.contains('hidden')) return;
    if (e.key === 'Escape') { closeMenu(); return; }
    if (e.key === 'Tab' && menuPanel) {
      const focusables = menuPanel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  });
}

// ================= THEME (LIGHT / DARK) =================
// The actual pre-paint theme decision (saved choice, else OS
// preference) already ran synchronously in partials/_header.html,
// before any of this module even loads — this only wires the visible
// toggle button(s) so a visitor can override that choice, and keeps
// every toggle button on the page (desktop nav + mobile menu) in sync
// with each other and with the OS, for the rest of the session.
const THEME_STORAGE_KEY = 'otw-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
    const isDark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(isDark));
    btn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
  });
}

function wireThemeToggle() {
  const buttons = document.querySelectorAll('.theme-toggle-btn');
  if (!buttons.length) return;

  // Reflect whatever the pre-paint inline script already decided (it
  // only sets the attribute, not aria-pressed/aria-label on buttons
  // that didn't exist yet at that point).
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  applyTheme(current);

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch {
        // Privacy mode / storage disabled — the choice just won't
        // persist across visits; still applies for this one.
      }
    });
  });

  // A visitor who never manually chose a theme should keep following
  // their OS setting live (e.g. their system switches to dark at
  // sunset) — but the moment they click a toggle, that manual choice
  // wins from then on and this listener stops overriding it.
  let userOverrode = false;
  try { userOverrode = localStorage.getItem(THEME_STORAGE_KEY) !== null; } catch { /* ignore */ }
  if (!userOverrode && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      let stillFollowingOs = true;
      try { stillFollowingOs = localStorage.getItem(THEME_STORAGE_KEY) === null; } catch { /* ignore */ }
      if (stillFollowingOs) applyTheme(e.matches ? 'dark' : 'light');
    });
  }
}

// ================= CATEGORY-SPECIFIC HEADER NAV =================
const CATEGORY_NAV_CONFIG = {
  image: {
    top3: ['resize', 'compress', 'crop'],
    groups: [
      { label: 'Convert', tools: ['pdf', 'imagetoexcel', 'imagetoppt', 'convertformat', 'heictojpg'] },
      { label: 'Modify', tools: ['rotateflip', 'grayscale', 'sepia', 'blurimage', 'socialresize', 'colorpalette'] },
      { label: 'Create', tools: ['memecreator', 'collagemaker'] },
      { label: 'Security', tools: ['watermarkimage'] },
      { label: 'AI', tools: ['bgremove'] },
    ],
    allLabel: 'All Image Tools',
    allLink: '/image',
  },
  pdf: {
    top3: ['pdfmerge', 'pdfcompress', 'pdfsplit'],
    groups: [
      { label: 'Convert', tools: ['pdftoword', 'pdftoexcel', 'pdftojpg', 'pdftoppt', 'pdftomarkdown'] },
      { label: 'Organize', tools: ['pdfrotate', 'pdfpagenumbers', 'pdfextract', 'pdfdelete', 'pdfcrop', 'pdfedit'] },
      { label: 'Security', tools: ['pdfwatermark', 'pdfprotect', 'pdfunlock', 'pdfsign'] },
      { label: 'Create', tools: ['scantopdf'] },
      { label: 'Review', tools: ['pdfcompare'] },
    ],
    allLabel: 'All PDF Tools',
    allLink: '/pdf',
  },
  utilities: {
    top3: ['qrcode', 'passwordgen', 'aisummarizer'],
    groups: [
      { label: 'Convert', tools: ['htmltopdf', 'htmltoexcel'] },
      { label: 'Generate', tools: ['loremipsum', 'randomgen', 'citationgen'] },
      { label: 'Calculate', tools: ['unitconverter', 'gpacalculator'] },
      { label: 'Documents', tools: ['invoicegen', 'resumebuilder'] },
      { label: 'Files', tools: ['zipfiles', 'unzipfiles'] },
      { label: 'Developer', tools: ['jsonformatter', 'base64'] },
      // Text's 4 tools, folded in here now that Text is no longer its own category.
      { label: 'Text', tools: ['texttoppt', 'textopdf', 'wordcounter', 'caseconverter'] },
    ],
    allLabel: 'All Utilities',
    allLink: '/other-tools',
  },
};

const CATEGORY_LABELS = { pdf: 'PDF', image: 'Image', excel: 'Excel', word: 'Word', ppt: 'PowerPoint', utilities: 'Utilities' };

// Full-viewport-width, categorized dropdown: every tool grouped into
// labeled sub-columns (a "Popular" column plus each of that category's
// groups — Convert/Organize/Security/etc. — for a single-category
// dropdown, or one column per top-level category for "All Tools").
// Columns wrap responsively (CSS grid auto-fill in .mega-menu-groups),
// since the panel itself is always the full viewport width rather than
// anchored/sized to its trigger (see .mega-menu-full in style.css).
// Each entry gets the exact same overlap icon badge as its tool-grid
// card (.tool-icon-badge, via renderIconBadge) — no arrow — just
// scaled down (.mega-menu-badge) to sit inline at the label's size.
function toolLinkHtml(key) {
  const meta = toolMeta[key];
  if (!meta) return '';
  const badge = renderIconBadge(meta.category, meta.iconTo, key);
  return `<a href="${toolUrl(key) || `?tool=${key}`}" data-nav-tool="${key}"><span class="tool-icon-badge mega-menu-badge">${badge}</span>${meta.label}</a>`;
}

// The "Convert" group each category's CATEGORY_NAV_CONFIG already
// curates (pdftoword, pdftojpg, etc.) only ever covers tools going
// OUT of that category — nothing in the static config captures the
// reverse direction (img/excel/word → pdf, say), since those tools
// live under their OWN category (image/excel/word) in categoryTools.
// This computes that reverse column on the fly: any real file-to-file
// converter (excludes noFile generators like Invoice/Resume/HTML-to-
// PDF, which don't "convert from" anything) whose iconTo is this
// category but whose own category isn't.
function convertFromGroup(category) {
  const tools = Object.keys(toolMeta).filter((k) => {
    const m = toolMeta[k];
    return m && !m.comingSoon && !m.noFile && m.accept && m.category !== category && m.iconTo === category;
  });
  return { label: 'Convert From', tools };
}

// A group either lists its tools directly ({label, tools}) or, when
// several small categories share one column (Excel/Word/PowerPoint —
// see allToolsGroups below), carries {label, subGroups: [{label,
// tools}, ...]} instead: each sub-group keeps its own smaller label
// and its own vertical block, so Excel/Word/PowerPoint still read as
// three distinct categories even while sharing a column.
function groupedMegaMenuHtml(groups) {
  const colsHtml = groups
    .filter((g) => (g.tools && g.tools.length) || (g.subGroups && g.subGroups.some((sg) => sg.tools.length)))
    .map((g) => {
      const body = g.subGroups
        ? g.subGroups
            .filter((sg) => sg.tools.length)
            .map((sg) => `
              <div class="mega-menu-subgroup">
                <p class="mega-menu-subgroup-label">${sg.label}</p>
                <div class="mega-menu-col-links">${sg.tools.map(toolLinkHtml).join('')}</div>
              </div>
            `)
            .join('')
        : `<div class="mega-menu-col-links">${g.tools.map(toolLinkHtml).join('')}</div>`;
      return `
        <div class="mega-menu-col">
          <p class="mega-menu-col-label">${g.label}</p>
          ${body}
        </div>
      `;
    })
    .join('');
  return `<div class="dropdown mega-menu-full"><div class="mega-menu-groups">${colsHtml}</div></div>`;
}

// One identical nav bar everywhere — home page and every tool/category
// page alike, so there's no page-dependent nav shape to keep in sync.
// PDF, Image and Utilities each keep their own dropdown of just that
// category's tools; "All Tools" is every tool on the site, in every
// category, combined into one dropdown; "Categories" jumps straight to
// any category's landing page (including Excel/Word/PowerPoint, which
// no longer get their own top-level nav item).
function renderMainNav() {
  const navEl = document.querySelector('.main-nav');
  if (!navEl) return;

  const categoryItem = (label, category) => {
    const config = CATEGORY_NAV_CONFIG[category];
    let groups = [{ label: 'Popular', tools: config.top3 }, ...config.groups];
    // PDF and Image both have a real two-way conversion story (things
    // convert INTO them from other formats, and OUT of them to other
    // formats) worth splitting into two columns instead of one; the
    // other categories' "Convert" group stays as a single column.
    if (category === 'pdf' || category === 'image') {
      groups = groups.map((g) => (g.label === 'Convert' ? { ...g, label: 'Convert To' } : g));
      const convertToIdx = groups.findIndex((g) => g.label === 'Convert To');
      const fromGroup = convertFromGroup(category);
      if (convertToIdx !== -1 && fromGroup.tools.length) groups.splice(convertToIdx, 0, fromGroup);
    }
    return `
    <div class="nav-item">
      <a href="${pageUrlMap[category] || `/${category}`}" class="nav-link nav-trigger-link">${label}</a>
      ${groupedMegaMenuHtml(groups)}
    </div>
  `;
  };

  // Grouped by top-level category, PDF/Image/Utilities each on their
  // own — but Excel, Word and PowerPoint each have only a couple of
  // tools, so they share a single combined column instead of three
  // near-empty ones. They still each get their own labeled sub-block
  // with space between them (see .mega-menu-subgroup in style.css),
  // so sharing a column doesn't blur them into one undifferentiated list.
  const activeTools = (list) => list.filter((k) => toolMeta[k] && !toolMeta[k].comingSoon);
  const allToolsGroups = [
    { label: CATEGORY_LABELS.pdf, tools: activeTools(categoryTools.pdf) },
    { label: CATEGORY_LABELS.image, tools: activeTools(categoryTools.image) },
    {
      label: 'Excel · Word · PPT',
      subGroups: [
        { label: 'Excel', tools: activeTools(categoryTools.excel) },
        { label: 'Word', tools: activeTools(categoryTools.word) },
        { label: 'PowerPoint', tools: activeTools(categoryTools.ppt) },
      ],
    },
    { label: CATEGORY_LABELS.utilities, tools: activeTools(categoryTools.utilities) },
  ];
  const allToolsItem = `
    <div class="nav-item">
      <a href="/" class="nav-link nav-trigger-link">All Tools</a>
      ${groupedMegaMenuHtml(allToolsGroups)}
    </div>
  `;

  const categoriesLinksHtml = Object.keys(categoryTools)
    .map((cat) => `<a href="${pageUrlMap[cat] || `/${cat}`}">${CATEGORY_LABELS[cat] || cat}</a>`)
    .join('');
  const categoriesItem = `
    <div class="nav-item">
      <button class="nav-trigger">Categories</button>
      <div class="dropdown">${categoriesLinksHtml}</div>
    </div>
  `;

  navEl.innerHTML = `
    ${allToolsItem}
    ${categoryItem('PDF', 'pdf')}
    ${categoryItem('Image', 'image')}
    ${categoryItem('Utilities', 'utilities')}
    ${categoriesItem}
    <a href="/about" class="nav-link">About Us</a>
  `;
  // Nav/mega-menu links point straight at each tool's dedicated,
  // indexable URL (toolUrl(k)) and navigate normally — no click
  // interception needed here.
}

// Hover-intent for the nav dropdowns/mega-menus: wait a beat before
// opening so brushing past the nav on the way somewhere else doesn't
// pop a dropdown open. Closes a little faster than it opens.
const NAV_DROPDOWN_OPEN_DELAY = 220;
const NAV_DROPDOWN_CLOSE_DELAY = 120;

function wireNavDropdowns() {
  const items = document.querySelectorAll('.main-nav .nav-item');
  items.forEach((item) => {
    let openTimer = null;
    let closeTimer = null;
    const panel = item.querySelector('.dropdown');

    const openNow = () => {
      item.classList.add('nav-item-open');
      // Left-aligned (left:0 against the trigger) by default, then
      // nudged by an explicit pixel offset once we can measure the
      // panel's real (variable, content-driven) width against the
      // viewport — a plain left/right flip isn't enough for the wide
      // flat grids (up to ~5 columns), since flipping a wide panel to
      // its trigger's right edge can just push it off the LEFT edge
      // instead, especially for a trigger near the start of the nav.
      // Clamping the actual edges keeps it fully on-screen either way.
      // Full-viewport panels (.mega-menu-full) are position:fixed and
      // already span edge-to-edge regardless of their trigger's
      // position, so this per-trigger horizontal nudge doesn't apply —
      // only the small anchored panels (Categories) need it.
      if (panel && !panel.classList.contains('mega-menu-full')) {
        panel.style.left = '';
        const margin = 12;
        const overflowRight = panel.getBoundingClientRect().right - (window.innerWidth - margin);
        if (overflowRight > 0) panel.style.left = `${-overflowRight}px`;
        const leftEdge = panel.getBoundingClientRect().left;
        if (leftEdge < margin) {
          const current = parseFloat(panel.style.left || '0');
          panel.style.left = `${current + (margin - leftEdge)}px`;
        }
      }
    };

    item.addEventListener('mouseenter', () => {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      if (openTimer || item.classList.contains('nav-item-open')) return;
      openTimer = setTimeout(() => { openNow(); openTimer = null; }, NAV_DROPDOWN_OPEN_DELAY);
    });

    item.addEventListener('mouseleave', () => {
      if (openTimer) { clearTimeout(openTimer); openTimer = null; }
      closeTimer = setTimeout(() => {
        item.classList.remove('nav-item-open');
        closeTimer = null;
      }, NAV_DROPDOWN_CLOSE_DELAY);
    });

    // Keyboard users: the CSS already opens the panel on :focus-within
    // (tabbing into it), this just runs the same overflow check so a
    // keyboard-opened panel doesn't hang off the screen either.
    item.addEventListener('focusin', openNow);
  });
}

// ================= HEADER HEIGHT VAR =================
// The full-viewport-width mega-menu (.mega-menu-full) is position:fixed
// so it can span edge-to-edge regardless of which trigger opened it —
// that takes it out of .site-header's own box, so it needs the header's
// real, measured height (logo + tagline stack, actions row, padding —
// all of which can shift with font-loading or a future edit) to know
// where to sit, rather than a guessed CSS constant.
function wireHeaderHeightVar() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const setVar = () => {
    document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
  };
  setVar();
  window.addEventListener('resize', setVar);
}

// ================= SMART NAV HIDE/SHOW =================
// Hides the sticky header on scroll-down past a small threshold (out
// of the way while reading), and brings it back the instant the
// visitor scrolls up even slightly — no threshold on the way back, per
// spec, since "I want my nav back" should never feel like it needs a
// deliberate gesture. Always visible near the top of the page
// regardless of direction, so the very first scroll never hides it.
const NAV_HIDE_DOWN_THRESHOLD = 10;
const NAV_HIDE_MIN_SCROLL = 96;

function wireSmartNav() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  let lastY = window.scrollY;
  let ticking = false;

  function update() {
    ticking = false;
    const y = window.scrollY;
    const delta = y - lastY;
    if (y <= NAV_HIDE_MIN_SCROLL) {
      header.classList.remove('nav-hidden');
    } else if (delta > NAV_HIDE_DOWN_THRESHOLD) {
      header.classList.add('nav-hidden');
      // Nothing should be left floating disconnected from its trigger
      // once that trigger has scrolled out of view under the hidden nav.
      document.querySelectorAll('.main-nav .nav-item-open').forEach((el) => el.classList.remove('nav-item-open'));
    } else if (delta < 0) {
      header.classList.remove('nav-hidden');
    }
    lastY = y;
  }

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
}

// ================= CARD TILT (Part 11) =================
// Desktop mouse only: skipped entirely on touch and for
// prefers-reduced-motion, so there's no "disabled" state to maintain
// elsewhere — it simply never wires up.
const CARD_TILT_MAX_DEG = 1.4;
const CARD_TILT_SELECTOR = '.tool-card:not(.tool-grid-more-tile):not(.coming-soon), .popular-item-visual';

function wirePointerEffects() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let activeCard = null;
  const resetCard = (card) => { card.style.transform = ''; };

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;

    const card = e.target.closest ? e.target.closest(CARD_TILT_SELECTOR) : null;
    if (card !== activeCard) {
      if (activeCard) resetCard(activeCard);
      activeCard = card;
    }
    if (card) {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * CARD_TILT_MAX_DEG * 2;
      const rotateX = (0.5 - py) * CARD_TILT_MAX_DEG * 2;
      card.style.transform =
        `perspective(900px) translateY(-3px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    }
  }, { passive: true });

  // No relatedTarget means the pointer left the window entirely (not
  // just moved between two elements inside it).
  window.addEventListener('mouseout', (e) => {
    if (e.relatedTarget) return;
    if (activeCard) { resetCard(activeCard); activeCard = null; }
  });
}

// ================= HOVER SOUND (Part 12) =================
// Off by default for every visitor; persisted per-visitor once they
// opt in via the header toggle. No AudioContext is created — not even
// a suspended one — until that toggle click, which is itself the user
// gesture browsers require before audio can play at all.
const SOUND_STORAGE_KEY = 'otw-sound';
let soundEnabled = false;
let audioCtx = null;

function getSoundEnabled() {
  try { return localStorage.getItem(SOUND_STORAGE_KEY) === 'on'; } catch (e) { return false; }
}

function ensureAudioCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// A single soft, short (~80ms) sine blip — not a sample, so there's no
// asset to load or CSP/host to allow. Quiet by design (peak gain 0.05).
function playHoverTone() {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(720, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.05, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.09);
}

// Delegated on `document` for the same reason as wireCardTilt above —
// cards come and go under one stable ancestor. `pointerover` (not
// `mouseenter`, which doesn't bubble) plus a relatedTarget check gives
// the "don't repeat-trigger while the cursor stays inside one card"
// behavior for free: it only fires again once the pointer has actually
// left that card's DOM subtree.
function wireHoverSound() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.addEventListener('pointerover', (e) => {
    if (!soundEnabled) return;
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const card = e.target.closest ? e.target.closest(CARD_TILT_SELECTOR) : null;
    if (!card) return;
    const from = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest(CARD_TILT_SELECTOR) : null;
    if (card === from) return;
    playHoverTone();
  });
}

// ================= SCROLL REVEAL =================
// One reusable fade+rise, applied by selector rather than by requiring
// every page's markup to opt in with a data attribute — the homepage's
// editorial sections and every generated tool page's .tp-section blocks
// (Related Tools, How It Works, FAQ) already exist as real elements, so
// this just watches for them. Replays every time an element crosses
// into/out of view (no unobserve) rather than firing once per page
// load, and is a no-op under prefers-reduced-motion, where every target
// is marked visible immediately instead of observed.
const SCROLL_REVEAL_SELECTOR = '.editorial-section, .editorial-media, .editorial-copy, .tp-section, .tp-usecases, .tool-card, .popular-item';

function wireScrollReveal() {
  const targets = document.querySelectorAll(SCROLL_REVEAL_SELECTOR);
  if (!targets.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('reveal-visible'));
    return;
  }

  targets.forEach((el) => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle('reveal-visible', entry.isIntersecting);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  targets.forEach((el) => io.observe(el));
}

function wireSoundToggle() {
  const btn = document.querySelector('#soundToggleBtn');
  if (!btn) return;
  soundEnabled = getSoundEnabled();

  const sync = () => {
    btn.classList.toggle('sound-on', soundEnabled);
    btn.setAttribute('aria-pressed', String(soundEnabled));
    btn.setAttribute('aria-label', soundEnabled ? 'Turn off hover sounds' : 'Turn on hover sounds');
  };
  sync();

  btn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem(SOUND_STORAGE_KEY, soundEnabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
    sync();
    // The click is the user gesture — safe to init/resume audio here,
    // and playing one tone back confirms the toggle audibly.
    if (soundEnabled) playHoverTone();
  });
}

// ================= FLOATING SAND-PARTICLE BACKGROUND =================
// Home + category pages only (see initToolPage() below) — fine grains in
// the site's own logo gradient (deep navy through mid blue to bright
// cyan), drifting slowly across three depths of field, that part around
// the cursor and settle back. Approved as a standalone preview before
// being wired in here; see /sand-particles preview history for the
// design rationale. No-ops entirely under prefers-reduced-motion (the
// canvas is already display:none via CSS in that case, so this skips
// the animation loop rather than fighting it).
function initParticleField() {
  const canvas = document.querySelector('.particle-field');
  if (!canvas) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const ctx = canvas.getContext('2d');
  const root = document.documentElement;

  // Two extra "radiant" accent colors (indices 3 and 4, after the three
  // base blues) ride along on every particle roll, but on the light
  // palette they simply alias back to ordinary blues — so they stay
  // invisible until dark mode supplies the real white/red hues. That
  // keeps the "only in dark mode" requirement true by construction
  // instead of needing separate light/dark spawn logic.
  const PALETTES = {
    light: { grains: ['#0A3FBF', '#0B68F3', '#12CDF6', '#0B68F3', '#0A3FBF'], glint: '#EAF6FF' },
    dark: { grains: ['#3E6FFF', '#4FA0FF', '#57E4FF', '#FFFFFF', '#FF5C5C'], glint: '#F3FBFF' },
  };
  function currentTheme() {
    const explicit = root.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // clientWidth/clientHeight (the visual viewport, scrollbar excluded)
  // rather than window.innerWidth/innerHeight (the outer viewport,
  // scrollbar INCLUDED) — the canvas is position:fixed with inset:0, so
  // a size measured from the scrollbar-inclusive metric was up to a
  // scrollbar's width (~15-17px) wider than the visual viewport,
  // pushing this always-present, full-page canvas past the right edge
  // and forcing a horizontal scrollbar on every load.
  let vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    vw = document.documentElement.clientWidth; vh = document.documentElement.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = vw * dpr; canvas.height = vh * dpr;
    // CSS (inset: 0 on .particle-field) drives the display size — an
    // explicit pixel width here is exactly what caused the overflow.
    canvas.style.width = '100%'; canvas.style.height = '100%';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const LAYERS = [
    { count: 46, sizeMin: 1.1, sizeMax: 2.2, speed: 0.06, blur: 1.6, alphaMin: 0.11, alphaMax: 0.2, repel: 0.35 },
    { count: 40, sizeMin: 2.0, sizeMax: 3.6, speed: 0.13, blur: 0.6, alphaMin: 0.16, alphaMax: 0.28, repel: 0.7 },
    { count: 30, sizeMin: 3.2, sizeMax: 5.4, speed: 0.22, blur: 0, alphaMin: 0.22, alphaMax: 0.38, repel: 1.15 },
    // A 4th, livelier layer reserved for the two corner clusters below
    // (never spawned across the full viewport like the ambient three) —
    // a bit bigger and brighter so the corners read as a deliberate
    // decorative accent rather than more of the same ambient drift.
    { count: 17, sizeMin: 2.6, sizeMax: 4.8, speed: 0.15, blur: 0.4, alphaMin: 0.26, alphaMax: 0.44, repel: 0.95 },
  ];
  const CORNER_LAYER_IDX = 3;
  // Reference size baked into every pre-rendered sprite (see the sprite
  // section further down) — declared up here, ahead of spawn()/
  // buildParticles(), since buildParticles() runs immediately below and
  // spawn() needs these to compute each particle's draw size.
  const SPRITE_R = 32;
  const SPRITE_PAD = 8;
  const SPRITE_DIM = (SPRITE_R + SPRITE_PAD) * 2;
  let particles = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  // Two roaming "pockets" tucked into the top-left/top-right corners,
  // just clear of the sticky nav — recomputed on every resize since
  // they're sized off the current viewport.
  function cornerZones() {
    const navClearance = 96;
    const cw = Math.min(340, vw * 0.26);
    const ch = Math.min(460, vh * 0.55);
    return {
      left: { x0: 0, y0: navClearance, x1: cw, y1: navClearance + ch },
      right: { x0: vw - cw, y0: navClearance, x1: vw, y1: navClearance + ch },
    };
  }

  function spawn(p, layerIdx, zone) {
    const layer = LAYERS[layerIdx];
    p.layer = layerIdx;
    p.zone = zone || null;
    p.size = rand(layer.sizeMin, layer.sizeMax);
    p.alpha = rand(layer.alphaMin, layer.alphaMax);
    p.driftAngle = rand(0, Math.PI * 2);
    p.driftSpeed = layer.speed * rand(0.6, 1.3);
    p.wobbleAmp = rand(8, 22);
    p.wobbleFreq = rand(0.0004, 0.0011);
    p.wobblePhase = rand(0, Math.PI * 2);
    const zx0 = zone ? zone.x0 : 0, zx1 = zone ? zone.x1 : vw;
    const zy0 = zone ? zone.y0 : 0, zy1 = zone ? zone.y1 : vh;
    p.baseX = rand(zx0, zx1);
    p.baseY = rand(zy0, zy1);
    p.offX = 0; p.offY = 0;
    p.velX = 0; p.velY = 0;
    p.glint = Math.random() < 0.08;
    // Most rolls land on one of the three base blues; a small slice
    // instead spawns as the white/red "radiant" accent (see PALETTES).
    const roll = Math.random();
    p.colorIdx = roll < 0.05 ? 4 : roll < 0.11 ? 3 : (Math.random() * 3) | 0;
    // Precompute the sprite slot (0-4 = grain color, 5 = glint) and the
    // on-screen draw size once — both are fixed for the particle's whole
    // lifetime, so there's no reason to redo this math every frame.
    p.colorSlot = p.glint ? 5 : p.colorIdx;
    p.destSize = (p.size / SPRITE_R) * SPRITE_DIM;
  }
  function buildParticles() {
    particles = [];
    const zones = cornerZones();
    LAYERS.forEach((layer, li) => {
      if (li === CORNER_LAYER_IDX) {
        for (let i = 0; i < layer.count; i++) { const p = {}; spawn(p, li, zones.left); particles.push(p); }
        for (let i = 0; i < layer.count; i++) { const p = {}; spawn(p, li, zones.right); particles.push(p); }
      } else {
        for (let i = 0; i < layer.count; i++) { const p = {}; spawn(p, li, null); particles.push(p); }
      }
    });
  }
  buildParticles();

  let pointerX = -9999, pointerY = -9999, hasPointer = false;
  const REPEL_RADIUS = 150, REPEL_STRENGTH = 2.4;
  window.addEventListener('pointermove', (e) => { pointerX = e.clientX; pointerY = e.clientY; hasPointer = true; }, { passive: true });
  window.addEventListener('pointerleave', () => { hasPointer = false; }, { passive: true });
  window.addEventListener('resize', () => { resize(); buildParticles(); });

  function step(p) {
    const layer = LAYERS[p.layer];
    p.baseX += Math.cos(p.driftAngle) * p.driftSpeed;
    p.baseY += Math.sin(p.driftAngle) * p.driftSpeed * 0.6 - p.driftSpeed * 0.18;
    const m = 40;
    // Ambient (unzoned) particles wrap across the whole viewport, same
    // as before; the two corner clusters wrap within their own pocket
    // instead, so they stay put as a corner accent rather than drifting
    // out across the page.
    const zone = p.zone;
    const zx0 = zone ? zone.x0 : 0, zx1 = zone ? zone.x1 : vw;
    const zy0 = zone ? zone.y0 : 0, zy1 = zone ? zone.y1 : vh;
    if (p.baseX < zx0 - m) p.baseX = zx1 + m;
    if (p.baseX > zx1 + m) p.baseX = zx0 - m;
    if (p.baseY < zy0 - m) p.baseY = zy1 + m;
    if (p.baseY > zy1 + m) p.baseY = zy0 - m;
    const wx = p.baseX, wy = p.baseY;
    if (hasPointer) {
      const dx = wx + p.offX - pointerX, dy = wy + p.offY - pointerY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      if (dist < REPEL_RADIUS) {
        const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH * layer.repel;
        p.velX += (dx / dist) * force; p.velY += (dy / dist) * force;
      }
    }
    p.velX *= 0.9; p.velY *= 0.9;
    p.offX += p.velX; p.offY += p.velY;
    p.offX *= 0.96; p.offY *= 0.96;
    p.x = wx + p.offX; p.y = wy + p.offY;
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
  }
  function lighten(hex) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, r + 70); g = Math.min(255, g + 70); b = Math.min(255, b + 70);
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  // --- Pre-rendered sprites -------------------------------------------
  // The previous version created a fresh radial gradient (3 color stops,
  // parsed from hex every time) AND ran a canvas blur filter for every
  // one of the ~116 particles on every single animation frame — that's
  // what was making the whole page feel sluggish, since the browser had
  // to redo that expensive gradient + blur work ~7,000+ times a second
  // and it was competing with scrolling/clicks for the main thread.
  //
  // Instead, each (layer, color) combination is drawn ONCE onto a small
  // offscreen canvas — blur included — and every frame just stamps that
  // ready-made sprite down with ctx.drawImage(), which is dramatically
  // cheaper. Per-particle alpha still varies via ctx.globalAlpha.
  // (SPRITE_R / SPRITE_PAD / SPRITE_DIM are declared up near LAYERS,
  // since spawn() needs them too.)
  function buildSpriteSet(theme) {
    const palette = PALETTES[theme];
    const colors = [...palette.grains, palette.glint];
    const glintIdx = colors.length - 1;
    const cx = SPRITE_DIM / 2, cy = SPRITE_DIM / 2;
    return LAYERS.map((layer) => colors.map((hex, ci) => {
      const isGlint = ci === glintIdx;
      const off = document.createElement('canvas');
      off.width = SPRITE_DIM; off.height = SPRITE_DIM;
      const octx = off.getContext('2d');
      if (layer.blur) octx.filter = `blur(${layer.blur}px)`;
      const core = isGlint ? hex : lighten(hex);
      const grad = octx.createRadialGradient(cx - SPRITE_R * 0.3, cy - SPRITE_R * 0.3, 0, cx, cy, SPRITE_R);
      grad.addColorStop(0, hexToRgba(core, isGlint ? 1 : 0.85));
      grad.addColorStop(0.55, hexToRgba(hex, 0.6));
      grad.addColorStop(1, hexToRgba(hex, 0));
      octx.fillStyle = grad;
      octx.beginPath();
      octx.arc(cx, cy, SPRITE_R, 0, Math.PI * 2);
      octx.fill();
      return off;
    }));
  }

  let sprites, activeTheme;
  function rebuildTheme() {
    activeTheme = currentTheme();
    sprites = buildSpriteSet(activeTheme);
  }
  rebuildTheme();
  let themeDirty = false;
  // Rebuild sprites only when the theme actually changes, not on every
  // frame — a media-query listener + attribute observer instead of
  // polling currentTheme() 60 times a second.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { themeDirty = true; });
  new MutationObserver(() => { themeDirty = true; }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  let rafId = null;
  function draw() {
    if (themeDirty) { themeDirty = false; rebuildTheme(); }
    // Dark backgrounds swallow the same alpha/size a lot faster than a
    // light one, and the brief was explicit that the effect should read
    // as more prominent in dark mode — so both get a boost there,
    // rather than only relying on the new white/red accent colors.
    const isDark = activeTheme === 'dark';
    const boostAlpha = isDark ? 1.35 : 1;
    const boostSize = isDark ? 1.15 : 1;
    ctx.clearRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      step(p);
      const sprite = sprites[p.layer][p.colorSlot];
      const d = p.destSize * boostSize;
      ctx.globalAlpha = Math.min(1, p.alpha * boostAlpha);
      ctx.drawImage(sprite, p.x - d / 2, p.y - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    rafId = requestAnimationFrame(draw);
  }

  resize();
  rafId = requestAnimationFrame(draw);

  // Pause the loop entirely while the tab is hidden — a background tab
  // has no visible cursor interaction to react to anyway.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = null; }
    else if (!rafId) { rafId = requestAnimationFrame(draw); }
  });
}

// ================= PAGE INIT =================
// The "Related Tools" section on every dedicated tool page, and the
// "Continue to…" grid on the result page, are both plain <a href> links
// (real navigations, not JS-intercepted) — a single delegated listener
// covers both without needing per-render wiring. Resolves the
// destination tool key from data-tool when present (result-page cards,
// via toolCardHtml) or from the href's slug otherwise (statically
// generated Related Tools links, via SLUG_TO_KEY).
function wireRelatedToolTracking() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.tp-related-grid a[href], .tp-result-continue-grid a[href]');
    if (!a) return;
    const toKey = a.dataset.tool || SLUG_TO_KEY[a.getAttribute('href').replace(/^\//, '')] || null;
    if (toKey) trackRelatedToolOpened(currentToolKey, toKey);
  });
}

// Homepage/category-page ad slot — a no-op placeholder while ADS_ENABLED
// is false (see src/config.js). #homeAdSlotContainer only exists on
// index.html, so this quietly does nothing on every other page.
function renderHomepageAdSlot() {
  const container = document.querySelector('#homeAdSlotContainer');
  if (!container) return;
  container.innerHTML = adSlotHtml('adSlotHomepage', 'leaderboard');
  mountAdSlots();
}

export function initToolPage(pageCategory) {
  wireThemeToggle();
  wireHamburger();
  wireSmartNav();
  wireHeaderHeightVar();
  wireSoundToggle();
  wirePointerEffects();
  wireHoverSound();
  initParticleField();
  renderMainNav();
  wireNavDropdowns();
  renderRecentTools();
  wireRecentToolsClear();
  renderHomepageAdSlot();
  wireRelatedToolTracking();
  wireSearch('mobileSearchInput', 'mobileSearchResults');
  // Prominent homepage search (only present on index.html — wireSearch
  // no-ops elsewhere since the elements won't exist).
  wireSearch('homeSearchInput', 'homeSearchResults');
  wireSearchShortcut();
  const grid = document.querySelector('#toolGrid');
  // The one category-switcher component (see .category-bar in
  // style.css) — a single horizontal chip row right below the search
  // bar, above the tool grid, at every viewport width. "Popular Tools"
  // lives here too now (between "All Tools" and "PDF"), backed by
  // getFilterKeys()'s "popular" case rather than a real category.
  const sidebarLinks = document.querySelectorAll('.category-bar-link[data-filter]');

  // The Popular Tools chip has no dedicated page/route of its own, so
  // from any other page it's a real link back to "/?filter=popular".
  // On the homepage itself, treat that the same as clicking the chip:
  // apply the filter and mark it active on load.
  const filterParam = new URLSearchParams(window.location.search).get('filter');
  const initialFilter = (pageCategory === 'all' && filterParam === 'popular') ? 'popular' : pageCategory;

  if (grid) {
    renderToolGrid(grid, getFilterKeys(initialFilter));
  }

  wireScrollReveal();

  // Reflect the page's current category on load regardless of how we
  // got here — a fresh page load on /pdf marks "PDF" active just as
  // much as an in-place filter click on the homepage does.
  sidebarLinks.forEach((link) => {
    const isCurrent = link.dataset.filter === initialFilter;
    link.classList.toggle('active', isCurrent);
    if (isCurrent) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  // Only the homepage / "All Tools" page re-filters its grid in place —
  // every category page's sidebar entries are real navigation links
  // (each category keeps its own indexable URL and unique SEO copy), so
  // clicking "Word" while on /pdf should just go to /word normally.
  if (pageCategory === 'all') {
    sidebarLinks.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const cat = tab.dataset.filter;
        sidebarLinks.forEach((t) => {
          const active = t.dataset.filter === cat;
          t.classList.toggle('active', active);
          if (active) t.setAttribute('aria-current', 'page');
          else t.removeAttribute('aria-current');
        });
        renderToolGrid(grid, getFilterKeys(cat));
        // A sidebar click can originate well down the page (a tall
        // Utilities-style tool grid) — scroll back to the top of the
        // grid so the just-filtered results are actually in view.
        grid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  const params = new URLSearchParams(window.location.search);
  const deepLinkTool = params.get('tool');
  if (deepLinkTool && toolMeta[deepLinkTool]) {
    // Old-style deep link (e.g. /pdf.html?tool=pdfmerge) landed on
    // directly from a bookmark, backlink, or old search result: send
    // the visitor straight to that tool's dedicated, indexable URL
    // (e.g. /merge-pdf) instead of opening the modal in place here.
    // This only fires on the very first load of the page with the
    // param already in the URL — internal clicks that push `?tool=`
    // via history.pushState afterward never re-run initToolPage, so
    // they're unaffected.
    const cleanUrl = toolUrl(deepLinkTool);
    if (cleanUrl) {
      window.location.replace(cleanUrl);
      return;
    }
    openToolModal(deepLinkTool);
  }
}

// ================= DEDICATED TOOL LANDING PAGES =================
// Bootstraps a single-tool SEO landing page (e.g. /resize-image.html,
// generated by scripts/generate-seo-pages.mjs). All the SEO content
// (breadcrumb, H1, intro, related tools, FAQ) is already static HTML
// on these pages — this only wires the shared nav/search chrome
// and mounts the real, already-working tool UI (the same modal every
// other page uses) as high on the page as possible.
function wireToolPageDropZone(toolKey, meta) {
  const dz = document.querySelector('#tpDropZone');
  const input = document.querySelector('#tpFileInput');
  if (!dz || !input) return;

  const openWithFiles = (files) => {
    const valid = files.filter((f) => validateFileType(f, meta.accept));
    if (!valid.length) return;
    if (meta.multiFile) {
      openToolModal(toolKey, dz, valid);
    } else {
      pendingHeroFile = valid[0];
      openToolModal(toolKey, dz);
    }
  };

  dz.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag-active'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-active'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('drag-active');
    if (e.dataTransfer.files.length) openWithFiles(Array.from(e.dataTransfer.files));
  });
  input.addEventListener('change', () => {
    if (input.files.length) openWithFiles(Array.from(input.files));
    input.value = '';
  });
}

export function initToolLandingPage(toolKey) {
  const meta = toolMeta[toolKey];
  if (!meta) return;

  // A direct page load (typed URL, bookmark, Related Tools link, nav
  // menu, search navigating cross-page) — the counterpart to the 'card'
  // and 'search' sources tracked in handleToolCardClick()/activateItem()
  // for in-place opens. A card click that redirects here (no shared
  // upload zone on the page it came from) fires both that source's event
  // and this one — an acceptable, documented double-count for a typed
  // interface with no live backend yet, rather than session-scoped dedup
  // logic that would add real complexity for no present benefit.
  trackToolOpened(toolKey, 'landing_page');

  wireThemeToggle();
  wireHamburger();
  wireSmartNav();
  wireHeaderHeightVar();
  wireSoundToggle();
  wirePointerEffects();
  wireHoverSound();
  wireSearch('mobileSearchInput', 'mobileSearchResults');
  wireSearchShortcut();
  renderMainNav();
  wireNavDropdowns();
  wireScrollReveal();
  wireRelatedToolTracking();

  const needsFile = !meta.noFile && toolKey !== 'pdfcompare';
  if (needsFile) wireToolPageDropZone(toolKey, meta);

  // No-file tools (generators/calculators) and Compare PDF can open
  // immediately — nothing to wait on. File-based tools only auto-open
  // if a valid file is already ready (e.g. carried over via a tool
  // card's fast path); otherwise the on-page drop zone above stays
  // visible and waiting, which is exactly the "clear upload zone above
  // the fold" state a fresh visitor from search should land on.
  const hasReadyFile = pendingHeroFile && validateFileType(pendingHeroFile, meta.accept);
  if (!needsFile || hasReadyFile) {
    openToolModal(toolKey);
  }

  const openBtn = document.querySelector('#tpOpenToolBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      const hasReadyFile = pendingHeroFile && validateFileType(pendingHeroFile, meta.accept);
      if (needsFile && !hasReadyFile) {
        document.querySelector('#tpDropZone')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        openToolModal(toolKey, openBtn);
      }
    });
  }
}