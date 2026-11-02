import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cropLoss, decideMediaFit, normalizeGalleryImages } from './media-fit'

const FOUR_THREE = 4 / 3

test('unknown dimensions default to cover until the image loads', () => {
  for (const input of [
    { frameAspect: FOUR_THREE },
    { naturalWidth: 0, naturalHeight: 0, frameAspect: FOUR_THREE },
    { naturalWidth: null, naturalHeight: 800, frameAspect: FOUR_THREE },
    { naturalWidth: Number.NaN, naturalHeight: 800, frameAspect: FOUR_THREE },
  ]) {
    assert.deepEqual(decideMediaFit(input), { mode: 'cover', lowRes: false, photoAspect: null })
  }
  // A bad frame aspect must not throw or flip to contain.
  assert.equal(decideMediaFit({ naturalWidth: 1600, naturalHeight: 900, frameAspect: 0 }).mode, 'cover')
})

test('landscape photos close to the frame aspect are covered', () => {
  assert.equal(decideMediaFit({ naturalWidth: 1600, naturalHeight: 1200, frameAspect: FOUR_THREE }).mode, 'cover')
  assert.equal(decideMediaFit({ naturalWidth: 1800, naturalHeight: 1200, frameAspect: FOUR_THREE }).mode, 'cover') // 3:2
  assert.equal(decideMediaFit({ naturalWidth: 1920, naturalHeight: 1080, frameAspect: FOUR_THREE }).mode, 'cover') // 16:9, loses exactly 25%
  assert.equal(decideMediaFit({ naturalWidth: 1920, naturalHeight: 1080, frameAspect: 16 / 9 }).mode, 'cover')
})

test('portrait photos in a landscape frame are contained', () => {
  const fit = decideMediaFit({ naturalWidth: 1200, naturalHeight: 1600, frameAspect: FOUR_THREE })
  assert.equal(fit.mode, 'contain')
  assert.equal(fit.lowRes, false)
  assert.ok(fit.photoAspect !== null && fit.photoAspect < 1)
  // ...but a portrait in a portrait frame is fine.
  assert.equal(decideMediaFit({ naturalWidth: 1200, naturalHeight: 1600, frameAspect: 3 / 4 }).mode, 'cover')
})

test('square photos: covered in a 4:3 frame, contained in a wide hero', () => {
  assert.equal(decideMediaFit({ naturalWidth: 1200, naturalHeight: 1200, frameAspect: FOUR_THREE }).mode, 'cover')
  assert.equal(decideMediaFit({ naturalWidth: 1200, naturalHeight: 1200, frameAspect: 16 / 10 }).mode, 'contain')
  assert.equal(decideMediaFit({ naturalWidth: 1200, naturalHeight: 1200, frameAspect: 21 / 9 }).mode, 'contain')
})

test('very wide panoramas are contained, never cropped to a sliver', () => {
  assert.equal(decideMediaFit({ naturalWidth: 4000, naturalHeight: 1000, frameAspect: FOUR_THREE }).mode, 'contain')
  assert.equal(decideMediaFit({ naturalWidth: 4000, naturalHeight: 1000, frameAspect: 3 / 2 }).mode, 'contain')
})

test('tiny images are flagged low-res and contained, not blown up', () => {
  const fit = decideMediaFit({
    naturalWidth: 240,
    naturalHeight: 180, // a perfect 4:3 — would be cover if it were large
    frameAspect: FOUR_THREE,
    renderedWidth: 640,
    devicePixelRatio: 2,
  })
  assert.equal(fit.lowRes, true)
  assert.equal(fit.mode, 'contain')
})

test('low-res is judged against rendered width x device pixel ratio with a wide margin', () => {
  const base = { naturalHeight: 480, frameAspect: FOUR_THREE, renderedWidth: 640 }
  // 640px photo in a 640px frame on a 2x display: sharp enough, not flagged.
  assert.equal(decideMediaFit({ ...base, naturalWidth: 640, devicePixelRatio: 2 }).lowRes, false)
  // 300px photo in the same frame: flagged.
  assert.equal(decideMediaFit({ ...base, naturalWidth: 300, devicePixelRatio: 2 }).lowRes, true)
  // dpr is clamped to 2: a 3x phone does not flag a photo a 2x display accepts.
  assert.equal(decideMediaFit({ ...base, naturalWidth: 640, devicePixelRatio: 3 }).lowRes, false)
  // Missing dpr counts as 1.
  assert.equal(decideMediaFit({ ...base, naturalWidth: 320 }).lowRes, false)
})

test('without a rendered width, only genuinely tiny photos are flagged', () => {
  assert.equal(decideMediaFit({ naturalWidth: 200, naturalHeight: 150, frameAspect: FOUR_THREE }).lowRes, true)
  assert.equal(decideMediaFit({ naturalWidth: 800, naturalHeight: 600, frameAspect: FOUR_THREE }).lowRes, false)
})

test('cropLoss measures the share of the photo cropped away', () => {
  assert.equal(cropLoss(FOUR_THREE, FOUR_THREE), 0)
  assert.equal(cropLoss(2, 1), 0.5)
  assert.equal(cropLoss(0.5, 1), 0.5)
})

test('normalizeGalleryImages drops empties and duplicates and keeps order', () => {
  assert.deepEqual(normalizeGalleryImages(['a.jpg', '', '  ', 'b.jpg', 'a.jpg', null, undefined, ' c.jpg ', 'b.jpg']), [
    'a.jpg',
    'b.jpg',
    'c.jpg',
  ])
  assert.deepEqual(normalizeGalleryImages(null), [])
  assert.deepEqual(normalizeGalleryImages([]), [])
})
