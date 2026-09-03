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

function fail(message) {
  throw new Error(`LayerSentry shell branding failed: ${ message }`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function replaceRequired(path, before, after, marker) {
  const source = readFileSync(path, 'utf8');

  if (source.includes(marker)) {
    return;
  }

  assert(source.includes(before), `expected source contract was not found in ${ path }`);
  writeFileSync(path, source.replace(before, after), 'utf8');
}

function copyAsset(sourcePath, destinationPath) {
  assert(existsSync(sourcePath), `source asset is missing: ${ sourcePath }`);
  mkdirSync(dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);
}

assert(existsSync(PACKAGE_ROOT), 'the locked @rancher/shell package is not installed');
assert(SHELL_ROOT, 'could not locate the @rancher/shell source root');

const privateLabelPath = join(SHELL_ROOT, 'config/private-label.js');
const loginPath = join(SHELL_ROOT, 'pages/auth/login.vue');
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

replaceRequired(
  privateLabelPath,
  `export function setTitle() {
  const v = getVendor();

  if (v === 'Harvester') {
    const ico = requireAsset(\`~shell/assets/images/pl/harvester.png\`);

    document.title = 'Harvester';
    const link = document.createElement('link');

    link.hid = 'icon';
    link.rel = 'icon';
    link.type = 'image/x-icon';
    link.hrefv = ico;
    const head = document.getElementsByTagName('head')[0];

    head.appendChild(link);
  }
}`,
  `export function setTitle() {
  const v = getVendor();

  if (v === 'Harvester' || v === 'LayerSentry') {
    const isLayerSentry = v === 'LayerSentry';
    const ico = isLayerSentry
      ? requireAsset(\`~shell/assets/images/pl/layersentry-favicon.svg\`)
      : requireAsset(\`~shell/assets/images/pl/harvester.png\`);

    document.title = isLayerSentry ? 'LayerSentry' : 'Harvester';
    let link = document.querySelector('link[rel~="icon"]');

    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }

    link.hid = 'icon';
    link.type = isLayerSentry ? 'image/svg+xml' : 'image/x-icon';
    link.href = ico;
  }
}`,
  "layersentry-favicon.svg"
);

replaceRequired(
  loginPath,
  `      vendor:             getVendor()
`,
  `      vendor:             getVendor() === 'Harvester' ? 'LayerSentry' : getVendor()
`,
  "vendor:             getVendor() === 'Harvester' ? 'LayerSentry' : getVendor()"
);

replaceRequired(
  loginPath,
  `      if (plSetting.value?.length && plSetting.value !== getVendor()) {
        setVendor(plSetting.value);
      }
`,
  `      const resolvedVendor = ['Harvester', 'Rancher'].includes(plSetting.value) ? 'LayerSentry' : plSetting.value;

      if (resolvedVendor?.length && resolvedVendor !== getVendor()) {
        setVendor(resolvedVendor);
      }
`,
  'const resolvedVendor ='
);

replaceRequired(
  loginPath,
  `    brandLogo() {
      return this.customizations.logo;
    }
`,
  `    brandLogo() {
      return this.customizations.logo || 'layersentry-wordmark.svg';
    }
`,
  "this.customizations.logo || 'layersentry-wordmark.svg'"
);

process.stdout.write('LAYERSENTRY SHELL BRANDING PATCH: PASS\n');
