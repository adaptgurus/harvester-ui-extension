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
  throw new Error(`LayerSentry validation failed: ${ message }`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function read(relativePath) {
  const fullPath = resolve(ROOT, relativePath);

  assert(existsSync(fullPath), `required file is missing: ${ relativePath }`);

  return readFileSync(fullPath, 'utf8');
}

function digestFile(fullPath) {
  const hash = createHash('sha256');

  hash.update(readFileSync(fullPath));

  return hash.digest('hex');
}

function walk(directory) {
  const out = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      out.push(...walk(fullPath));
    } else if (entry.isFile()) {
      out.push(fullPath);
    }
  }

  return out;
}

function collectStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }

  return output;
}

function get(object, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => value?.[key], object);
}

function validateSvg(relativePath) {
  const source = read(relativePath);
  const unsafe = /<\s*(?:script|foreignObject|iframe|object|embed)\b|javascript:|on(?:load|error|click)\s*=|(?:href|xlink:href)\s*=\s*["']https?:/i;

  assert(/<svg\b/i.test(source), `${ relativePath } is not an SVG document`);
  assert(!unsafe.test(source), `${ relativePath } contains active or externally loaded content`);

  return {
    path:   relativePath,
    bytes:  Buffer.byteLength(source),
    sha256: digestFile(resolve(ROOT, relativePath))
  };
}

const packageMetadata = JSON.parse(read('pkg/harvester/package.json'));
const rootPackage = JSON.parse(read('package.json'));
const pluginIndex = read('pkg/harvester/index.ts');
const brandingConfig = read('pkg/harvester/config/layersentry-cluster.js');
const brandingPage = read('pkg/harvester/pages/c/_cluster/brand/index.vue');
const supportPage = read('pkg/harvester/pages/c/_cluster/support/index.vue');
const overlayText = read('pkg/harvester/l10n/layersentry-en-us.yaml');
const overlay = parseYaml(overlayText);
const layersentryStyles = walk(resolve(ROOT, 'pkg/harvester/styles/layersentry'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

assert(packageMetadata.name === 'harvester', 'the compatibility package name must remain harvester');
assert(packageMetadata.description.includes('LayerSentry'), 'the package description must identify LayerSentry');
const catalogDisplayName = packageMetadata.rancher?.annotations?.['catalog.cattle.io/display-name'];

assert(catalogDisplayName === 'LayerSentry', 'the catalog display name must be LayerSentry');
assert(packageMetadata.icon.includes('adaptgurus/harvester-ui-extension'), 'the catalog icon must use the controlled repository asset');
assert(rootPackage.engines?.node === '>=24.0.0', 'the production toolchain must require Node 24 or later');
assert(rootPackage.scripts?.['validate:layersentry'], 'package.json must expose validate:layersentry');

assert(pluginIndex.includes("./styles/layersentry/index.scss"), 'the LayerSentry theme must be loaded');
assert(pluginIndex.includes("./l10n/layersentry-en-us.yaml"), 'the LayerSentry locale overlay must be loaded');
assert(pluginIndex.includes("plugin.addProduct(require('./config/layersentry-cluster'))"), 'the LayerSentry product configuration must be registered');

const vendorIndex = brandingConfig.indexOf('const vendor = getVendor()');
const singleProductGuardIndex = brandingConfig.indexOf("const current = store.getters['isSingleProduct']");

assert(vendorIndex >= 0, 'the vendor synchronization logic is missing');
assert(singleProductGuardIndex > vendorIndex, 'vendor synchronization must run before the single-product metadata guard');
assert(brandingConfig.includes("setVendor(LAYERSENTRY_VENDOR)"), 'the default vendor must be synchronized to LayerSentry');
assert(brandingConfig.includes("data-product-brand', 'layersentry'"), 'the runtime document must expose the LayerSentry brand marker');
assert(brandingConfig.includes('layer-sentry-icon.svg'), 'the single-product header must use the canonical LayerSentry icon');
assert(brandingConfig.includes('supportCustomLogo: true'), 'custom logo support must remain enabled');
assert(
  !existsSync(resolve(ROOT, 'pkg/harvester/assets/layersentry/layer-sentry-logo.svg')),
  'the malformed legacy wordmark asset must not be present'
);

const expectedTranslations = new Map([
  ['harvester.productLabel', 'LayerSentry'],
  ['harvester.dashboard.version', 'Platform version'],
  ['harvester.support.title', 'LayerSentry Support'],
  ['layersentrySupport.title', 'LayerSentry Support']
]);

for (const [key, expected] of expectedTranslations) {
  assert(get(overlay, key) === expected, `translation ${ key } must equal "${ expected }"`);
}

for (const value of collectStrings(overlay)) {
  const forbidden = [
    /https?:\/\/(?:www\.)?harvesterhci\.io/i,
    /https?:\/\/docs\.harvesterhci\.io/i,
    /https?:\/\/forums\.rancher\.com/i,
    /https?:\/\/slack\.rancher\.io/i,
    /https?:\/\/github\.com\/harvester/i,
    /https?:\/\/(?:www\.)?suse\.com\/(?:products\/harvester|suse-harvester)/i,
    /\bupstream Harvester\b/,
    /\bRancher Dashboard\b/,
    /\bSUSE Harvester\b/
  ];

  for (const pattern of forbidden) {
    assert(!pattern.test(value), `user-facing locale text contains a forbidden upstream reference: ${ value }`);
  }
}

const forbiddenSupportReferences = [
  'docs.harvesterhci.io',
  'forums.rancher.com',
  'slack.rancher.io',
  'github.com/harvester',
  'suse.com/products/harvester',
  'suse.com/suse-harvester'
];

for (const reference of forbiddenSupportReferences) {
  assert(!supportPage.includes(reference), `support page exposes upstream destination ${ reference }`);
}

assert(supportPage.includes("layersentrySupport.actions.bundle"), 'the support bundle action must use LayerSentry copy');
assert(supportPage.includes("layersentrySupport.actions.kubeconfig"), 'the kubeconfig action must use LayerSentry copy');
assert(supportPage.includes('role="note"'), 'the support page must identify the security notice for assistive technology');

const imageTags = brandingPage.match(/<img\b[\s\S]*?>/g) || [];

assert(imageTags.length >= 3, 'branding previews are missing');
for (const tag of imageTags) {
  assert(/(?:^|\s):?alt=/.test(tag), `branding preview image is missing alt text: ${ tag }`);
}

assert(brandingPage.includes('SAFE_IMAGE_DATA_URL'), 'branding image MIME validation is missing');
assert(brandingPage.includes('UNSAFE_SVG_CONTENT'), 'branding SVG active-content validation is missing');
assert(brandingPage.includes('aria-live="polite"'), 'branding validation errors must be announced');

assert(!/(?:linear|radial|conic)-gradient\s*\(/i.test(layersentryStyles), 'LayerSentry production styles must not use gradients');
assert(layersentryStyles.includes('--ls-brand-navy'), 'LayerSentry design tokens must be loaded');

const assets = [
  validateSvg('pkg/harvester/assets/layersentry/layer-sentry-icon.svg'),
  validateSvg('pkg/harvester/icon.svg')
];

const manifest = {
  schemaVersion: '1.0',
  product:       'LayerSentry',
  sourceCommit:  process.env.GITHUB_SHA || null,
  generatedAt:   new Date().toISOString(),
  sourceChecks:  {
    compatibilityPackageName: packageMetadata.name,
    packageVersion:           packageMetadata.version,
    displayName:              catalogDisplayName,
    nodeEngine:               rootPackage.engines.node,
    localeOverlayParsed:      true,
    upstreamSupportLinks:     false,
    gradientsPresent:         false,
    brandingImageValidation:  true,
    accessibleImagePreviews:  true,
    runtimeBrandMarker:       true
  },
  assets,
  bundle: null
};

if (!sourceOnly) {
  assert(distDirectory, 'use --dist <directory> when validating generated output');
  assert(existsSync(distDirectory), `generated package directory is missing: ${ distDirectory }`);

  const generatedFiles = walk(distDirectory);
  const bundles = generatedFiles.filter((file) => file.endsWith('.umd.min.js'));

  assert(bundles.length === 1, `expected one UMD bundle, found ${ bundles.length }`);

  const bundle = bundles[0];
  const bundleBytes = statSync(bundle).size;
  const bundleText = readFileSync(bundle, 'utf8');

  assert(bundleBytes > 500_000, `generated UMD bundle is unexpectedly small: ${ bundleBytes } bytes`);
  assert(bundleText.includes('LayerSentry'), 'generated UMD bundle does not contain LayerSentry presentation copy');

  manifest.bundle = {
    path:   relative(ROOT, bundle),
    bytes:  bundleBytes,
    sha256: digestFile(bundle),
    files:  generatedFiles.length
  };

  const manifestDirectory = resolve(ROOT, 'dist-pkg');

  mkdirSync(manifestDirectory, { recursive: true });
  writeFileSync(
    join(manifestDirectory, 'layersentry-branding-manifest.json'),
    `${ JSON.stringify(manifest, null, 2) }\n`,
    'utf8'
  );
}

console.log(JSON.stringify(manifest, null, 2));
console.log('LAYERSENTRY UI BRANDING AND PRODUCTION-SAFETY CONTRACT: PASS');
