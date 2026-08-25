// FileForge / OnlineToolsWeb — API Worker
//
// This is the ONLY custom server-side code on the whole site. Every other
// request continues to be served as a static asset straight from ./dist
// (see wrangler.jsonc: assets.run_worker_first only routes "/api/*" here —
// everything else never touches this file).
//
// Currently handles one endpoint:
//   POST /api/remove-background
// which forwards the photo to remove.bg's API for the cutout — the same
// service the tool's UX is modeled on, so the quality is a guaranteed
// match rather than an approximation. If this fails for any reason (no
// API key configured, remove.bg is down, quota/rate limit hit, network
// error), the client (src/main.js) automatically falls back to an AI
// model that runs locally in the browser instead.
//
// SETUP REQUIRED: this needs a remove.bg API key, set as a Worker secret
// (never commit it to wrangler.jsonc or git):
//   npx wrangler secret put REMOVEBG_API_KEY
// Get a key from https://www.remove.bg/api — the free tier includes 50
// calls/month; beyond that it's billed per image by remove.bg directly.
//
// PRIVACY NOTE: unlike a fully local tool, this sends the photo to
// remove.bg's servers. Per remove.bg's own privacy policy, uploaded
// images are auto-deleted after about an hour, and may be used to
// improve their models unless "Improvement Program" is turned off in
// your remove.bg account settings. See privacy-policy.html, which
// discloses this to visitors — keep it in sync if this changes.

const MAX_BYTES = 20 * 1024 * 1024; // remove.bg's own hard cap is 22MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const REMOVEBG_ENDPOINT = 'https://api.remove.bg/v1.0/removebg';

function jsonError(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// remove.bg's error responses follow a JSON:API-style shape:
//   { "errors": [{ "title": "...", "status": "...", "detail": "..." }] }
// but that's not guaranteed for every failure mode (e.g. an upstream 5xx
// from a proxy in front of their API might return plain text/HTML), so
// this only trusts the shape after confirming it parses.
async function extractRemoveBgError(res) {
  try {
    const body = await res.json();
    const first = body && Array.isArray(body.errors) && body.errors[0];
    if (first) return first.detail || first.title || null;
  } catch (_) { /* non-JSON error body, ignore */ }
  return null;
}

async function handleRemoveBackground(request, env) {
  if (request.method !== 'POST') {
    return jsonError(405, 'Method not allowed');
  }

  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();
  if (!ALLOWED_TYPES.has(contentType)) {
    return jsonError(415, 'Unsupported file type. Use JPEG, PNG, or WebP.');
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength && contentLength > MAX_BYTES) {
    return jsonError(413, 'File is too large for server-side processing.');
  }

  if (!env.REMOVEBG_API_KEY) {
    // Secret not configured yet in this environment (e.g. fresh clone
    // before `wrangler secret put REMOVEBG_API_KEY` has been run).
    return jsonError(503, 'Server-side image processing is not available.');
  }

  let imageBytes;
  try {
    imageBytes = await request.arrayBuffer();
  } catch (err) {
    return jsonError(400, 'Could not read the uploaded file.');
  }

  const form = new FormData();
  form.append('image_file', new Blob([imageBytes], { type: contentType }), 'upload');
  form.append('size', 'auto');
  form.append('format', 'png'); // lossless, alpha-transparent — matches the rest of the cutout pipeline

  let upstream;
  try {
    upstream = await fetch(REMOVEBG_ENDPOINT, {
      method: 'POST',
      headers: { 'X-Api-Key': env.REMOVEBG_API_KEY },
      body: form,
    });
  } catch (err) {
    return jsonError(502, `Could not reach remove.bg: ${err && err.message ? err.message : 'network error'}`);
  }

  if (!upstream.ok) {
    const detail = await extractRemoveBgError(upstream);
    // Surface remove.bg's own reason (invalid key, out of credits, rate
    // limited, image rejected, etc.) so it's visible in Worker logs —
    // the visitor never sees this, they just get the client-side fallback.
    return jsonError(upstream.status === 429 ? 429 : 502, detail || `remove.bg responded with ${upstream.status}`);
  }

  const headers = new Headers();
  headers.set('content-type', upstream.headers.get('content-type') || 'image/png');
  headers.set('cache-control', 'no-store');

  return new Response(upstream.body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/remove-background') {
      return handleRemoveBackground(request, env);
    }

    return jsonError(404, 'Not found');
  },
};
