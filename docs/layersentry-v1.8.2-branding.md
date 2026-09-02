# LayerSentry v1.8.2 frontend branding

## Status

This branch carries the stable, frontend-only LayerSentry presentation layer for the Harvester UI extension package version `1.8.2`.

Repository build qualification is separate from live-cluster deployment qualification. The UI must not be installed into the lab until the three-node recovery gate has passed and the Harvester first-run EULA/password step has been completed manually.

## Branding contract

Visible product presentation uses **LayerSentry**:

- compact product and catalog icon;
- full wordmark in the single-product navigation header;
- catalog display name and package description;
- dashboard, support, branding, monitoring, backup, migration, settings and operator-facing copy;
- scoped light/dark semantic styling anchored to `#000f42`;
- responsive, focus-visible and reduced-motion behavior.

The complete upstream English locale is loaded first, then the narrow LayerSentry overlay is merged with `mergeWithReplace`. The overlay must never replace the complete locale by itself.

## Compatibility boundary

The following technical contracts deliberately remain unchanged:

- package and product identity `harvester`;
- `harvester.*` localization keys;
- `harvesterhci.io`, KubeVirt, Longhorn and Rancher resource identifiers;
- API endpoints, schemas, stores, models, controllers, routes, validators and RBAC;
- VM, storage, network, migration, backup and snapshot behavior.

Customer private-label controls remain enabled for vendor name, light/dark logos, favicon, primary color and link color.

## Validation and artifacts

The production validation workflow requires:

- stable root and package version `1.8.2`;
- frozen dependency installation, lint and package build;
- exact LayerSentry icon and wordmark wiring;
- complete-locale merge protection;
- private-label support preservation;
- presentation-copy and theme-contract checks;
- generated package content containing LayerSentry markers.

After merge to `release-layersentry-v1.8.2`, the offline asset workflow rebuilds:

- `v1.8.2.tar.gz` for the embedded dashboard payload;
- `harvester-v1.8.2.tar.gz` for the embedded Harvester plugin payload;
- SHA-512 checksums, file inventories and a sanitized manifest.

No credential, token, password or kubeconfig belongs in this repository or its workflow artifacts.
