import { getVendor, setVendor } from '@shell/config/private-label';

export const LAYERSENTRY_VENDOR = 'LayerSentry';

const UPSTREAM_DEFAULT_VENDORS = new Set(['', 'Rancher', 'Harvester']);
const LAYERSENTRY_FAVICON = require('../assets/layersentry/layer-sentry-icon.svg');
const BRAND_SYNC_DELAYS = [0, 250, 1000, 4000];

let brandingStarted = false;
let titleObserver = null;

function hasDocument() {
  return typeof document !== 'undefined';
}

function hasWindow() {
  return typeof window !== 'undefined';
}

function packagedBrandIsActive() {
  return getVendor() === LAYERSENTRY_VENDOR;
}

function markLayerSentryDocument() {
  if (!hasDocument()) {
    return;
  }

  document.documentElement.setAttribute('data-product-brand', 'layersentry');
  document.documentElement.setAttribute('data-layersentry-theme', 'operations');

  if (document.body) {
    document.body.setAttribute('data-product-brand', 'layersentry');
  }
}

function normalizeVendor() {
  const vendor = getVendor() || '';

  if (UPSTREAM_DEFAULT_VENDORS.has(vendor)) {
    setVendor(LAYERSENTRY_VENDOR);
  }

  return getVendor();
}

function brandedTitle(value) {
  const title = String(value || '').trim();

  if (!title) {
    return LAYERSENTRY_VENDOR;
  }

  if (title === LAYERSENTRY_VENDOR || title.startsWith(`${ LAYERSENTRY_VENDOR } -`)) {
    return title;
  }

  if (/^(?:Harvester|Rancher)(?=\s*(?:-|$))/i.test(title)) {
    return title.replace(/^(?:Harvester|Rancher)/i, LAYERSENTRY_VENDOR);
  }

  return `${ LAYERSENTRY_VENDOR } - ${ title }`;
}

function syncDocumentTitle() {
  if (!hasDocument() || !packagedBrandIsActive()) {
    return;
  }

  const title = brandedTitle(document.title);

  if (document.title !== title) {
    document.title = title;
  }
}

function isUpstreamFavicon(link) {
  const href = link?.getAttribute?.('href') || '';

  return !href || /(?:harvester|rancher)(?:[./_-]|$)/i.test(href);
}

function syncFavicon() {
  if (!hasDocument() || !packagedBrandIsActive()) {
    return;
  }

  const links = Array.from(document.querySelectorAll('link[rel~="icon"]'));
  const upstream = links.find((link) => isUpstreamFavicon(link));

  if (!upstream && links.length) {
    // A non-upstream favicon is treated as an explicit administrator override.
    return;
  }

  const link = upstream || document.createElement('link');

  link.setAttribute('rel', 'icon');
  link.setAttribute('type', 'image/svg+xml');
  link.setAttribute('href', LAYERSENTRY_FAVICON);
  link.setAttribute('data-layersentry-default-favicon', 'true');

  if (!link.parentNode) {
    document.head.appendChild(link);
  }
}

export function syncLayerSentryBrowserBranding() {
  normalizeVendor();

  if (!packagedBrandIsActive()) {
    return;
  }

  markLayerSentryDocument();
  syncDocumentTitle();
  syncFavicon();
}

function observeTitleChanges() {
  if (!hasDocument() || typeof MutationObserver === 'undefined' || titleObserver) {
    return;
  }

  const title = document.querySelector('title');

  if (!title) {
    return;
  }

  titleObserver = new MutationObserver(() => {
    syncLayerSentryBrowserBranding();
  });
  titleObserver.observe(title, { childList: true, characterData: true, subtree: true });
}

export function installLayerSentryBrowserBranding() {
  if (brandingStarted) {
    syncLayerSentryBrowserBranding();

    return;
  }

  brandingStarted = true;
  syncLayerSentryBrowserBranding();
  observeTitleChanges();

  if (!hasWindow()) {
    return;
  }

  BRAND_SYNC_DELAYS.forEach((delay) => {
    window.setTimeout(() => {
      syncLayerSentryBrowserBranding();
      observeTitleChanges();
    }, delay);
  });

  window.addEventListener('pageshow', syncLayerSentryBrowserBranding);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncLayerSentryBrowserBranding();
    }
  });
}
