import { MANAGEMENT } from '@shell/config/types';
import { SETTING } from '@shell/config/settings';
import { getVendor, setVendor } from '@shell/config/private-label';
import * as harvesterCluster from './harvester-cluster';

const LAYERSENTRY_VENDOR = 'LayerSentry';
const UPSTREAM_DEFAULT_VENDOR = 'Harvester';
const LAYERSENTRY_LOGO = require('../assets/layersentry/layer-sentry-icon.svg');

function hasConfiguredLogo(store) {
  const settings = store.getters['management/all']?.(MANAGEMENT.SETTING) || [];

  return settings.some((setting) =>
    [SETTING.LOGO_DARK, SETTING.LOGO_LIGHT].includes(setting.id) && !!setting.value
  );
}

export function syncLayerSentrySingleProductBranding(store) {
  const current = store.getters['isSingleProduct'];

  if (!current || typeof current !== 'object') {
    return;
  }

  let vendor = getVendor();

  if (!vendor || vendor === UPSTREAM_DEFAULT_VENDOR) {
    setVendor(LAYERSENTRY_VENDOR);
    vendor = LAYERSENTRY_VENDOR;
  }

  const hasCustomVendor = vendor !== LAYERSENTRY_VENDOR;
  const supportCustomLogo = hasConfiguredLogo(store) || hasCustomVendor;

  store.dispatch('setIsSingleProduct', {
    ...current,
    logo: LAYERSENTRY_LOGO,
    supportCustomLogo
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
