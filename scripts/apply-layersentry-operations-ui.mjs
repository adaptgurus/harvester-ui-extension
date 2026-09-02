#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(process.argv[2] || process.cwd());
const changed = [];

function fail(message) {
  throw new Error(`LayerSentry operations UI migration failed: ${ message }`);
}

function read(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function write(path, content) {
  const fullPath = resolve(ROOT, path);
  const current = readFileSync(fullPath, 'utf8');

  if (current !== content) {
    writeFileSync(fullPath, content, 'utf8');
    changed.push(path);
  }
}

function replaceRequired(source, search, replacement, description) {
  if (typeof search === 'string') {
    if (!source.includes(search)) {
      fail(`could not locate ${ description }`);
    }

    return source.replace(search, replacement);
  }

  if (!search.test(source)) {
    fail(`could not locate ${ description }`);
  }

  search.lastIndex = 0;

  return source.replace(search, replacement);
}

function updateDashboard() {
  const path = 'pkg/harvester/list/harvesterhci.io.dashboard.vue';
  let source = read(path);

  if (source.includes('class="layersentry-dashboard"')) {
    return;
  }

  source = replaceRequired(
    source,
    `    currentVersion() {`,
    `    dashboardClusterName() {\n      return this.currentCluster?.nameDisplay || this.currentCluster?.displayName || this.currentCluster?.id || this.t('generic.loading');\n    },\n\n    currentVersion() {`,
    'dashboard cluster-name computed property'
  );

  source = replaceRequired(
    source,
    `  <section v-else>\n    <HarvesterUpgrade />\n\n    <div\n      class="cluster-dashboard-glance"\n    >\n      <div>\n        <label>\n          {{ t('harvester.dashboard.version') }}:\n        </label>\n        <span>\n          <span v-clean-tooltip="{content: currentVersion}">\n            {{ currentVersion }}\n          </span>\n        </span>\n      </div>\n      <div>\n        <label>\n          {{ t('glance.created') }}:\n        </label>\n        <span>\n          <LiveDate\n            :value="firstNodeCreationTimestamp"\n            :add-suffix="true"\n            :show-tooltip="true"\n          />\n        </span>\n      </div>\n    </div>`,
    `  <section\n    v-else\n    class="layersentry-dashboard"\n    aria-labelledby="layersentry-dashboard-heading"\n  >\n    <HarvesterUpgrade />\n\n    <header class="layersentry-dashboard-header">\n      <div>\n        <p class="layersentry-eyebrow">\n          {{ t('harvester.dashboard.operationalOverview') }}\n        </p>\n        <h1 id="layersentry-dashboard-heading">\n          {{ t('harvester.dashboard.header', { cluster: dashboardClusterName }) }}\n        </h1>\n        <p class="layersentry-dashboard-description">\n          {{ t('harvester.dashboard.description') }}\n        </p>\n      </div>\n    </header>\n\n    <dl\n      class="cluster-dashboard-glance"\n      :aria-label="t('harvester.dashboard.glanceLabel')"\n    >\n      <div>\n        <dt>\n          {{ t('harvester.dashboard.version') }}\n        </dt>\n        <dd>\n          <span v-clean-tooltip="{content: currentVersion}">\n            {{ currentVersion }}\n          </span>\n        </dd>\n      </div>\n      <div>\n        <dt>\n          {{ t('glance.created') }}\n        </dt>\n        <dd>\n          <LiveDate\n            :value="firstNodeCreationTimestamp"\n            :add-suffix="true"\n            :show-tooltip="true"\n          />\n        </dd>\n      </div>\n    </dl>`,
    'dashboard introduction and semantic glance panel'
  );

  source = replaceRequired(
    source,
    `        v-for="(resource, i) in totalCountGaugeInput"\n        :key="i"`,
    `        v-for="resource in totalCountGaugeInput"\n        :key="resource.resource"`,
    'stable resource summary key'
  );

  source = replaceRequired(
    source,
    `      <h3 class="mt-40">\n        {{ t('clusterIndexPage.sections.capacity.label') }}\n      </h3>`,
    `      <h2 class="mt-40 section-heading">\n        {{ t('clusterIndexPage.sections.capacity.label') }}\n      </h2>`,
    'capacity heading hierarchy'
  );

  source = replaceRequired(
    source,
    `      <h3>\n        {{ t('clusterIndexPage.sections.events.label') }}\n      </h3>`,
    `      <h2 class="section-heading">\n        {{ t('clusterIndexPage.sections.events.label') }}\n      </h2>`,
    'events heading hierarchy'
  );

  const eventLabels = new Map([
    ['label="Hosts"', `:label="t('harvester.dashboard.events.hosts')"`],
    ['label="VMs"', `:label="t('harvester.dashboard.events.virtualMachines')"`],
    ['label="Volumes"', `:label="t('harvester.dashboard.events.volumes')"`],
    ['label="Images"', `:label="t('harvester.dashboard.events.images')"`],
  ]);

  for (const [from, to] of eventLabels) {
    source = replaceRequired(source, from, to, `localized dashboard event label ${ from }`);
  }

  source = replaceRequired(
    source,
    /<style lang="scss" scoped>[\s\S]*?<\/style>\s*$/,
    `<style lang="scss" scoped>\n.layersentry-dashboard {\n  min-width: 0;\n}\n\n.cluster-dashboard-glance {\n  display: flex;\n\n  > div {\n    min-width: 0;\n  }\n\n  dd {\n    font-weight: 700;\n    margin: 0;\n  }\n}\n\n.section-heading {\n  font-size: 20px;\n  line-height: 1.3;\n}\n\n.events {\n  margin-top: 30px;\n}\n</style>\n`,
    'dashboard scoped production styles'
  );

  write(path, source);
}

function updateLocale() {
  const path = 'pkg/harvester/l10n/layersentry-en-us.yaml';
  let source = read(path);

  if (!source.includes('    operationalOverview: Operational overview')) {
    source = replaceRequired(
      source,
      `  dashboard:\n    header: 'LayerSentry Cluster: {cluster}'\n    version: Platform version`,
      `  dashboard:\n    header: 'LayerSentry Cluster: {cluster}'\n    version: Platform version\n    operationalOverview: Operational overview\n    description: Real-time capacity, workload, network, storage, monitoring, and recent-event status for this cluster.\n    glanceLabel: LayerSentry cluster release and creation details\n    events:\n      hosts: Hosts\n      virtualMachines: Virtual machines\n      volumes: Volumes\n      images: Images`,
      'LayerSentry dashboard locale block'
    );
  }

  if (!source.includes('    layersentryHeader:')) {
    source = replaceRequired(
      source,
      `  upgrade:\n    releaseTip:`,
      `  upgradePage:\n    layersentryHeader:\n      openStatus: Open LayerSentry upgrade status\n      targetRelease: Target release\n      managementVersion: Management plane\n  upgrade:\n    releaseTip:`,
      'LayerSentry upgrade-header locale block'
    );
  }

  write(path, source);
}

function updateTokens() {
  const path = 'pkg/harvester/styles/layersentry/_tokens.scss';
  let source = read(path);

  if (!source.includes('--ls-status-warning:')) {
    source = replaceRequired(
      source,
      `:root {\n  --ls-brand-navy: #000f42;`,
      `:root {\n  color-scheme: light;\n  --ls-brand-navy: #000f42;`,
      'light color-scheme token'
    );
    source = replaceRequired(
      source,
      `  --ls-focus: #3457a8;`,
      `  --ls-focus: #3457a8;\n  --ls-status-positive: #157347;\n  --ls-status-warning: #9a6700;\n  --ls-status-critical: #b42318;\n  --ls-on-brand: #ffffff;`,
      'semantic status tokens'
    );
    source = replaceRequired(
      source,
      `body.theme-dark {\n  --ls-brand-line:`,
      `body.theme-dark {\n  color-scheme: dark;\n  --ls-brand-line:`,
      'dark color-scheme token'
    );
    source = replaceRequired(
      source,
      `  --ls-focus: #9eb0e0;`,
      `  --ls-focus: #9eb0e0;\n  --ls-status-positive: #54c892;\n  --ls-status-warning: #f1c75b;\n  --ls-status-critical: #ff8a80;`,
      'dark semantic status tokens'
    );
  }

  write(path, source);
}

function updateComponents() {
  const path = 'pkg/harvester/styles/layersentry/_components.scss';
  let source = read(path);

  if (!source.includes('.layersentry-dashboard-header')) {
    source = `.layersentry-dashboard-header {\n  align-items: flex-start;\n  border-bottom: 1px solid var(--ls-border);\n  display: flex;\n  gap: 24px;\n  justify-content: space-between;\n  margin-bottom: 18px;\n  padding: 2px 0 18px;\n\n  h1 {\n    font-size: 24px;\n    line-height: 1.25;\n    margin: 4px 0 0;\n  }\n\n  .layersentry-eyebrow {\n    color: var(--ls-brand-line);\n    font-size: 11px;\n    font-weight: 700;\n    letter-spacing: 0.08em;\n    margin: 0;\n    text-transform: uppercase;\n  }\n\n  .layersentry-dashboard-description {\n    color: var(--ls-text-muted);\n    line-height: 1.5;\n    margin: 8px 0 0;\n    max-width: 780px;\n  }\n}\n\n${ source }`;
  }

  source = source.replace(
    `  label {\n    color: var(--ls-text-muted);`,
    `  dt {\n    color: var(--ls-text-muted);`
  );
  source = source.replace(
    `  span {\n    color: var(--ls-text);\n  }`,
    `  dd {\n    color: var(--ls-text);\n    margin: 0;\n  }`
  );

  if (!source.includes('  .layersentry-dashboard-header h1 {')) {
    source = replaceRequired(
      source,
      `@media (max-width: 700px) {\n  .cluster-dashboard-glance {`,
      `@media (max-width: 700px) {\n  .layersentry-dashboard-header h1 {\n    font-size: 21px;\n  }\n\n  .cluster-dashboard-glance {`,
      'mobile dashboard heading style'
    );
  }

  write(path, source);
}

function updateTheme() {
  const path = 'pkg/harvester/styles/layersentry/_theme.scss';
  let source = read(path);

  if (!source.startsWith('.layersentry-dashboard,')) {
    source = `.layersentry-dashboard,\n${ source }`;
    source = source.replace(
      `.layersentry-branding h1,`,
      `.layersentry-dashboard h1,\n.layersentry-dashboard h2,\n.layersentry-dashboard h3,\n.layersentry-branding h1,`
    );
    source = source.replace(
      `.layersentry-branding a,`,
      `.layersentry-dashboard a,\n.layersentry-branding a,`
    );
    source = source.replace(
      `.cluster-dashboard-glance :focus-visible,`,
      `.layersentry-dashboard :focus-visible,\n.cluster-dashboard-glance :focus-visible,`
    );
    source = source.replace(
      `@media (prefers-reduced-motion: reduce) {\n  .cluster-dashboard-glance *,`,
      `@media (prefers-reduced-motion: reduce) {\n  .layersentry-dashboard *,\n  .cluster-dashboard-glance *,`
    );
  }

  if (!source.includes('@media (forced-colors: active)')) {
    source += `\n@media (forced-colors: active) {\n  .cluster-dashboard-glance,\n  .resource-gauges > *,\n  .hardware-resource-gauges > *,\n  .layersentry-branding .layersentry-brand-section,\n  .layersentry-support .box {\n    border: 1px solid CanvasText;\n    box-shadow: none;\n    forced-color-adjust: auto;\n  }\n\n  .cluster-dashboard-glance {\n    border-left-width: 4px;\n  }\n}\n`;
  }

  write(path, source);
}

function updateUpgradeHeader() {
  const path = 'pkg/harvester/components/HarvesterUpgradeHeader.vue';
  let source = read(path);

  if (source.includes('class="upgrade-trigger"')) {
    return;
  }

  source = replaceRequired(
    source,
    /\n    releaseLink\(\) \{\n      return `https:\/\/github\.com\/harvester\/harvester\/releases\/tag\/\$\{ this\.latestResource\?\.spec\?\.version \}`;\n    \},\n/,
    '\n',
    'upstream release-link computed property'
  );

  source = replaceRequired(
    source,
    `      <slot name="button-content">\n        <i class="warning icon-fw icon icon-dot-open dot-icon" />\n      </slot>`,
    `      <slot name="button-content">\n        <button\n          type="button"\n          class="upgrade-trigger"\n          :aria-label="t('harvester.upgradePage.layersentryHeader.openStatus')"\n        >\n          <i\n            aria-hidden="true"\n            class="warning icon-fw icon icon-dot-open dot-icon"\n          />\n        </button>\n      </slot>`,
    'semantic upgrade status trigger'
  );

  source = replaceRequired(
    source,
    `        <div class="upgrade-info mb-10">`,
    `        <div\n          class="upgrade-info mb-10"\n          aria-live="polite"\n        >`,
    'upgrade live-status region'
  );

  source = replaceRequired(
    source,
    `                <a\n                  :href="releaseLink"\n                  target="_blank"\n                >{{ upgradeVersion }}</a>`,
    `                <p class="release-version">\n                  <span>{{ t('harvester.upgradePage.layersentryHeader.targetRelease') }}</span>\n                  <strong>{{ upgradeVersion }}</strong>\n                </p>`,
    'controlled target-release presentation'
  );

  source = replaceRequired(
    source,
    `{{ t('product.rancher') }}: <span class="text-muted">{{ repoInfo.release.rancher }}</span>`,
    `{{ t('harvester.upgradePage.layersentryHeader.managementVersion') }}: <span class="text-muted">{{ repoInfo.release.rancher }}</span>`,
    'LayerSentry management-plane label'
  );

  source = replaceRequired(
    source,
    `a {\n  float: right;\n  color: var(--link) !important;\n  text-decoration: none;\n}\n\n`,
    `.release-version {\n  align-items: baseline;\n  display: flex;\n  gap: 8px;\n  justify-content: flex-end;\n  margin: 0 0 12px;\n\n  span {\n    color: var(--ls-text-muted);\n  }\n}\n\n`,
    'release-version styling'
  );

  source = replaceRequired(
    source,
    `  .dot-icon {\n    font-size: 24px;\n    vertical-align: middle;\n    color: #00a483;\n  }`,
    `  .upgrade-trigger {\n    align-items: center;\n    background: transparent;\n    border: 0;\n    border-radius: var(--ls-radius-sm);\n    color: inherit;\n    cursor: pointer;\n    display: inline-flex;\n    height: 40px;\n    justify-content: center;\n    padding: 0;\n    width: 40px;\n  }\n\n  .upgrade-trigger:focus-visible {\n    outline: 2px solid var(--ls-focus);\n    outline-offset: 2px;\n  }\n\n  .dot-icon {\n    color: var(--ls-status-warning);\n    font-size: 24px;\n    pointer-events: none;\n    vertical-align: middle;\n  }`,
    'upgrade trigger production styling'
  );

  source += `\n<style lang="scss">\n@media (max-width: 700px) {\n  .upgrade-header-dropdown .upgrade-info {\n    min-width: min(550px, calc(100vw - 32px));\n  }\n}\n</style>\n`;

  write(path, source);
}

function updatePackageScript() {
  const path = 'package.json';
  let source = read(path);

  if (!source.includes('validate-layersentry-operations-ui.mjs')) {
    source = replaceRequired(
      source,
      `"validate:layersentry": "node scripts/validate-layersentry-branding.mjs --source-only"`,
      `"validate:layersentry": "node scripts/validate-layersentry-branding.mjs --source-only && node scripts/validate-layersentry-operations-ui.mjs"`,
      'LayerSentry validation script command'
    );
  }

  write(path, source);
}

updateDashboard();
updateLocale();
updateTokens();
updateComponents();
updateTheme();
updateUpgradeHeader();
updatePackageScript();

process.stdout.write(`${ JSON.stringify({ changed }, null, 2) }\n`);
