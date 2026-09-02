#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

function fail(message) {
  throw new Error(`LayerSentry operations UI validation failed: ${ message }`);
}

function read(path) {
  const fullPath = resolve(ROOT, path);

  if (!existsSync(fullPath)) {
    fail(`required file is missing: ${ path }`);
  }

  return readFileSync(fullPath, 'utf8');
}

function requireMarkers(source, name, markers) {
  for (const marker of markers) {
    if (!source.includes(marker)) {
      fail(`${ name } is missing marker: ${ marker }`);
    }
  }
}

function forbidMarkers(source, name, markers) {
  for (const marker of markers) {
    if (source.includes(marker)) {
      fail(`${ name } contains forbidden marker: ${ marker }`);
    }
  }
}

const dashboard = read('pkg/harvester/list/harvesterhci.io.dashboard.vue');
const locale = read('pkg/harvester/l10n/layersentry-en-us.yaml');
const tokens = read('pkg/harvester/styles/layersentry/_tokens.scss');
const components = read('pkg/harvester/styles/layersentry/_components.scss');
const theme = read('pkg/harvester/styles/layersentry/_theme.scss');
const upgradeHeader = read('pkg/harvester/components/HarvesterUpgradeHeader.vue');

requireMarkers(dashboard, 'dashboard', [
  'class="layersentry-dashboard"',
  'aria-labelledby="layersentry-dashboard-heading"',
  'class="layersentry-dashboard-header"',
  '<dl',
  ':aria-label="t(\'harvester.dashboard.glanceLabel\')"',
  `t('harvester.dashboard.events.hosts')`,
  `t('harvester.dashboard.events.virtualMachines')`,
  `t('harvester.dashboard.events.volumes')`,
  `t('harvester.dashboard.events.images')`,
  ':key="resource.resource"',
]);
forbidMarkers(dashboard, 'dashboard', [
  'label="Hosts"',
  'label="VMs"',
  'label="Volumes"',
  'label="Images"',
]);

requireMarkers(locale, 'locale overlay', [
  'operationalOverview: Operational overview',
  'glanceLabel: LayerSentry cluster release and creation details',
  'openStatus: Open LayerSentry upgrade status',
  'targetRelease: Target release',
  'managementVersion: Management plane',
]);

requireMarkers(tokens, 'design tokens', [
  'color-scheme: light',
  'color-scheme: dark',
  '--ls-status-positive:',
  '--ls-status-warning:',
  '--ls-status-critical:',
  '--ls-on-brand:',
]);

requireMarkers(components, 'component theme', [
  '.layersentry-dashboard-header',
  '.layersentry-eyebrow',
  '.layersentry-dashboard-description',
  'dt {',
  'dd {',
]);
forbidMarkers(components, 'component theme', [
  'linear-gradient(',
  'radial-gradient(',
  'conic-gradient(',
]);

requireMarkers(theme, 'accessibility theme', [
  '.layersentry-dashboard,',
  '.layersentry-dashboard :focus-visible',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
  'forced-color-adjust: auto',
]);

requireMarkers(upgradeHeader, 'upgrade header', [
  'class="upgrade-trigger"',
  `t('harvester.upgradePage.layersentryHeader.openStatus')`,
  'aria-live="polite"',
  `t('harvester.upgradePage.layersentryHeader.targetRelease')`,
  `t('harvester.upgradePage.layersentryHeader.managementVersion')`,
  'var(--ls-status-warning)',
]);
forbidMarkers(upgradeHeader, 'upgrade header', [
  'github.com/harvester/harvester/releases',
  ':href="releaseLink"',
  "t('product.rancher')",
]);

const credentialMarkers = [
  'bootstrap-credentials.json',
  'nodePassword',
  'clusterToken',
];
for (const [name, source] of [
  ['dashboard', dashboard],
  ['locale overlay', locale],
  ['design tokens', tokens],
  ['component theme', components],
  ['accessibility theme', theme],
  ['upgrade header', upgradeHeader],
]) {
  forbidMarkers(source, name, credentialMarkers);
}

process.stdout.write('LAYERSENTRY OPERATIONS UI, ACCESSIBILITY, AND CREDENTIAL-ISOLATION CONTRACT: PASS\n');
