<script>
import { mapGetters } from 'vuex';
import { PLUGIN_DEVELOPER, DEV } from '@shell/store/prefs';
import BannerGraphic from '@shell/components/BannerGraphic';
import IndentedPanel from '@shell/components/IndentedPanel';
import { SCHEMA } from '@shell/config/types';
import HarvesterSupportBundle from '../../../../dialog/HarvesterSupportBundle';
import { HCI } from '../../../../types';

export default {
  components: {
    BannerGraphic,
    IndentedPanel,
    HarvesterSupportBundle
  },

  computed: {
    ...mapGetters(['currentCluster']),

    dev() {
      try {
        return this.$store.getters['prefs/get'](PLUGIN_DEVELOPER);
      } catch {
        return this.$store.getters['prefs/get'](DEV);
      }
    },

    showSupportBundle() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return !!this.$store.getters[`${ inStore }/byId`](
        SCHEMA,
        HCI.SUPPORT_BUNDLE
      );
    },

    clusterLabel() {
      return this.currentCluster?.nameDisplay ||
        this.currentCluster?.name ||
        this.currentCluster?.id ||
        this.t('layersentrySupport.context.unavailable');
    },

    serverVersion() {
      const getVersion = this.$store.getters['harvester-common/getServerVersion'];

      return (typeof getVersion === 'function' && getVersion()) ||
        this.t('layersentrySupport.context.unavailable');
    },

    internalPrefix() {
      const origin = window.location.origin;
      const prefix = window.location.pathname.replace(this.$route.path, '');
      const params = this.$route?.params;

      return {
        origin, prefix, params
      };
    },

    managementDiagnosticsLink() {
      const { origin, prefix, params } = this.internalPrefix;

      return `${ origin }${ prefix }/c/${ params.cluster }/explorer`;
    },

    storageDiagnosticsLink() {
      const { origin, params } = this.internalPrefix;

      return `${ origin }/k8s/clusters/${ params.cluster }/api/v1/namespaces/longhorn-system/services/http:longhorn-frontend:80/proxy/#/dashboard`;
    },
  },

  methods: {
    openSupportBundle() {
      this.$store.commit('harvester-common/toggleBundleModal', true);
    },
  }
};
</script>

<template>
  <div class="layersentry-support">
    <BannerGraphic :title="t('layersentrySupport.title')" />

    <IndentedPanel>
      <div class="content mt-20">
        <section
          class="support-overview"
          aria-labelledby="layersentry-support-overview-title"
        >
          <div class="support-intro">
            <h2 id="layersentry-support-overview-title">
              {{ t('layersentrySupport.overview.title') }}
            </h2>
            <p>
              {{ t('layersentrySupport.overview.description') }}
            </p>
          </div>

          <dl
            class="support-context"
            :aria-label="t('layersentrySupport.context.label')"
          >
            <div>
              <dt>{{ t('layersentrySupport.context.cluster') }}</dt>
              <dd>{{ clusterLabel }}</dd>
            </div>
            <div>
              <dt>{{ t('layersentrySupport.context.version') }}</dt>
              <dd>{{ serverVersion }}</dd>
            </div>
          </dl>
        </section>

        <section
          class="support-actions"
          :aria-label="t('layersentrySupport.actions.label')"
        >
          <article
            v-if="showSupportBundle"
            class="box box-primary"
          >
            <h2>
              {{ t('layersentrySupport.actions.bundle.title') }}
            </h2>
            <p id="layersentry-support-bundle-description">
              {{ t('layersentrySupport.actions.bundle.description') }}
            </p>
            <button
              class="btn role-secondary btn-sm"
              type="button"
              aria-describedby="layersentry-support-bundle-description"
              @click="openSupportBundle"
            >
              {{ t('layersentrySupport.actions.bundle.action') }}
            </button>
          </article>

          <article class="box box-primary">
            <h2>
              {{ t('layersentrySupport.actions.kubeconfig.title') }}
            </h2>
            <p id="layersentry-kubeconfig-description">
              {{ t('layersentrySupport.actions.kubeconfig.description') }}
            </p>
            <button
              class="btn role-secondary btn-sm"
              type="button"
              aria-describedby="layersentry-kubeconfig-description"
              @click="currentCluster.downloadKubeConfig()"
            >
              {{ t('layersentrySupport.actions.kubeconfig.action') }}
            </button>
          </article>

          <article class="box">
            <h2>
              {{ t('layersentrySupport.actions.readiness.title') }}
            </h2>
            <p>
              {{ t('layersentrySupport.actions.readiness.description') }}
            </p>
            <ul class="support-checklist">
              <li>{{ t('layersentrySupport.actions.readiness.nodes') }}</li>
              <li>{{ t('layersentrySupport.actions.readiness.storage') }}</li>
              <li>{{ t('layersentrySupport.actions.readiness.network') }}</li>
              <li>{{ t('layersentrySupport.actions.readiness.backup') }}</li>
            </ul>
          </article>

          <article class="box">
            <h2>
              {{ t('layersentrySupport.actions.changeControl.title') }}
            </h2>
            <p>
              {{ t('layersentrySupport.actions.changeControl.description') }}
            </p>
            <p class="support-emphasis">
              {{ t('layersentrySupport.actions.changeControl.warning') }}
            </p>
          </article>
        </section>

        <section
          v-if="dev"
          class="support-diagnostics"
          aria-labelledby="layersentry-support-diagnostics-title"
        >
          <h2 id="layersentry-support-diagnostics-title">
            {{ t('layersentrySupport.diagnostics.title') }}
          </h2>
          <p>
            {{ t('layersentrySupport.diagnostics.description') }}
          </p>

          <div class="support-diagnostics-grid">
            <a
              class="diagnostic-link"
              rel="nofollow noopener noreferrer"
              target="_blank"
              :href="managementDiagnosticsLink"
            >
              <span>
                {{ t('layersentrySupport.diagnostics.management.title') }}
              </span>
              <small>
                {{ t('layersentrySupport.diagnostics.management.description') }}
              </small>
            </a>
            <a
              class="diagnostic-link"
              rel="nofollow noopener noreferrer"
              target="_blank"
              :href="storageDiagnosticsLink"
            >
              <span>
                {{ t('layersentrySupport.diagnostics.storage.title') }}
              </span>
              <small>
                {{ t('layersentrySupport.diagnostics.storage.description') }}
              </small>
            </a>
          </div>
        </section>

        <div
          class="support-security-note"
          role="note"
        >
          <strong>{{ t('layersentrySupport.security.title') }}</strong>
          <span>{{ t('layersentrySupport.security.description') }}</span>
        </div>
      </div>
    </IndentedPanel>

    <HarvesterSupportBundle v-if="showSupportBundle" />
  </div>
</template>

<style lang="scss" scoped>
.content {
  display: grid;
  gap: 20px;
  max-width: 1120px;
}

.support-overview {
  align-items: start;
  border-bottom: 1px solid var(--ls-border);
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.45fr);
  padding-bottom: 20px;
}

.support-intro {
  h2 {
    color: var(--ls-text);
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  p {
    color: var(--ls-text-muted);
    line-height: 1.55;
    margin: 0;
    max-width: 760px;
  }
}

.support-context {
  background: var(--ls-surface);
  border: 1px solid var(--ls-border);
  border-left: 3px solid var(--ls-brand-line);
  border-radius: var(--ls-radius-sm);
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 16px;

  > div {
    min-width: 0;
  }

  dt {
    color: var(--ls-text-muted);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    margin-bottom: 3px;
    text-transform: uppercase;
  }

  dd {
    color: var(--ls-text);
    font-weight: 600;
    margin: 0;
    overflow-wrap: anywhere;
  }
}

.support-actions {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.box {
  background: var(--ls-surface);
  border: 1px solid var(--ls-border);
  border-radius: var(--ls-radius-sm);
  display: flex;
  flex-direction: column;
  min-height: 210px;
  padding: 20px;

  &.box-primary {
    border-top: 3px solid var(--ls-brand-line);
  }

  h2 {
    color: var(--ls-text);
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 10px;
  }

  p {
    color: var(--ls-text-muted);
    line-height: 1.5;
    margin: 0 0 14px;
  }

  .btn {
    align-self: flex-start;
    margin-top: auto;
  }
}

.support-checklist {
  color: var(--ls-text);
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 20px;
}

.support-emphasis {
  border-left: 3px solid var(--warning);
  color: var(--ls-text) !important;
  font-weight: 600;
  padding-left: 10px;
}

.support-diagnostics {
  border-top: 1px solid var(--ls-border);
  padding-top: 20px;

  > h2 {
    color: var(--ls-text);
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  > p {
    color: var(--ls-text-muted);
    margin: 0 0 14px;
  }
}

.support-diagnostics-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.diagnostic-link {
  background: var(--ls-surface);
  border: 1px solid var(--ls-border);
  border-radius: var(--ls-radius-sm);
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  text-decoration: none;

  &:hover {
    border-color: var(--ls-border-strong);
  }

  &:focus-visible {
    outline: 3px solid var(--ls-focus);
    outline-offset: 2px;
  }

  span {
    color: var(--link);
    font-weight: 600;
  }

  small {
    color: var(--ls-text-muted);
    line-height: 1.4;
  }
}

.support-security-note {
  align-items: flex-start;
  background: var(--ls-brand-soft);
  border-left: 3px solid var(--ls-brand-line);
  color: var(--ls-text);
  display: flex;
  gap: 8px;
  line-height: 1.45;
  padding: 14px 16px;

  strong {
    flex: 0 0 auto;
  }
}

@media (max-width: 900px) {
  .support-overview,
  .support-actions,
  .support-diagnostics-grid {
    grid-template-columns: 1fr;
  }

  .box {
    min-height: 0;
  }
}

@media (max-width: 600px) {
  .support-security-note {
    display: grid;
  }
}
</style>
