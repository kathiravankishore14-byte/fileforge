// Reads src/main.js as plain text and pulls out the pure-data object
// literals (toolMeta, categoryTools, CATEGORY_NAV_CONFIG, pageUrlMap,
// CATEGORY_LABELS) it needs, without ever importing main.js itself —
// main.js has top-level browser-only side effects (DOM queries, a raw
// CSS import) that would throw immediately under plain Node. Every
// object below is written as a literal (string/boolean/array values
// only, no function calls or computed keys), so extracting the
// balanced-brace substring and evaluating it as an expression is safe
// and keeps main.js as the single source of truth — nothing here is
// hand-duplicated data that main.js could silently drift out of sync
// with.
import { readFileSync } from 'fs';

function extractLiteral(source, declaration) {
  const startIdx = source.indexOf(declaration);
  if (startIdx === -1) throw new Error(`Could not find "${declaration}" in main.js`);
  const braceStart = source.indexOf('{', startIdx);
  let depth = 0;
  let i = braceStart;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  const literalText = source.slice(braceStart, i);
  // eslint-disable-next-line no-new-func
  return new Function(`return (${literalText});`)();
}

export function extractMainData(mainJsPath) {
  const source = readFileSync(mainJsPath, 'utf-8');
  return {
    toolMeta: extractLiteral(source, 'const toolMeta = '),
    categoryTools: extractLiteral(source, 'const categoryTools = '),
    categoryNavConfig: extractLiteral(source, 'const CATEGORY_NAV_CONFIG = '),
    pageUrlMap: extractLiteral(source, 'const pageUrlMap = '),
    categoryLabels: extractLiteral(source, 'const CATEGORY_LABELS = '),
    categoryIcons: extractLiteral(source, 'const CATEGORY_ICONS = '),
    toolIconOverrides: extractLiteral(source, 'const TOOL_ICON_OVERRIDES = '),
  };
}
