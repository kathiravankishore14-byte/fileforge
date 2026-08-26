# Security Hardening Report

## Implemented in code
- Added global response headers via `public/_headers` so Vite copies them into `dist` for Cloudflare static asset deployment.
- Added HTTPS/canonical redirect rules via `public/_redirects`.
- Added `X-Content-Type-Options: nosniff`.
- Added `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`.
- Added `Referrer-Policy: strict-origin-when-cross-origin`.
- Added a restrictive `Permissions-Policy` for unused powerful browser APIs.
- Added HSTS with a one-year max-age. `includeSubDomains` and `preload` were intentionally not enabled because subdomain HTTPS coverage cannot be verified from this source archive alone.
- Added a functional baseline CSP covering local assets, Google Fonts, blob/data URLs used by client-side processing, Web Workers, and Hugging Face model downloads.
- Added HTML escaping for multiple user-controlled values inserted through `innerHTML`, including search input, file names, Office document preview text/cells, JSON errors, and text utility output.
- Added centralized filename sanitization and applied it to generated result downloads.
- Removed the dead `worker/index.js` remove.bg proxy implementation. It was not referenced by `wrangler.jsonc`, contradicted the site's local-only privacy model, and increased future attack/privacy surface if accidentally enabled later.

## CSP note
The current codebase contains many inline module/JSON-LD script blocks and inline style attributes. To avoid breaking the existing site, this first hardening pass uses `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline' ...`. This is materially better than having no CSP because it still restricts external origins, objects, framing, form targets, connections and workers, but `unsafe-inline` means the script policy is not yet the strongest possible XSS control.

A later hardening pass should externalize executable inline scripts and move to CSP hashes/nonces so `unsafe-inline` can be removed from `script-src`.

## Manual verification required after deployment
1. Confirm Cloudflare Workers Static Assets honors `_headers` and `_redirects` in this deployment mode by checking the live response headers.
2. Rerun SecurityHeaders.com and MDN Observatory.
3. Test HTTP -> HTTPS and www -> canonical redirects directly.
4. Exercise all major tools with DevTools Console open and verify CSP does not block required model/worker resources.
5. Verify the browser-only privacy claim with DevTools Network for representative file tools.
6. If any other subdomains exist, verify they are HTTPS-only before adding `includeSubDomains` to HSTS.

## Remaining risks
- The application uses extensive `innerHTML` templating. High-risk user-controlled interpolation points were hardened in this pass, but a broader refactor to DOM construction/textContent would reduce future XSS risk.
- Client-side document parsing libraries process untrusted files and should be kept patched.
- CSP still permits inline script because of the current HTML architecture.

Build verification note
- JavaScript syntax checks passed for src/main.js, vite.config.js, and worker/index.js.
- Full Vite production build could not be completed in this Linux sandbox because the uploaded node_modules contained Windows-native binaries; a clean npm install exceeded the execution window. Run npm ci && npm run build on the normal development/deployment environment before production.
