// Tiny external page-boot shim.
//
// Why this file exists: every page used to carry its own inline
// `<script type="module">...</script>` bootstrap block that called
// initToolPage('category') or initToolLandingPage('toolKey') directly.
// Under a real Content-Security-Policy, inline <script> content is
// blocked by default (that's the whole point of CSP — it stops injected
// inline scripts from running). Rather than adding 'unsafe-inline' to
// script-src (which would defeat CSP's main XSS protection) or hard-coding
// a growing list of per-page script hashes (fragile — breaks every time
// scripts/generate-seo-pages.mjs adds a new tool), every page now points
// to this ONE external, self-hosted, CSP-friendly script instead, and
// tells it what to boot via a data attribute already on <body>.
import { initToolPage, initToolLandingPage } from './main.js';

const body = document.body;
const landingKey = body.dataset.toolLanding;
const categoryKey = body.dataset.toolCategory;

if (landingKey) {
  initToolLandingPage(landingKey);
} else {
  initToolPage(categoryKey || 'all');
}
