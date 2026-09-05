// ================= PHASE 3: PRIVACY-RESPECTING ANALYTICS INTERFACE =================
//
// No analytics system exists in this project today (confirmed by searching
// the repo for gtag/dataLayer/plausible/posthog/mixpanel — none found, and
// privacy-policy.html explicitly states no analytics or cookie-based
// tracking is in use). Per the Phase 3 brief, this file is therefore a
// TYPED INTERNAL EVENT INTERFACE ONLY — it never sends anything to a
// third-party endpoint, and no third-party tracker has been added.
//
// What this file gives a future integration:
//   - A single, exhaustive list of the 11 approved event names (ALLOWED_EVENTS).
//     track() silently ignores (and, in dev, warns about) anything not on
//     this list, so a typo or a scope-creep event can't silently start
//     flowing anywhere.
//   - A defensive scrub() pass that strips known-sensitive keys and any
//     suspiciously long string value from every payload before it goes
//     anywhere else — even though every call site in main.js is already
//     written not to pass that data, this is a second, structural
//     guarantee rather than trusting every call site forever.
//   - A DOM CustomEvent broadcast (`window.addEventListener('otw:analytics', ...)`)
//     so a real analytics provider can be wired in later by listening for
//     this event, with ZERO changes to any call site in main.js.
//   - setAnalyticsSink(fn) as the one seam a future first-party endpoint
//     or approved third-party SDK would plug into.
//
// ---------------------------------------------------------------------------
// PRIVACY RULES (enforced by construction, not just by convention):
//
// Never sent, ever, by any event in this file:
//   - filenames, file contents, extracted text, image data, document
//     metadata, or generated output — no call site in main.js is given
//     access to any of these when it calls track(), and scrub() also
//     strips a fixed list of key names as a second line of defense.
//   - raw search query text. The brief asks that a search "containing
//     detected personal information" never be sent — this file goes
//     further and never transmits the raw query at all, in either
//     tool_search_started, tool_search_results_shown, or
//     tool_search_no_results. Only non-identifying shape (a bucketed
//     length, whether it matched a category filter, how many results
//     came back) is recorded. A query can't leak what is never read.
//   - raw error messages. file_processing_failed sends a coarse,
//     hand-picked errorType bucket (see trackProcessingFailed below),
//     never the library's raw Error#message string, since a handful of
//     third-party libraries this site calls do occasionally interpolate
//     user-supplied values (e.g. a detected format name) into their
//     error text and this file has no way to audit every dependency's
//     every error path.
// ---------------------------------------------------------------------------

export const ALLOWED_EVENTS = Object.freeze([
  'tool_search_started',
  'tool_search_results_shown',
  'tool_search_no_results',
  'tool_opened',
  'file_processing_started',
  'file_processing_completed',
  'file_processing_failed',
  'result_downloaded',
  'related_tool_opened',
  'premium_cta_viewed',
  'premium_cta_clicked',
]);

const ALLOWED_EVENTS_SET = new Set(ALLOWED_EVENTS);

// Defensive key denylist — belt-and-suspenders in case a future call site
// is ever written carelessly. EXACT (case-insensitive) key names only —
// not a substring match — because a substring match against a term like
// "query" would also strip legitimate, already-safe keys that merely
// contain that word, such as this file's own `queryLength` bucket field
// (a caught bug during Phase 3 verification: an earlier substring-based
// version of this list silently dropped `queryLength` from every search
// event). If a future payload key needs blocking, add its exact name
// here rather than reaching for a broad pattern.
const FORBIDDEN_KEYS = new Set([
  'filename', 'file_name', 'filecontent', 'file_content',
  'content', 'text', 'extractedtext', 'extracted_text',
  'imagedata', 'image_data', 'metadata',
  'query', 'rawquery', 'raw_query', 'searchterm', 'search_term',
  'password', 'email', 'output', 'outputdata', 'output_data',
]);

const MAX_STRING_VALUE_LENGTH = 40; // generous for a bucket/enum label, far too short for free text

function scrub(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === 'string' && value.length > MAX_STRING_VALUE_LENGTH) continue;
    if (value !== null && typeof value === 'object') continue; // no nested blobs
    clean[key] = value;
  }
  return clean;
}

// No destination is configured today (ADS/analytics providers are both
// unapproved — see src/config.js). Call setAnalyticsSink() from a future
// integration to start actually forwarding events somewhere real.
let sink = null;
export function setAnalyticsSink(fn) {
  sink = typeof fn === 'function' ? fn : null;
}

export function track(eventName, payload) {
  if (!ALLOWED_EVENTS_SET.has(eventName)) {
    if (typeof console !== 'undefined') console.warn(`[analytics] ignored unknown event "${eventName}" — add it to ALLOWED_EVENTS in src/analytics.js first`);
    return;
  }
  const event = { name: eventName, ts: Date.now(), ...scrub(payload) };
  try {
    window.dispatchEvent(new CustomEvent('otw:analytics', { detail: event }));
  } catch { /* CustomEvent unsupported or window unavailable — never break the app over telemetry */ }
  if (sink) {
    try { sink(event); } catch { /* a future sink's own failure must never break tool functionality */ }
  }
}

// ---------------------------------------------------------------------------
// Thin, self-documenting wrappers — one per approved event — so call sites
// in main.js read as intent ("trackToolOpened(...)") rather than repeating
// event-name strings and payload shapes everywhere.

const lengthBucket = (str) => {
  const n = (str || '').trim().length;
  if (n === 0) return '0';
  if (n <= 3) return '1-3';
  if (n <= 8) return '4-8';
  if (n <= 20) return '9-20';
  return '20+';
};

export const trackSearchStarted = (query, source) =>
  track('tool_search_started', { queryLength: lengthBucket(query), source });

export const trackSearchResultsShown = (query, resultCount, source) =>
  track('tool_search_results_shown', { queryLength: lengthBucket(query), resultCount: Math.min(resultCount, 99), source });

export const trackSearchNoResults = (query, source) =>
  track('tool_search_no_results', { queryLength: lengthBucket(query), source });

export const trackToolOpened = (toolKey, source) =>
  track('tool_opened', { toolKey, source });

export const trackProcessingStarted = (toolKey) =>
  track('file_processing_started', { toolKey });

export const trackProcessingCompleted = (toolKey, durationMs) =>
  track('file_processing_completed', { toolKey, durationMs: typeof durationMs === 'number' ? Math.round(durationMs) : undefined });

// errorType is a small, hand-picked bucket — never the raw Error#message.
export const trackProcessingFailed = (toolKey, errorType) =>
  track('file_processing_failed', { toolKey, errorType: errorType || 'unknown' });

export const trackResultDownloaded = (toolKey) =>
  track('result_downloaded', { toolKey });

export const trackRelatedToolOpened = (fromToolKey, toToolKey) =>
  track('related_tool_opened', { fromToolKey, toToolKey });

export const trackPremiumCtaViewed = (toolKey) =>
  track('premium_cta_viewed', { toolKey });

export const trackPremiumCtaClicked = (toolKey) =>
  track('premium_cta_clicked', { toolKey });
