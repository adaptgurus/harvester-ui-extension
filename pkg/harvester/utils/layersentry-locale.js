const LAYERSENTRY_VENDOR = 'LayerSentry';

const PRESENTATION_REPLACEMENTS = [
  [/\bSUSE Harvester\b/g, LAYERSENTRY_VENDOR],
  [/\bHarvester HCI\b/g, LAYERSENTRY_VENDOR],
  [/\bRancher Dashboard\b/g, `${ LAYERSENTRY_VENDOR } Console`],
  [/\bRancher Manager\b/g, `${ LAYERSENTRY_VENDOR } Management Plane`],
  [/\bHarvester\b/g, LAYERSENTRY_VENDOR],
  [/\bRancher\b/g, LAYERSENTRY_VENDOR],
];

function brandPresentationString(value) {
  return PRESENTATION_REPLACEMENTS.reduce(
    (out, [pattern, replacement]) => out.replace(pattern, replacement),
    value
  );
}

/**
 * Brand translation values without changing translation keys, API identifiers,
 * namespaces, resource kinds, URLs, or controller contracts. Technical names in
 * those locations are lowercase or embedded in a larger identifier and are not
 * matched by the presentation-only word-boundary replacements above.
 */
export function brandLayerSentryLocale(value) {
  if (typeof value === 'string') {
    return brandPresentationString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => brandLayerSentryLocale(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, brandLayerSentryLocale(item)])
    );
  }

  return value;
}
