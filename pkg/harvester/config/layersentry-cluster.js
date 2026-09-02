import { getVendor, setVendor } from '@shell/config/private-label';
import * as harvesterCluster from './harvester-cluster';

const LAYERSENTRY_VENDOR = 'LayerSentry';
const UPSTREAM_DEFAULT_VENDOR = 'Harvester';
const LAYERSENTRY_LOGO = require('../assets/layersentry/layer-sentry-logo.svg');

export function syncLayerSentrySingleProductBranding(store) {
  const current = store.getters['isSingleProduct'];

  if (!current || typeof current !== 'object') {
    return;
  }

  const vendor = getVendor();

  if (!vendor || vendor === UPSTREAM_DEFAULT_VENDOR) {
    setVendor(LAYERSENTRY_VENDOR);
  }

  store.dispatch('setIsSingleProduct', {
    ...current,
    logo:              LAYERSENTRY_LOGO,
    supportCustomLogo: true,
  });
}

export const PRODUCT_NAME = harvesterCluster.PRODUCT_NAME;
export const IP_POOL_HEADERS = harvesterCluster.IP_POOL_HEADERS;

export function init($plugin, store) {
  harvesterCluster.init($plugin, store);

  if (process.env.rancherEnv === PRODUCT_NAME) {
    syncLayerSentrySingleProductBranding(store);
  }
}
