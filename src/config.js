// ================= PHASE 3: SITE-WIDE FEATURE CONFIGURATION =================
// A single, obvious place to flip monetization/growth features on once the
// underlying product or provider actually exists. Every flag here defaults
// to OFF — nothing in this file changes what a visitor sees today. Flipping
// a flag to `true` without also wiring up the real destination/provider it
// describes would be deceptive, so don't do that; each flag's comment says
// what has to exist first.

// Premium features do not exist yet (no billing, no account system, no
// upgraded destination page). Until they do, the result-page "premium"
// block must stay in its honest, non-clickable "planned" state — see
// PREMIUM_BENEFITS below and renderPremiumExplainer() in main.js.
// Flip this only once a real premium destination (pricing/upgrade page)
// exists to send the CTA to.
export const PREMIUM_CTA_ENABLED = false;

// The benefits list is descriptive copy only — never a purchase button,
// price, or "Start trial" action — until PREMIUM_CTA_ENABLED is true AND
// a real destination URL is supplied below.
export const PREMIUM_BENEFITS = [
  'Batch processing for many files at once',
  'Saved presets for your usual settings',
  'A local history of your recent conversions',
  'Advanced export settings',
  'Multi-file workflows',
];

// Where the (currently disabled) premium CTA button would go once it
// exists. Left null on purpose — renderPremiumExplainer() refuses to draw
// a clickable CTA at all while this is null, even if PREMIUM_CTA_ENABLED
// were accidentally flipped true.
export const PREMIUM_CTA_HREF = null;

// No advertising provider is approved or configured yet (see
// privacy-policy.html's disclosure placeholder for what has to happen
// first: an AdSense — or equivalent — approval, plus updating the privacy
// policy's cookie/third-party disclosures before any ad script can load).
// Ad slot containers are reusable and already placed in the markup, but
// stay `hidden` and inert while this is false — see src/adSlots.js.
export const ADS_ENABLED = false;

// Set to a loader function once a provider is approved, e.g.
// `provider: () => import('./adProviders/adsense.js')`. Left null so
// mountAdSlot() has nothing to call while ADS_ENABLED is false.
export const AD_PROVIDER = null;
