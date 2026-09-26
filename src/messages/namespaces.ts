/**
 * WEEMAP V2 message namespaces.
 *
 * Each namespace lives in its own file per locale — src/messages/<locale>/<ns>.json,
 * whose top-level object IS the namespace (use it as useTranslations('<ns>')).
 * They are merged on top of the legacy src/messages/<locale>.json by
 * src/i18n/request.ts, and must never reuse a legacy top-level key.
 *
 * Splitting by surface keeps parallel work from colliding in one 600-line file.
 */
export const V2_NAMESPACES = [
  'ia',
  'ui',
  'homeV2',
  'builder',
  'stays',
  'explore',
  'signatureV2',
  'editions',
  'shopV2',
  'communityV2',
  'ops',
  'opsConfig',
  'discovery',
] as const

export type V2Namespace = (typeof V2_NAMESPACES)[number]
