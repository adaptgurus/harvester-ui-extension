#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';
import { parse as parseYaml } from 'yaml';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const sourceOnly = args.includes('--source-only');
const distIndex = args.indexOf('--dist');
const distDirectory = distIndex >= 0 ? resolve(ROOT, args[distIndex + 1] || '') : null;

function fail(message) {
  throw new Error(`LayerSentry v3 validation failed: ${ message }`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function read(path) {
  const fullPath = resolve(ROOT, path);

  assert(existsSync(fullPath), `required file is missing: ${ path }`);

  return readFileSync(fullPath, 'utf8');
}

function requireMarkers(source, name, markers) {
  for (const marker of markers) {
    assert(source.includes(marker), `${ name } is missing marker: ${ marker }`);
  }
}

function forbidMarkers(source, name, markers) {
  for (const marker of markers) {
    assert(!source.includes(marker), `${ name } contains forbidden marker: ${ marker }`);
  }
}

function walk(directory) {
  const out = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      out.push(...walk(path));
    } else if (entry.isFile()) {
      out.push(path);
    }
  }

  return out;
}

function digest(path) {
  const hash = createHash('sha256');

  hash.update(readFileSync(path));

  return hash.digest('hex');
}

function validateSvg(path) {
  const source = read(path);
  const unsafe = /<\s*(?:script|foreignObject|iframe|object|embed)\b|javascript:|on(?:load|error|click)\s*=|(?:href|xlink:href)\s*=\s*["']https?:/i;

  assert(/<svg\b/i.test(source), `${ path } is not an SVG document`);
  assert(!unsafe.test(source), `${ path } contains active or externally loaded content`);

  return {
    path,
    bytes:  Buffer.byteLength(source),
    sha256: digest(resolve(ROOT, path)),
  };
}

function get(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

const rootPackage = JSON.parse(read('package.json'));
const extensionPackage = JSON.parse(read('pkg/harvester/package.json'));
const pluginIndex = read('pkg/harvester/index.ts');
const productConfig = read('pkg/harvester/config/layersentry-cluster.js');
const browserBranding = read('pkg/harvester/utils/layersentry-branding.js');
const localeBranding = read('pkg/harvester/utils/layersentry-locale.js');
const shellPatch = read('scripts/apply-layersentry-shell-branding-v3.mjs');
const dashboardRoute = read('pkg/harvester/pages/c/_cluster/_resource/index.vue');
const operationsDashboard = read('pkg/harvester/components/layersentry/OperationsDashboard.vue');
const supportPage = read('pkg/harvester/pages/c/_cluster/support/index.vue');
const brandingPage = read('pkg/harvester/pages/c/_cluster/brand/index.vue');
const brandingOverlay = parseYaml(read('pkg/harvester/l10n/layersentry-en-us.yaml'));
const operationsOverlay = parseYaml(read('pkg/harvester/l10n/layersentry-operations-en-us.yaml'));
const styles = walk(resolve(ROOT, 'pkg/harvester/styles/layersentry'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

assert(rootPackage.version === '1.8.2', 'root package version must remain 1.8.2');
assert(rootPackage.engines?.node === '>=24.0.0', 'Node 24 or later must remain mandatory');
assert(
  rootPackage.scripts?.postinstall === 'node scripts/apply-layersentry-shell-branding-v3.mjs',
  'the complete v3 shell patch must run during locked installation'
);
assert(extensionPackage.name === 'harvester', 'technical compatibility package name must remain harvester');
assert(extensionPackage.version === '1.8.2', 'extension package version must remain 1.8.2');
assert(
  extensionPackage.rancher?.annotations?.['catalog.cattle.io/display-name'] === 'LayerSentry',
  'catalog display name must be LayerSentry'
);

requireMarkers(pluginIndex, 'plugin entry', [
  "import { brandLayerSentryLocale } from './utils/layersentry-locale'",
  "import { installLayerSentryBrowserBranding } from './utils/layersentry-branding'",
  'installLayerSentryBrowserBranding();',
  'const customerEnUs = brandLayerSentryLocale(mergedEnUs);',
  "plugin.register('l10n', 'en-us', customerEnUs)",
  "plugin.addProduct(require('./config/layersentry-cluster'))",
]);

requireMarkers(localeBranding, 'presentation locale branding', [
  "const LAYERSENTRY_VENDOR = 'LayerSentry'",
  '/\\bSUSE Harvester\\b/g',
  '/\\bHarvester\\b/g',
  '/\\bRancher\\b/g',
  'export function brandLayerSentryLocale(value)',
  'Object.fromEntries(',
]);

requireMarkers(browserBranding, 'browser branding runtime', [
  "export const LAYERSENTRY_VENDOR = 'LayerSentry'",
  "new Set(['', 'Rancher', 'Harvester'])",
  "document.documentElement.setAttribute('data-product-brand', 'layersentry')",
  'document.title = title',
  'MutationObserver',
  'data-layersentry-default-favicon',
]);

requireMarkers(productConfig, 'single-product branding', [
  "setVendor(LAYERSENTRY_VENDOR)",
  "data-product-brand', 'layersentry'",
  'layer-sentry-icon.svg',
  'afterLoginLogo:',
  'supportCustomLogo: true',
]);

requireMarkers(shellPatch, 'v3 packaged shell patch', [
  "const PATCH_MARKER = 'LayerSentry packaged shell branding v3'",
  'layersentry-wordmark.svg',
  'layersentry-wordmark-dark.svg',
  'layersentry-login-landscape.svg',
  "copyAsset(iconSource, join(providerAssetDirectory, 'harvester.svg'))",
  "replaceFunction(source, 'setTitle'",
  "link.href = ico",
  "vendor === 'LayerSentry' ? 'Sign in to LayerSentry'",
  'Use the unique bootstrap password generated for this LayerSentry cluster.',
  'The bootstrap password is temporary.',
  '(LayerSentry-{{ harvesterVersion }})',
]);

requireMarkers(dashboardRoute, 'dashboard route adapter', [
  "const LAYERSENTRY_DASHBOARD_RESOURCE = 'harvesterhci.io.dashboard'",
  "import OperationsDashboard from '../../../../components/layersentry/OperationsDashboard.vue'",
  'OperationsDashboard v-if="isLayerSentryDashboard"',
  '<ResourceList v-else />',
]);

requireMarkers(operationsDashboard, 'advanced operations control plane', [
  "name:       'LayerSentryOperationsDashboard'",
  'data-testid="layersentry-operations-dashboard"',
  'class="layersentry-command-header"',
  "t('harvester.dashboard.commandCenter.title')",
  'class="layersentry-quick-actions"',
  'class="layersentry-posture-grid"',
  'class="layersentry-resource-grid"',
  'class="layersentry-capacity-grid"',
  'class="layersentry-event-list"',
  'recentWarningEvents',
  'runningVmCount',
  'storageStats',
  'aria-live="polite"',
]);

requireMarkers(styles, 'LayerSentry design system', [
  '--ls-accent:',
  '--ls-nav-bg:',
  '--ls-status-positive:',
  '--ls-status-warning:',
  '--ls-status-critical:',
  "html[data-product-brand='layersentry']",
  "html[data-product-brand='layersentry'] .side-nav",
  "html[data-product-brand='layersentry'] [data-testid='header']",
  "html[data-product-brand='layersentry'] .login",
  "html[data-product-brand='layersentry'] table thead th",
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
]);
assert(!/(?:linear|radial|conic)-gradient\s*\(/i.test(styles), 'production styles must not use gradients');

const expectedTranslations = [
  [brandingOverlay, 'harvester.productLabel', 'LayerSentry'],
  [brandingOverlay, 'harvester.dashboard.version', 'Platform version'],
  [brandingOverlay, 'harvester.support.title', 'LayerSentry Support'],
  [operationsOverlay, 'product.harvester', 'LayerSentry'],
  [operationsOverlay, 'harvester.dashboard.label', 'Control Plane'],
  [operationsOverlay, 'harvester.dashboard.commandCenter.title', 'Operations Control Plane'],
  [operationsOverlay, 'login.loginWithLocal', 'Sign in to LayerSentry'],
];

for (const [source, path, expected] of expectedTranslations) {
  assert(get(source, path) === expected, `translation ${ path } must equal ${ expected }`);
}

const forbiddenDestinations = [
  'docs.harvesterhci.io',
  'forums.rancher.com',
  'slack.rancher.io',
  'github.com/harvester',
  'suse.com/products/harvester',
  'suse.com/suse-harvester',
];

for (const destination of forbiddenDestinations) {
  assert(!supportPage.includes(destination), `support page exposes upstream destination ${ destination }`);
}

requireMarkers(supportPage, 'support page', [
  'layersentrySupport.actions.bundle',
  'layersentrySupport.actions.kubeconfig',
  'role="note"',
]);
requireMarkers(brandingPage, 'branding page', [
  'SAFE_IMAGE_DATA_URL',
  'UNSAFE_SVG_CONTENT',
  'aria-live="polite"',
]);

const sourceCredentialMarkers = [
  'bootstrap-credentials.json',
  'nodePassword',
  'clusterToken',
  'adminPassword',
];

for (const [name, source] of [
  ['plugin entry', pluginIndex],
  ['locale branding', localeBranding],
  ['browser branding', browserBranding],
  ['operations dashboard', operationsDashboard],
  ['styles', styles],
]) {
  forbidMarkers(source, name, sourceCredentialMarkers);
}

const assets = [
  validateSvg('pkg/harvester/assets/layersentry/layer-sentry-icon.svg'),
  validateSvg('pkg/harvester/assets/layersentry/layersentry-wordmark.svg'),
  validateSvg('pkg/harvester/assets/layersentry/layersentry-wordmark-dark.svg'),
  validateSvg('pkg/harvester/assets/layersentry/layersentry-login-landscape.svg'),
  validateSvg('pkg/harvester/icon.svg'),
];

const manifest = {
  schemaVersion: '1.2',
  product:       'LayerSentry',
  sourceCommit:  process.env.GITHUB_SHA || null,
  generatedAt:   new Date().toISOString(),
  sourceChecks:  {
    compatibilityPackageName: extensionPackage.name,
    packageVersion:           extensionPackage.version,
    displayName:              extensionPackage.rancher?.annotations?.['catalog.cattle.io/display-name'],
    completePreAuthBranding:   true,
    browserBranding:           true,
    recursiveLocaleBranding:   true,
    advancedOperationsUi:      true,
    responsiveEnterpriseShell: true,
    upstreamSupportLinks:      false,
    gradientsPresent:          false,
  },
  assets,
  bundle: null,
};

if (!sourceOnly) {
  assert(distDirectory, 'use --dist <directory> for generated-output validation');
  assert(existsSync(distDirectory), `generated package directory is missing: ${ distDirectory }`);

  const files = walk(distDirectory);
  const bundles = files.filter((path) => path.endsWith('.umd.min.js'));

  assert(bundles.length === 1, `expected exactly one UMD bundle, found ${ bundles.length }`);

  const bundle = bundles[0];
  const source = readFileSync(bundle, 'utf8');
  const bytes = statSync(bundle).size;

  assert(bytes > 500_000, `generated UMD bundle is unexpectedly small: ${ bytes } bytes`);
  requireMarkers(source, 'generated UMD bundle', [
    'LayerSentry',
    'Operations Control Plane',
    'layersentry-operations-dashboard',
    'Secure private cloud control plane',
  ]);

  manifest.bundle = {
    path:   relative(ROOT, bundle),
    bytes,
    sha256: digest(bundle),
    files:  files.length,
  };

  mkdirSync(resolve(ROOT, 'dist-pkg'), { recursive: true });
  writeFileSync(
    resolve(ROOT, 'dist-pkg/layersentry-branding-manifest.json'),
    `${ JSON.stringify(manifest, null, 2) }\n`,
    'utf8'
  );
}

process.stdout.write(`${ JSON.stringify(manifest, null, 2) }\n`);
process.stdout.write('LAYERSENTRY V3 BROWSER, LOGIN, SHELL, LOCALE, AND OPERATIONS CONTRACT: PASS\n');
