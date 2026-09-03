<script>
import dayjs from 'dayjs';
import minMax from 'dayjs/plugin/minMax';
import utc from 'dayjs/plugin/utc';
import { mapGetters } from 'vuex';
import Loading from '@shell/components/Loading';
import Banner from '@components/Banner/Banner.vue';
import MessageLink from '@shell/components/MessageLink';
import DashboardMetrics from '@shell/components/DashboardMetrics';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import metricPoller from '@shell/mixins/metric-poller';
import { allDashboardsExist } from '@shell/utils/grafana';
import { allHash, setPromiseResult } from '@shell/utils/promise';
import { exponentNeeded, formatSi, parseSi, UNITS } from '@shell/utils/units';
import {
  EVENT,
  LONGHORN,
  METRIC,
  NETWORK_ATTACHMENT,
  NODE,
  PVC
} from '@shell/config/types';
import { HCI } from '../../types';
import HarvesterUpgrade from '../HarvesterUpgrade';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../../config/harvester';
import { UNIT_SUFFIX } from '../../utils/unit';

dayjs.extend(utc);
dayjs.extend(minMax);

const CLUSTER_METRICS_DETAIL_URL = '/api/v1/namespaces/cattle-monitoring-system/services/http:rancher-monitoring-grafana:80/proxy/d/rancher-cluster-nodes-1/rancher-cluster-nodes?orgId=1';
const CLUSTER_METRICS_SUMMARY_URL = '/api/v1/namespaces/cattle-monitoring-system/services/http:rancher-monitoring-grafana:80/proxy/d/rancher-cluster-1/rancher-cluster?orgId=1';
const VM_DASHBOARD_METRICS_URL = '/api/v1/namespaces/cattle-monitoring-system/services/http:rancher-monitoring-grafana:80/proxy/d/harvester-vm-dashboard-1/vm-dashboard?orgId=1';
const MONITORING_ID = 'cattle-monitoring-system/rancher-monitoring';
const HOURS_FOR_ACTIVE_WARNING = 24;

const FORMAT_RULES = {
  addSuffix:        true,
  firstSuffix:      UNIT_SUFFIX,
  increment:        1024,
  maxExponent:      99,
  maxPrecision:     2,
  minExponent:      0,
  startingExponent: 0,
  suffix:           UNIT_SUFFIX,
};

export default {
  name:       'LayerSentryOperationsDashboard',
  mixins:     [metricPoller],
  components: {
    Banner,
    DashboardMetrics,
    HarvesterUpgrade,
    Loading,
    MessageLink,
    Tab,
    Tabbed,
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;
    const hash = {
      nodes:            this.fetchClusterResources(NODE),
      vms:              this.fetchClusterResources(HCI.VM),
      images:           this.fetchClusterResources(HCI.IMAGE),
      volumes:          this.fetchClusterResources(PVC),
      networks:         this.fetchClusterResources(NETWORK_ATTACHMENT),
      events:           this.fetchClusterResources(EVENT),
      metricNodes:      this.fetchClusterResources(METRIC.NODE),
      settings:         this.fetchClusterResources(HCI.SETTING),
      longhornNodes:    this.fetchClusterResources(LONGHORN.NODES),
      longhornSettings: this.fetchClusterResources(LONGHORN.SETTINGS),
    };

    if (this.$store.getters[`${ inStore }/schemaFor`](HCI.ADD_ONS)) {
      hash.addons = this.fetchClusterResources(HCI.ADD_ONS);
    }

    const result = await allHash(hash);

    Object.assign(this, result);
    this.nodeMetrics = result.metricNodes || [];
    this.monitoring = (result.addons || []).find((addon) => addon.id === MONITORING_ID) || null;
    this.enabledMonitoringAddon = !!this.monitoring?.spec?.enabled;

    setPromiseResult(
      allDashboardsExist(
        this.$store,
        this.currentCluster.id,
        [CLUSTER_METRICS_DETAIL_URL, CLUSTER_METRICS_SUMMARY_URL],
        HARVESTER_PRODUCT
      ),
      this,
      'showClusterMetrics',
      'Determine LayerSentry cluster metrics'
    );
    setPromiseResult(
      allDashboardsExist(
        this.$store,
        this.currentCluster.id,
        [VM_DASHBOARD_METRICS_URL],
        HARVESTER_PRODUCT
      ),
      this,
      'showVmMetrics',
      'Determine LayerSentry virtual machine metrics'
    );
  },

  data() {
    return {
      nodes:                  [],
      vms:                    [],
      images:                 [],
      volumes:                [],
      networks:               [],
      events:                 [],
      metricNodes:            [],
      nodeMetrics:            [],
      settings:               [],
      longhornNodes:          [],
      longhornSettings:       [],
      monitoring:             null,
      enabledMonitoringAddon: false,
      showClusterMetrics:     false,
      showVmMetrics:          false,
      CLUSTER_METRICS_DETAIL_URL,
      CLUSTER_METRICS_SUMMARY_URL,
      VM_DASHBOARD_METRICS_URL,
    };
  },

  computed: {
    ...mapGetters(['currentCluster']),

    dashboardClusterName() {
      return this.currentCluster?.nameDisplay || this.currentCluster?.displayName || this.currentCluster?.id || this.t('generic.loading');
    },

    currentVersion() {
      const setting = this.settings.find((item) => item.id === 'server-version');

      return setting?.value || setting?.default || this.t('harvester.dashboard.status.unavailable');
    },

    firstNodeCreationTimestamp() {
      const dates = this.nodes
        .map((node) => node?.metadata?.creationTimestamp)
        .filter(Boolean)
        .map((timestamp) => dayjs(timestamp));

      return dates.length ? dayjs.min(dates).utc().format() : dayjs().utc().format();
    },

    readyHostCount() {
      return this.nodes.filter((node) => this.nodeIsReady(node)).length;
    },

    runningVmCount() {
      return this.vms.filter((vm) => this.vmIsRunning(vm)).length;
    },

    readyImageCount() {
      return this.images.filter((image) => this.resourceIsReady(image)).length;
    },

    diskCount() {
      return this.nodes.reduce((total, node) => total + Number(node?.diskStatusCount?.total || 0), 0);
    },

    diskErrorCount() {
      return this.nodes.reduce((total, node) => total + Number(node?.diskStatusCount?.errorCount || 0), 0);
    },

    recentWarningEvents() {
      const threshold = dayjs().subtract(HOURS_FOR_ACTIVE_WARNING, 'hour');

      return this.events.filter((event) => {
        const timestamp = this.eventTimestamp(event);

        return String(event?.type || '').toLowerCase() === 'warning' && timestamp && dayjs(timestamp).isAfter(threshold);
      });
    },

    clusterHealthTone() {
      if (!this.nodes.length || this.readyHostCount < this.nodes.length) {
        return 'critical';
      }

      if (this.recentWarningEvents.length || this.diskErrorCount) {
        return 'warning';
      }

      return 'positive';
    },

    clusterHealthLabel() {
      return this.t(`harvester.dashboard.status.${ this.clusterHealthTone }`);
    },

    operationalPosture() {
      return [
        {
          key:         'hosts',
          label:       this.t('harvester.dashboard.posture.hosts.label'),
          value:       `${ this.readyHostCount }/${ this.nodes.length }`,
          detail:      this.t('harvester.dashboard.posture.hosts.detail'),
          tone:        this.nodes.length && this.readyHostCount === this.nodes.length ? 'positive' : 'critical',
          short:       'HA',
        },
        {
          key:         'workloads',
          label:       this.t('harvester.dashboard.posture.workloads.label'),
          value:       `${ this.runningVmCount }/${ this.vms.length }`,
          detail:      this.t('harvester.dashboard.posture.workloads.detail'),
          tone:        this.vms.length && this.runningVmCount < this.vms.length ? 'warning' : 'positive',
          short:       'VM',
        },
        {
          key:         'storage',
          label:       this.t('harvester.dashboard.posture.storage.label'),
          value:       this.diskErrorCount ? String(this.diskErrorCount) : this.t('harvester.dashboard.status.clear'),
          detail:      this.diskErrorCount ? this.t('harvester.dashboard.posture.storage.degraded') : this.t('harvester.dashboard.posture.storage.detail'),
          tone:        this.diskErrorCount ? 'critical' : 'positive',
          short:       'ST',
        },
        {
          key:         'alerts',
          label:       this.t('harvester.dashboard.posture.alerts.label'),
          value:       String(this.recentWarningEvents.length),
          detail:      this.t('harvester.dashboard.posture.alerts.detail', { hours: HOURS_FOR_ACTIVE_WARNING }),
          tone:        this.recentWarningEvents.length ? 'warning' : 'positive',
          short:       'AL',
        },
      ];
    },

    quickActions() {
      const actions = [
        {
          key:         'create-vm',
          label:       this.t('harvester.dashboard.quickActions.createVm.label'),
          description: this.t('harvester.dashboard.quickActions.createVm.description'),
          short:       'VM',
          type:        HCI.VM,
          mode:        'create',
        },
        {
          key:         'import-image',
          label:       this.t('harvester.dashboard.quickActions.importImage.label'),
          description: this.t('harvester.dashboard.quickActions.importImage.description'),
          short:       'IMG',
          type:        HCI.IMAGE,
          mode:        'create',
        },
        {
          key:         'create-network',
          label:       this.t('harvester.dashboard.quickActions.createNetwork.label'),
          description: this.t('harvester.dashboard.quickActions.createNetwork.description'),
          short:       'NET',
          type:        HCI.NETWORK_ATTACHMENT,
          mode:        'create',
        },
        {
          key:         'protection',
          label:       this.t('harvester.dashboard.quickActions.protection.label'),
          description: this.t('harvester.dashboard.quickActions.protection.description'),
          short:       'DR',
          type:        HCI.BACKUP,
          mode:        'list',
        },
      ];

      return actions
        .filter((action) => this.hasSchema(action.type))
        .map((action) => ({
          ...action,
          to: action.mode === 'create' ? this.createRoute(action.type) : this.listRoute(action.type),
        }));
    },

    resourceCards() {
      return [
        {
          key:    'hosts',
          label:  this.t('harvester.dashboard.resources.hosts'),
          value:  this.nodes.length,
          meta:   this.t('harvester.dashboard.resources.ready', { ready: this.readyHostCount }),
          tone:   this.readyHostCount === this.nodes.length && this.nodes.length ? 'positive' : 'critical',
          to:     this.listRoute(HCI.HOST),
        },
        {
          key:    'virtual-machines',
          label:  this.t('harvester.dashboard.resources.virtualMachines'),
          value:  this.vms.length,
          meta:   this.t('harvester.dashboard.resources.running', { running: this.runningVmCount }),
          tone:   this.vms.length && this.runningVmCount < this.vms.length ? 'warning' : 'neutral',
          to:     this.listRoute(HCI.VM),
        },
        {
          key:    'images',
          label:  this.t('harvester.dashboard.resources.images'),
          value:  this.images.length,
          meta:   this.t('harvester.dashboard.resources.ready', { ready: this.readyImageCount }),
          tone:   this.images.length && this.readyImageCount < this.images.length ? 'warning' : 'neutral',
          to:     this.listRoute(HCI.IMAGE),
        },
        {
          key:    'volumes',
          label:  this.t('harvester.dashboard.resources.volumes'),
          value:  this.volumes.length,
          meta:   this.t('harvester.dashboard.resources.provisioned'),
          tone:   'neutral',
          to:     this.listRoute(HCI.VOLUME),
        },
        {
          key:    'networks',
          label:  this.t('harvester.dashboard.resources.networks'),
          value:  this.networks.length,
          meta:   this.t('harvester.dashboard.resources.available'),
          tone:   'neutral',
          to:     this.listRoute(HCI.NETWORK_ATTACHMENT),
        },
        {
          key:    'disks',
          label:  this.t('harvester.dashboard.resources.disks'),
          value:  this.diskCount,
          meta:   this.diskErrorCount ? this.t('harvester.dashboard.resources.diskErrors', { errors: this.diskErrorCount }) : this.t('harvester.dashboard.resources.healthy'),
          tone:   this.diskErrorCount ? 'critical' : 'positive',
          to:     this.listRoute(HCI.HOST),
        },
      ];
    },

    cpusTotal() {
      return this.metricNodes.reduce((total, node) => total + Number(node?.cpuCapacity || 0), 0);
    },

    memoryTotal() {
      return this.metricNodes.reduce((total, node) => total + Number(node?.memoryCapacity || 0), 0);
    },

    metricAggregations() {
      return this.nodeMetrics.reduce((total, metric) => {
        total.cpu += parseSi(metric?.usage?.cpu || '0');
        total.memory += parseSi(metric?.usage?.memory || '0');

        return total;
      }, { cpu: 0, memory: 0 });
    },

    cpuReserved() {
      return this.nodes.reduce((total, node) => total + Number(node?.cpuReserved || 0), 0);
    },

    memoryReserved() {
      return this.nodes.reduce((total, node) => total + Number(node?.memoryReserved || 0), 0);
    },

    storageStats() {
      const overProvisioning = this.longhornSettings.find((setting) => setting.id === 'longhorn-system/storage-over-provisioning-percentage');
      const stats = this.longhornNodes.reduce((total, node) => {
        const disks = node?.spec?.disks || {};
        const diskStatus = node?.status?.diskStatus || {};

        total.used += node?.spec?.allowScheduling ? Number(node?.used || 0) : 0;

        Object.keys(disks).forEach((key) => {
          total.scheduled += node?.spec?.allowScheduling ? Number(diskStatus[key]?.storageScheduled || 0) : 0;
          total.reserved += Number(disks[key]?.storageReserved || 0);
        });
        Object.values(diskStatus).forEach((disk) => {
          total.maximum += Number(disk?.storageMaximum || 0);
        });

        return total;
      }, {
        maximum:   0,
        reserved:  0,
        scheduled: 0,
        total:     0,
        used:      0,
      });

      stats.total = ((stats.maximum - stats.reserved) * Number(overProvisioning?.value || 0)) / 100;

      return stats;
    },

    capacityCards() {
      return [
        {
          key:             'cpu',
          label:           this.t('harvester.dashboard.capacity.cpu'),
          reservedLabel:   this.t('harvester.dashboard.capacity.reserved'),
          reservedValue:   this.formatCores(this.cpuReserved),
          reservedPercent: this.percent(this.cpuReserved, this.cpusTotal),
          usedLabel:       this.t('harvester.dashboard.capacity.used'),
          usedValue:       this.formatCores(this.metricAggregations.cpu),
          usedPercent:     this.percent(this.metricAggregations.cpu, this.cpusTotal),
          total:           this.t('harvester.dashboard.capacity.totalCores', { total: this.formatCores(this.cpusTotal) }),
        },
        {
          key:             'memory',
          label:           this.t('harvester.dashboard.capacity.memory'),
          reservedLabel:   this.t('harvester.dashboard.capacity.reserved'),
          reservedValue:   this.formatBytes(this.memoryReserved),
          reservedPercent: this.percent(this.memoryReserved, this.memoryTotal),
          usedLabel:       this.t('harvester.dashboard.capacity.used'),
          usedValue:       this.formatBytes(this.metricAggregations.memory),
          usedPercent:     this.percent(this.metricAggregations.memory, this.memoryTotal),
          total:           this.t('harvester.dashboard.capacity.total', { total: this.formatBytes(this.memoryTotal) }),
        },
        {
          key:             'storage',
          label:           this.t('harvester.dashboard.capacity.storage'),
          reservedLabel:   this.t('harvester.dashboard.capacity.allocated'),
          reservedValue:   this.formatBytes(this.storageStats.scheduled),
          reservedPercent: this.percent(this.storageStats.scheduled, this.storageStats.total),
          usedLabel:       this.t('harvester.dashboard.capacity.used'),
          usedValue:       this.formatBytes(this.storageStats.used),
          usedPercent:     this.percent(this.storageStats.used, this.storageStats.maximum),
          total:           this.t('harvester.dashboard.capacity.total', { total: this.formatBytes(this.storageStats.maximum) }),
        },
      ];
    },

    recentEvents() {
      return [...this.events]
        .sort((left, right) => dayjs(this.eventTimestamp(right) || 0).valueOf() - dayjs(this.eventTimestamp(left) || 0).valueOf())
        .slice(0, 8);
    },

    availableNodes() {
      return this.metricNodes.map((node) => node.id);
    },

    hasMetricsTabs() {
      return this.showClusterMetrics || this.showVmMetrics;
    },

    canEnableMonitoringAddon() {
      return !!this.monitoring;
    },

    toEnableMonitoringAddon() {
      return `${ HCI.ADD_ONS }/${ MONITORING_ID }?mode=edit#alertmanager`;
    },
  },

  methods: {
    hasSchema(type) {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return !!this.$store.getters[`${ inStore }/schemaFor`](type);
    },

    listRoute(resource) {
      return {
        name:   `${ HARVESTER_PRODUCT }-c-cluster-resource`,
        params: {
          cluster:  this.currentCluster?.id,
          product:  HARVESTER_PRODUCT,
          resource,
        },
      };
    },

    createRoute(resource) {
      return {
        name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-create`,
        params: {
          cluster:  this.currentCluster?.id,
          product:  HARVESTER_PRODUCT,
          resource,
        },
      };
    },

    nodeIsReady(node) {
      const ready = node?.status?.conditions?.find((condition) => condition.type === 'Ready');
      const state = String(node?.state || node?.status?.phase || '').toLowerCase();

      return ready?.status === 'True' || ['active', 'healthy', 'ready'].includes(state);
    },

    vmIsRunning(vm) {
      const state = String(vm?.state || vm?.status?.printableStatus || vm?.status?.phase || '').toLowerCase();

      return vm?.isRunning === true || ['active', 'running', 'started'].includes(state);
    },

    resourceIsReady(resource) {
      const state = String(resource?.state || resource?.status?.phase || resource?.status?.conditions?.[0]?.type || '').toLowerCase();

      return resource?.isReady === true || ['active', 'ready', 'succeeded'].includes(state);
    },

    eventTimestamp(event) {
      return event?.lastTimestamp || event?.eventTime || event?.metadata?.creationTimestamp || null;
    },

    eventTone(event) {
      return String(event?.type || '').toLowerCase() === 'warning' ? 'warning' : 'neutral';
    },

    eventResource(event) {
      return event?.displayInvolvedObject || [event?.involvedObject?.kind, event?.involvedObject?.name].filter(Boolean).join('/') || this.t('harvester.dashboard.status.unavailable');
    },

    percent(value, total) {
      const safeTotal = Number(total || 0);

      if (!safeTotal) {
        return 0;
      }

      return Math.min(100, Math.max(0, Math.round((Number(value || 0) / safeTotal) * 100)));
    },

    formatCores(value) {
      const cores = Number(value || 0);

      return cores < 10 ? cores.toFixed(2).replace(/\.00$/, '') : cores.toFixed(1).replace(/\.0$/, '');
    },

    formatBytes(value) {
      const parsed = parseSi(String(value || 0));
      const exponent = exponentNeeded(parsed, FORMAT_RULES.increment);
      const formatted = formatSi(parsed, {
        ...FORMAT_RULES,
        maxExponent: exponent,
        minExponent: exponent,
      });

      return formatted || `0 ${ UNITS[0] }${ UNIT_SUFFIX }`;
    },

    async fetchClusterResources(type, opt = {}) {
      const inStore = this.$store.getters['currentProduct'].inStore;

      if (!this.$store.getters[`${ inStore }/schemaFor`](type)) {
        return [];
      }

      try {
        return await this.$store.dispatch(`${ inStore }/findAll`, { type, opt });
      } catch (error) {
        console.error(`Failed fetching LayerSentry dashboard resource ${ type }:`, error); // eslint-disable-line no-console

        return [];
      }
    },

    async loadMetrics() {
      this.nodeMetrics = await this.fetchClusterResources(METRIC.NODE, { force: true });
    },
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending || !currentCluster" />
  <section
    v-else
    class="layersentry-control-plane"
    aria-labelledby="layersentry-control-plane-heading"
    data-testid="layersentry-operations-dashboard"
  >
    <HarvesterUpgrade />

    <header class="layersentry-command-header">
      <div class="layersentry-command-header__identity">
        <p class="layersentry-eyebrow">
          {{ t('harvester.dashboard.commandCenter.eyebrow') }}
        </p>
        <h1 id="layersentry-control-plane-heading">
          {{ t('harvester.dashboard.commandCenter.title') }}
        </h1>
        <p class="layersentry-command-header__description">
          {{ t('harvester.dashboard.commandCenter.description', { cluster: dashboardClusterName }) }}
        </p>
      </div>

      <div class="layersentry-command-header__status">
        <span
          class="layersentry-health-badge"
          :class="`tone-${clusterHealthTone}`"
          role="status"
          aria-live="polite"
        >
          <span
            class="layersentry-health-badge__dot"
            aria-hidden="true"
          />
          {{ clusterHealthLabel }}
        </span>
        <dl class="layersentry-command-metadata">
          <div>
            <dt>{{ t('harvester.dashboard.version') }}</dt>
            <dd>{{ currentVersion }}</dd>
          </div>
          <div>
            <dt>{{ t('glance.created') }}</dt>
            <dd>
              <LiveDate
                :value="firstNodeCreationTimestamp"
                :add-suffix="true"
                :show-tooltip="true"
              />
            </dd>
          </div>
        </dl>
      </div>
    </header>

    <div
      v-if="!enabledMonitoringAddon && canEnableMonitoringAddon"
      class="mb-20"
    >
      <Banner color="info">
        <MessageLink
          :to="toEnableMonitoringAddon"
          prefix-label="harvester.monitoring.alertmanagerConfig.disabledAddon.prefix"
          middle-label="harvester.monitoring.alertmanagerConfig.disabledAddon.middle"
          suffix-label="harvester.monitoring.alertmanagerConfig.disabledAddon.suffix"
        />
      </Banner>
    </div>

    <section
      class="layersentry-dashboard-section"
      aria-labelledby="layersentry-quick-actions-heading"
    >
      <div class="layersentry-section-heading">
        <div>
          <p class="layersentry-section-kicker">
            {{ t('harvester.dashboard.quickActions.kicker') }}
          </p>
          <h2 id="layersentry-quick-actions-heading">
            {{ t('harvester.dashboard.quickActions.title') }}
          </h2>
        </div>
        <p>{{ t('harvester.dashboard.quickActions.description') }}</p>
      </div>

      <div class="layersentry-quick-actions">
        <router-link
          v-for="action in quickActions"
          :key="action.key"
          :to="action.to"
          class="layersentry-quick-action"
        >
          <span
            class="layersentry-action-icon"
            aria-hidden="true"
          >{{ action.short }}</span>
          <span>
            <strong>{{ action.label }}</strong>
            <small>{{ action.description }}</small>
          </span>
          <span
            class="layersentry-action-arrow"
            aria-hidden="true"
          >→</span>
        </router-link>
      </div>
    </section>

    <section
      class="layersentry-dashboard-section"
      aria-labelledby="layersentry-posture-heading"
    >
      <div class="layersentry-section-heading">
        <div>
          <p class="layersentry-section-kicker">
            {{ t('harvester.dashboard.posture.kicker') }}
          </p>
          <h2 id="layersentry-posture-heading">
            {{ t('harvester.dashboard.posture.title') }}
          </h2>
        </div>
        <p>{{ t('harvester.dashboard.posture.description') }}</p>
      </div>

      <div class="layersentry-posture-grid">
        <article
          v-for="item in operationalPosture"
          :key="item.key"
          class="layersentry-posture-card"
          :class="`tone-${item.tone}`"
        >
          <span
            class="layersentry-posture-card__icon"
            aria-hidden="true"
          >{{ item.short }}</span>
          <div>
            <p>{{ item.label }}</p>
            <strong>{{ item.value }}</strong>
            <small>{{ item.detail }}</small>
          </div>
        </article>
      </div>
    </section>

    <section
      class="layersentry-dashboard-section"
      aria-labelledby="layersentry-inventory-heading"
    >
      <div class="layersentry-section-heading">
        <div>
          <p class="layersentry-section-kicker">
            {{ t('harvester.dashboard.resources.kicker') }}
          </p>
          <h2 id="layersentry-inventory-heading">
            {{ t('harvester.dashboard.resources.title') }}
          </h2>
        </div>
        <p>{{ t('harvester.dashboard.resources.description') }}</p>
      </div>

      <div class="layersentry-resource-grid">
        <router-link
          v-for="resource in resourceCards"
          :key="resource.key"
          :to="resource.to"
          class="layersentry-resource-card"
          :class="`tone-${resource.tone}`"
        >
          <span class="layersentry-resource-card__label">{{ resource.label }}</span>
          <strong>{{ resource.value }}</strong>
          <span class="layersentry-resource-card__meta">{{ resource.meta }}</span>
        </router-link>
      </div>
    </section>

    <section
      class="layersentry-dashboard-section"
      aria-labelledby="layersentry-capacity-heading"
    >
      <div class="layersentry-section-heading">
        <div>
          <p class="layersentry-section-kicker">
            {{ t('harvester.dashboard.capacity.kicker') }}
          </p>
          <h2 id="layersentry-capacity-heading">
            {{ t('harvester.dashboard.capacity.title') }}
          </h2>
        </div>
        <p>{{ t('harvester.dashboard.capacity.description') }}</p>
      </div>

      <div class="layersentry-capacity-grid">
        <article
          v-for="capacity in capacityCards"
          :key="capacity.key"
          class="layersentry-capacity-card"
        >
          <div class="layersentry-capacity-card__heading">
            <h3>{{ capacity.label }}</h3>
            <span>{{ capacity.total }}</span>
          </div>

          <div class="layersentry-capacity-meter">
            <div class="layersentry-capacity-meter__labels">
              <span>{{ capacity.reservedLabel }}</span>
              <strong>{{ capacity.reservedValue }} · {{ capacity.reservedPercent }}%</strong>
            </div>
            <div
              class="layersentry-capacity-meter__track"
              aria-hidden="true"
            >
              <span
                class="reserved"
                :style="{width: `${capacity.reservedPercent}%`}"
              />
            </div>
          </div>

          <div class="layersentry-capacity-meter">
            <div class="layersentry-capacity-meter__labels">
              <span>{{ capacity.usedLabel }}</span>
              <strong>{{ capacity.usedValue }} · {{ capacity.usedPercent }}%</strong>
            </div>
            <div
              class="layersentry-capacity-meter__track"
              aria-hidden="true"
            >
              <span
                class="used"
                :style="{width: `${capacity.usedPercent}%`}"
              />
            </div>
          </div>
        </article>
      </div>
    </section>

    <section
      v-if="hasMetricsTabs && enabledMonitoringAddon"
      class="layersentry-dashboard-section"
      aria-labelledby="layersentry-metrics-heading"
    >
      <div class="layersentry-section-heading">
        <div>
          <p class="layersentry-section-kicker">
            {{ t('harvester.dashboard.metrics.kicker') }}
          </p>
          <h2 id="layersentry-metrics-heading">
            {{ t('harvester.dashboard.metrics.title') }}
          </h2>
        </div>
        <p>{{ t('harvester.dashboard.metrics.description') }}</p>
      </div>

      <Tabbed class="layersentry-metrics-tabs">
        <Tab
          v-if="showClusterMetrics"
          name="cluster-metrics"
          :label="t('clusterIndexPage.sections.clusterMetrics.label')"
          :weight="99"
        >
          <template #default="props">
            <DashboardMetrics
              v-if="props.active"
              :detail-url="CLUSTER_METRICS_DETAIL_URL"
              :summary-url="CLUSTER_METRICS_SUMMARY_URL"
              graph-height="825px"
            />
          </template>
        </Tab>
        <Tab
          v-if="showVmMetrics"
          name="vm-metrics"
          :label="t('harvester.dashboard.sections.vmMetrics.label')"
          :weight="98"
        >
          <template #default="props">
            <DashboardMetrics
              v-if="props.active"
              :detail-url="VM_DASHBOARD_METRICS_URL"
              graph-height="825px"
              :has-summary-and-detail="false"
            />
          </template>
        </Tab>
      </Tabbed>
    </section>

    <section
      class="layersentry-dashboard-section"
      aria-labelledby="layersentry-events-heading"
    >
      <div class="layersentry-section-heading">
        <div>
          <p class="layersentry-section-kicker">
            {{ t('harvester.dashboard.activity.kicker') }}
          </p>
          <h2 id="layersentry-events-heading">
            {{ t('harvester.dashboard.activity.title') }}
          </h2>
        </div>
        <p>{{ t('harvester.dashboard.activity.description') }}</p>
      </div>

      <div
        v-if="recentEvents.length"
        class="layersentry-event-list"
      >
        <article
          v-for="event in recentEvents"
          :key="event.id || `${eventResource(event)}-${eventTimestamp(event)}`"
          class="layersentry-event-row"
          :class="`tone-${eventTone(event)}`"
        >
          <span
            class="layersentry-event-row__indicator"
            aria-hidden="true"
          />
          <div class="layersentry-event-row__body">
            <div>
              <strong>{{ event.reason || t('harvester.dashboard.activity.event') }}</strong>
              <span>{{ eventResource(event) }}</span>
            </div>
            <p>{{ event.displayMessage || event.message || t('harvester.dashboard.activity.noMessage') }}</p>
          </div>
          <LiveDate
            v-if="eventTimestamp(event)"
            class="layersentry-event-row__time"
            :value="eventTimestamp(event)"
            :add-suffix="true"
            :show-tooltip="true"
          />
        </article>
      </div>
      <div
        v-else
        class="layersentry-empty-state"
        role="status"
      >
        <strong>{{ t('harvester.dashboard.activity.emptyTitle') }}</strong>
        <p>{{ t('harvester.dashboard.activity.emptyDescription') }}</p>
      </div>
    </section>
  </section>
</template>

<style lang="scss" scoped>
.layersentry-control-plane {
  min-width: 0;
}

.layersentry-command-header {
  align-items: flex-start;
  background: var(--ls-command-bg);
  border: 1px solid var(--ls-command-border);
  border-left: 5px solid var(--ls-accent);
  display: flex;
  gap: 32px;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 24px 26px;
}

.layersentry-command-header__identity {
  min-width: 0;
}

.layersentry-eyebrow,
.layersentry-section-kicker {
  color: var(--ls-accent-strong);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.1em;
  margin: 0;
  text-transform: uppercase;
}

.layersentry-command-header h1 {
  color: var(--ls-heading);
  font-size: 28px;
  letter-spacing: -0.025em;
  line-height: 1.2;
  margin: 7px 0 0;
}

.layersentry-command-header__description {
  color: var(--ls-text-muted);
  line-height: 1.55;
  margin: 9px 0 0;
  max-width: 760px;
}

.layersentry-command-header__status {
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 270px;
}

.layersentry-health-badge {
  align-items: center;
  background: var(--ls-surface);
  border: 1px solid var(--ls-border);
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  gap: 8px;
  padding: 7px 11px;
  text-transform: uppercase;
}

.layersentry-health-badge__dot {
  background: currentColor;
  border-radius: 50%;
  height: 8px;
  width: 8px;
}

.tone-positive {
  --ls-tone: var(--ls-status-positive);
}

.tone-warning {
  --ls-tone: var(--ls-status-warning);
}

.tone-critical {
  --ls-tone: var(--ls-status-critical);
}

.tone-neutral {
  --ls-tone: var(--ls-text-muted);
}

.layersentry-health-badge.tone-positive,
.layersentry-health-badge.tone-warning,
.layersentry-health-badge.tone-critical {
  border-color: color-mix(in srgb, var(--ls-tone) 35%, var(--ls-border));
  color: var(--ls-tone);
}

.layersentry-command-metadata {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(100px, 1fr));
  margin: 0;
  width: 100%;
}

.layersentry-command-metadata div {
  border-left: 1px solid var(--ls-border);
  padding-left: 14px;
}

.layersentry-command-metadata dt {
  color: var(--ls-text-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.layersentry-command-metadata dd {
  color: var(--ls-heading);
  font-weight: 700;
  margin: 0;
}

.layersentry-dashboard-section {
  margin-top: 30px;
}

.layersentry-section-heading {
  align-items: flex-end;
  border-bottom: 1px solid var(--ls-border);
  display: flex;
  gap: 24px;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 11px;
}

.layersentry-section-heading h2 {
  color: var(--ls-heading);
  font-size: 20px;
  letter-spacing: -0.015em;
  margin: 4px 0 0;
}

.layersentry-section-heading > p {
  color: var(--ls-text-muted);
  line-height: 1.45;
  margin: 0;
  max-width: 600px;
  text-align: right;
}

.layersentry-quick-actions,
.layersentry-posture-grid,
.layersentry-resource-grid,
.layersentry-capacity-grid {
  display: grid;
  gap: 14px;
}

.layersentry-quick-actions,
.layersentry-posture-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.layersentry-resource-grid {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.layersentry-capacity-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.layersentry-quick-action {
  align-items: center;
  background: var(--ls-surface);
  border: 1px solid var(--ls-border);
  color: var(--ls-text);
  display: grid;
  gap: 12px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-height: 88px;
  padding: 15px;
  text-decoration: none;
  transition: border-color var(--ls-transition-fast), transform var(--ls-transition-fast);
}

.layersentry-quick-action:hover {
  border-color: var(--ls-accent);
  color: var(--ls-text);
  text-decoration: none;
  transform: translateY(-1px);
}

.layersentry-action-icon,
.layersentry-posture-card__icon {
  align-items: center;
  background: var(--ls-accent-soft);
  border: 1px solid var(--ls-accent-border);
  color: var(--ls-accent-strong);
  display: inline-flex;
  font-size: 10px;
  font-weight: 800;
  height: 38px;
  justify-content: center;
  letter-spacing: 0.03em;
  min-width: 38px;
  padding: 0 5px;
}

.layersentry-quick-action strong,
.layersentry-quick-action small {
  display: block;
}

.layersentry-quick-action strong {
  color: var(--ls-heading);
  font-size: 14px;
  margin-bottom: 5px;
}

.layersentry-quick-action small {
  color: var(--ls-text-muted);
  line-height: 1.35;
}

.layersentry-action-arrow {
  color: var(--ls-accent-strong);
  font-size: 19px;
}

.layersentry-posture-card {
  align-items: flex-start;
  background: var(--ls-surface);
  border: 1px solid var(--ls-border);
  border-top: 3px solid var(--ls-tone);
  display: flex;
  gap: 13px;
  min-height: 124px;
  padding: 16px;
}

.layersentry-posture-card p,
.layersentry-posture-card small,
.layersentry-posture-card strong {
  display: block;
}

.layersentry-posture-card p {
  color: var(--ls-text-muted);
  font-size: 12px;
  font-weight: 650;
  margin: 0 0 4px;
  text-transform: uppercase;
}

.layersentry-posture-card strong {
  color: var(--ls-heading);
  font-size: 24px;
  line-height: 1.1;
  margin-bottom: 7px;
}

.layersentry-posture-card small {
  color: var(--ls-text-muted);
  line-height: 1.35;
}

.layersentry-resource-card {
  background: var(--ls-surface);
  border: 1px solid var(--ls-border);
  border-bottom: 3px solid var(--ls-tone);
  color: var(--ls-text);
  min-height: 122px;
  padding: 16px;
  text-decoration: none;
  transition: border-color var(--ls-transition-fast);
}

.layersentry-resource-card:hover {
  border-color: var(--ls-accent);
  color: var(--ls-text);
  text-decoration: none;
}

.layersentry-resource-card span,
.layersentry-resource-card strong {
  display: block;
}

.layersentry-resource-card__label {
  color: var(--ls-text-muted);
  font-size: 12px;
  font-weight: 650;
  min-height: 34px;
}

.layersentry-resource-card strong {
  color: var(--ls-heading);
  font-size: 30px;
  line-height: 1;
  margin: 5px 0 9px;
}

.layersentry-resource-card__meta {
  color: var(--ls-text-muted);
  font-size: 12px;
}

.layersentry-capacity-card {
  background: var(--ls-surface);
  border: 1px solid var(--ls-border);
  padding: 18px;
}

.layersentry-capacity-card__heading {
  align-items: baseline;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 20px;
}

.layersentry-capacity-card__heading h3 {
  color: var(--ls-heading);
  font-size: 17px;
  margin: 0;
}

.layersentry-capacity-card__heading span {
  color: var(--ls-text-muted);
  font-size: 11px;
}

.layersentry-capacity-meter + .layersentry-capacity-meter {
  margin-top: 17px;
}

.layersentry-capacity-meter__labels {
  display: flex;
  font-size: 12px;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 7px;
}

.layersentry-capacity-meter__labels span {
  color: var(--ls-text-muted);
}

.layersentry-capacity-meter__labels strong {
  color: var(--ls-heading);
}

.layersentry-capacity-meter__track {
  background: var(--ls-meter-track);
  height: 7px;
  overflow: hidden;
}

.layersentry-capacity-meter__track span {
  display: block;
  height: 100%;
  min-width: 2px;
}

.layersentry-capacity-meter__track .reserved {
  background: var(--ls-capacity-reserved);
}

.layersentry-capacity-meter__track .used {
  background: var(--ls-capacity-used);
}

.layersentry-metrics-tabs,
.layersentry-event-list,
.layersentry-empty-state {
  background: var(--ls-surface);
  border: 1px solid var(--ls-border);
}

.layersentry-event-list {
  overflow: hidden;
}

.layersentry-event-row {
  align-items: center;
  display: grid;
  gap: 14px;
  grid-template-columns: 4px minmax(0, 1fr) auto;
  min-height: 78px;
  padding: 13px 16px;
}

.layersentry-event-row + .layersentry-event-row {
  border-top: 1px solid var(--ls-border);
}

.layersentry-event-row__indicator {
  align-self: stretch;
  background: var(--ls-tone);
  width: 4px;
}

.layersentry-event-row__body > div {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.layersentry-event-row__body strong {
  color: var(--ls-heading);
}

.layersentry-event-row__body span,
.layersentry-event-row__body p,
.layersentry-event-row__time {
  color: var(--ls-text-muted);
}

.layersentry-event-row__body span {
  font-size: 12px;
}

.layersentry-event-row__body p {
  line-height: 1.4;
  margin: 5px 0 0;
}

.layersentry-event-row__time {
  font-size: 12px;
  white-space: nowrap;
}

.layersentry-empty-state {
  padding: 28px;
  text-align: center;
}

.layersentry-empty-state strong {
  color: var(--ls-heading);
}

.layersentry-empty-state p {
  color: var(--ls-text-muted);
  margin: 7px 0 0;
}

@media (max-width: 1280px) {
  .layersentry-quick-actions,
  .layersentry-posture-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .layersentry-resource-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .layersentry-command-header,
  .layersentry-section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .layersentry-command-header__status {
    align-items: flex-start;
    min-width: 0;
  }

  .layersentry-section-heading > p {
    text-align: left;
  }

  .layersentry-capacity-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 650px) {
  .layersentry-command-header {
    padding: 20px;
  }

  .layersentry-command-header h1 {
    font-size: 24px;
  }

  .layersentry-command-metadata,
  .layersentry-quick-actions,
  .layersentry-posture-grid,
  .layersentry-resource-grid {
    grid-template-columns: 1fr;
  }

  .layersentry-event-row {
    align-items: flex-start;
    grid-template-columns: 4px minmax(0, 1fr);
  }

  .layersentry-event-row__time {
    grid-column: 2;
  }
}
</style>
