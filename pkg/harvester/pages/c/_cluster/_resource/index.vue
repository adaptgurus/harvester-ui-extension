<script>
import ResourceList from '@shell/components/ResourceList/index.vue';
import OperationsDashboard from '../../../../components/layersentry/OperationsDashboard.vue';

const LAYERSENTRY_DASHBOARD_RESOURCE = 'harvesterhci.io.dashboard';

export default {
  name:       'HarvesterResourcedList',
  components: { OperationsDashboard, ResourceList },

  computed: {
    isLayerSentryDashboard() {
      return this.$route.params.resource === LAYERSENTRY_DASHBOARD_RESOURCE;
    },
  },
};
</script>

<template>
  <OperationsDashboard v-if="isLayerSentryDashboard" />
  <ResourceList v-else />
</template>
