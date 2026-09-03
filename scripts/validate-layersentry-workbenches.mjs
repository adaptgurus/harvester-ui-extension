#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

function fail(message) {
  throw new Error(`LayerSentry workbench validation failed: ${ message }`);
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

const runtime = read('pkg/harvester/utils/layersentry-branding.js');
const workbenches = read('pkg/harvester/styles/layersentry/_workbenches.scss');
const styleIndex = read('pkg/harvester/styles/layersentry/index.scss');

requireMarkers(runtime, 'route-aware runtime', [
  'const ROUTE_CONTEXTS = [',
  "view: 'hosts'",
  "title: 'Host Operations'",
  "view: 'vm-create'",
  "title: 'Virtual Machine Provisioner'",
  "view: 'image-create'",
  "title: 'Operating Image Registrar'",
  "view: 'storage'",
  "view: 'network'",
  "view: 'protection'",
  "view: 'observability'",
  "document.documentElement.setAttribute('data-layersentry-view', context.view)",
  "region.id = 'layersentry-route-context'",
  "region.setAttribute('role', 'region')",
  "region.setAttribute('aria-label', `${ context.title } context`)",
  "['IDENTITY', 'POLICY', 'CAPACITY', 'AUDIT']",
  "window.addEventListener('popstate', syncLayerSentryBrowserBranding)",
  'window.setInterval(syncLayerSentryBrowserBranding, ROUTE_SYNC_INTERVAL)',
]);

requireMarkers(workbenches, 'workbench design system', [
  '.layersentry-route-context {',
  '.layersentry-route-context__rail {',
  "html[data-layersentry-view='hosts'] .resource-table",
  "html[data-layersentry-view='vm-create'] .form-nav",
  "html[data-layersentry-view='image-create'] .form-nav",
  "html[data-layersentry-view='vm-create'] .form-container",
  "html[data-layersentry-view='image-create'] .form-container",
  "html[data-layersentry-view='vm-create'] main footer",
  "html[data-layersentry-view='image-create'] main footer",
  '@media (max-width: 1050px)',
  '@media (max-width: 720px)',
  '@media (forced-colors: active)',
  'forced-color-adjust: auto',
]);

requireMarkers(styleIndex, 'LayerSentry style entry', [
  "@import './workbenches';",
]);

forbidMarkers(`${ runtime }\n${ workbenches }`, 'workbench source', [
  'bootstrap-credentials.json',
  'nodePassword',
  'clusterToken',
  'adminPassword',
  'linear-gradient(',
  'radial-gradient(',
  'conic-gradient(',
]);

process.stdout.write('LAYERSENTRY HOST, VM, IMAGE, STORAGE, NETWORK, PROTECTION, AND OBSERVABILITY WORKBENCH CONTRACT: PASS\n');
