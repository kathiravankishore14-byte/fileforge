# CSP & Security Header Hardening — onlinetoolsweb.com

Delivered files (attached alongside this report, and already in place in the repo):

- `worker/index.js` — the new Cloudflare Worker that fronts every request
- `wrangler.jsonc` — updated to run that Worker on every request, not just 404s

This report covers items 3–10 of the requested deliverables. Items 1–2 (full file
contents) are the two attached files themselves — reproduced in full, not diffs or
snippets, exactly as requested.

---

## 1–2. Full final files

See `worker/index.js` and `wrangler.jsonc`, delivered as separate files. Both are
complete — nothing to merge or splice in.

**Why a Worker was needed at all:** the site previously shipped its CSP via a static
`public/_headers` file, which Cloudflare's static-assets serving honors *without* ever
invoking a Worker. A nonce has to be minted fresh per response, so a static file
fundamentally cannot express it — this required moving to a real Worker with
`assets.run_worker_first: true` so `worker/index.js` runs on every request (HTML and
asset alike), not only on cache misses. `public/_headers` has been deleted from the
repo; see the rollback section if you need it back.

## 3. Exact CSP header generated (as served by the Worker, verified live)

```
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; frame-src 'none'; form-action 'self'; script-src 'self' 'nonce-<per-response>' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; script-src-attr 'none'; style-src-elem 'self' 'nonce-<per-response>' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://huggingface.co https://*.huggingface.co https://cdn-lfs.huggingface.co https://*.hf.co https://cdn.jsdelivr.net https://staticimgly.com; worker-src 'self' blob:; child-src 'self' blob:; media-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests
```

`<per-response>` is a fresh base64 128-bit value from `crypto.getRandomValues()` on
every single HTML response — never cached, never reused, never hard-coded. Captured
live example from `wrangler dev`:

```
script-src 'self' 'nonce-Sz5OUDu8eMSJmS2WyW0J9Q==' 'wasm-unsafe-eval' https://cdn.jsdelivr.net
```

This CSP is **only sent on HTML responses**. JS/CSS/WASM/image/font sub-resource
responses get every other security header but no CSP (a nonce-scoped policy has no
enforcement point on a sub-resource fetched directly, and sending one built around a
nonce nobody will read invites confusion for zero benefit) — confirmed live: the JS
bundle `/assets/rolldown-runtime-*.js` carries `X-Content-Type-Options: nosniff` and no
`Content-Security-Policy` header at all.

### Two deviations from your literal target CSP — read this section

Your target baseline listed `connect-src 'self' https://huggingface.co https://*.huggingface.co https://cdn-lfs.huggingface.co https://*.hf.co` with no jsdelivr or staticimgly anywhere, and a `script-src` with no extra hosts beyond `'self' 'nonce-...' 'wasm-unsafe-eval'`. Per your own instruction — *"If a required domain is missing and something breaks: identify the exact blocked host, add only that host, explain why it is needed"* — I did not implement the target verbatim. I audited the actual compiled `dist/` bundle (not just `src/`) for every outbound network call your dependencies make by default, and found two real gaps. Both are additions, not broadenings — no wildcards, no scheme-level hosts, exactly one hostname each.

**`https://cdn.jsdelivr.net`** — added to both `script-src` and `connect-src`.
`tesseract.js` (the OCR engine behind the Image → Excel tool) is called in `src/main.js`
with no `workerPath`/`corePath`/`langPath` override. Its default behavior — confirmed by
grepping the compiled bundle — is to build a Blob containing
`importScripts("https://cdn.jsdelivr.net/npm/tesseract.js@v.../dist/worker.min.js")`
and spawn that as a Worker via `URL.createObjectURL(blob)`. A `blob:`-sourced Worker
inherits the *creating document's* CSP, so that `importScripts()` call is gated by this
page's `script-src`, not `worker-src` and not `connect-src` alone — both directives
needed the host because the worker script itself also fetches its WASM/traineddata
files from the same CDN at runtime. Drop this host and OCR breaks silently (the button
does nothing, no visible error unless DevTools is open).

**`https://staticimgly.com`** — added to `connect-src` only.
`@imgly/background-removal` is the fallback "isnet" model used when the primary
BiRefNet pipeline throws (lower-end devices, memory-constrained browsers, older
Safari). It's called with no `publicPath` override; its own config schema defaults
`publicPath` to `https://staticimgly.com/@imgly/background-removal-data/<version>/dist/`
and fetches **both** its WASM runtime and the ONNX model weights from there. This host
has no relationship to Hugging Face and was verified directly against the compiled
bundle string, not assumed from documentation. Drop it and the Remove Background
tool's fallback path breaks for exactly the users it exists to protect.

Everything else in your target baseline (Hugging Face hosts, Google Fonts hosts,
`'wasm-unsafe-eval'`, `worker-src 'self' blob:`, etc.) was verified correct as
written and needed no change.

**A natural Phase 3, not implemented now:** both jsdelivr and staticimgly could
eventually be eliminated the same way pdf.js's worker and onnxruntime-web's WASM
assets already are in this build — by self-hosting tesseract.js's worker/lang-data
and imgly's WASM/model files under `/assets/` and pointing `workerPath`/`corePath` and
`publicPath` at same-origin URLs at call time. That would let `connect-src` and
`script-src` shrink back to exactly your original target with zero functional loss.
I did not do this because it's an application-code change (touches `src/main.js` and
the build), not a header change, and you asked me to hardened headers without breaking
the app — not to refactor dependency loading. Flagging it as the natural next step if
you want the policy tightened further.

## 4. Directive-by-directive explanation

| Directive | Value | What it does here |
|---|---|---|
| `default-src` | `'self'` | Fallback for any directive not explicitly listed — same-origin only. |
| `base-uri` | `'self'` | Blocks a `<base href="...">` injection from silently retargeting every relative URL on the page. |
| `object-src` | `'none'` | Blocks `<object>`/`<embed>`/legacy plugins entirely. Nothing on this site uses them. |
| `frame-ancestors` | `'none'` | Anti-clickjacking: no site may embed onlinetoolsweb.com in an iframe. Paired with `X-Frame-Options: DENY` for older browsers that don't read CSP. |
| `frame-src` | `'none'` | This page itself may not embed *any* iframe (distinct from `frame-ancestors`, which is about being embedded, not embedding). The site has none, so this costs nothing. |
| `form-action` | `'self'` | Any `<form>` may only submit back to this origin. There are currently no `<form>` elements in `dist/index.html`, so this is a no-op today and a safety net if one is ever added. |
| `script-src` | `'self' 'nonce-...' 'wasm-unsafe-eval' https://cdn.jsdelivr.net` | Only same-origin scripts, scripts carrying this response's nonce, WASM compilation/instantiation, and the one CDN host tesseract.js's worker bootstrap needs. No `'unsafe-inline'`, no `'unsafe-eval'` (that token grants arbitrary `eval()`/`new Function()` — `'wasm-unsafe-eval'` is the narrower CSP3 token that permits *only* WebAssembly; confirmed no library in this codebase calls `eval()`/`new Function()`). |
| `script-src-attr` | `'none'` | Blocks every inline event-handler attribute (`onclick=`, `onload=`, etc.) unconditionally — a nonce cannot re-permit these; the only way past this directive is removing the attribute and using `addEventListener()`. Grep of the compiled HTML found none, so this costs nothing today and closes off a whole XSS class going forward. |
| `style-src-elem` | `'self' 'nonce-...' https://fonts.googleapis.com` | Governs `<style>` blocks and `<link rel=stylesheet>`. Same-origin, nonce-matched, plus Google Fonts' CSS host. No `'unsafe-inline'`. |
| `style-src-attr` | `'unsafe-inline'` | Governs inline `style="..."` attributes, kept separate from `style-src-elem` on purpose. **Not tightened to `'none'` yet** — see the Phase 1/2 note below. |
| `img-src` | `'self' data: blob:'` | Same-origin images, `data:` URIs (canvas exports, generated QR codes/thumbnails), and `blob:` URIs (file previews). No remote image hosts, because none are used. |
| `font-src` | `'self' https://fonts.gstatic.com` | Self-hosted Bootstrap fonts plus the one host Google Fonts actually serves font *files* from (as opposed to the CSS, which is `fonts.googleapis.com` and belongs to `style-src-elem`). |
| `connect-src` | `'self' + HF hosts + jsdelivr + staticimgly` | Everywhere `fetch`/`XHR`/WebSocket/EventSource may reach. Deliberately the narrowest directive here — every host is one a specific dependency provably calls, nothing speculative. |
| `worker-src` | `'self' blob:'` | Governs the URL passed to `new Worker(...)`. Same-origin scripts or `blob:`-constructed workers (tesseract.js, heic2any, and the app's own workers all use one of these two forms). |
| `child-src` | `'self' blob:'` | Legacy fallback for `worker-src`/`frame-src` in older engines that don't split them; kept for defense-in-depth at zero cost. |
| `media-src` | `'self' blob:'` | Covers `<video>`/`<audio>`/`createObjectURL()` playback if any tool ever needs it; costs nothing today. |
| `manifest-src` | `'self'` | Would restrict a web-app manifest to same-origin if one is added later. |
| `upgrade-insecure-requests` | (flag) | Belt-and-suspenders: rewrites any accidental `http://` sub-resource reference to `https://` before the browser even requests it. |

## 5. Security improvements made

- **Nonce-based inline script/style, no `'unsafe-inline'` anywhere in `script-src` or `style-src-elem`.** Every `<script>` and `<style>` element gets a fresh per-response nonce stamped on by `HTMLRewriter`; nothing without a matching nonce (or matching `'self'`/allowlisted host) executes.
- **`script-src-attr 'none'`** — closes inline event-handler attributes as an XSS vector completely, not just via nonce gating (nonces can't re-permit this directive at all).
- **`object-src 'none'`, `frame-src 'none'`, `frame-ancestors 'none'`** all preserved/added — no plugins, no framing in or out.
- **`form-action 'self'`** added as a safety net even though the site has no forms today.
- **Split `style-src-elem` / `style-src-attr`** so the `<style>`-block channel is fully locked down to nonce-only, while the small number of inline `style="..."` attributes (progress bars, the mascot SVG's transform toggles — confirmed by reading `dist/index.html`) keep working without weakening the bigger attack surface (`<style>` blocks, which is where a real injected-CSS attack would land).
- **`/api/*` is explicitly rejected with a 404** rather than silently falling through to asset lookup — there is no server-side API surface by design, and this makes that an enforced fact rather than an assumption.
- **Fixed a real bug found only through live testing, not static review:** `env.ASSETS.fetch()` under this Worker configuration was still carrying a stale, looser CSP (left over from the old `_headers` file) on every non-HTML asset response, independent of what the Worker itself set. `applySecurityHeaders()` now explicitly deletes any pre-existing `Content-Security-Policy` header when no nonce applies, so it's correct in isolation regardless of upstream header state — and `public/_headers` was deleted from the repo as the redundant root cause.
- All previously-working headers preserved and unchanged in substance: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, the full `Permissions-Policy` lockdown (camera/microphone/geolocation/payment/usb/bluetooth/accelerometer/gyroscope/magnetometer all `()`), and `Strict-Transport-Security: max-age=31536000` (left without `includeSubDomains`/`preload`, matching your instruction not to add scope beyond what's already there).

## 6. Functional risks / things to watch

- **The two added hosts (`cdn.jsdelivr.net`, `staticimgly.com`)** are the only departure from your literal target and are explained in full above — nothing else changed from your baseline.
- **Sandbox limitation on my end:** this environment cannot reach the public internet (outbound requests to `fonts.googleapis.com`, `huggingface.co`, etc. fail at the network/proxy layer here with `net::ERR_TUNNEL_CONNECTION_FAILED`, not `net::ERR_BLOCKED_BY_CSP`). That distinction matters — a proxy failure is not a CSP block, and no CSP violation or blocked-by-CSP message appeared for any of these requests — but it does mean I could not watch an actual Hugging Face model download or a jsdelivr/staticimgly fetch complete end-to-end from inside this sandbox. **Please re-run the OCR, background-removal-fallback, and paraphraser/summarizer flows against a real deployment (or `wrangler dev` on a machine with normal internet access) before considering this done** — the CSP grants are verified correct against the bundle's actual code paths, but a live network fetch is the only way to see a 200 come back.
- **Pre-existing bug, unrelated to this work, found incidentally:** `/contact` and `/about` both throw `TypeError: Cannot read properties of null (reading 'addEventListener')` as a page error in every browser test I ran, with and without the new CSP. This is an application bug (a script element is looked up before it exists in the DOM, or a selector no longer matches), not a security regression — flagging it since it showed up in the test logs, but I did not touch it.
- **`style-src-attr` is still `'unsafe-inline'`**, per your explicit instruction not to tighten this yet. It is the one place `'unsafe-inline'` still appears anywhere in this policy.

## 7. Testing checklist — what was actually verified vs. what still needs manual/production checking

Verified live against a running `wrangler dev` instance of this exact `worker/index.js` + `wrangler.jsonc`, using a headless Chromium via Playwright plus direct `curl -D -` header inspection:

| # | Item | Status |
|---|---|---|
| 1 | Homepage loads correctly | ✅ Verified — 0 CSP violations, 0 page errors |
| 2 | PDF tools work (watermark tested end-to-end: file upload → pdf-lib/pdf.js processing) | ✅ Verified — file accepted, processed, 0 CSP violations, 0 page errors |
| 3 | Image resize works | ✅ Page loads clean (part of the 21-page sweep); interactive resize not separately exercised |
| 4 | Image compression works | ✅ Page loads clean (part of the 21-page sweep); interactive compression not separately exercised |
| 5 | Background removal works | ✅ Page loads clean; BiRefNet/isnet-fallback network calls **not** end-to-end verified — see sandbox limitation above |
| 6 | QR generator works | ✅ Verified end-to-end — text filled, generate clicked, a canvas/image element confirmed present, 0 CSP violations |
| 7 | File conversion tools work | ✅ Pages load clean (Word/Excel/PPT tool pages included in the sweep) |
| 8 | Web Worker functionality | ✅ Confirmed via watermark test (pdf.js worker) and QR test — both spin up workers with no `worker-src` violations |
| 9 | WASM functionality | ✅ Confirmed via watermark test (pdf-lib/pdf.js WASM paths) — no `'wasm-unsafe-eval'`-related violations |
| 10 | Google Fonts load | ⚠️ Not verifiable in this sandbox (network-blocked, not CSP-blocked — see above); CSP grant confirmed correct by inspection |
| 11 | Hugging Face model download | ⚠️ Not verifiable in this sandbox (same reason); CSP grant confirmed correct by inspection |
| 12 | Mobile view | Not separately tested here — no CSP directive is viewport-dependent, so this is a UI/layout check, not a security one |

Also verified: a **21-page sweep** (home, remove-background, image-to-excel,
qr-code-generator, pdf/word/excel/ppt hubs, other-tools, contact, about,
unit-converter, merge-pdf, compress-image, resize-image, json-formatter,
password-generator, watermark-pdf, sign-pdf, heic-to-jpg, content-paraphraser) —
**0 total CSP violations across all 21 pages.** Also confirmed: `/api/anything` returns
a clean 404 with baseline headers and no CSP; JS/WASM/CSS asset responses carry the
baseline headers and correctly carry **no** CSP header at all (by design — see item 3).

**What you should still do before shipping:** run items 5, 10, and 11 against a real
deployment or a network-unrestricted `wrangler dev`, watching DevTools' Console and
Network tab specifically for `Refused to connect`/`Refused to load the script` CSP
messages on those three flows. If one of those *specific* hosts throws a CSP error,
the fix is to identify precisely which host was blocked (it will name itself in the
console message) and add only that host — the same evidence-based approach used above,
not a broadening of any directive.

## 8. Deployment commands

```bash
# from the repo root
npm run build                 # regenerates dist/ (public/_headers is gone, so this
                               # is the only place headers get set now)
npx wrangler deploy           # deploys worker/index.js + dist/ together
```

No new secrets, bindings, or environment variables are required — `ASSETS` is a
built-in static-assets binding declared entirely in `wrangler.jsonc`.

## 9. Rollback instructions

If anything regresses in production, two independent reverts are possible:

**Full rollback (back to static-only, no Worker):**
1. Restore `public/_headers` with its original ruleset (recoverable from git history —
   it was deleted in this change; `git log -- public/_headers` will show the last
   commit that had it).
2. In `wrangler.jsonc`, remove the `main`, and the `binding`/`run_worker_first` keys
   under `assets`, leaving just `{ "name": "fileforge", "compatibility_date": "...",
   "assets": { "directory": "./dist" } }`.
3. `npm run build && npx wrangler deploy` — Cloudflare goes back to serving `dist/`
   directly with `_headers`-driven headers and no Worker in the request path at all.

**Partial rollback (keep the Worker, loosen just the CSP):** edit `buildCsp()` in
`worker/index.js` directly — it's one pure function, isolated from header plumbing and
the HTMLRewriter wiring, specifically so a policy-only change never touches anything
else. `git diff` against the previous commit shows exactly what changed if you want a
smaller, surgical revert.

## 10. Optional Phase 2 — CSP violation reporting (not enabled)

Not turned on, per your instruction not to enable external reporting automatically.
If you want visibility into real-world CSP violations (a browser extension injecting a
script, a future regression, an attacker probing), the CSP3-native approach is:

1. Add a `Reporting-Endpoints` header alongside the existing ones:
   ```
   Reporting-Endpoints: csp-endpoint="https://<your-collector>/csp-reports"
   ```
2. Add `report-to csp-endpoint` to the end of `buildCsp()`'s directive list.
3. Point `<your-collector>` at something that can receive and store POSTed JSON
   reports — this needs an endpoint you control and trust, since violation reports can
   contain URL fragments of user-supplied content. A second, small Worker route (e.g.
   `POST /csp-reports` on this same Worker, writing to a KV namespace or D1 table) is
   the natural Cloudflare-native choice if you want to keep everything on one platform;
   a third-party collector (Sentry, report-uri.com, etc.) also works but sends
   violation data off-platform.

This is entirely additive — turning it on doesn't change what's blocked or allowed,
only whether you get told about it when a browser blocks something. I did not wire
this up because no collector endpoint was specified and doing so would mean guessing
at infrastructure you haven't set up.
