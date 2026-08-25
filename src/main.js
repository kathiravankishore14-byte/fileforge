import imageCompression from 'browser-image-compression';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Tesseract from 'tesseract.js';
import { removeBackground } from '@imgly/background-removal';
import { PDFDocument, degrees, PDFName, PDFRawStream, PDFRef, PDFDict, PDFArray, PDFStream } from 'pdf-lib';
import { TOOL_SLUGS, toolUrl } from './toolSlugs.js';
import './style.css';

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
      h1: 'Remove Image Background — Free & Automatic',
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
  pdfcompress: { label: 'Compress PDF', desc: 'Shrink file size by recompressing images and trimming unused data — text and vectors stay untouched.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdftoword: { label: 'PDF to Word', desc: 'Extract text into an editable Word document.', needsConfig: false, accept: '.pdf', category: 'pdf', iconTo: 'word' },
  pdftoexcel: { label: 'PDF to Excel', desc: 'Pull tabular data into a spreadsheet.', needsConfig: false, accept: '.pdf', category: 'pdf', iconTo: 'excel' },
  pdftojpg: { label: 'PDF to JPG', desc: 'Export every page as an image.', needsConfig: false, accept: '.pdf', category: 'pdf', iconTo: 'image' },
  pdftoppt: { label: 'PDF to PowerPoint', desc: 'Turn each page into a slide.', needsConfig: false, accept: '.pdf', category: 'pdf', iconTo: 'ppt' },
  pdfprotect: { label: 'Protect PDF', desc: 'Add a password to a PDF.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdfcrop: { label: 'Crop PDF', desc: 'Trim the margins of every page.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdfunlock: { label: 'Unlock PDF', desc: 'Remove a password you already know.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
  pdftomarkdown: { label: 'PDF to Markdown', desc: 'Convert pages into basic Markdown text.', needsConfig: false, accept: '.pdf', category: 'pdf', iconTo: 'text' },
  pdfsign: { label: 'Sign PDF', desc: 'Draw a signature and place it on a page.', needsConfig: true, accept: '.pdf', category: 'pdf', iconTo: 'pdf' },
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
  pdf: ['pdfmerge', 'pdfrotate', 'pdfpagenumbers', 'pdfextract', 'pdfdelete', 'pdfwatermark', 'pdftoword', 'pdftoexcel', 'pdftojpg', 'pdftoppt', 'pdfprotect', 'pdfcrop', 'pdfunlock', 'pdftomarkdown', 'pdfsign', 'scantopdf', 'pdfcompare', 'pdfsplit', 'pdfcompress'],
  image: ['resize', 'compress', 'crop', 'pdf', 'imagetoexcel', 'imagetoppt', 'convertformat', 'rotateflip', 'watermarkimage', 'bgremove', 'colorpalette', 'socialresize', 'grayscale', 'sepia', 'blurimage', 'heictojpg', 'memecreator', 'collagemaker'],
  excel: ['exceltopdf', 'exceltocsv'],
  word: ['wordtoexcel', 'wordtopdf', 'wordtotext'],
  ppt: ['ppttotext'],
  utilities: ['qrcode', 'passwordgen', 'jsonformatter', 'base64', 'loremipsum', 'unitconverter', 'gpacalculator', 'citationgen', 'randomgen', 'zipfiles', 'unzipfiles', 'invoicegen', 'resumebuilder', 'htmltopdf', 'htmltoexcel', 'aisummarizer', 'texttoppt', 'textopdf', 'wordcounter', 'caseconverter'],
};

// ================= ICON BADGE RENDERING =================
function renderIconBadge(fromCategory, toCategory, toolKey) {
  // A tool-specific icon (Other Tools) already fully identifies that one
  // tool on its own — pairing it with a destination-format overlay would
  // just bury the custom glyph behind the (now much larger) overlap
  // badge, so it always renders alone, ignoring toCategory.
  const overrideIcon = toolKey && TOOL_ICON_OVERRIDES[toolKey];
  if (overrideIcon) {
    return `<img src="${overrideIcon}" alt="" />`;
  }
  const fromIcon = CATEGORY_ICONS[fromCategory];
  const toIcon = CATEGORY_ICONS[toCategory];
  if (!toCategory || fromCategory === toCategory) {
    return `<img src="${fromIcon}" alt="" />`;
  }
  return `<img src="${fromIcon}" alt="" /><span class="arrow">→</span><img src="${toIcon}" alt="" />`;
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
  if (meta.comingSoon) {
    return `
      <div class="tool-card${catClass} coming-soon${hiddenClass}">
        <div class="tool-icon-badge">${iconHtml}</div>
        <h3>${meta.label}</h3>
      </div>
    `;
  }
  // A real <a href> to the tool's dedicated URL — crawlable and
  // shareable on its own — but the click is still intercepted below so
  // the existing "route to the drop zone if no file is ready yet" flow
  // keeps working exactly as before for real users.
  return `
    <a class="tool-card${catClass}${hiddenClass}" href="${toolUrl(key) || '#'}" data-tool="${key}">
      <div class="tool-icon-badge">${iconHtml}</div>
      <h3>${meta.label}</h3>
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
        <h3>Tools</h3>
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
  clearResultPage(); // starting a new tool from anywhere restores the hero/dropzone if a result page was showing

  // noFile tools and Compare PDF (needs two distinct named slots) still open their own modal directly
  if (meta.noFile || toolKey === 'pdfcompare') {
    openToolModal(toolKey, card);
    return;
  }

  // If a file is already sitting ready (carried from a previous drop), just proceed
  if (!meta.multiFile && pendingHeroFile && validateFileType(pendingHeroFile, meta.accept)) {
    openToolModal(toolKey, card);
    return;
  }

  // Otherwise: point them at the big drop zone — used for both single files and starting a multi-file batch
  awaitingToolKey = toolKey;
  awaitingExistingFiles = meta.multiFile ? [] : null;
  updateHeroDropZoneLabel();
  const dropWrap = document.querySelector('#heroDropZone');
  if (dropWrap) dropWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateHeroDropZoneLabel() {
  // If a specific tool just got requested (e.g. from a tool card) while the
  // drop zone was showing analyzing/preview content from an unrelated
  // earlier drop, snap it back to the plain idle state first so the
  // "drop your file for X" hint has somewhere to render.
  if (awaitingToolKey && !document.querySelector('.hero-drop-text')) {
    resetHeroUploadFlow();
  }
  const textEl = document.querySelector('.hero-drop-text');
  const hintEl = document.querySelector('#awaitingToolHint');
  if (!textEl) return;
  if (awaitingToolKey && toolMeta[awaitingToolKey]) {
    const count = awaitingExistingFiles ? awaitingExistingFiles.length : 0;
    textEl.textContent = count > 0
      ? `Drop another file for ${toolMeta[awaitingToolKey].label} (${count} added so far)`
      : `Drop your file here for ${toolMeta[awaitingToolKey].label}`;
    if (hintEl) hintEl.style.display = 'block';
  } else {
    textEl.textContent = "Drop any file here to get started, we'll find the right tool";
    if (hintEl) hintEl.style.display = 'none';
  }
}

// ================= MODAL CORE =================
let currentFile = null;
let cropperInstance = null;
let currentImg = null;
let currentToolKey = null;
let lastFocusedElement = null;
let pendingHeroFile = null;
let renderGeneration = 0;
let awaitingToolKey = null;
let awaitingExistingFiles = null;

const backdrop = document.querySelector('#modalBackdrop');
const modalTitle = document.querySelector('#modalTitle');
const modalBody = document.querySelector('#modalBody');
const modalClose = document.querySelector('#modalClose');
const modalBox = document.querySelector('.modal-box');

function openToolModal(toolKey, triggerEl, initialMultiFiles) {
  const meta = toolMeta[toolKey];
  if (!meta) return;
  clearResultPage(); // starting a new tool from anywhere restores the hero/dropzone if a result page was showing

  // Decide BEFORE opening anything: if this tool needs a file and none is ready, redirect to the
  // big blue drop zone instead of opening a modal with its own separate upload box.
  const hasReadySingleFile = !meta.multiFile && pendingHeroFile && validateFileType(pendingHeroFile, meta.accept);
  const hasReadyMultiFiles = meta.multiFile && initialMultiFiles && initialMultiFiles.length > 0;
  const needsFile = !meta.noFile && toolKey !== 'pdfcompare';

  if (needsFile && !hasReadySingleFile && !hasReadyMultiFiles) {
    awaitingToolKey = toolKey;
    awaitingExistingFiles = meta.multiFile ? [] : null;
    updateHeroDropZoneLabel();
    const dropWrap = document.querySelector('#heroDropZone');
    if (dropWrap) dropWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

modalClose.addEventListener('click', () => closeToolModal());
backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeToolModal(); });
document.addEventListener('keydown', (e) => {
  if (!backdrop.classList.contains('hidden')) {
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
function showProcessingState(captionText) {
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
    </div>
  `;

  clearResultPage(); // in case one was already showing (shouldn't normally happen, but stay safe)
  const heroEl = document.querySelector('.hero');
  if (heroEl) heroEl.insertAdjacentElement('afterend', page);
  else document.body.appendChild(page);
  document.body.classList.add('tool-result-active');
  page.scrollIntoView({ behavior: 'smooth', block: 'start' });

  renderResultPreview(blob, url);
  page.querySelector('.download-btn').addEventListener('click', () => showToast(`Downloading ${filename}`, '<span class="icon icon-download" aria-hidden="true"></span>'));
  page.querySelector('#resetToolBtn').addEventListener('click', () => {
    currentFile = null;
    clearResultPage();
    handleToolCardClick(currentToolKey, lastFocusedElement);
  });
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

function showErrorState(message) {
  modalBody.innerHTML = `
    <div class="result-box">
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

function newImagePdf(pxWidth, pxHeight) {
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
  if (currentFile.type.startsWith('image/')) {
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
      liveHint.innerHTML = `New size: <strong>${w} × ${h}px</strong>${stretched ? ' <span class="tp-live-warn"><span class="icon icon-alert-triangle" aria-hidden="true"></span> different aspect ratio — image will stretch</span>' : ''}`;
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
    setTimeout(() => {
      if (myGeneration !== renderGeneration) return; // a newer render has since started — skip this stale init
      if (cropperInstance) cropperInstance.destroy();
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
        // Primary: BiRefNet, full precision — the most accurate model that
        // can realistically run in a browser, at the cost of a bigger
        // one-time download than the fallback below.
        cutoutBlob = await removeBackgroundBiRefNet(currentFile, (pct) => {
          updateProcessingProgress(pct, `Downloading AI model... ${pct}%`);
        });
      } catch (birefnetErr) {
        // Fallback: the lighter isnet model. Covers devices that can't
        // handle BiRefNet's memory footprint, or any other failure — this
        // path is the one that was already shipping and working.
        try {
          showProcessingState('Trying a lighter AI model...');
          cutoutBlob = await removeBackground(currentFile, {
            model: 'isnet',
            progress: (key, current, total) => {
              const pct = total ? Math.round((current / total) * 100) : 0;
              const label = key.startsWith('fetch') ? `Downloading AI model... ${pct}%` : `Removing background... ${pct}%`;
              updateProcessingProgress(pct, label);
            },
          });
        } catch (fallbackErr) {
          showErrorState(fallbackErr.message);
          return;
        }
      }
      // Soften the raw AI mask's edge before showing it — segmentation
      // masks tend to be near-binary (fully opaque or fully transparent),
      // which reads as a harsh, slightly jagged cutout line, especially on
      // hair/fur. A very small blur of ONLY the alpha channel smooths that
      // transition without eating into real detail. Never lets a failure
      // here block the tool — worst case, the un-softened cutout is used.
      try {
        cutoutBlob = await featherCutoutEdges(cutoutBlob);
      } catch (featherErr) { /* use the un-softened cutout */ }
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
    document.querySelector('#cfgApply').addEventListener('click', () => {
      const w = currentImg.naturalWidth, h = currentImg.naturalHeight;
      const pdf = newImagePdf(w, h);
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
          : 'This PDF is already about as small as it gets — no embedded JPEGs to recompress and no extra data to trim without changing its content.';
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

function copyBtn(targetSelector) {
  return `<button type="button" class="config-action-btn copy-btn" data-copy-target="${targetSelector}" style="margin-top:8px;">Copy</button>`;
}

function wireCopyButtons() {
  modalBody.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(btn.dataset.copyTarget);
      if (!target) return;
      navigator.clipboard.writeText(target.value || target.textContent).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = original; }, 1200);
      });
    });
  });
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
    <div id="caseOutWrap"></div>
  `;
  function show(val) {
    const wrap = document.querySelector('#caseOutWrap');
    wrap.innerHTML = `<textarea id="caseOutput" rows="6" readonly style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;">${val}</textarea>${copyBtn('#caseOutput')}`;
    wireCopyButtons();
  }
  document.querySelector('#cUpper').addEventListener('click', () => show(document.querySelector('#caseInput').value.toUpperCase()));
  document.querySelector('#cLower').addEventListener('click', () => show(document.querySelector('#caseInput').value.toLowerCase()));
  document.querySelector('#cTitle').addEventListener('click', () => show(document.querySelector('#caseInput').value.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase())));
  document.querySelector('#cSentence').addEventListener('click', () => {
    const text = document.querySelector('#caseInput').value.toLowerCase();
    show(text.replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase()));
  });
}

function renderQrCodeTool() {
  modalBody.innerHTML = `
    <div class="config-panel">
      <input type="text" id="qrInput" placeholder="https://example.com" style="flex:1; min-width:200px;" />
      <button class="config-action-btn" id="cfgGen">Generate</button>
    </div>
    <div id="qrOutput" style="text-align:center; margin-top:14px;"></div>
  `;
  document.querySelector('#cfgGen').addEventListener('click', async () => {
    const val = document.querySelector('#qrInput').value.trim();
    if (!val) return;
    const QRCode = (await import('qrcode')).default;
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, val, { width: 220 });
    const output = document.querySelector('#qrOutput');
    output.innerHTML = '';
    output.appendChild(canvas);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'qrcode.png'; link.textContent = 'Download QR Code'; link.className = 'download-btn';
      output.appendChild(document.createElement('br'));
      output.appendChild(link);
    });
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
    <div id="pwOutWrap"></div>
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
    document.querySelector('#pwOutWrap').innerHTML = `<p id="pwResult" style="font-size:1.2rem; font-family:monospace; margin-top:12px; word-break:break-all;">${pw}</p>${copyBtn('#pwResult')}`;
    wireCopyButtons();
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
      wrap.innerHTML = `<textarea id="jsonOutput" rows="10" readonly style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;">${pretty}</textarea>${copyBtn('#jsonOutput')}`;
      wireCopyButtons();
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
  function show(val) {
    const wrap = document.querySelector('#b64OutWrap');
    wrap.innerHTML = `<textarea id="b64Output" rows="6" readonly style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;">${val}</textarea>${copyBtn('#b64Output')}`;
    wireCopyButtons();
  }
  document.querySelector('#b64Enc').addEventListener('click', () => { try { show(btoa(document.querySelector('#b64Input').value)); } catch { show('Error: cannot encode these characters.'); } });
  document.querySelector('#b64Dec').addEventListener('click', () => { try { show(atob(document.querySelector('#b64Input').value)); } catch { show('Error: invalid Base64 input.'); } });
}

function renderLoremIpsumTool() {
  modalBody.innerHTML = `
    <div class="config-panel">
      <label>Paragraphs <input type="number" id="loremCount" value="3" min="1" max="20" /></label>
      <button class="config-action-btn" id="cfgGen">Generate</button>
    </div>
    <div id="loremOutWrap"></div>
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
    const wrap = document.querySelector('#loremOutWrap');
    wrap.innerHTML = `<textarea id="loremOutput" rows="12" readonly style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; margin-top:10px;">${paragraphs.join('\n\n')}</textarea>${copyBtn('#loremOutput')}`;
    wireCopyButtons();
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
    <div id="citeOutWrap"></div>
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
    document.querySelector('#citeOutWrap').innerHTML = `<p id="citeResult" style="margin-top:10px;">${result}</p>${copyBtn('#citeResult')}`;
    wireCopyButtons();
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
    <p id="randOutput" style="margin-top:10px; font-size:1.1rem;"></p>
  `;
  document.querySelector('#cfgGen').addEventListener('click', () => {
    const type = document.querySelector('#randType').value;
    if (type === 'number') {
      const min = parseInt(document.querySelector('#randMin').value) || 0;
      const max = parseInt(document.querySelector('#randMax').value) || 100;
      document.querySelector('#randOutput').textContent = `Random number: ${Math.floor(Math.random() * (max - min + 1)) + min}`;
    } else {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let str = '';
      for (let i = 0; i < 12; i++) str += chars[Math.floor(Math.random() * chars.length)];
      document.querySelector('#randOutput').textContent = `Random string: ${str}`;
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
    const pdf = newImagePdf(first.width, first.height);
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
      const pdf = newImagePdf(canvas.width, canvas.height);
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

// ================= BACKGROUND REMOVAL (BiRefNet, primary — 100% client-side) =================
// BiRefNet is a newer, more accurate segmentation model than the isnet
// model @imgly/background-removal ships (better edges on hair, fur, and
// cluttered real-world backgrounds) — but it's heavier, and transformer
// -based models are known to occasionally exhaust WASM memory on
// lower-end devices or very large images. Cached after first load, same
// pattern as the summarizer pipeline below. The bgremove click handler
// tries this first and falls back to the older, lighter isnet model (via
// removeBackground()) if this throws for any reason, so a visitor on a
// device that can't handle BiRefNet still gets a working result. No
// server involved anywhere in this chain — everything runs on-device.
let birefnetPipeline = null;
async function removeBackgroundBiRefNet(file, onProgress) {
  const { pipeline } = await import('@huggingface/transformers');
  if (!birefnetPipeline) {
    birefnetPipeline = await pipeline('background-removal', 'onnx-community/BiRefNet_lite-ONNX', {
      dtype: 'fp32', // full precision — noticeably crisper mask edges than fp16, ~2x the one-time download
      progress_callback: (p) => {
        if (p.status === 'progress' && p.progress != null) onProgress(Math.round(p.progress));
      },
    });
  }
  const result = await birefnetPipeline(file);
  return result.toBlob('image/png');
}

// Softens the hard, near-binary edge a segmentation mask leaves around the
// cutout subject — a small blur applied ONLY to the alpha channel (color
// pixels are untouched), so hair/fur/soft edges don't read as a harsh
// jagged line. Deliberately subtle: large enough to anti-alias, small
// enough not to eat into real detail.
async function featherCutoutEdges(blob, radiusPx = 1.1) {
  const img = await loadImageFromBlob(blob);
  const w = img.naturalWidth, h = img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);

  // Copy the alpha channel out into its own grayscale image...
  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = w; alphaCanvas.height = h;
  const actx = alphaCanvas.getContext('2d');
  const alphaData = actx.createImageData(w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const a = imgData.data[i + 3];
    alphaData.data[i] = a; alphaData.data[i + 1] = a; alphaData.data[i + 2] = a; alphaData.data[i + 3] = 255;
  }
  actx.putImageData(alphaData, 0, 0);

  // ...blur that grayscale copy...
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w; blurCanvas.height = h;
  const bctx = blurCanvas.getContext('2d');
  bctx.filter = `blur(${radiusPx}px)`;
  bctx.drawImage(alphaCanvas, 0, 0);
  const blurredAlpha = bctx.getImageData(0, 0, w, h);

  // ...and write the blurred values back as the new alpha channel, leaving
  // every RGB color pixel exactly as the model produced it.
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i + 3] = blurredAlpha.data[i];
  }
  ctx.putImageData(imgData, 0, 0);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// ================= AI SUMMARIZER =================
let summarizerPipeline = null;
function renderContentParaphraserTool() {
  modalBody.innerHTML = `
    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:8px;">Paste text to paraphrase. First use downloads a small AI model (one-time, cached after); everything runs in your browser, nothing is sent anywhere.</p>
    <textarea id="aiInput" rows="8" placeholder="Paste an article, essay, or long passage here..." style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;"></textarea>
    <div class="config-panel"><button class="config-action-btn" id="cfgGen">Paraphrase</button></div>
    <div id="aiOutWrap"></div>
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
      modalBody.innerHTML = `
        <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:6px;">Paraphrased version:</p>
        <p id="aiSummaryResult" style="font-size:1rem; line-height:1.6;">${summary}</p>
        ${copyBtn('#aiSummaryResult')}
        <button class="reset-btn" id="aiResetBtn" style="margin-top:14px; display:block;">Paraphrase something else</button>
      `;
      wireCopyButtons();
      document.querySelector('#aiResetBtn').addEventListener('click', renderContentParaphraserTool);
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
        ${showReorder ? '<p class="multi-file-hint">Drag cards to reorder — files combine in this order.</p>' : ''}
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
        const pdf = newImagePdf(first.width, first.height);
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

function detectCategoryFromFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.heic') || name.endsWith('.heif') || file.type.startsWith('image/')) return 'image';
  if (name.endsWith('.docx')) return 'word';
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return 'excel';
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.pptx')) return 'ppt';
  return null;
}

function wireHeroDropZone() {
  const dz = document.querySelector('#heroDropZone');
  if (!dz) return;
  const input = document.querySelector('#heroFileInput');
  const cancelBtn = document.querySelector('#cancelAwaitingTool');

  // The file input covers the whole box (see CSS) and stays in the DOM the
  // entire time — only #heroDropContent's innerHTML gets swapped between
  // idle/analyzing/preview states, so this listener never needs rewiring.
  dz.addEventListener('click', (e) => {
    if (e.target === input) return;
    // The Browse button is deliberately part of the same click-to-open
    // area (not a separate handler) — it re-renders on every reset, so
    // delegating through the drop zone's own stable listener means it
    // never needs to be individually re-wired.
    if (e.target.closest('#heroBrowseBtn')) { input.click(); return; }
    if (e.target.closest('button, a')) return;
    input.click();
  });
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag-active'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-active'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('drag-active');
    if (e.dataTransfer.files.length) routeHeroFiles(Array.from(e.dataTransfer.files));
  });
  input.addEventListener('change', (e) => {
    if (e.target.files.length) routeHeroFiles(Array.from(e.target.files));
    input.value = '';
  });
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      awaitingToolKey = null;
      updateHeroDropZoneLabel();
    });
  }

  // Below 860px the drop zone and suggestion panel stack instead of
  // sitting side by side, so nothing here naturally keeps them the same
  // height any more (desktop just fixes both to 320px). Re-run the
  // equalizer on resize/orientation-change so the pair stays matched
  // even if the browser is resized while the suggestion panel is open.
  let alignResizeRaf = null;
  window.addEventListener('resize', () => {
    if (alignResizeRaf) return;
    alignResizeRaf = requestAnimationFrame(() => {
      alignResizeRaf = null;
      alignHeroBoxHeights();
    });
  });
}

// Keeps the drop zone and the suggestion "speech bubble" panel the same
// height once both are showing on mobile (see wireHeroDropZone's resize
// listener and the end of renderHeroSuggestions). Desktop already fixes
// both to 320px in CSS, so this only needs to do anything on narrow
// screens where they're stacked and each sizes to its own content.
function alignHeroBoxHeights() {
  const dz = document.querySelector('#heroDropZone');
  const panel = document.querySelector('#heroSuggestPanel');
  if (!dz || !panel || !panel.classList.contains('visible')) return;
  if (window.innerWidth > 860) {
    dz.style.minHeight = '';
    panel.style.minHeight = '';
    return;
  }
  dz.style.minHeight = '';
  panel.style.minHeight = '';
  const target = Math.max(dz.offsetHeight, panel.offsetHeight);
  dz.style.minHeight = `${target}px`;
  panel.style.minHeight = `${target}px`;
}

async function routeHeroFiles(files) {
  if (!files || !files.length) return;

  // If a specific tool is waiting for this drop, go straight there —
  // same as before, just now accepts several files in one go too.
  if (awaitingToolKey && toolMeta[awaitingToolKey]) {
    const meta = toolMeta[awaitingToolKey];
    const toolKey = awaitingToolKey;

    if (meta.multiFile) {
      const valid = files.filter((f) => {
        if (!validateFileType(f, meta.accept)) { showTypeRejection(meta.label, meta.accept); return false; }
        return true;
      });
      if (!valid.length) return;
      awaitingExistingFiles = [...(awaitingExistingFiles || []), ...valid];
      awaitingToolKey = null;
      const filesToOpen = awaitingExistingFiles;
      awaitingExistingFiles = null;
      updateHeroDropZoneLabel();
      openToolModal(toolKey, null, filesToOpen);
      return;
    }

    const file = files[0];
    if (!validateFileType(file, meta.accept)) {
      showTypeRejection(meta.label, meta.accept);
      return;
    }
    awaitingToolKey = null;
    pendingHeroFile = file;
    updateHeroDropZoneLabel();
    openToolModal(toolKey);
    return;
  }

  // Otherwise: no tool picked yet — run the inline analyze → suggest flow.
  analyzeAndSuggestHeroFiles(files);
}

// ================= HERO PREDICT-THE-TOOL FLOW =================
// Files dropped with no specific tool already chosen accumulate here.
// { file, category } — category comes from detectCategoryFromFile.
let heroFiles = [];

const HERO_CATEGORY_ICON_CLASS = { pdf: 'icon-file', word: 'icon-file-text', excel: 'icon-sheet', ppt: 'icon-presentation', image: 'icon-image' };
const heroCategoryIconHtml = (category) => `<span class="icon ${HERO_CATEGORY_ICON_CLASS[category] || 'icon-folder'}" aria-hidden="true"></span>`;

// Default 3 suggested tools per category, tuned separately for a single
// file vs. several files of the same type (e.g. multiple PDFs bumps
// Merge PDF to the top instead of a single-file-oriented tool).
const HERO_SUGGEST_CONFIG = {
  pdf: { single: ['pdfcompress', 'pdftoword', 'pdfrotate'], multi: ['pdfmerge', 'pdfrotate', 'pdfcompress'] },
  image: { single: ['resize', 'compress', 'crop'], multi: ['collagemaker', 'pdf', 'imagetoppt'] },
  word: { single: ['wordtopdf', 'wordtoexcel', 'wordtotext'], multi: ['wordtopdf', 'wordtoexcel', 'wordtotext'] },
  excel: { single: ['exceltopdf', 'exceltocsv'], multi: ['exceltopdf', 'exceltocsv'] },
  ppt: { single: ['ppttotext'], multi: ['ppttotext'] },
};

function analyzeAndSuggestHeroFiles(newFiles) {
  const recognized = [];
  newFiles.forEach((file) => {
    const cat = detectCategoryFromFile(file);
    if (cat) recognized.push({ file, category: cat });
  });
  if (!recognized.length) {
    alert("We couldn't recognize that file type. Try browsing a category above instead.");
    return;
  }
  heroFiles = [...heroFiles, ...recognized];
  showHeroAnalyzing();
  setTimeout(renderHeroSuggestions, 1100);
}

function showHeroAnalyzing() {
  const dz = document.querySelector('#heroDropZone');
  const content = document.querySelector('#heroDropContent');
  if (!dz || !content) return;
  dz.classList.add('compact');
  content.innerHTML = `
    <div class="hero-analyzing">
      <div class="hero-analyzing-icons">
        <span class="hero-analyzing-doc"><span class="icon icon-file" aria-hidden="true"></span></span>
        <span class="hero-analyzing-glass"><span class="icon icon-search" aria-hidden="true"></span></span>
      </div>
      <p class="hero-analyzing-text">Analyzing file type…</p>
      <div class="progress-bar-track"><div class="progress-bar-fill" id="heroProgressFill"></div></div>
    </div>
  `;
  const fill = document.querySelector('#heroProgressFill');
  if (fill) {
    fill.style.transition = 'width 1s ease';
    requestAnimationFrame(() => { fill.style.width = '100%'; });
  }
}

function resetHeroUploadFlow() {
  heroFiles = [];
  const dz = document.querySelector('#heroDropZone');
  const content = document.querySelector('#heroDropContent');
  const panel = document.querySelector('#heroSuggestPanel');
  if (dz) { dz.classList.remove('compact'); dz.style.minHeight = ''; }
  if (panel) { panel.classList.remove('visible'); panel.innerHTML = ''; panel.style.minHeight = ''; }
  if (content) {
    content.innerHTML = `
      <div class="hero-drop-idle" id="heroDropIdle">
        <span class="icon icon-upload hero-drop-icon" aria-hidden="true"></span>
        <p class="hero-drop-text">
          <span class="drop-text-desktop">Drag your file here</span>
          <span class="drop-text-mobile">Choose a file</span>
        </p>
        <button type="button" class="hero-drop-browse-btn" id="heroBrowseBtn">Browse files</button>
        <p class="hero-drop-subtext">PDF · JPG · PNG · WEBP · DOCX · XLSX · PPTX</p>
      </div>
    `;
  }
}

// Removes a single file (by its index in heroFiles) from the hero
// upload flow — used by both the single-file thumb's "✕" and the
// per-row "✕" in the multi-file list. Falls back to a full reset once
// the last file is removed.
function removeHeroFile(index) {
  heroFiles.splice(index, 1);
  if (!heroFiles.length) {
    resetHeroUploadFlow();
  } else {
    renderHeroSuggestions();
  }
}

function renderHeroSuggestions() {
  const dz = document.querySelector('#heroDropZone');
  const content = document.querySelector('#heroDropContent');
  const panel = document.querySelector('#heroSuggestPanel');
  if (!dz || !content || !panel || !heroFiles.length) return;

  dz.classList.add('compact');

  const cats = [...new Set(heroFiles.map((f) => f.category))];
  const countByCat = {};
  heroFiles.forEach((f) => { countByCat[f.category] = (countByCat[f.category] || 0) + 1; });
  const dominant = cats.reduce((a, b) => (countByCat[b] > countByCat[a] ? b : a), cats[0]);
  const isMulti = heroFiles.length > 1;
  const latest = heroFiles[heroFiles.length - 1];

  const badgeHtml = heroFiles.length > 1 ? `<span class="hero-file-badge">${heroFiles.length}</span>` : '';
  const latestIndex = heroFiles.length - 1;
  const removeBtnHtml = `<button type="button" class="hero-file-remove-btn" data-remove-index="${latestIndex}" aria-label="Remove this file" title="Remove this file">✕</button>`;
  const fileListHtml = heroFiles.length > 1 ? `
    <div class="hero-file-list">
      ${heroFiles.map((f, i) => `
        <div class="hero-file-row">
          <span class="hero-file-row-icon">${heroCategoryIconHtml(f.category)}</span>
          <span class="hero-file-row-name">${f.file.name}</span>
          <button type="button" class="hero-file-row-remove" data-remove-index="${i}" aria-label="Remove ${f.file.name}" title="Remove this file">✕</button>
        </div>
      `).join('')}
    </div>
  ` : '';
  content.innerHTML = `
    <div class="hero-preview">
      ${latest.file.type.startsWith('image/')
        ? `<div class="hero-preview-thumb-wrap"><img class="hero-preview-thumb" src="${URL.createObjectURL(latest.file)}" />${badgeHtml}${removeBtnHtml}</div>`
        : `<div class="hero-preview-icon">${heroCategoryIconHtml(latest.category)}${badgeHtml}${removeBtnHtml}</div>`}
      <p class="hero-preview-name">${heroFiles.length > 1 ? `${heroFiles.length} files selected` : latest.file.name}</p>
      ${cats.length > 1 ? `<div class="batch-warning"><span class="icon icon-alert-triangle" aria-hidden="true"></span> These files span more than one category (${cats.map((c) => CATEGORY_LABELS[c] || c).join(', ')}); suggestions below are based on the most common type.</div>` : ''}
      ${fileListHtml}
      <button type="button" class="hero-add-more-btn" id="heroAddMoreFilesBtn">+ Add more files</button>
      <button type="button" class="hero-clear-btn" id="heroClearFilesBtn">Start over</button>
    </div>
  `;
  document.querySelector('#heroAddMoreFilesBtn').addEventListener('click', () => {
    document.querySelector('#heroFileInput').click();
  });
  document.querySelector('#heroClearFilesBtn').addEventListener('click', () => resetHeroUploadFlow());
  content.querySelectorAll('[data-remove-index]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeHeroFile(Number(btn.dataset.removeIndex));
    });
  });

  const config = HERO_SUGGEST_CONFIG[dominant];
  const matchingFiles = heroFiles.filter((f) => f.category === dominant).map((f) => f.file);
  const suggestedKeys = (config ? (isMulti ? config.multi : config.single) : [])
    .filter((k) => toolMeta[k] && !toolMeta[k].comingSoon)
    .slice(0, 3);

  const cardsHtml = suggestedKeys.map((key) => {
    const meta = toolMeta[key];
    return `
      <div class="hero-suggest-card" data-suggest-tool="${key}">
        ${renderIconBadge(meta.category, meta.iconTo, key)}
        <div>
          <div class="hero-suggest-label">${meta.label}</div>
          <div class="hero-suggest-desc">${meta.desc}</div>
        </div>
      </div>
    `;
  }).join('');

  const moreLink = pageUrlMap[dominant] || '#';
  const moreLabel = CATEGORY_LABELS[dominant] || dominant;

  panel.innerHTML = `
    <p class="hero-suggest-title">Which tool would you like to use?</p>
    ${cardsHtml}
    <a class="hero-suggest-card hero-suggest-more" href="${moreLink}">See all ${moreLabel} tools →</a>
  `;
  panel.classList.add('visible');

  panel.querySelectorAll('[data-suggest-tool]').forEach((card) => {
    card.addEventListener('click', () => {
      const key = card.dataset.suggestTool;
      const meta = toolMeta[key];
      if (!meta) return;
      const validForTool = matchingFiles.filter((f) => validateFileType(f, meta.accept));
      if (meta.multiFile) {
        openToolModal(key, card, validForTool.length ? validForTool : matchingFiles);
      } else {
        pendingHeroFile = validForTool[0] || matchingFiles[0];
        openToolModal(key, card);
      }
    });
  });

  updateSuggestTailPosition();
  alignHeroBoxHeights();
}

// ================= SUGGESTION-BUBBLE TAIL TRACKING =================
// The suggestion panel's speech-bubble tail should always point at the
// mascot, who is fixed to the viewport corner. As the page scrolls the
// panel moves but the mascot doesn't, so the tail's position *within*
// the panel has to be recomputed continuously — this keeps it level
// ("in parallel") with the mascot at any scroll depth.
let suggestTailRaf = null;

function updateSuggestTailPosition() {
  const widget = document.querySelector('#ffhWidget');
  const panel = document.querySelector('#heroSuggestPanel');
  if (!widget || !panel || !panel.classList.contains('visible')) return;
  const widgetRect = widget.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  if (!panelRect.height) return;
  // Aim roughly at the mascot's chest/speech-bubble height, not his feet.
  const mascotY = widgetRect.top + widgetRect.height * 0.32;
  let tailTop = mascotY - panelRect.top;
  // Keep the tail on the flat part of the panel's right edge, clear of
  // the 24px rounded corners (plus the triangle's own ~13px half-height)
  // — otherwise it clips into the curve and looks jagged/detached
  // instead of a smooth, properly-seated speech-bubble tail.
  const cornerClearance = 40;
  const clampMin = cornerClearance;
  const clampMax = panelRect.height - cornerClearance;
  tailTop = Math.max(clampMin, Math.min(clampMax, tailTop));
  panel.style.setProperty('--tail-top', `${tailTop}px`);
}

function requestSuggestTailUpdate() {
  if (suggestTailRaf) return;
  suggestTailRaf = requestAnimationFrame(() => {
    suggestTailRaf = null;
    updateSuggestTailPosition();
  });
}

function wireSuggestTailTracking() {
  window.addEventListener('scroll', requestSuggestTailUpdate, { passive: true });
  window.addEventListener('resize', requestSuggestTailUpdate);
}

function storePendingHeroFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        sessionStorage.setItem('pendingHeroFile', JSON.stringify({
          name: file.name, type: file.type, dataUrl: reader.result,
        }));
      } catch {
        // file too large for sessionStorage — degrade gracefully, no carry-over
      }
      resolve();
    };
    reader.onerror = () => resolve();
    reader.readAsDataURL(file);
  });
}

async function loadPendingHeroFile() {
  const raw = sessionStorage.getItem('pendingHeroFile');
  if (!raw) return;
  sessionStorage.removeItem('pendingHeroFile');
  try {
    const { name, type, dataUrl } = JSON.parse(raw);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    pendingHeroFile = new File([blob], name, { type });
  } catch {
    pendingHeroFile = null;
  }
}

// Cloudflare's static-asset routing (html_handling: auto-trailing-slash,
// the default) auto-serves these extensionless URLs from the matching
// *.html file and 307-redirects the .html form to this one — so these
// ARE each category's true canonical URL, not just a display nicety.
const pageUrlMap = { image: '/image', word: '/word', excel: '/excel', pdf: '/pdf', ppt: '/ppt', text: '/other-tools', utilities: '/other-tools' };

function buildSearchIndex() {
  return Object.entries(toolMeta)
    .filter(([, meta]) => !meta.comingSoon)
    .map(([key, meta]) => ({ key, ...meta }));
}

function wireSearch(inputId, resultsId) {
  const input = document.querySelector(`#${inputId}`);
  const resultsEl = document.querySelector(`#${resultsId}`);
  if (!input || !resultsEl) return;
  const index = buildSearchIndex();
  let debounceTimer;
  let activeIndex = -1;

  const activateItem = (key, cat) => {
    resultsEl.classList.remove('visible');
    input.value = '';
    if (window.location.pathname.endsWith(pageUrlMap[cat])) {
      openToolModal(key);
    } else {
      window.location.href = toolUrl(key) || `${pageUrlMap[cat]}?tool=${key}`;
    }
  };

  const setActive = (i) => {
    const items = resultsEl.querySelectorAll('.search-result-item');
    items.forEach((el) => el.classList.remove('active'));
    if (i < 0 || i >= items.length) { activeIndex = -1; input.removeAttribute('aria-activedescendant'); return; }
    activeIndex = i;
    items[i].classList.add('active');
    items[i].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', items[i].id);
  };

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = input.value.trim().toLowerCase();
      activeIndex = -1;
      if (!q) { resultsEl.classList.remove('visible'); resultsEl.innerHTML = ''; return; }

      const matches = index.filter((t) => {
        const categoryLabel = (CATEGORY_LABELS[t.category] || t.category).toLowerCase();
        return t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || categoryLabel.includes(q);
      });
      if (!matches.length) {
        resultsEl.innerHTML = `<div class="search-no-results">No tools match "${input.value}"</div>`;
      } else {
        resultsEl.innerHTML = matches.slice(0, 8).map((t, i) => `
          <div class="search-result-item" id="${resultsId}-opt-${i}" role="option" data-key="${t.key}" data-cat="${t.category}">
            <img src="${TOOL_ICON_OVERRIDES[t.key] || CATEGORY_ICONS[t.category] || ''}" alt="" />
            <span>${t.label}</span>
          </div>
        `).join('');
      }
      resultsEl.classList.add('visible');

      resultsEl.querySelectorAll('.search-result-item').forEach((item) => {
        item.addEventListener('click', () => activateItem(item.dataset.key, item.dataset.cat));
      });
    }, 180);
  });

  // Arrow-key navigation through the results, Enter to open the
  // highlighted (or first) match, Escape to dismiss the panel.
  input.addEventListener('keydown', (e) => {
    const items = resultsEl.querySelectorAll('.search-result-item');
    if (!items.length || !resultsEl.classList.contains('visible')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1 >= items.length ? 0 : activeIndex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex <= 0 ? items.length - 1 : activeIndex - 1); }
    else if (e.key === 'Enter') {
      const target = items[activeIndex >= 0 ? activeIndex : 0];
      if (target) { e.preventDefault(); activateItem(target.dataset.key, target.dataset.cat); }
    } else if (e.key === 'Escape') {
      resultsEl.classList.remove('visible');
      setActive(-1);
    }
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !resultsEl.contains(e.target)) {
      resultsEl.classList.remove('visible');
    }
  });
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
  if (!btn || !menuBackdrop) return;

  const openMenu = () => {
    menuBackdrop.classList.remove('hidden');
    document.body.classList.add('modal-open');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Close menu');
  };
  const closeMenu = () => {
    menuBackdrop.classList.add('hidden');
    document.body.classList.remove('modal-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Open menu');
  };

  btn.addEventListener('click', openMenu);
  menuClose.addEventListener('click', closeMenu);
  menuBackdrop.addEventListener('click', (e) => { if (e.target === menuBackdrop) closeMenu(); });
  // Obvious, standard close behavior: Esc closes the drawer from anywhere,
  // matching every other dismissible panel/modal on the site.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menuBackdrop.classList.contains('hidden')) closeMenu();
  });
}

// ================= HERO MASCOT WIDGET =================
function wireHeroMascot() {
  const widget = document.querySelector('#ffhWidget');
  const eyeL = document.querySelector('#ffhEyeL');
  const eyeR = document.querySelector('#ffhEyeR');
  const pupilL = document.querySelector('#ffhPupilL');
  const pupilR = document.querySelector('#ffhPupilR');
  const headGroup = document.querySelector('#ffhHeadGroup');
  const headCircle = document.querySelector('#ffhHeadCircle');
  const armLGroup = document.querySelector('#ffhArmL');
  const armRGroup = document.querySelector('#ffhArmR');
  const heroWrap = document.querySelector('#ffhHeroWrap');
  const speechBubble = document.querySelector('#ffhSpeechBubble');
  const eyelidL = document.querySelector('#ffhEyelidL');
  const eyelidR = document.querySelector('#ffhEyelidR');
  const hint = document.querySelector('#ffhHint');
  if (!widget || !eyeL || !eyeR || !headGroup || !headCircle) return;

  const maxPupilOffset = 4.5;
  let isWaving = false;

  [pupilL, pupilR].forEach((p) => {
    p.setAttribute('data-base-cx', p.getAttribute('cx'));
    p.setAttribute('data-base-cy', p.getAttribute('cy'));
  });

  function moveEye(eyeEl, pupilEl, mouseX, mouseY) {
    const rect = eyeEl.getBoundingClientRect();
    const eyeCenterX = rect.left + rect.width / 2;
    const eyeCenterY = rect.top + rect.height / 2;
    const dx = mouseX - eyeCenterX;
    const dy = mouseY - eyeCenterY;
    const angle = Math.atan2(dy, dx);
    const distance = Math.min(Math.hypot(dx, dy) / 18, maxPupilOffset);
    const baseCx = parseFloat(pupilEl.getAttribute('data-base-cx'));
    const baseCy = parseFloat(pupilEl.getAttribute('data-base-cy'));
    pupilEl.setAttribute('cx', baseCx + Math.cos(angle) * distance);
    pupilEl.setAttribute('cy', baseCy + Math.sin(angle) * distance);
  }

  function updateFullBodyTracking(mouseX, mouseY) {
    if (isWaving) return;
    const headRect = headCircle.getBoundingClientRect();
    const charCenterX = headRect.left + headRect.width / 2;
    const charCenterY = headRect.top + headRect.height / 2 + 40;
    const dx = mouseX - charCenterX;
    const dy = mouseY - charCenterY;
    const headMaxAngle = 10;
    const headAngle = Math.max(-headMaxAngle, Math.min(headMaxAngle, (dx / 300) * headMaxAngle));
    const headTiltY = Math.max(-6, Math.min(6, (dy / 300) * 6));
    headGroup.style.transform = `rotate(${headAngle.toFixed(2)}deg) translateY(${headTiltY.toFixed(2)}px)`;
  }

  function handlePointerMove(x, y) {
    moveEye(eyeL, pupilL, x, y);
    moveEye(eyeR, pupilR, x, y);
    updateFullBodyTracking(x, y);
  }

  window.addEventListener('mousemove', (e) => handlePointerMove(e.clientX, e.clientY));
  window.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (touch) handlePointerMove(touch.clientX, touch.clientY);
  });

  function blink() {
    if (!isWaving && eyelidL && eyelidR) {
      [eyelidL, eyelidR].forEach((el) => {
        el.style.transition = 'transform 0.09s cubic-bezier(0.4, 0, 1, 1)';
        el.style.transform = 'scaleY(1)';
      });
      setTimeout(() => {
        [eyelidL, eyelidR].forEach((el) => {
          el.style.transition = 'transform 0.14s cubic-bezier(0, 0, 0.2, 1)';
          el.style.transform = 'scaleY(0)';
        });
      }, 90 + Math.random() * 40);
    }
    setTimeout(blink, 2400 + Math.random() * 3200);
  }
  setTimeout(blink, 1800);

  function waveHello() {
    if (isWaving) return;
    isWaving = true;
    // Mouth stays neutral throughout — no smiling, on proximity or here.
    if (speechBubble) speechBubble.classList.add('show');
    if (hint) hint.style.opacity = '0';
    armRGroup.style.transform = 'rotate(-100deg)';
    armRGroup.classList.add('ffh-waving-now');
    setTimeout(() => {
      armRGroup.classList.remove('ffh-waving-now');
      armRGroup.classList.add('ffh-lowering');
      requestAnimationFrame(() => {
        armRGroup.style.transform = 'rotate(-18deg)';
      });
      if (speechBubble) speechBubble.classList.remove('show');
      if (hint) hint.style.opacity = '';
      setTimeout(() => {
        armRGroup.classList.remove('ffh-lowering');
        isWaving = false;
      }, 400);
    }, 1500);
  }
  widget.addEventListener('click', waveHello);
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
      { label: 'Organize', tools: ['pdfrotate', 'pdfpagenumbers', 'pdfextract', 'pdfdelete', 'pdfcrop'] },
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

// Home ("all") page nav: every top-level category gets its own hover
// dropdown listing every tool in that category, same grid/mega-menu
// styling category pages use for their own current category, just
// applied across all six at once since the home page has no single
// "current" category to special-case.
const NAV_CATEGORY_ICON = { pdf: 'icon-pdf', image: 'icon-image', excel: 'icon-excel', word: 'icon-word', ppt: 'icon-ppt', utilities: 'icon-utilities' };
const NAV_CATEGORY_ORDER = ['pdf', 'image', 'excel', 'word', 'ppt', 'utilities'];

function populateHomeCategoryDropdowns() {
  const navEl = document.querySelector('.main-nav');
  if (!navEl) return;

  navEl.innerHTML = NAV_CATEGORY_ORDER.map((category) => {
    const label = CATEGORY_LABELS[category] || category;
    const iconHtml = `<img src="/icons/${NAV_CATEGORY_ICON[category]}.svg" class="nav-icon" width="20" height="24" alt="" />`;
    const config = CATEGORY_NAV_CONFIG[category];

    let dropdownHtml;
    if (config) {
      // Bigger categories: grouped mega-menu grid, same as on that
      // category's own page.
      const popularHtml = `
        <div class="mega-menu-section">
          <p class="mega-menu-label">Popular</p>
          ${config.top3.map((k) => `<a href="${toolUrl(k) || `?tool=${k}`}" data-nav-tool="${k}"><span class="mega-menu-icons">${renderIconBadge(toolMeta[k].category, toolMeta[k].iconTo, k)}</span>${toolMeta[k].label}</a>`).join('')}
        </div>
      `;
      const groupsHtml = config.groups.map((group) => `
        <div class="mega-menu-section">
          <p class="mega-menu-label">${group.label}</p>
          ${group.tools.map((k) => `<a href="${toolUrl(k) || `?tool=${k}`}" data-nav-tool="${k}"><span class="mega-menu-icons">${renderIconBadge(toolMeta[k].category, toolMeta[k].iconTo, k)}</span>${toolMeta[k].label}</a>`).join('')}
        </div>
      `).join('');
      dropdownHtml = `<div class="dropdown mega-menu">${popularHtml}${groupsHtml}</div>`;
    } else {
      // Smaller categories (Excel, Word, PPT): a single flat dropdown
      // listing every tool in the category.
      const keys = (categoryTools[category] || []).filter((k) => !toolMeta[k].comingSoon);
      const linksHtml = keys.map((k) => `<a href="${toolUrl(k) || `?tool=${k}`}" data-nav-tool="${k}"><span class="mega-menu-icons">${renderIconBadge(toolMeta[k].category, toolMeta[k].iconTo, k)}</span>${toolMeta[k].label}</a>`).join('');
      dropdownHtml = `<div class="dropdown">${linksHtml}</div>`;
    }

    return `
      <div class="nav-item">
        <a href="${pageUrlMap[category] || `/${category}`}" class="nav-link nav-trigger-link">${iconHtml} ${label}</a>
        ${dropdownHtml}
      </div>
    `;
  }).join('');
  // Nav/mega-menu links now point straight at each tool's dedicated,
  // indexable URL (toolUrl(k)) and navigate normally — no click
  // interception needed here anymore.
}

function renderCategoryNav(category) {
  const config = CATEGORY_NAV_CONFIG[category];
  const navEl = document.querySelector('.main-nav');
  if (!navEl) return;

  // "Categories" dropdown: lets you jump straight to any other category page
  // from wherever you are, instead of routing back through the home page.
  const categoriesLinksHtml = Object.keys(categoryTools)
    .map((cat) => `<a href="${pageUrlMap[cat] || `/${cat}`}">${CATEGORY_LABELS[cat] || cat}</a>`)
    .join('');
  const categoriesDropdownHtml = `
    <div class="nav-item">
      <button class="nav-trigger">Categories</button>
      <div class="dropdown">${categoriesLinksHtml}</div>
    </div>
  `;

  if (!config) {
    // small categories: single hover dropdown listing every tool in the category
    const keys = (categoryTools[category] || []).filter((k) => !toolMeta[k].comingSoon);
    const label = CATEGORY_LABELS[category] || (category.charAt(0).toUpperCase() + category.slice(1));
    const linksHtml = keys.map((k) => `<a href="${toolUrl(k) || `?tool=${k}`}" data-nav-tool="${k}"><span class="mega-menu-icons">${renderIconBadge(toolMeta[k].category, toolMeta[k].iconTo, k)}</span>${toolMeta[k].label}</a>`).join('');
    navEl.innerHTML = `
      <div class="nav-item">
        <button class="nav-trigger">All ${label} Tools</button>
        <div class="dropdown">${linksHtml}</div>
      </div>
      ${categoriesDropdownHtml}
    `;
  } else {
    // categories with a bigger tool list get a grouped mega-menu, with the
    // top picks pinned in their own "Popular" section at the front — and
    // also surfaced as direct quick links right on the nav bar itself.
    const top3Html = config.top3.map((k) => `
      <a href="${toolUrl(k) || `?tool=${k}`}" class="nav-link" data-nav-tool="${k}">${toolMeta[k].label}</a>
    `).join('');
    const popularHtml = `
      <div class="mega-menu-section">
        <p class="mega-menu-label">Popular</p>
        ${config.top3.map((k) => `<a href="${toolUrl(k) || `?tool=${k}`}" data-nav-tool="${k}"><span class="mega-menu-icons">${renderIconBadge(toolMeta[k].category, toolMeta[k].iconTo, k)}</span>${toolMeta[k].label}</a>`).join('')}
      </div>
    `;
    const groupsHtml = config.groups.map((group) => `
      <div class="mega-menu-section">
        <p class="mega-menu-label">${group.label}</p>
        ${group.tools.map((k) => `<a href="${toolUrl(k) || `?tool=${k}`}" data-nav-tool="${k}"><span class="mega-menu-icons">${renderIconBadge(toolMeta[k].category, toolMeta[k].iconTo, k)}</span>${toolMeta[k].label}</a>`).join('')}
      </div>
    `).join('');
    navEl.innerHTML = `
      ${top3Html}
      <div class="nav-item">
        <button class="nav-trigger">${config.allLabel}</button>
        <div class="dropdown mega-menu">${popularHtml}${groupsHtml}</div>
      </div>
      ${categoriesDropdownHtml}
    `;
  }
  // Nav/mega-menu links point straight at each tool's dedicated,
  // indexable URL (toolUrl(k)) and navigate normally.
}

// ================= FEATURED TOOLS BANNER (replaces search box) =================
const FEATURED_TOOL_KEYS = ['pdfmerge', 'bgremove', 'resize', 'wordtopdf', 'compress', 'qrcode', 'pdfcompress', 'aisummarizer'];
const FEATURED_SLIDE_INTERVAL = 4000;

function wireFeaturedBanner() {
  const banner = document.querySelector('#ffhBanner');
  const track = document.querySelector('#ffhBannerTrack');
  const dotsEl = document.querySelector('#ffhBannerDots');
  if (!banner || !track || !dotsEl) return;

  const keys = FEATURED_TOOL_KEYS.filter((k) => toolMeta[k] && !toolMeta[k].comingSoon);
  if (!keys.length) return;

  track.innerHTML = keys.map((key) => {
    const meta = toolMeta[key];
    const href = toolUrl(key) || `${pageUrlMap[meta.category] || '/'}?tool=${key}`;
    return `
      <a class="ffh-banner-slide" href="${href}">
        ${renderIconBadge(meta.category, meta.iconTo, key)}
        <span class="ffh-banner-text">${meta.label}: <span class="ffh-banner-sub">${meta.desc}</span></span>
      </a>
    `;
  }).join('');

  dotsEl.innerHTML = keys.map((_, i) => `<span class="ffh-banner-dot${i === 0 ? ' active' : ''}"></span>`).join('');
  const dots = dotsEl.querySelectorAll('.ffh-banner-dot');

  let index = 0;
  function goTo(i) {
    index = (i + keys.length) % keys.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, di) => d.classList.toggle('active', di === index));
  }
  let timer = setInterval(() => goTo(index + 1), FEATURED_SLIDE_INTERVAL);
  banner.addEventListener('mouseenter', () => clearInterval(timer));
  banner.addEventListener('mouseleave', () => { timer = setInterval(() => goTo(index + 1), FEATURED_SLIDE_INTERVAL); });
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

    item.addEventListener('mouseenter', () => {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      if (openTimer || item.classList.contains('nav-item-open')) return;
      openTimer = setTimeout(() => {
        item.classList.add('nav-item-open');
        openTimer = null;
      }, NAV_DROPDOWN_OPEN_DELAY);
    });

    item.addEventListener('mouseleave', () => {
      if (openTimer) { clearTimeout(openTimer); openTimer = null; }
      closeTimer = setTimeout(() => {
        item.classList.remove('nav-item-open');
        closeTimer = null;
      }, NAV_DROPDOWN_CLOSE_DELAY);
    });
  });
}

// ================= PAGE INIT =================
export function initToolPage(pageCategory) {
  wireHeroDropZone();
  wireHamburger();
  wireHeroMascot();
  wireFeaturedBanner();
  wireSuggestTailTracking();
  if (pageCategory !== 'all') renderCategoryNav(pageCategory);
  else populateHomeCategoryDropdowns();
  wireNavDropdowns();
  wireSearch('mobileSearchInput', 'mobileSearchResults');
  // Prominent homepage search (only present on index.html — wireSearch
  // no-ops elsewhere since the elements won't exist).
  wireSearch('homeSearchInput', 'homeSearchResults');
  wireSearchShortcut();
  loadPendingHeroFile();
  const grid = document.querySelector('#toolGrid');
  const tabs = document.querySelectorAll('.filter-tab');

  if (grid) {
    const keys = pageCategory === 'all'
      ? Object.keys(toolMeta)
      : categoryTools[pageCategory] || [];
    renderToolGrid(grid, keys);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.filter;
      const keys = cat === 'all' ? Object.keys(toolMeta) : categoryTools[cat] || [];
      renderToolGrid(grid, keys);
    });
  });

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

  wireHamburger();
  wireSearch('mobileSearchInput', 'mobileSearchResults');
  wireSearchShortcut();
  renderCategoryNav(meta.category);
  wireNavDropdowns();

  const needsFile = !meta.noFile && toolKey !== 'pdfcompare';
  if (needsFile) wireToolPageDropZone(toolKey, meta);

  loadPendingHeroFile().then(() => {
    const hasReadyFile = pendingHeroFile && validateFileType(pendingHeroFile, meta.accept);
    // No-file tools (generators/calculators) and Compare PDF can open
    // immediately — nothing to wait on. File-based tools only auto-open
    // if a valid file already carried over from elsewhere on the site;
    // otherwise the on-page drop zone above stays visible and waiting,
    // which is exactly the "clear upload zone above the fold" state a
    // fresh visitor from search should land on.
    if (!needsFile || hasReadyFile) {
      openToolModal(toolKey);
    }
  });

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