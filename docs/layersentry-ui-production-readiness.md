# LayerSentry UI production-readiness contract

This document separates source qualification, build qualification, deployment qualification, and release approval. A successful repository build does not by itself approve a production release.

## Product identity

The operator-visible product name is exactly **LayerSentry**. Internal compatibility identifiers such as API groups, route names, resource kinds, and the extension package name remain unchanged where the upstream platform requires them.

The controlled primary brand color is `#000f42`. Production UI surfaces use flat backgrounds, restrained borders, consistent focus indicators, and equivalent light- and dark-mode behavior. LayerSentry-owned styles must not introduce decorative gradients.

## Automated source and build gates

The `LayerSentry UI Production Validation` workflow must pass all jobs:

1. Parse and validate the LayerSentry locale overlay.
2. Verify controlled product metadata, logo assets, runtime brand marker, and single-product initialization order.
3. Reject active or externally loaded content in committed SVG assets.
4. Reject upstream support destinations from LayerSentry-owned support copy.
5. Verify accessible alternative text for branding previews.
6. Lint the complete extension repository.
7. Build and validate the extension package.
8. Build hosted and embedded distributions without publishing to an upstream cloud bucket.
9. Produce SHA-256 checksums and `layersentry-branding-manifest.json`.
10. Upload the qualified package as a GitHub Actions artifact.

The upstream Google Cloud upload workflow is not a LayerSentry release gate because this fork does not use upstream publishing credentials.

## Runtime deployment gate

Deploy only the exact artifact produced by a passing validation run. Record the source commit, workflow run ID, artifact ID, bundle SHA-256, deployment time, target cluster, and rollback artifact before changing the UI source.

The UI index must be served with revalidation (`Cache-Control: no-cache, must-revalidate`). Content-addressed static assets may use long-lived immutable caching. Do not use a mutable URL for both the old and new bundle.

## Browser and private-label acceptance

Validate in a clean browser profile and after a hard refresh:

- login, browser title, favicon, top navigation, sidebar, dashboard, About & Branding, Support, upgrade, backup, networking, storage, image, host, and virtual-machine views;
- no operator-facing Harvester, Rancher, or SUSE vendor promotion on LayerSentry-owned pages;
- no upstream community, pricing, issue, documentation, or support links on the LayerSentry Support page;
- light mode, dark mode, keyboard-only navigation, visible focus, 200% zoom, and reduced-motion preference;
- desktop widths of 1920, 1440, and 1280 pixels, plus tablet and narrow layouts;
- support-bundle generation and kubeconfig download authorization;
- safe rejection of invalid image data, active SVG content, empty product names, and invalid color values;
- no secrets, tokens, kubeconfig content, certificates, or private keys in screenshots or evidence.

## Cluster-aware acceptance

Complete browser validation only after all required cluster nodes are Ready and stable. Confirm that management, storage, virtual-machine networking, monitoring, support-bundle generation, and relevant API calls function through the cluster VIP.

A node reimage, node join, workload recovery, browser validation, air-gap validation, and release approval remain separate evidence gates.

## Rollback

Before deployment, retain the previous qualified UI artifact and its checksum. If the new bundle fails to load, presents broken navigation, exposes upstream branding, or causes API/UI incompatibility:

1. restore the previous UI source or bundled artifact;
2. invalidate only the mutable UI index;
3. preserve logs and browser console evidence without credentials;
4. verify the previous dashboard loads from a clean browser profile;
5. record the rollback as a failed deployment qualification, not a source-build failure.
