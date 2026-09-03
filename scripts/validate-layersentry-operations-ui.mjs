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

const legacyDashboard = read('pkg/harvester/list/harvesterhci.io.dashboard.vue');
const operationsDashboard = read('pkg/harvester/components/layersentry/OperationsDashboard.vue');
const resourceRoute = read('pkg/harvester/pages/c/_cluster/_resource/index.vue');
const locale = read('pkg/harvester/l10n/layersentry-en-us.yaml');
const operationsLocale = read('pkg/harvester/l10n/layersentry-operations-en-us.yaml');
const tokens = read('pkg/harvester/styles/layersentry/_tokens.scss');
const components = read('pkg/harvester/styles/layersentry/_components.scss');
const shell = read('pkg/harvester/styles/layersentry/_shell.scss');
const theme = read('pkg/harvester/styles/layersentry/_theme.scss');
const upgradeHeader = read('pkg/harvester/components/HarvesterUpgradeHeader.vue');
const browserBranding = read('pkg/harvester/utils/layersentry-branding.js');
const shellPatch = read('scripts/apply-layersentry-shell-branding-v2.mjs');

// Keep the upstream-compatible dashboard implementation intact for resource and
// model compatibility, but require the customer route to select LayerSentry's
// advanced control plane explicitly.
requireMarkers(legacyDashboard, 'compatibility dashboard', [
  'class="layersentry-dashboard"',
  ':key="resource.resource"',
]);

requireMarkers(resourceRoute, 'dashboard route adapter', [
  "const LAYERSENTRY_DASHBOARD_RESOURCE = 'harvesterhci.io.dashboard'",
  "import OperationsDashboard from '../../../../components/layersentry/OperationsDashboard.vue'",
  'OperationsDashboard v-if="isLayerSentryDashboard"',
  '<ResourceList v-else />',
]);

requireMarkers(operationsDashboard, 'operations dashboard', [
  'name:       \'LayerSentryOperationsDashboard\'',
  'data-testid="layersentry-operations-dashboard"',
  'class="layersentry-command-header"',
  `t('harvester.dashboard.commandCenter.title')`,
  'class="layersentry-quick-actions"',
  'class="layersentry-posture-grid"',
  'class="layersentry-resource-grid"',
  'class="layersentry-capacity-grid"',
  'class="layersentry-event-list"',
  'recentWarningEvents',
  'runningVmCount',
  'storageStats',
  'createRoute(resource)',
  'listRoute(resource)',
  'aria-live="polite"',
]);
forbidMarkers(operationsDashboard, 'operations dashboard', [
  'linear-gradient(',
  'radial-gradient(',
  'conic-gradient(',
  'label="Hosts"',
  'label="VMs"',
]);

requireMarkers(locale, 'branding locale overlay', [
  'operationalOverview: Operational overview',
  'openStatus: Open LayerSentry upgrade status',
  'targetRelease: Target release',
  'managementVersion: Management plane',
]);

requireMarkers(operationsLocale, 'operations locale overlay', [
  'harvester: LayerSentry',
  'label: Control Plane',
  'title: Operations Control Plane',
  'title: Launch operations',
  'title: Operational readiness',
  'title: Managed resources',
  'title: Capacity and consumption',
  'title: Recent platform activity',
  'Sign in to LayerSentry',
]);

requireMarkers(tokens, 'design tokens', [
  'color-scheme: light',
  'color-scheme: dark',
  '--ls-accent:',
  '--ls-nav-bg:',
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

requireMarkers(shell, 'product shell theme', [
  "html[data-product-brand='layersentry']",
  "html[data-product-brand='layersentry'] .side-nav",
  "html[data-product-brand='layersentry'] [data-testid='header']",
  "html[data-product-brand='layersentry'] .login",
  "html[data-product-brand='layersentry'] table thead th",
  "html[data-product-brand='layersentry'] input:not([type='checkbox'])",
  '.btn.role-primary',
  '@media (prefers-reduced-motion: reduce)',
]);
forbidMarkers(`${ components }\n${ shell }`, 'production shell styles', [
  'linear-gradient(',
  'radial-gradient(',
  'conic-gradient(',
]);

requireMarkers(theme, 'accessibility theme', [
  '.layersentry-control-plane,',
  '.layersentry-control-plane :focus-visible',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
  'forced-color-adjust: auto',
]);

requireMarkers(browserBranding, 'browser branding runtime', [
  "export const LAYERSENTRY_VENDOR = 'LayerSentry'",
  "new Set(['', 'Rancher', 'Harvester'])",
  "document.documentElement.setAttribute('data-product-brand', 'layersentry')",
  'document.title = title',
  'MutationObserver',
  'data-layersentry-default-favicon',
]);

requireMarkers(shellPatch, 'locked shell branding patch', [
  "const PATCH_MARKER = 'LayerSentry packaged shell branding'",
  'layersentry-wordmark.svg',
  'layersentry-wordmark-dark.svg',
  'layersentry-login-landscape.svg',
  "copyAsset(iconSource, join(providerAssetDirectory, 'harvester.svg'))",
  'replaceFunction(source, \'setTitle\'',
  "link.href = ico",
  "this.customizations.logo || 'layersentry-wordmark.svg'",
  "['Harvester', 'Rancher'].includes(plSetting.value)",
  '(LayerSentry-{{ harvesterVersion }})',
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
  'adminPassword',
];
for (const [name, source] of [
  ['compatibility dashboard', legacyDashboard],
  ['operations dashboard', operationsDashboard],
  ['route adapter', resourceRoute],
  ['branding locale overlay', locale],
  ['operations locale overlay', operationsLocale],
  ['design tokens', tokens],
  ['component theme', components],
  ['product shell theme', shell],
  ['accessibility theme', theme],
  ['upgrade header', upgradeHeader],
  ['browser branding runtime', browserBranding],
  ['shell branding patch', shellPatch],
]) {
  forbidMarkers(source, name, credentialMarkers);
}

process.stdout.write('LAYERSENTRY ADVANCED OPERATIONS UI, ACCESSIBILITY, AND CREDENTIAL-ISOLATION CONTRACT: PASS\n');
