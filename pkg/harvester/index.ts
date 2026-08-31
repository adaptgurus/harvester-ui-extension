//@ts-nocheck
import { importTypes } from '@rancher/auto-import';
import { IPlugin } from '@shell/core/types';
import extensionRoutes from './routing/harvester-routing';
import harvesterCommonStore from './store/harvester-common';
import harvesterStore from './store/harvester-store';
import customValidators from './validators';
import { PRODUCT_NAME } from './config/harvester';
import layersentryEnUs from './l10n/layersentry-en-us';
import { defineAsyncComponent } from 'vue';
import './styles/vue-flow.scss';
import './styles/layersentry/index.scss';

// Init the package
export default function (plugin: IPlugin) {
  const isDev = process.env.NODE_ENV !== 'production';
  const isSingleVirtualCluster = process.env.rancherEnv === PRODUCT_NAME;

  // Auto-import model, detail, edit from the folders
  importTypes(plugin);

  // Apply a narrow LayerSentry presentation overlay after the upstream locale.
  // Translation keys remain harvester.* to preserve compatibility.
  plugin.register('l10n', 'en-us', () => layersentryEnUs);

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
