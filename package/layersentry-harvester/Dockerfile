ARG BASE_IMAGE
FROM ${BASE_IMAGE}

ARG LAYERSENTRY_UI_SOURCE_COMMIT
ARG LAYERSENTRY_UI_VERSION=1.8.2

LABEL org.opencontainers.image.title="LayerSentry Harvester control plane"
LABEL org.opencontainers.image.description="Harvester v1.8.2 compatibility image with the qualified LayerSentry browser dashboard and plugin payloads"
LABEL org.opencontainers.image.source="https://github.com/adaptgurus/harvester-ui-extension"
LABEL io.layersentry.ui.source-commit="${LAYERSENTRY_UI_SOURCE_COMMIT}"
LABEL io.layersentry.ui.version="${LAYERSENTRY_UI_VERSION}"
LABEL io.layersentry.compatibility.harvester="v1.8.2"

USER 0

COPY dashboard.tar.gz plugin.tar.gz /tmp/layersentry-ui/

RUN set -eux; \
    ui_root=/usr/share/harvester/harvester; \
    plugin_root=${ui_root}/v1/harvester/plugin-assets; \
    test -d "${ui_root}"; \
    test -d "${ui_root}/api-ui"; \
    find "${ui_root}" -mindepth 1 -maxdepth 1 \
      ! -name api-ui \
      ! -name v1 \
      -exec rm -rf {} +; \
    tar -xzf /tmp/layersentry-ui/dashboard.tar.gz \
      -C "${ui_root}" \
      --strip-components=2; \
    rm -rf "${plugin_root}"; \
    mkdir -p "${plugin_root}"; \
    tar -xzf /tmp/layersentry-ui/plugin.tar.gz \
      -C "${plugin_root}" \
      --strip-components=1; \
    test -s "${ui_root}/index.html"; \
    test "$(find "${ui_root}" -maxdepth 1 -type f | wc -l)" -gt 3; \
    test "$(find "${plugin_root}" -type f | wc -l)" -gt 1; \
    find "${ui_root}" -type d -exec chmod a+rx {} +; \
    find "${ui_root}" -type f -exec chmod a+r {} +; \
    rm -rf /tmp/layersentry-ui

ENV LAYERSENTRY_UI_SOURCE_COMMIT=${LAYERSENTRY_UI_SOURCE_COMMIT}
ENV LAYERSENTRY_UI_VERSION=${LAYERSENTRY_UI_VERSION}
ENV HARVESTER_UI_SOURCE=bundled
