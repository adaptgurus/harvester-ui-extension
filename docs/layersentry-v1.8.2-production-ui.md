# LayerSentry v1.8.2 production UI qualification

## Release alignment

This branch remains based on the maintained Harvester UI extension v1.8.2 line and keeps the technical package name `harvester` for compatibility. The customer-facing catalog display name, product navigation, support experience, branding controls, and operational dashboard identify the product as LayerSentry.

The package declares Rancher compatibility `>= 2.14.0-0`, matching the management-plane generation used by the LayerSentry v1.0 offline ISO. Root and extension package versions remain the stable `1.8.2` release identity.

## Production user experience

- The cluster landing page presents a concise LayerSentry operational overview.
- Platform version and creation time use semantic description-list markup.
- Capacity and recent-event sections have a consistent heading hierarchy.
- Event tabs use localized, descriptive labels.
- Upgrade state uses a keyboard-focusable status control, live announcements, semantic status colors, and controlled in-product release metadata.
- The support page provides cluster context, support-bundle and kubeconfig actions, readiness and change-control guidance, internal diagnostics, and a security notice without directing operators to uncontrolled community destinations.
- Branding previews have accessible alternative text and announce validation failures.
- Logo and favicon uploads accept only supported image data URLs; SVG active content and external references are rejected before persistence.

## Design system and accessibility

- LayerSentry design tokens cover light and dark color schemes, surfaces, borders, text, focus, status, spacing, radius, shadow, and motion.
- Production styling uses no gradients.
- Reduced-motion preferences are honored.
- Windows High Contrast / forced-colors mode retains borders, focus indication, and control operability.
- Responsive layouts constrain dashboard, support, branding, and upgrade surfaces on narrow viewports.

## Branding asset correction

The corrupt legacy wordmark asset is removed. The single-product header uses the canonical LayerSentry icon from `pkg/harvester/assets/layersentry/layer-sentry-icon.svg`; custom administrator-provided logos remain supported through validated branding settings.

## Security boundary

The browser UI does not read or embed node enrollment material. Source and generated package validation reject known markers for:

- `bootstrap-credentials.json`
- `nodePassword`
- `clusterToken`
- private keys
- kubeconfig-like cluster material

The UI qualification process does not access `C:\ProgramData\LayerSentry\bootstrap-credentials.json` and performs no VM, node, Rancher, RKE2, Kubernetes, KubeVirt, Longhorn, storage, or network mutation.

## Acceptance gates

A single release commit must pass:

1. stable v1.8.2 and Rancher 2.14 identity validation;
2. LayerSentry branding and operations source contracts;
3. zero-warning ESLint;
4. extension package build;
5. generated browser-bundle validation and credential-isolation scan;
6. SHA-256 manifest generation;
7. hosted distribution build;
8. embedded distribution build;
9. dependency-audit review;
10. runtime browser validation on a stable LayerSentry cluster before deployment approval.

Repository build qualification does not, by itself, approve deployment or production release.
