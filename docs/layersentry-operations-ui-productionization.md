# LayerSentry operations UI production gate

## Scope

This change productionizes the LayerSentry operations experience without changing cluster state, node enrollment, credentials, storage, networking, or workloads.

Source commit under qualification:

`a62a90e7e1055c47e369ac5a25a9bfd89fd08bf2`

## User experience controls

- The cluster landing page now has a LayerSentry operational-overview heading and concise description.
- Platform version and cluster creation time use semantic description-list markup.
- Capacity and recent-events sections follow a consistent heading hierarchy.
- Event tabs use localized LayerSentry presentation strings rather than hard-coded labels.
- Resource cards use stable resource identifiers as render keys.
- Upgrade status uses a keyboard-focusable button with an accessible name and live status announcements.
- Upstream release destinations are not exposed from the upgrade status surface; release metadata remains in-product.

## Visual-system controls

- Shared LayerSentry tokens define light and dark color schemes, semantic positive/warning/critical status colors, focus treatment, surfaces, borders, typography, radius, and motion.
- Production styles contain no gradients.
- Reduced-motion preferences are respected.
- Windows High Contrast / forced-colors mode preserves borders, focus, and operability.
- Mobile layouts constrain the upgrade panel to the viewport.

## Security boundary

The UI source and generated browser bundle must never contain bootstrap credential filenames, node passwords, cluster join tokens, kubeconfig contents, certificates, private keys, or other enrollment material. The production source contract explicitly rejects known bootstrap-credential markers in the affected UI files.

This UI change does not read `C:\ProgramData\LayerSentry\bootstrap-credentials.json`, does not call the live cluster, and does not authorize any node, Rancher, RKE2, Kubernetes, KubeVirt, Longhorn, disk, VM, or network mutation.

## Required qualification

The branch is accepted only after all of the following pass from the same Git commit:

1. LayerSentry branding source contract.
2. LayerSentry operations UI and credential-isolation contract.
3. ESLint with zero warnings.
4. Extension package build.
5. Generated package manifest and SHA-256 checksums.
6. Hosted distribution build.
7. Embedded distribution build.
8. Runtime browser validation against a stable LayerSentry cluster before deployment approval.

A successful repository build is not, by itself, production deployment approval. Runtime browser validation and cluster health remain separate gates.
