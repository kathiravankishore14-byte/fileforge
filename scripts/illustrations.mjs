// ================= CARTOON ILLUSTRATION LIBRARY =================
// Shared by generate-seo-pages.mjs to render the "Popular in {category}"
// and "How it works" sections on every generated tool page. A small set
// of reusable "families" (one visual idea + one animated prop) covers
// every tool via toolFamily(), rather than hand-drawing 60+ bespoke
// illustrations — the three original bespoke ones (squeeze/scissors/
// transform, built for the Image category preview) anchor the style;
// everything else follows the same card + face + animated badge recipe.
//
// All shapes use currentColor (set via CSS on the wrapping element from
// --card-accent, the tool's own category color) so no per-tool palette
// work is ever needed here.

const INK = '#1E2733';

function shadow() {
  return `<ellipse cx="80" cy="140" rx="44" ry="7" fill="#0B1220" opacity="0.13" />`;
}

// The recurring "photo card" — a rounded square with a tiny mountain +
// sun scene and a simple smiling mouth, in currentColor. Used as-is by
// most families; compress/crop/transform below build their own variant
// where the standard face wouldn't fit the animation.
function faceCard(cx, cy, size, accent) {
  const r = size / 2;
  return `
    <rect x="${cx - r}" y="${cy - r}" width="${size}" height="${size}" rx="${(size * 0.21).toFixed(1)}" fill="${accent}" />
    <circle cx="${(cx - r * 0.42).toFixed(1)}" cy="${(cy - r * 0.4).toFixed(1)}" r="${(size * 0.09).toFixed(1)}" fill="#fff" opacity="0.85" />
    <path d="M${(cx - r * 0.7).toFixed(1)} ${(cy + r * 0.42).toFixed(1)} L${(cx - r * 0.1).toFixed(1)} ${(cy - r * 0.12).toFixed(1)} L${(cx + r * 0.08).toFixed(1)} ${(cy + r * 0.06).toFixed(1)} L${(cx + r * 0.32).toFixed(1)} ${(cy - r * 0.2).toFixed(1)} L${(cx + r * 0.72).toFixed(1)} ${(cy + r * 0.42).toFixed(1)} Z" fill="#fff" opacity="0.85" />
    <path d="M${(cx - r * 0.26).toFixed(1)} ${(cy + r * 0.62).toFixed(1)} q${(r * 0.26).toFixed(1)} ${(r * 0.2).toFixed(1)} ${(r * 0.52).toFixed(1)} 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round" />
  `;
}

// A small circular badge sitting on the card's corner, holding a white
// glyph — one shared per-family "prop" so every family reuses the same
// composition instead of a bespoke layout each time.
function badge(cx, cy, glyph, animClass) {
  return `
    <g class="${animClass}" transform="translate(${cx} ${cy})">
      <circle cx="0" cy="0" r="14" fill="currentColor" stroke="#fff" stroke-width="2.2" />
      ${glyph}
    </g>`;
}

function familyGeneric(glyph, animClass) {
  return `
    ${shadow()}
    ${faceCard(80, 80, 76, 'currentColor')}
    ${badge(114, 106, glyph, animClass)}
  `;
}

const GLYPHS = {
  merge: `<rect x="-7" y="-5" width="10" height="8" rx="1.5" fill="#fff" opacity="0.65" /><rect x="-3" y="-2" width="10" height="8" rx="1.5" fill="#fff" />`,
  split: `<rect x="-8" y="-3.5" width="6" height="7" rx="1.5" fill="#fff" /><rect x="2" y="-3.5" width="6" height="7" rx="1.5" fill="#fff" /><line x1="-1" y1="0" x2="1" y2="0" stroke="#fff" stroke-width="1.4" />`,
  rotate: `<path d="M-6 -1 a6 6 0 1 1 0.8 4.6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" /><path d="M-6 -1 l-3.4 -1.4 M-6 -1 l1.6 -3.2" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" />`,
  stamp: `<rect x="-7" y="-3" width="14" height="6" rx="2" fill="#fff" transform="rotate(-18)" />`,
  lock: `<rect x="-6" y="-2" width="12" height="9" rx="2" fill="#fff" /><path d="M-3.6 -2 v-2.6 a3.6 3.6 0 0 1 7.2 0 v2.6" stroke="#fff" stroke-width="2" fill="none" />`,
  tag: `<rect x="-7" y="-6" width="14" height="12" rx="2" fill="#fff" /><rect x="-4" y="-3" width="8" height="2" rx="1" fill="currentColor" /><rect x="-4" y="1" width="5" height="2" rx="1" fill="currentColor" />`,
  sign: `<path d="M-7 3 q4 -8 7 -2 q3 6 7 -3" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" />`,
  scan: `<rect x="-8" y="-4" width="16" height="10" rx="2" fill="#fff" /><circle cx="0" cy="1" r="3" fill="currentColor" /><rect x="3" y="-6.5" width="4" height="3" rx="1" fill="#fff" />`,
  compare: `<circle cx="-3" cy="0" r="6" fill="none" stroke="#fff" stroke-width="2" /><circle cx="3" cy="0" r="6" fill="none" stroke="#fff" stroke-width="2" />`,
  edit: `<path d="M-6 6 l9 -9 l3 3 l-9 9 l-4 1 z" fill="#fff" />`,
  filter: `<path d="M0 -7 q6 7 0 13 q-6 -6 0 -13 Z" fill="#fff" />`,
  eraser: `<rect x="-7" y="-4" width="14" height="8" rx="2" fill="#fff" transform="rotate(-15)" />`,
  generate: `<rect x="-6" y="-1.3" width="12" height="2.6" rx="1.3" fill="#fff" /><rect x="-1.3" y="-6" width="2.6" height="12" rx="1.3" fill="#fff" />`,
};

const ANIM = {
  merge: 'civ-bob', split: 'civ-bob', tag: 'civ-bob', filter: 'civ-bob',
  rotate: 'civ-spin-slow',
  stamp: 'civ-wiggle', sign: 'civ-wiggle', edit: 'civ-wiggle', eraser: 'civ-wiggle',
  lock: 'civ-pulse', scan: 'civ-pulse', compare: 'civ-pulse', generate: 'civ-pulse',
};

// ---------- the three bespoke families (Compress / Crop / Convert) ----------
function familySqueeze() {
  return `
    ${shadow()}
    <path d="M40 50 q-7 24 0 48" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.45" />
    <path d="M120 50 q7 24 0 48" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.45" />
    <rect class="civ-compress-card" x="44" y="38" width="72" height="72" rx="16" fill="currentColor" />
    <circle cx="65" cy="58" r="7" fill="#fff" opacity="0.85" />
    <path d="M50 92 L70 68 L82 82 L94 66 L110 92 Z" fill="#fff" opacity="0.85" />
    <path d="M64 100 q4 -5 8 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round" />
    <path d="M88 100 q4 -5 8 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round" />
    <g transform="translate(38 74)"><rect class="civ-compress-hand-left" x="-4" y="-10" width="30" height="20" rx="10" fill="currentColor" stroke="#fff" stroke-width="1.5" stroke-opacity="0.5" /></g>
    <g transform="translate(122 74)"><rect class="civ-compress-hand-right" x="-26" y="-10" width="30" height="20" rx="10" fill="currentColor" stroke="#fff" stroke-width="1.5" stroke-opacity="0.5" /></g>
  `;
}

function familyScissors() {
  return `
    ${shadow()}
    <rect x="38" y="34" width="84" height="84" rx="16" fill="currentColor" />
    <circle cx="60" cy="56" r="7" fill="#fff" opacity="0.85" />
    <path d="M44 100 L68 72 L82 88 L96 68 L116 100 Z" fill="#fff" opacity="0.85" />
    <rect class="civ-crop-marquee" x="54" y="50" width="60" height="54" rx="4" fill="none" stroke="#fff" stroke-width="2.5" />
    <g transform="translate(112 106)">
      <circle cx="0" cy="0" r="7" fill="currentColor" stroke="#fff" stroke-width="2" />
      <circle cx="-2" cy="-2" r="1.3" fill="#fff" />
      <circle cx="2" cy="-2" r="1.3" fill="#fff" />
    </g>
    <g transform="translate(112 106) rotate(18)"><rect class="civ-crop-blade-a" x="0" y="-2.5" width="26" height="5" rx="2.5" fill="currentColor" stroke="#fff" stroke-width="1.2" stroke-opacity="0.6" /></g>
    <g transform="translate(112 106) rotate(-18)"><rect class="civ-crop-blade-b civ-mirror" x="0" y="-2.5" width="26" height="5" rx="2.5" fill="currentColor" stroke="#fff" stroke-width="1.2" stroke-opacity="0.6" /></g>
  `;
}

function familyTransform(toColorVar) {
  return `
    ${shadow()}
    <g class="civ-convert-photo">
      <rect x="20" y="46" width="60" height="60" rx="14" fill="currentColor" />
      <circle cx="38" cy="64" r="6" fill="#fff" opacity="0.85" />
      <path d="M28 96 L46 76 L56 88 L66 74 L78 96 Z" fill="#fff" opacity="0.85" />
      <path d="M32 100 q3 -4 6 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round" />
      <path d="M52 100 q3 -4 6 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round" />
    </g>
    <path d="M84 74 q16 -8 30 0" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-dasharray="1 8" opacity="0.6" />
    <g class="civ-convert-doc">
      <rect x="96" y="40" width="46" height="62" rx="10" fill="${toColorVar}" />
      <rect x="104" y="70" width="30" height="7" rx="3.5" fill="#fff" opacity="0.9" />
      <rect x="104" y="82" width="22" height="7" rx="3.5" fill="#fff" opacity="0.9" />
      <path d="M106 55 q3 -4 6 0" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" />
      <path d="M122 55 q3 -4 6 0" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" />
    </g>
    <g class="civ-convert-sparkle civ-s1" transform="translate(90 40)"><rect x="-7" y="-1.4" width="14" height="2.8" rx="1.4" fill="currentColor" /><rect x="-1.4" y="-7" width="2.8" height="14" rx="1.4" fill="currentColor" /></g>
    <g class="civ-convert-sparkle civ-s2" transform="translate(112 112) scale(0.7)"><rect x="-7" y="-1.4" width="14" height="2.8" rx="1.4" fill="currentColor" /><rect x="-1.4" y="-7" width="2.8" height="14" rx="1.4" fill="currentColor" /></g>
    <g class="civ-convert-sparkle civ-s3" transform="translate(70 30) scale(0.55)"><rect x="-7" y="-1.4" width="14" height="2.8" rx="1.4" fill="currentColor" /><rect x="-1.4" y="-7" width="2.8" height="14" rx="1.4" fill="currentColor" /></g>
  `;
}

// ---------- family dispatch ----------
const EXPLICIT_FAMILY = {
  compress: 'squeeze', pdfcompress: 'squeeze',
  crop: 'scissors', pdfcrop: 'scissors',
  pdfmerge: 'merge', collagemaker: 'merge', zipfiles: 'merge',
  pdfsplit: 'split', pdfextract: 'split', pdfdelete: 'split', unzipfiles: 'split',
  pdfrotate: 'rotate', rotateflip: 'rotate',
  pdfwatermark: 'stamp', watermarkimage: 'stamp', memecreator: 'stamp',
  pdfprotect: 'lock', pdfunlock: 'lock',
  pdfpagenumbers: 'tag',
  pdfsign: 'sign',
  scantopdf: 'scan',
  pdfcompare: 'compare',
  pdfedit: 'edit',
  grayscale: 'filter', sepia: 'filter', colorpalette: 'filter', blurimage: 'filter', socialresize: 'filter', resize: 'filter',
  bgremove: 'eraser',
};

export function toolFamily(key, meta) {
  if (EXPLICIT_FAMILY[key]) return EXPLICIT_FAMILY[key];
  if (meta.iconTo && meta.iconTo !== meta.category) return 'transform';
  if (meta.noFile) return 'generate';
  return 'transform';
}

export function popularIllustrationSvg(key, meta, categoryIcons) {
  const family = toolFamily(key, meta);
  let inner;
  if (family === 'squeeze') inner = familySqueeze();
  else if (family === 'scissors') inner = familyScissors();
  else if (family === 'transform') inner = familyTransform(`var(--category-${meta.iconTo || meta.category})`);
  else inner = familyGeneric(GLYPHS[family] || GLYPHS.generate, ANIM[family] || 'civ-pulse');
  return `<svg class="civ-illustration" viewBox="0 0 160 160" aria-hidden="true">${inner}</svg>`;
}

// ---------- the four universal "How it works" step characters ----------
// Identical on every page (upload / adjust / preview / download reads
// naturally for nearly every tool), so unlike the popular-tool families
// these aren't parameterized — same four SVGs everywhere.
export const STEP_ICONS = [
  {
    label: 'Add your input',
    svg: `<svg class="sic-illustration" viewBox="0 0 64 64" aria-hidden="true">
      <g class="sic-cloud-file">
        <rect x="24" y="5" width="16" height="19" rx="2.5" fill="#fff" opacity="0.95" />
        <path d="M34 5 L40 11 L34 11 Z" fill="currentColor" opacity="0.75" />
        <rect x="27" y="15" width="10" height="2" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="27" y="19" width="7" height="2" rx="1" fill="currentColor" opacity="0.4" />
      </g>
      <circle cx="22" cy="40" r="9" fill="#fff" opacity="0.96" />
      <circle cx="32" cy="34" r="11" fill="#fff" opacity="0.96" />
      <circle cx="42" cy="40" r="9" fill="#fff" opacity="0.96" />
      <rect x="16" y="38" width="32" height="14" rx="7" fill="#fff" opacity="0.96" />
      <g transform="translate(17 44)"><rect class="sic-cloud-arm-left" x="-13" y="-2.5" width="13" height="5" rx="2.5" fill="currentColor" /></g>
      <g transform="translate(47 44)"><rect class="sic-cloud-arm-right" x="0" y="-2.5" width="13" height="5" rx="2.5" fill="currentColor" /></g>
      <circle cx="27" cy="39" r="1.6" fill="#1E2733" />
      <circle cx="37" cy="39" r="1.6" fill="#1E2733" />
      <path d="M26 44 q6 5 12 0" stroke="#1E2733" stroke-width="2" fill="none" stroke-linecap="round" />
    </svg>`,
  },
  {
    label: 'Adjust the settings',
    svg: `<svg class="sic-illustration" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="22" fill="#fff" opacity="0.96" />
      <g stroke="#1E2733" stroke-width="1.6" stroke-linecap="round" opacity="0.5">
        <line x1="32" y1="14" x2="32" y2="18" />
        <line x1="50" y1="34" x2="46" y2="34" />
        <line x1="14" y1="34" x2="18" y2="34" />
        <line x1="45.5" y1="20.5" x2="42.8" y2="23.2" />
        <line x1="18.5" y1="20.5" x2="21.2" y2="23.2" />
      </g>
      <g transform="translate(32 34)">
        <line class="sic-dial-needle" x1="0" y1="0" x2="0" y2="-15" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        <circle cx="0" cy="0" r="3.4" fill="currentColor" />
      </g>
      <circle cx="26" cy="41" r="1.6" fill="#1E2733" />
      <circle cx="38" cy="41" r="1.6" fill="#1E2733" />
      <path d="M26 46 q6 4 12 0" stroke="#1E2733" stroke-width="2" fill="none" stroke-linecap="round" />
    </svg>`,
  },
  {
    label: 'Check the preview',
    svg: `<svg class="sic-illustration" viewBox="0 0 64 64" aria-hidden="true">
      <g transform="translate(46 46) rotate(45)"><rect x="0" y="-4" width="19" height="8" rx="4" fill="#1E2733" opacity="0.8" /></g>
      <circle cx="26" cy="26" r="17" fill="#fff" opacity="0.97" stroke="#1E2733" stroke-width="2.4" />
      <circle cx="21" cy="24" r="1.6" fill="#1E2733" />
      <circle cx="31" cy="24" r="1.6" fill="#1E2733" />
      <path d="M20 31 q6 4 12 0" stroke="#1E2733" stroke-width="2" fill="none" stroke-linecap="round" />
      <g class="sic-glass-check" transform="translate(43 41)">
        <circle cx="0" cy="0" r="9" fill="currentColor" />
        <path d="M-4 0 L-1 3.2 L5 -4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </svg>`,
  },
  {
    label: 'Download the result',
    svg: `<svg class="sic-illustration" viewBox="0 0 64 64" aria-hidden="true">
      <g class="sic-folder-file">
        <rect x="24" y="2" width="16" height="18" rx="2.5" fill="currentColor" />
        <path d="M34 2 L40 8 L34 8 Z" fill="#fff" opacity="0.75" />
        <rect x="27" y="12" width="10" height="2" rx="1" fill="#fff" opacity="0.7" />
      </g>
      <circle cx="24" cy="30" r="1.6" fill="#1E2733" />
      <circle cx="40" cy="30" r="1.6" fill="#1E2733" />
      <rect x="10" y="24" width="44" height="12" rx="6" fill="#fff" opacity="0.96" />
      <rect x="10" y="42" width="44" height="16" rx="6" fill="#fff" opacity="0.98" />
    </svg>`,
  },
];
