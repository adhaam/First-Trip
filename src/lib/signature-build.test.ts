// Run with: npx tsx --test src/lib/signature-build.test.ts

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_SIGNATURE_BUILD_DRAFT,
  buildSignatureRequestPayload,
  furthestReachableStep,
  isDraftSubmittable,
  isStepValid,
  type SignatureBuildDraft,
} from './signature-build'

function draft(overrides: Partial<SignatureBuildDraft>): SignatureBuildDraft {
  return { ...EMPTY_SIGNATURE_BUILD_DRAFT, ...overrides }
}

test('experience step requires a real idea, not a couple of characters', () => {
  assert.equal(isStepValid('experience', draft({ experienceIdea: 'hi' })), false)
  assert.equal(isStepValid('experience', draft({ experienceIdea: 'a sunset dive at the Blue Hole' })), true)
})

test('travelers step requires an integer in range', () => {
  assert.equal(isStepValid('travelers', draft({ travelers: 0 })), false)
  assert.equal(isStepValid('travelers', draft({ travelers: 51 })), false)
  assert.equal(isStepValid('travelers', draft({ travelers: 1.5 })), false)
  assert.equal(isStepValid('travelers', draft({ travelers: 4 })), true)
})

test('when step: flexible is always valid, fixed requires a real date', () => {
  assert.equal(isStepValid('when', draft({ dateMode: 'flexible', preferredDate: '' })), true)
  assert.equal(isStepValid('when', draft({ dateMode: 'fixed', preferredDate: '' })), false)
  assert.equal(isStepValid('when', draft({ dateMode: 'fixed', preferredDate: '2026-05-01' })), true)
})

test('vibe step never blocks progress', () => {
  assert.equal(isStepValid('vibe', draft({})), true)
})

test('contact step requires a name and a phone-length number', () => {
  assert.equal(isStepValid('contact', draft({ fullName: 'Al', phone: '01005744083' })), false)
  assert.equal(isStepValid('contact', draft({ fullName: 'Ali', phone: '123' })), false)
  assert.equal(isStepValid('contact', draft({ fullName: 'Ali', phone: '01005744083' })), true)
})

test('furthestReachableStep advances through every valid step and stops before contact (no name/phone yet)', () => {
  const d = draft({ experienceIdea: 'a full week exploring Sinai by camel and boat' })
  assert.equal(furthestReachableStep(d), 'vibe')
})

test('furthestReachableStep never advances past an empty experience idea', () => {
  assert.equal(furthestReachableStep(draft({})), 'experience')
})

test('isDraftSubmittable is true only once every step is valid', () => {
  const incomplete = draft({ experienceIdea: 'a full week exploring Sinai by camel and boat' })
  assert.equal(isDraftSubmittable(incomplete), false)

  const complete = draft({
    experienceIdea: 'a full week exploring Sinai by camel and boat',
    fullName: 'Ali Hassan',
    phone: '01005744083',
  })
  assert.equal(isDraftSubmittable(complete), true)
})

test('buildSignatureRequestPayload folds free-form fields into interests/notes without inventing anything', () => {
  const d = draft({
    experienceIdea: 'A quiet week of diving and desert camps',
    vibes: ['diving', 'desert'],
    travelers: 3,
    occasion: 'anniversary',
    dateMode: 'fixed',
    preferredDate: '2026-06-01',
    pace: 'relaxed',
    budgetComfort: 'mid',
    fullName: 'Ali Hassan',
    phone: '01005744083',
    email: 'ali@example.com',
  })
  const payload = buildSignatureRequestPayload(d)
  assert.equal(payload.full_name, 'Ali Hassan')
  assert.equal(payload.phone, '01005744083')
  assert.equal(payload.email, 'ali@example.com')
  assert.equal(payload.preferred_date, '2026-06-01')
  assert.equal(payload.spots_requested, 3)
  assert.equal(payload.interests, 'A quiet week of diving and desert camps · diving · desert')
  assert.equal(payload.duration_preference, '')
  assert.match(payload.notes, /Occasion: anniversary/)
  assert.match(payload.notes, /Pace: relaxed/)
  assert.match(payload.notes, /Budget comfort: mid/)
  assert.match(payload.notes, /Dates: 2026-06-01/)
})

test('buildSignatureRequestPayload omits empty optional fields entirely', () => {
  const d = draft({
    experienceIdea: 'A quiet week of diving and desert camps',
    fullName: 'Ali Hassan',
    phone: '01005744083',
  })
  const payload = buildSignatureRequestPayload(d)
  assert.equal(payload.email, undefined)
  assert.equal(payload.preferred_date, undefined)
  assert.equal(payload.notes, 'Dates: flexible')
})
