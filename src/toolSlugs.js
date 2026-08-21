// ================= CANONICAL TOOL SLUGS =================
// Single source of truth mapping every tool key (as used in toolMeta,
// src/main.js) to its dedicated, indexable URL slug (e.g. "resize" ->
// "resize-image", served at /resize-image). Pure data, no DOM/browser
// dependencies, so it's safe to import from BOTH the live browser
// bundle (src/main.js, for building internal link hrefs) and the
// Node.js build-time page generator (scripts/generate-seo-pages.mjs).
//
// Changing a slug here renames that tool's canonical URL everywhere at
// once — the generator, the nav, tool-grid cards, related-tools links,
// and the sitemap all read from this one map.
export const TOOL_SLUGS = {
  // PDF
  pdfmerge: 'merge-pdf',
  pdfrotate: 'rotate-pdf',
  pdfpagenumbers: 'add-page-numbers-pdf',
  pdfextract: 'extract-pdf-pages',
  pdfdelete: 'delete-pdf-pages',
  pdfwatermark: 'watermark-pdf',
  pdftoword: 'pdf-to-word',
  pdftoexcel: 'pdf-to-excel',
  pdftojpg: 'pdf-to-jpg',
  pdftoppt: 'pdf-to-ppt',
  pdfprotect: 'protect-pdf',
  pdfcrop: 'crop-pdf',
  pdfunlock: 'unlock-pdf',
  pdftomarkdown: 'pdf-to-markdown',
  pdfsign: 'sign-pdf',
  scantopdf: 'scan-to-pdf',
  pdfcompare: 'compare-pdf',
  pdfsplit: 'split-pdf',
  pdfcompress: 'compress-pdf',

  // Image
  resize: 'resize-image',
  compress: 'compress-image',
  crop: 'crop-image',
  pdf: 'image-to-pdf',
  imagetoexcel: 'image-to-excel',
  imagetoppt: 'image-to-ppt',
  convertformat: 'convert-image-format',
  rotateflip: 'rotate-flip-image',
  watermarkimage: 'watermark-image',
  bgremove: 'remove-background',
  colorpalette: 'color-palette-extractor',
  socialresize: 'social-media-image-resize',
  grayscale: 'grayscale-image-converter',
  sepia: 'sepia-vintage-filter',
  blurimage: 'blur-image',
  heictojpg: 'heic-to-jpg',
  memecreator: 'meme-creator',
  collagemaker: 'collage-maker',

  // Excel
  exceltopdf: 'excel-to-pdf',
  exceltocsv: 'excel-to-csv',

  // Word
  wordtoexcel: 'word-to-excel',
  wordtopdf: 'word-to-pdf',
  wordtotext: 'word-to-text',

  // PPT
  ppttotext: 'ppt-to-text',

  // Other Tools (utilities)
  qrcode: 'qr-code-generator',
  passwordgen: 'password-generator',
  jsonformatter: 'json-formatter',
  base64: 'base64-encode-decode',
  loremipsum: 'lorem-ipsum-generator',
  unitconverter: 'unit-converter',
  gpacalculator: 'gpa-calculator',
  citationgen: 'citation-generator',
  randomgen: 'random-generator',
  zipfiles: 'zip-files',
  unzipfiles: 'unzip-archive',
  invoicegen: 'invoice-generator',
  resumebuilder: 'resume-builder',
  htmltopdf: 'html-to-pdf',
  htmltoexcel: 'html-to-excel',
  aisummarizer: 'content-paraphraser',
  texttoppt: 'text-to-ppt',
  textopdf: 'text-to-pdf',
  wordcounter: 'word-counter',
  caseconverter: 'case-converter',
};

// Reverse lookup (slug -> tool key), built once — used by the landing
// page bootstrap script to resolve which tool a given static page is
// for without needing a query string.
export const SLUG_TO_TOOL = Object.fromEntries(
  Object.entries(TOOL_SLUGS).map(([key, slug]) => [slug, key])
);

export function toolUrl(key) {
  const slug = TOOL_SLUGS[key];
  return slug ? `/${slug}` : null;
}
