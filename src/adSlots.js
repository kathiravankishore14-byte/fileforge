// ================= PHASE 3: ADVERTISING SLOT COMPONENT =================
// Reusable, disabled-by-default ad slot markup. No ad provider is approved
// or configured (see src/config.js — ADS_ENABLED is false and AD_PROVIDER
// is null), so every slot this module renders stays `hidden` and inert:
// zero layout space reserved, zero network requests, zero third-party
// script loaded. Flipping ADS_ENABLED on later requires no markup changes
// anywhere in the site — every slot is already placed correctly.
//
// Placement rules honored by every call site that uses adSlotHtml()
// (see index.html and the result-page template in src/main.js):
//   - Never inside a dropzone or a tool's processing workspace.
//   - Always separated from the nearest button/control by real margin,
//     so a provider's ad can never be positioned to catch an accidental
//     click meant for a tool control.
//   - Always visually distinct from a tool card (dashed border, muted
//     surface, an explicit "Advertisement" label) so it reads as
//     sponsored content, never as another tool.
//   - Fixed aspect ratio reserved via CSS (see .ad-slot rules in
//     style.css) BEFORE any provider content loads, so turning ads on
//     later cannot introduce a layout shift.

import { ADS_ENABLED, AD_PROVIDER } from './config.js';

/**
 * @param {string} id - unique element id for this slot on the page
 * @param {'leaderboard'|'rectangle'} format - leaderboard collapses to a
 *   rectangle's proportions under 640px via CSS, so the same homepage
 *   slot works as both the "desktop" and "mobile" placement the brief
 *   asks for without needing two different components.
 */
export function adSlotHtml(id, format) {
  return `
    <div class="ad-slot ad-slot--${format}" id="${id}" data-ad-format="${format}" role="complementary" aria-label="Advertisement" hidden>
      <span class="ad-slot-label">Advertisement</span>
    </div>
  `;
}

// Call once per page, after the slot markup above already exists in the
// DOM. A no-op today (ADS_ENABLED is false) — this is the ONLY function
// that would need real work once a provider is approved; no other file
// changes when that day comes.
export function mountAdSlots() {
  if (!ADS_ENABLED || typeof AD_PROVIDER !== 'function') return;
  document.querySelectorAll('.ad-slot[data-ad-format]').forEach((slot) => {
    slot.hidden = false;
    // A real integration would do something like:
    //   AD_PROVIDER().then((provider) => provider.render(slot));
    // left unimplemented — no provider exists to call yet.
  });
}
