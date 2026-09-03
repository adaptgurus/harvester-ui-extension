#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const PACKAGE_ROOT = resolve(ROOT, 'node_modules/@rancher/shell');
const SHELL_ROOT_CANDIDATES = [PACKAGE_ROOT, join(PACKAGE_ROOT, 'shell')];
const SHELL_ROOT = SHELL_ROOT_CANDIDATES.find((candidate) => existsSync(join(candidate, 'config/private-label.js')));
const PATCH_MARKER = 'LayerSentry packaged shell branding';

function fail(message) {
  throw new Error(`LayerSentry shell branding failed: ${ message }`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function copyAsset(sourcePath, destinationPath) {
  assert(existsSync(sourcePath), `source asset is missing: ${ sourcePath }`);
  mkdirSync(dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);
}

function writeChanged(path, source, next) {
  if (next !== source) {
    writeFileSync(path, next, 'utf8');
  }
}

function replaceFunction(source, functionName, replacement) {
  const signature = `export function ${ functionName }(`;
  const start = source.indexOf(signature);

  assert(start >= 0, `could not find exported function ${ functionName }`);

  const openingBrace = source.indexOf('{', start);

  assert(openingBrace >= 0, `could not find opening brace for ${ functionName }`);

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openingBrace; index < source.length; index++) {
    const character = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character;

      continue;
    }

    if (character === '{') {
      depth++;
    } else if (character === '}') {
      depth--;

      if (depth === 0) {
        return `${ source.slice(0, start) }${ replacement }${ source.slice(index + 1) }`;
      }
    }
  }

  fail(`could not find closing brace for ${ functionName }`);
}

function patchPrivateLabel(path) {
  const source = readFileSync(path, 'utf8');

  if (source.includes(PATCH_MARKER)) {
    return;
  }

  const replacement = `// ${ PATCH_MARKER }\nexport function setTitle() {\n  const v = getVendor();\n\n  if (v === 'Harvester' || v === 'LayerSentry') {\n    const isLayerSentry = v === 'LayerSentry';\n    const ico = isLayerSentry\n      ? requireAsset(\`~shell/assets/images/pl/layersentry-favicon.svg\`)\n      : requireAsset(\`~shell/assets/images/pl/harvester.png\`);\n\n    document.title = isLayerSentry ? 'LayerSentry' : 'Harvester';\n    let link = document.querySelector('link[rel~="icon"]');\n\n    if (!link) {\n      link = document.createElement('link');\n      link.rel = 'icon';\n      document.getElementsByTagName('head')[0].appendChild(link);\n    }\n\n    link.hid = 'icon';\n    link.type = isLayerSentry ? 'image/svg+xml' : 'image/x-icon';\n    link.href = ico;\n  }\n}`;
  const next = replaceFunction(source, 'setTitle', replacement);

  writeChanged(path, source, next);
}

function patchLogin(path) {
  const source = readFileSync(path, 'utf8');
  let next = source;

  if (!next.includes("vendor:             getVendor() === 'Harvester' ? 'LayerSentry' : getVendor()")) {
    next = next.replace(
      /vendor:\s+getVendor\(\)/,
      "vendor:             getVendor() === 'Harvester' ? 'LayerSentry' : getVendor()"
    );
  }

  if (!next.includes('const resolvedVendor =')) {
    next = next.replace(
      /\s+if \(plSetting\.value\?\.length && plSetting\.value !== getVendor\(\)\) \{\s+setVendor\(plSetting\.value\);\s+\}/,
      `\n      const resolvedVendor = ['Harvester', 'Rancher'].includes(plSetting.value) ? 'LayerSentry' : plSetting.value;\n\n      if (resolvedVendor?.length && resolvedVendor !== getVendor()) {\n        setVendor(resolvedVendor);\n      }`
    );
  }

  if (!next.includes("this.customizations.logo || 'layersentry-wordmark.svg'")) {
    next = next.replace(
      /brandLogo\(\) \{\s+return this\.customizations\.logo;\s+\}/,
      `brandLogo() {\n      return this.customizations.logo || 'layersentry-wordmark.svg';\n    }`
    );
  }

  assert(next.includes("vendor:             getVendor() === 'Harvester' ? 'LayerSentry' : getVendor()"), 'login vendor normalization was not applied');
  assert(next.includes('const resolvedVendor ='), 'login private-label normalization was not applied');
  assert(next.includes("this.customizations.logo || 'layersentry-wordmark.svg'"), 'login wordmark fallback was not applied');

  writeChanged(path, source, next);
}

function patchVisibleFooter(path) {
  const source = readFileSync(path, 'utf8');
  const next = source.replace('(Harvester-{{ harvesterVersion }})', '(LayerSentry-{{ harvesterVersion }})');

  writeChanged(path, source, next);
}

assert(existsSync(PACKAGE_ROOT), 'the locked @rancher/shell package is not installed');
assert(SHELL_ROOT, 'could not locate the @rancher/shell source root');

const privateLabelPath = join(SHELL_ROOT, 'config/private-label.js');
const loginPath = join(SHELL_ROOT, 'pages/auth/login.vue');
const sideNavPath = join(SHELL_ROOT, 'components/SideNav.vue');
const providerAssetDirectory = join(SHELL_ROOT, 'assets/images/providers');
const privateLabelAssetDirectory = join(SHELL_ROOT, 'assets/images/pl');

const iconSource = resolve(ROOT, 'pkg/harvester/assets/layersentry/layer-sentry-icon.svg');
const wordmarkSource = resolve(ROOT, 'pkg/harvester/assets/layersentry/layersentry-wordmark.svg');
const darkWordmarkSource = resolve(ROOT, 'pkg/harvester/assets/layersentry/layersentry-wordmark-dark.svg');
const landscapeSource = resolve(ROOT, 'pkg/harvester/assets/layersentry/layersentry-login-landscape.svg');

copyAsset(iconSource, join(providerAssetDirectory, 'harvester.svg'));
copyAsset(iconSource, join(privateLabelAssetDirectory, 'layersentry-favicon.svg'));
copyAsset(wordmarkSource, join(privateLabelAssetDirectory, 'layersentry-wordmark.svg'));
copyAsset(darkWordmarkSource, join(privateLabelAssetDirectory, 'dark/layersentry-wordmark.svg'));
copyAsset(landscapeSource, join(privateLabelAssetDirectory, 'login-landscape.svg'));
copyAsset(landscapeSource, join(privateLabelAssetDirectory, 'dark/login-landscape.svg'));

patchPrivateLabel(privateLabelPath);
patchLogin(loginPath);

if (existsSync(sideNavPath)) {
  patchVisibleFooter(sideNavPath);
}

process.stdout.write('LAYERSENTRY PACKAGED SHELL BRANDING V2: PASS\n');
