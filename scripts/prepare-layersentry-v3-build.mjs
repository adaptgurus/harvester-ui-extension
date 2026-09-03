#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const changed = [];

function fail(message) {
  throw new Error(`LayerSentry v3 build preparation failed: ${ message }`);
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

function writeIfChanged(path, before, after) {
  if (after === before) {
    return;
  }

  writeFileSync(resolve(ROOT, path), after, 'utf8');
  changed.push(path);
}

function replaceRequired(source, pattern, replacement, description) {
  const next = source.replace(pattern, replacement);

  assert(next !== source, `could not apply ${ description }`);

  return next;
}

function preparePackage() {
  const path = 'package.json';
  const before = read(path);
  const pkg = JSON.parse(before);

  pkg.scripts = pkg.scripts || {};
  pkg.scripts['validate:layersentry'] = 'node scripts/validate-layersentry-v3.mjs --source-only';
  pkg.scripts.postinstall = 'node scripts/apply-layersentry-shell-branding-v3.mjs';

  const after = `${ JSON.stringify(pkg, null, 2) }\n`;

  writeIfChanged(path, before, after);
}

function preparePluginEntry() {
  const path = 'pkg/harvester/index.ts';
  const before = read(path);
  let after = before;

  if (!after.includes("import { brandLayerSentryLocale } from './utils/layersentry-locale';")) {
    after = replaceRequired(
      after,
      "import { installLayerSentryBrowserBranding } from './utils/layersentry-branding';",
      "import { installLayerSentryBrowserBranding } from './utils/layersentry-branding';\nimport { brandLayerSentryLocale } from './utils/layersentry-locale';",
      'recursive locale-branding import'
    );
  }

  if (!after.includes("const operationsEnUs = require('./l10n/layersentry-operations-en-us.yaml');")) {
    after = replaceRequired(
      after,
      "const layersentryEnUs = require('./l10n/layersentry-en-us.yaml');",
      "const layersentryEnUs = require('./l10n/layersentry-en-us.yaml');\n  const operationsEnUs = require('./l10n/layersentry-operations-en-us.yaml');",
      'operations locale import'
    );
  }

  if (!after.includes('const customerEnUs = brandLayerSentryLocale(mergedEnUs);')) {
    if (!after.includes('const mergedEnUs = mergeWithReplace(brandedEnUs, operationsEnUs')) {
      after = replaceRequired(
        after,
        /const mergedEnUs = mergeWithReplace\(baseEnUs, layersentryEnUs, \{ mutateOriginal: false \}\);/,
        "const brandedEnUs = mergeWithReplace(baseEnUs, layersentryEnUs, { mutateOriginal: false });\n  const mergedEnUs = mergeWithReplace(brandedEnUs, operationsEnUs, { mutateOriginal: false });",
        'operations locale merge'
      );
    }

    after = replaceRequired(
      after,
      "plugin.register('l10n', 'en-us', mergedEnUs);",
      "const customerEnUs = brandLayerSentryLocale(mergedEnUs);\n\n  plugin.register('l10n', 'en-us', customerEnUs);",
      'recursive locale registration'
    );
  }

  writeIfChanged(path, before, after);
}

function prepareBaseLocale() {
  const path = 'pkg/harvester/l10n/en-us.yaml';
  const before = read(path);
  const replacements = [
    [/\bSUSE Harvester\b/g, 'LayerSentry'],
    [/\bHarvester HCI\b/g, 'LayerSentry'],
    [/\bRancher Dashboard\b/g, 'LayerSentry Console'],
    [/\bRancher Manager\b/g, 'LayerSentry Management Plane'],
    [/\bHarvester\b/g, 'LayerSentry'],
    [/\bRancher\b/g, 'LayerSentry'],
  ];
  const after = replacements.reduce(
    (source, [pattern, replacement]) => source.replace(pattern, replacement),
    before
  );

  writeIfChanged(path, before, after);
}

function verifyPreparedSource() {
  const pkg = JSON.parse(read('package.json'));
  const index = read('pkg/harvester/index.ts');
  const locale = read('pkg/harvester/l10n/en-us.yaml');

  assert(
    pkg.scripts?.postinstall === 'node scripts/apply-layersentry-shell-branding-v3.mjs',
    'v3 postinstall hook is not active'
  );
  assert(
    pkg.scripts?.['validate:layersentry'] === 'node scripts/validate-layersentry-v3.mjs --source-only',
    'v3 validation hook is not active'
  );
  assert(index.includes('brandLayerSentryLocale(mergedEnUs)'), 'recursive locale branding is not registered');
  assert(index.includes('layersentry-operations-en-us.yaml'), 'operations locale is not registered');
  assert(!/\bHarvester\b/.test(locale), 'base customer locale still contains a standalone Harvester product name');
}

preparePackage();
preparePluginEntry();
prepareBaseLocale();
verifyPreparedSource();

const manifest = {
  schemaVersion: '1.0',
  product:       'LayerSentry',
  preparation:   'v3',
  sourceCommit:  process.env.GITHUB_SHA || null,
  changed,
  digests:       {},
};

for (const path of [
  'package.json',
  'pkg/harvester/index.ts',
  'pkg/harvester/l10n/en-us.yaml',
  'scripts/apply-layersentry-shell-branding-v3.mjs',
  'scripts/validate-layersentry-v3.mjs',
]) {
  const hash = createHash('sha256');

  hash.update(readFileSync(resolve(ROOT, path)));
  manifest.digests[path] = hash.digest('hex');
}

mkdirSync(resolve(ROOT, '.layersentry-build'), { recursive: true });
writeFileSync(
  resolve(ROOT, '.layersentry-build/preparation-manifest.json'),
  `${ JSON.stringify(manifest, null, 2) }\n`,
  'utf8'
);

process.stdout.write(`${ JSON.stringify(manifest, null, 2) }\n`);
process.stdout.write('LAYERSENTRY V3 DETERMINISTIC BUILD PREPARATION: PASS\n');
