/**
 * k6 load test for onlinetoolsweb.com
 * ================================================================
 * What this tests: how the EDGE (page loads + static assets) holds up
 * under increasing concurrent traffic. It does NOT and CANNOT test the
 * browser-side tools (background removal, OCR, PDF processing, etc.) —
 * those run entirely on each visitor's own device, not on your server,
 * so there is nothing server-side for a load test to measure there.
 * See CSP_HARDENING_REPORT.md / the chat explanation for why that's
 * actually a good thing for capacity.
 *
 * RAMP PROFILE: starts small and increases in steps rather than
 * jumping straight to high concurrency. This matters against a
 * Cloudflare-protected site specifically — a sudden traffic spike from
 * one source looks like the start of a DDoS attack to Cloudflare's own
 * automated mitigation, and a flat blast is far more likely to get your
 * own test traffic rate-limited or challenged than a gentle ramp is.
 *
 * HOW TO RUN
 * ----------
 * 1. Install k6:  https://grafana.com/docs/k6/latest/set-up/install-k6/
 *      macOS:   brew install k6
 *      Windows: choco install k6   (or winget install k6)
 *      Linux:   see the install page above (apt/yum repos provided)
 *
 * 2. Run against production (default target is already set below):
 *      k6 run k6-onlinetoolsweb.js
 *
 *    Run against a different target (e.g. a staging URL, or localhost
 *    if you have `wrangler dev` running) without editing this file:
 *      k6 run -e BASE_URL=http://127.0.0.1:8787 k6-onlinetoolsweb.js
 *
 * 3. Best practice: run it during a low-traffic window for your site,
 *    and watch the Cloudflare dashboard's Analytics tab in another
 *    window while it runs — if you see a spike in "Blocked" or
 *    "Challenged" requests there, the ramp was too aggressive for your
 *    current security settings, not that your site failed.
 *
 * READING THE OUTPUT
 * -------------------
 * k6 prints a summary at the end. The lines that matter most:
 *   http_req_duration..... p(95)=XXXms   <- 95% of requests were this
 *                                            fast or faster
 *   http_req_failed....... X.XX%         <- fraction of requests that
 *                                            errored or timed out
 *   checks................ X.XX%         <- fraction of the specific
 *                                            checks below that passed
 * The THRESHOLDS section below turns those into automatic pass/fail
 * (k6 exits non-zero if a threshold is breached), so you don't have to
 * eyeball the numbers to know whether something went wrong.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://onlinetoolsweb.com';

// Separate, named metrics so the summary breaks out "page load" from
// "static asset" performance instead of averaging them together — they
// have very different costs (one runs the CSP/nonce Worker logic, the
// other is a near-free passthrough) and hiding that difference in one
// blended number would make the results harder to act on.
const pageErrors = new Rate('page_errors');
const pageDuration = new Trend('page_duration', true);
const assetErrors = new Rate('asset_errors');
const assetDuration = new Trend('asset_duration', true);

// A handful of real page paths, mixing the homepage with a few actual
// tool pages, so the test reflects real navigation rather than
// hammering one URL. Trim or extend this list to match your own sitemap.
const PAGES = [
  '/',
  '/remove-background',
  '/qr-code-generator',
  '/compress-image',
  '/merge-pdf',
];

export const options = {
  // Ramp profile, step 2 (corrected): this Grafana Cloud k6 project has
  // a hard cap of 100 concurrent VUs on the free tier (confirmed by an
  // actual rejected run — k6 Cloud returned "exceeds the maximum
  // allowed for your project (100 VUs)" when this was set to 1,500).
  // So 100 is the real ceiling reachable without an admin raising the
  // project's limits in Grafana Cloud k6 project settings — this ramp
  // ends exactly there instead of guessing at a number that gets
  // rejected again.
  stages: [
    { duration: '30s', target: 25 },
    { duration: '1m', target: 25 },
    { duration: '30s', target: 60 },
    { duration: '1m', target: 60 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // The 50-VU run came back at 16ms p95 with 0 failures, so 100 VUs
    // shouldn't be dramatically different — kept these reasonably tight
    // rather than loosened, since this is still well within what a
    // healthy edge-served site should absorb easily.
    http_req_failed: ['rate<0.01'],
    page_duration: ['p(95)<1000'],
    asset_duration: ['p(95)<500'],
  },
};

export default function () {
  // --- Page load: exercises the Worker's nonce + CSP + HTMLRewriter path ---
  const path = PAGES[Math.floor(Math.random() * PAGES.length)];
  const pageRes = http.get(`${BASE_URL}${path}`, { tags: { kind: 'page' } });

  const pageOk = check(pageRes, {
    'page status is 200': (r) => r.status === 200,
    'page has CSP header': (r) => !!r.headers['Content-Security-Policy'],
    'page CSP has a nonce': (r) =>
      (r.headers['Content-Security-Policy'] || '').includes('nonce-'),
  });
  pageErrors.add(!pageOk);
  pageDuration.add(pageRes.timings.duration);

  sleep(Math.random() * 2 + 1); // 1-3s think time, like a real visitor reading the page

  // --- Static asset: exercises the cheap passthrough path for comparison ---
  const assetMatch = pageRes.body && pageRes.body.match(/\/assets\/[A-Za-z0-9_.-]+\.js/);
  if (assetMatch) {
    const assetRes = http.get(`${BASE_URL}${assetMatch[0]}`, { tags: { kind: 'asset' } });
    const assetOk = check(assetRes, {
      'asset status is 200': (r) => r.status === 200,
      'asset has no CSP header': (r) => !r.headers['Content-Security-Policy'],
    });
    assetErrors.add(!assetOk);
    assetDuration.add(assetRes.timings.duration);
  }

  sleep(Math.random() * 1 + 0.5); // brief pause before the next simulated visitor action
}
