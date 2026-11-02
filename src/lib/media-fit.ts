/**
 * Adaptive fit for hotel (and other supplier) photography.
 *
 * Photos arrive from suppliers and dashboard uploads in every size and
 * orientation. A blanket `object-cover` crops portraits and panoramas badly;
 * a blanket `object-contain` leaves ugly bars on ordinary landscape shots.
 * This module is the single, pure decision point:
 *
 *   - `cover`   when cropping to the frame loses little of the photo;
 *   - `contain` when it would lose a lot (portrait in a landscape frame, very
 *               wide panorama, square in a wide hero) — the photo is shown
 *               whole, on a neutral backdrop, never stretched;
 *   - `lowRes`  when the photo has far fewer pixels than the frame needs, so
 *               it must not be blown up: it is shown contained at (at most)
 *               its natural size.
 *
 * Unknown dimensions (image not loaded yet) default to `cover` so the first
 * paint matches the common case and the layout never jumps.
 */

export type MediaFitMode = 'cover' | 'contain'

export interface MediaFitInput {
  naturalWidth?: number | null
  naturalHeight?: number | null
  /** Frame width / height (e.g. 4/3). */
  frameAspect: number
  /** Rendered frame width in CSS pixels, if known. */
  renderedWidth?: number | null
  devicePixelRatio?: number | null
}

export interface MediaFit {
  mode: MediaFitMode
  /** Too few pixels for the frame — render at natural size at most. */
  lowRes: boolean
  /** Photo width / height, or null while unknown. */
  photoAspect: number | null
}

/** Share of the photo that may be cropped away under `cover`. */
export const MAX_CROP_LOSS = 0.25

/**
 * A photo is low-res when it has less than this share of the pixels the frame
 * needs (rendered width x device pixel ratio). 0.5 means "below roughly 1x on
 * a 2x display" — a margin large enough that ordinary web photos never trip it.
 */
export const LOW_RES_RATIO = 0.5

/** Used when the rendered width is unknown: below this the photo is tiny. */
export const LOW_RES_ABSOLUTE_WIDTH = 320

const EPSILON = 1e-6

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** Fraction of the photo lost when it is cropped (cover) to fill the frame. */
export function cropLoss(photoAspect: number, frameAspect: number): number {
  const ratio = photoAspect > frameAspect ? frameAspect / photoAspect : photoAspect / frameAspect
  return 1 - ratio
}

export function decideMediaFit(input: MediaFitInput): MediaFit {
  const { naturalWidth, naturalHeight, frameAspect } = input
  if (!isPositive(naturalWidth) || !isPositive(naturalHeight) || !isPositive(frameAspect)) {
    return { mode: 'cover', lowRes: false, photoAspect: null }
  }

  const photoAspect = naturalWidth / naturalHeight

  let lowRes: boolean
  if (isPositive(input.renderedWidth)) {
    const dpr = isPositive(input.devicePixelRatio) ? Math.min(input.devicePixelRatio, 2) : 1
    lowRes = naturalWidth < input.renderedWidth * dpr * LOW_RES_RATIO
  } else {
    lowRes = naturalWidth < LOW_RES_ABSOLUTE_WIDTH
  }

  const mode: MediaFitMode =
    !lowRes && cropLoss(photoAspect, frameAspect) <= MAX_CROP_LOSS + EPSILON ? 'cover' : 'contain'

  return { mode, lowRes, photoAspect }
}

/**
 * Normalises a gallery's image list: trims, drops empty / non-string entries
 * and exact duplicates, preserving the given order (index 0 stays the cover).
 */
export function normalizeGalleryImages(images: ReadonlyArray<string | null | undefined> | null | undefined): string[] {
  if (!images) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const image of images) {
    if (typeof image !== 'string') continue
    const src = image.trim()
    if (!src || seen.has(src)) continue
    seen.add(src)
    out.push(src)
  }
  return out
}
