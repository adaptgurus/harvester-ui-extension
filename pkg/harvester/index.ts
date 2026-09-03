//@ts-nocheck
import { importTypes } from '@rancher/auto-import';
import { IPlugin } from '@shell/core/types';
import { mergeWithReplace } from '@shell/utils/object';
import extensionRoutes from './routing/harvester-routing';
import harvesterCommonStore from './store/harvester-common';
import harvesterStore from './store/harvester-store';
import customValidators from './validators';
import { PRODUCT_NAME } from './config/harvester';
import { installLayerSentryBrowserBranding } from './utils/layersentry-branding';
import { brandLayerSentryLocale } from './utils/layersentry-locale';
import { defineAsyncComponent } from 'vue';
import './styles/vue-flow.scss';
import './styles/layersentry/index.scss';

// Apply the packaged product identity before login and shell components render.
// Explicit administrator private-label values remain authoritative.
installLayerSentryBrowserBranding();

// Init the package
export default function (plugin: IPlugin) {
  const isDev = process.env.NODE_ENV !== 'production';
  const isSingleVirtualCluster = process.env.rancherEnv === PRODUCT_NAME;

  // Auto-import model, detail, edit from the folders
  importTypes(plugin);

  // Merge LayerSentry presentation and operations copy into the complete locale.
  // Translation keys remain harvester.* where compatibility requires them, while
  // every customer-visible value is normalized to the LayerSentry product name.
  const baseEnUs = require('./l10n/en-us.yaml');
  const layersentryEnUs = require('./l10n/layersentry-en-us.yaml');
  const operationsEnUs = require('./l10n/layersentry-operations-en-us.yaml');
  const brandedEnUs = mergeWithReplace(baseEnUs, layersentryEnUs, { mutateOriginal: false });
  const mergedEnUs = mergeWithReplace(brandedEnUs, operationsEnUs, { mutateOriginal: false });
  const customerEnUs = brandLayerSentryLocale(mergedEnUs);

  plugin.register('l10n', 'en-us', customerEnUs);

  // Provide plugin metadata from package.json
  plugin.metadata = require('./package.json');

  // Built-in icon
  plugin.metadata.icon = require('./icon.svg');

  plugin.addProduct(require('./config/layersentry-cluster'));

  plugin.addDashboardStore(harvesterCommonStore.config.namespace, harvesterCommonStore.specifics, harvesterCommonStore.config);
  plugin.addDashboardStore(harvesterStore.config.namespace, harvesterStore.specifics, harvesterStore.config, harvesterStore.init);
  plugin.validators = customValidators;

  plugin.addRoutes(extensionRoutes);

  plugin.register('component', 'NavHeaderRight', defineAsyncComponent(() =>
    import('./components/HarvesterUpgradeHeader.vue')
  ));
}
