/**
 * OnlineToolsWeb — security-header + CSP Worker
 * ================================================================
 * This Worker sits in front of the static asset bundle (env.ASSETS,
 * the Vite `dist/` output) purely to do two things every response
 * needs and a static `_headers` file cannot do on its own:
 *
 *   1. Mint a fresh, cryptographically random nonce PER RESPONSE and
 *      stamp it onto every <script> and <style> element in the HTML
 *      via HTMLRewriter, so script-src / style-src-elem can drop
 *      'unsafe-inline' entirely and allow only nonce-matched inline
 *      content.
 *   2. Build the Content-Security-Policy (and the rest of the
 *      security header set) from that same nonce and attach it to
 *      the response.
 *
 * There is no server-side API surface here on purpose — every tool
 * on this site processes files entirely client-side (WASM / Canvas /
 * on-device ML). Any request to /api/* is rejected outright rather
 * than silently falling through to the asset handler.
 *
 * Every exported/top-level function below is self-contained and unit
 * -testable in isolation (makeNonce, buildCsp, applySecurityHeaders,
 * isHtml) — none of them touch the network or the ASSETS binding.
 */

// ----------------------------------------------------------------
// External hosts actually required by this build (see README in
// this same folder for how each one was verified against the
// compiled dist/ output — every entry here is load-bearing, not
// precautionary):
//
//   https://cdn.jsdelivr.net
//     tesseract.js (OCR, used by the Image → Excel tool) ships with
//     NO custom workerPath/corePath/langPath in this app, so it uses
//     its built-in default: it wraps a Blob around
//     `importScripts("https://cdn.jsdelivr.net/npm/tesseract.js@vX/
//     dist/worker.min.js")` and spawns that as a Worker. A
//     blob:-sourced Worker inherits the creating document's CSP, so
//     that importScripts() call is gated by *this page's*
//     script-src — not worker-src, and not connect-src. Drop this
//     host and OCR (Image → Excel's cell/whole-page recognition
//     path) breaks silently.
//
//   https://huggingface.co / *.huggingface.co / cdn-lfs.huggingface.co / *.hf.co
//     @huggingface/transformers (the primary BiRefNet background-
//     removal pipeline and the AI paraphraser/summarizer tool) uses
//     its default `remoteHost: "https://huggingface.co/"`. Large
//     model weight files on HF are served via git-lfs and commonly
//     302-redirect to an `cdn-lfs*` / `*.hf.co` host; each redirect
//     hop is checked against connect-src independently, so the
//     narrower single-host allowance the original target policy
//     specified is kept as-is here — it's already correct.
//
// Everything else (pdf.js's worker, onnxruntime-web's own WASM runtime
// used by the BiRefNet background-removal and summarizer pipelines,
// heic2any's worker) is bundled and resolved to a same-origin
// /assets/... URL by Vite at build time — confirmed by grepping the
// compiled output for `new URL(..., import.meta.url)` — so none of
// those need an extra host anywhere. (Background Removal previously
// also depended on @imgly/background-removal, which fetched its own
// WASM runtime and model weights from staticimgly.com at runtime. That
// library was the confirmed, reproducible source of a live "Failed to
// create session ... no available backend found" failure that
// persisted even after this Worker's CSP was widened to allow that
// host — it has since been removed from the app entirely in favor of
// a single same-origin pipeline, so staticimgly.com is no longer
// referenced here.)
// ----------------------------------------------------------------

const JSDELIVR = 'https://cdn.jsdelivr.net';
const HUGGINGFACE_HOSTS = [
  'https://huggingface.co',
  'https://*.huggingface.co',
  'https://cdn-lfs.huggingface.co',
  'https://*.hf.co',
];
const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com';
const GOOGLE_FONTS_FILES = 'https://fonts.gstatic.com';

const PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'bluetooth=()',
  'accelerometer=()',
  'gyroscope=()',
  'magnetometer=()',
].join(', ');

/**
 * Cryptographically secure per-response nonce. 16 random bytes
 * (128 bits) is the value CSP's own spec examples use — comfortably
 * unguessable and short enough to keep the header small.
 */
function makeNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Builds the full Content-Security-Policy header value for one
 * response, parameterized by that response's nonce. Pure function —
 * no I/O, easy to unit test / snapshot.
 */
function buildCsp(nonce) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' ${JSDELIVR}`,
    "script-src-attr 'none'",
    `style-src-elem 'self' 'nonce-${nonce}' ${GOOGLE_FONTS_CSS}`,
    // Phase 1 only — see README §"style-src-attr migration". ~300
    // template-generated style="..." attributes still exist in the
    // current markup; moving this to 'none' before they're removed
    // would break real UI (progress bars, toggles, the mascot SVG).
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `font-src 'self' ${GOOGLE_FONTS_FILES}`,
    `connect-src 'self' ${HUGGINGFACE_HOSTS.join(' ')} ${JSDELIVR}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "media-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * Sets every non-CSP security header unconditionally, plus the CSP
 * header itself when (and only when) a nonce is supplied. Called
 * from exactly one place for HTML and exactly one place for every
 * other response, so there is nowhere else header logic can drift.
 *
 * CSP is intentionally omitted on non-HTML responses: a nonce-scoped
 * policy has no meaningful enforcement point on a .js/.css/.wasm/
 * image asset requested as a sub-resource (only the *document's* CSP
 * that references it matters), and sending a policy built around a
 * nonce nobody will ever see invites confusion for zero benefit.
 * The baseline headers (HSTS, nosniff, frame options, referrer,
 * permissions) still apply to every response, including that one.
 */
function applySecurityHeaders(headers, nonce) {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  if (nonce) {
    headers.set('Content-Security-Policy', buildCsp(nonce));
  } else {
    // Defense in depth: `headers` here is frequently a clone of
    // env.ASSETS.fetch()'s own response headers, which (confirmed via
    // `wrangler dev` against this project) still carry whatever a
    // legacy public/_headers rule set — including a stale
    // Content-Security-Policy — even with assets.run_worker_first
    // enabled. Explicitly clearing it means this function is correct
    // on its own regardless of what any `_headers` file does or
    // doesn't contain, rather than depending on that file being
    // deleted (which it should be — see README) or on undocumented
    // platform ordering that could change.
    headers.delete('Content-Security-Policy');
  }
  return headers;
}

/** Content-Type sniff used to decide whether HTMLRewriter runs at all. */
function isHtml(response) {
  const type = response.headers.get('content-type') || '';
  return type.includes('text/html');
}

/** Stamps one nonce attribute onto every element it's attached to. */
class NonceHandler {
  constructor(nonce) {
    this.nonce = nonce;
  }
  element(element) {
    element.setAttribute('nonce', this.nonce);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // No server-side API exists or should exist for this app — every
    // tool runs entirely in the browser. Reject rather than let a
    // future /api/* path accidentally fall through to asset lookup.
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const headers = applySecurityHeaders(
        new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
      );
      return new Response('Not found', { status: 404, headers });
    }

    const assetResponse = await env.ASSETS.fetch(request);

    // Non-HTML assets (JS, CSS, WASM, SVG, fonts, images): apply the
    // baseline headers and return as-is. No HTMLRewriter parse pass —
    // it's needless work for content with nothing to nonce, and it's
    // the streaming-parser cost this branch specifically avoids.
    if (!isHtml(assetResponse)) {
      const headers = applySecurityHeaders(new Headers(assetResponse.headers));
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers,
      });
    }

    // HTML: mint one nonce, apply the full header set (including CSP
    // built from that nonce) to a Response wrapping the *original*
    // body, then let HTMLRewriter transform that body in place. The
    // headers already set below are the ones the transformed
    // Response carries through unchanged.
    const nonce = makeNonce();
    const headers = applySecurityHeaders(new Headers(assetResponse.headers), nonce);
    const htmlResponse = new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });

    return new HTMLRewriter()
      .on('script', new NonceHandler(nonce))
      .on('style', new NonceHandler(nonce))
      .transform(htmlResponse);
  },
};

// Exported for unit testing (e.g. Vitest + `import { ... } from
// './worker/index.js'`) without spinning up a Worker runtime.
export { makeNonce, buildCsp, applySecurityHeaders, isHtml, NonceHandler };
