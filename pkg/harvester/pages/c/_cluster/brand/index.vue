<script>
import { LabeledInput } from '@components/Form/LabeledInput';
import ColorInput from '@shell/components/form/ColorInput';
import TypeDescription from '@shell/components/TypeDescription';
import { Checkbox } from '@components/Form/Checkbox';
import FileSelector from '@shell/components/form/FileSelector';
import SimpleBox from '@shell/components/SimpleBox';
import Loading from '@shell/components/Loading';
import AsyncButton from '@shell/components/AsyncButton';
import { Banner } from '@components/Banner';
import { allHash } from '@shell/utils/promise';
import { MANAGEMENT } from '@shell/config/types';
import { getVendor, setVendor } from '@shell/config/private-label';
import { fetchOrCreateSetting } from '@shell/utils/settings';
import { SETTING } from '@shell/config/settings';
import { _EDIT, _VIEW } from '@shell/config/query-params';
import { setFavIcon } from '@shell/utils/favicon';
import { syncLayerSentrySingleProductBranding } from '../../../../config/layersentry-cluster';

const Color = require('color');
const SAFE_IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g|svg\+xml)(?:;charset=[^;,]+)?;base64,/i;
const UNSAFE_SVG_CONTENT = /<\s*(?:script|foreignObject|iframe|object|embed)\b|javascript:|on(?:load|error|click)\s*=|(?:href|xlink:href)\s*=\s*["']https?:/i;

export default {
  components: {
    LabeledInput, Checkbox, FileSelector, Loading, SimpleBox, AsyncButton, Banner, ColorInput, TypeDescription
  },

  async fetch() {
    const hash = await allHash({
      uiPLSetting:        this.$store.dispatch('management/find', { type: MANAGEMENT.SETTING, id: SETTING.PL }),
      uiLogoDarkSetting:  fetchOrCreateSetting(this.$store, SETTING.LOGO_DARK, ''),
      uiLogoLightSetting: fetchOrCreateSetting(this.$store, SETTING.LOGO_LIGHT, ''),
      uiColorSetting:     fetchOrCreateSetting(this.$store, SETTING.PRIMARY_COLOR, ''),
      uiLinkColorSetting: fetchOrCreateSetting(this.$store, SETTING.LINK_COLOR, ''),
      uiFaviconSetting:   fetchOrCreateSetting(this.$store, SETTING.FAVICON, ''),
    });

    Object.assign(this, hash);

    if (hash.uiLogoDarkSetting.value) {
      this.uiLogoDark = hash.uiLogoDarkSetting.value;
      this.customizeLogo = true;
    }

    if (hash.uiLogoLightSetting.value) {
      this.uiLogoLight = hash.uiLogoLightSetting.value;
      this.customizeLogo = true;
    }

    if (hash.uiFaviconSetting.value) {
      this.uiFavicon = hash.uiFaviconSetting.value;
      this.customizeFavicon = true;
    }

    try {
      if (hash.uiColorSetting.value) {
        this.uiColor = Color(hash.uiColorSetting.value).hex();
        this.customizeColor = true;
      }

      if (hash.uiLinkColorSetting.value) {
        this.uiLinkColor = Color(hash.uiLinkColorSetting.value).hex();
        this.customizeLinkColor = true;
      }
    } catch (err) {
      this.setError(err);
    }
  },

  data() {
    return {
      vendor:             getVendor(),
      uiPLSetting:        {},
      uiLogoDarkSetting:  {},
      uiLogoDark:         '',
      uiLogoLightSetting: {},
      uiLogoLight:        '',
      customizeLogo:      false,
      uiFaviconSetting:   {},
      uiFavicon:          '',
      customizeFavicon:   false,
      uiColorSetting:     {},
      uiColor:            null,
      customizeColor:     false,
      uiLinkColorSetting: {},
      uiLinkColor:        null,
      customizeLinkColor: false,
      errors:             [],
    };
  },

  computed: {
    mode() {
      const schema = this.$store.getters[`management/schemaFor`](MANAGEMENT.SETTING);

      return schema?.resourceMethods?.includes('PUT') ? _EDIT : _VIEW;
    },

    isEditable() {
      return this.mode === _EDIT;
    },

    customLinkColor() {
      return { color: this.uiLinkColor };
    }
  },

  mounted() {
    let uiColor = getComputedStyle(document.body).getPropertyValue('--primary');
    let uiLinkColor = getComputedStyle(document.body).getPropertyValue('--link');
    const suse = document.querySelector('.suse');

    if (suse) {
      uiColor = getComputedStyle(suse).getPropertyValue('--primary');
      uiLinkColor = getComputedStyle(suse).getPropertyValue('--link');
    }

    this.uiColor = this.uiColor || uiColor.trim();
    this.uiLinkColor = this.uiLinkColor || uiLinkColor.trim();
  },

  methods: {
    updateLogo(img, key) {
      try {
        this.validateImageDataUrl(img);
        this[key] = img;
        this.errors = [];
      } catch (err) {
        this.setError(err);
      }
    },

    setError(err) {
      const message = err?.message || String(err);

      this.errors = [message];
    },

    normalizeVendor(value) {
      const normalized = String(value || '')
        .replace(/[<>&=#()"]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!normalized) {
        throw new Error(this.t('layersentryBranding.validation.productNameRequired'));
      }

      return normalized;
    },

    validateImageDataUrl(value) {
      if (!value || !SAFE_IMAGE_DATA_URL.test(value)) {
        throw new Error(this.t('layersentryBranding.validation.imageType'));
      }

      if (value.toLowerCase().startsWith('data:image/svg+xml')) {
        const payload = value.slice(value.indexOf(',') + 1);
        let svg = '';

        try {
          svg = window.atob(payload);
        } catch {
          throw new Error(this.t('layersentryBranding.validation.imageInvalid'));
        }

        if (UNSAFE_SVG_CONTENT.test(svg)) {
          throw new Error(this.t('layersentryBranding.validation.svgUnsafe'));
        }
      }
    },

    async save(btnCB) {
      this.errors = [];

      try {
        const vendor = this.normalizeVendor(this.uiPLSetting.value);

        if (this.customizeLogo) {
          if (!this.uiLogoLight && !this.uiLogoDark) {
            throw new Error(this.t('layersentryBranding.validation.logoRequired'));
          }

          if (this.uiLogoLight) {
            this.validateImageDataUrl(this.uiLogoLight);
          }

          if (this.uiLogoDark) {
            this.validateImageDataUrl(this.uiLogoDark);
          }
        }

        if (this.customizeFavicon) {
          if (!this.uiFavicon) {
            throw new Error(this.t('layersentryBranding.validation.faviconRequired'));
          }

          this.validateImageDataUrl(this.uiFavicon);
        }

        const primaryColor = this.customizeColor ? Color(this.uiColor).rgb().string() : null;
        const linkColor = this.customizeLinkColor ? Color(this.uiLinkColor).rgb().string() : null;

        this.uiPLSetting.value = vendor;
        this.uiLogoLightSetting.value = this.customizeLogo ? this.uiLogoLight : '';
        this.uiLogoDarkSetting.value = this.customizeLogo ? this.uiLogoDark : '';
        this.uiFaviconSetting.value = this.customizeFavicon ? this.uiFavicon : '';
        this.uiColorSetting.value = primaryColor;
        this.uiLinkColorSetting.value = linkColor;

        await Promise.all([
          this.uiPLSetting.save(),
          this.uiLogoDarkSetting.save(),
          this.uiLogoLightSetting.save(),
          this.uiColorSetting.save(),
          this.uiLinkColorSetting.save(),
          this.uiFaviconSetting.save()
        ]);

        if (vendor !== this.vendor) {
          setVendor(vendor);
          this.vendor = vendor;
        }

        setFavIcon(this.$store);
        syncLayerSentrySingleProductBranding(this.$store);
        btnCB(true);
      } catch (err) {
        this.setError(err);
        btnCB(false);
      }
    },
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <section
    v-else
    class="layersentry-branding"
    aria-labelledby="layersentry-branding-title"
  >
    <div class="layersentry-page-intro">
      <h1
        id="layersentry-branding-title"
        class="mb-20"
      >
        {{ t('branding.label') }}
      </h1>
      <TypeDescription resource="harvester" />
    </div>

    <div class="layersentry-brand-section">
      <div class="row mb-20">
        <div class="col span-6">
          <LabeledInput
            v-model:value="uiPLSetting.value"
            :label="t('branding.uiPL.label')"
            :mode="mode"
            :maxlength="100"
            autocomplete="organization"
          />
        </div>
      </div>

      <h3 class="mt-20 mb-5 pb-5">
        {{ t('branding.logos.label') }}
      </h3>
      <p class="text-label">
        {{ t('harvester.branding.logos.tip', {}, true) }}
      </p>
      <div class="row mt-10 mb-20">
        <Checkbox
          v-model:value="customizeLogo"
          :label="t('branding.logos.useCustom')"
          :mode="mode"
        />
      </div>

      <div
        v-if="customizeLogo"
        class="row mb-20"
      >
        <div class="col logo-container span-6">
          <div class="mb-10">
            <FileSelector
              :byte-limit="20000"
              :read-as-data-url="true"
              class="role-secondary"
              :label="t('branding.logos.uploadLight')"
              :mode="mode"
              @error="setError"
              @selected="updateLogo($event, 'uiLogoLight')"
            />
          </div>
          <SimpleBox
            v-if="uiLogoLight || uiLogoDark"
            class="theme-light mb-10"
          >
            <span class="preview-label">
              {{ t('branding.logos.lightPreview') }}
            </span>
            <img
              class="logo-preview"
              :src="uiLogoLight ? uiLogoLight : uiLogoDark"
              :alt="t('layersentryBranding.preview.lightLogoAlt')"
            >
          </SimpleBox>
        </div>

        <div class="col logo-container span-6">
          <div class="mb-10">
            <FileSelector
              :byte-limit="20000"
              :read-as-data-url="true"
              class="role-secondary"
              :label="t('branding.logos.uploadDark')"
              :mode="mode"
              @error="setError"
              @selected="updateLogo($event, 'uiLogoDark')"
            />
          </div>
          <SimpleBox
            v-if="uiLogoDark || uiLogoLight"
            class="theme-dark mb-10"
          >
            <span class="preview-label">
              {{ t('branding.logos.darkPreview') }}
            </span>
            <img
              class="logo-preview"
              :src="uiLogoDark ? uiLogoDark : uiLogoLight"
              :alt="t('layersentryBranding.preview.darkLogoAlt')"
            >
          </SimpleBox>
        </div>
      </div>

      <h3 class="mt-20 mb-5 pb-5">
        {{ t('branding.favicon.label') }}
      </h3>
      <p class="text-label">
        {{ t('harvester.branding.favicon.tip', {}, true) }}
      </p>
      <div class="row mt-10 mb-20">
        <Checkbox
          v-model:value="customizeFavicon"
          :label="t('branding.favicon.useCustom')"
          :mode="mode"
        />
      </div>

      <div
        v-if="customizeFavicon"
        class="row mb-20"
      >
        <div class="col logo-container span-12">
          <div class="mb-10">
            <FileSelector
              :byte-limit="20000"
              :read-as-data-url="true"
              class="role-secondary"
              :label="t('branding.favicon.upload')"
              :mode="mode"
              @error="setError"
              @selected="updateLogo($event, 'uiFavicon')"
            />
          </div>
          <SimpleBox v-if="uiFavicon">
            <span class="preview-label">
              {{ t('branding.favicon.preview') }}
            </span>
            <img
              class="favicon-preview"
              :src="uiFavicon"
              :alt="t('layersentryBranding.preview.faviconAlt')"
            >
          </SimpleBox>
        </div>
      </div>

      <h3 class="mt-40 mb-5 pb-0">
        {{ t('branding.color.label') }}
      </h3>
      <p class="text-label">
        {{ t('branding.color.tip', {}, true) }}
      </p>
      <div class="row mt-20">
        <Checkbox
          v-model:value="customizeColor"
          :label="t('branding.color.useCustom')"
          :mode="mode"
        />
      </div>
      <div
        v-if="customizeColor"
        class="row mt-20 mb-20"
      >
        <ColorInput
          v-model:value="uiColor"
          component-testid="primary"
        />
      </div>

      <h3 class="mt-40 mb-5 pb-0">
        {{ t('branding.linkColor.label') }}
      </h3>
      <p class="text-label">
        {{ t('branding.linkColor.tip', {}, true) }}
      </p>
      <div class="row mt-20">
        <Checkbox
          v-model:value="customizeLinkColor"
          :label="t('branding.linkColor.useCustom')"
          :mode="mode"
        />
      </div>
      <div
        v-if="customizeLinkColor"
        class="row mt-20 mb-20"
      >
        <ColorInput
          v-model:value="uiLinkColor"
          class="col"
          component-testid="link"
        />
        <span class="col link-example">
          <span
            class="link-preview"
            :style="customLinkColor"
          >
            {{ t('branding.linkColor.example') }}
          </span>
        </span>
      </div>
    </div>

    <div
      v-if="errors.length"
      aria-live="polite"
    >
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
    </div>

    <div v-if="isEditable">
      <AsyncButton
        component-testid="branding-apply"
        class="pull-right mt-20"
        mode="apply"
        @click="save"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.link-example {
  align-items: center;
  display: flex;
}

.link-preview {
  font-weight: 600;
  margin: auto;
}

.logo-container {
  display: flex;
  flex-direction: column;

  :deep().simple-box {
    flex: 1;
    max-height: 140px;
    min-height: 100px;
    position: relative;

    .content {
      align-items: center;
      display: flex;
      height: 100%;
      justify-content: center;
      padding-top: 28px;
    }
  }
}

.preview-label {
  color: var(--ls-text-muted);
  font-size: 12px;
  font-weight: 600;
  left: 10px;
  position: absolute;
  top: 10px;
}

.logo-preview {
  max-height: 72px;
  max-width: 100%;
  object-fit: contain;
}

.favicon-preview {
  height: 48px;
  object-fit: contain;
  width: 48px;
}
</style>
