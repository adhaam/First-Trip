import type { ContactInput, TripRequestInput, TripRequestQuoteInput } from '@/lib/trip-requests/schema'
import { roomsFit } from './rooms'
import type { BuilderCatalog, BuilderState } from './types'

export type SectionId = 'origin' | 'transport' | 'dates' | 'travelers' | 'stay' | 'rooms' | 'experiences' | 'overview' | 'contact'
export type SectionState = { status: 'complete' | 'optional' | 'needs_input' | 'not_applicable'; reason: string }

export function sectionStatus(state: BuilderState, catalog: BuilderCatalog): Record<SectionId, SectionState> {
  const transport = state.transport_mode
  const stayOnly = transport === 'stay_only'
  const stay = catalog.accommodations.find((item) => item.id === state.accommodation_id)
  const hasStay = Boolean(state.accommodation_id)
  const people = (state.adults ?? 1) + (state.children ?? 0)
  const roomsAreValid = Boolean(state.room_allocations?.length && roomsFit(people, state.room_allocations))

  return {
    origin: stayOnly ? { status: 'not_applicable', reason: 'stay_only' } : state.origin_governorate_code ? { status: 'complete', reason: 'selected' } : { status: 'needs_input', reason: 'origin_required' },
    transport: transport ? { status: 'complete', reason: 'selected' } : { status: 'needs_input', reason: 'mode_required' },
    dates: !transport
      ? { status: 'needs_input', reason: 'mode_required' }
      : stayOnly
        ? hasValidStayRange(state) ? { status: 'complete', reason: 'selected' } : { status: 'needs_input', reason: 'stay_dates_required' }
        : state.stay_pattern_code && state.arrival_date ? { status: 'complete', reason: 'selected' } : { status: 'needs_input', reason: 'transport_dates_required' },
    travelers: (state.adults ?? 0) >= 1 && state.travellers_confirmed
      ? { status: 'complete', reason: 'selected' }
      : { status: 'needs_input', reason: state.travellers_confirmed ? 'adult_required' : 'travellers_confirmation_required' },
    stay: hasStay
      ? stay ? { status: 'complete', reason: 'selected' } : { status: 'needs_input', reason: 'stay_unavailable' }
      : stayOnly ? { status: 'needs_input', reason: 'stay_required' } : { status: 'optional', reason: 'transfer_only_allowed' },
    rooms: hasStay
      ? roomsAreValid ? { status: 'complete', reason: 'selected' } : state.room_allocations?.length ? { status: 'needs_input', reason: 'rooms_do_not_fit' } : { status: 'optional', reason: 'suggested_at_quote' }
      : { status: 'not_applicable', reason: 'no_stay' },
    experiences: { status: 'optional', reason: 'optional' },
    overview: transport ? { status: 'complete', reason: 'review' } : { status: 'needs_input', reason: 'journey_required' },
    contact: state.contact?.name && state.contact.phone ? { status: 'complete', reason: 'provided' } : { status: 'needs_input', reason: 'contact_required' },
  }
}

export function quoteReadiness(state: BuilderState): { ready: boolean; missing: SectionId[] } {
  const missing: SectionId[] = []
  if (!state.transport_mode) missing.push('transport')
  if (state.transport_mode === 'stay_only') {
    if (!hasValidStayRange(state)) missing.push('dates')
    if (!state.accommodation_id) missing.push('stay')
  } else {
    if (!state.origin_governorate_code) missing.push('origin')
    if (!state.stay_pattern_code || !state.arrival_date) missing.push('dates')
  }
  if ((state.adults ?? 0) < 1 || !state.travellers_confirmed) missing.push('travelers')
  return { ready: missing.length === 0, missing }
}

function quoteExperiences(state: BuilderState) {
  return (state.experiences ?? []).map((experience) => ({
    kind: experience.kind,
    id: experience.id,
    ...(experience.preferred_date ? { preferred_date: experience.preferred_date } : {}),
  }))
}

export function toQuotePayload(state: BuilderState, locale: 'ar' | 'en'): TripRequestQuoteInput {
  const transportMode = state.transport_mode
  const hasAccommodation = Boolean(state.accommodation_id)
  const isStayOnly = transportMode === 'stay_only'
  const isTransport = Boolean(transportMode && !isStayOnly)
  const payload = {
    locale,
    source: 'website' as const,
    transport_mode: transportMode,
    arrival_date: state.arrival_date,
    adults: state.adults ?? 1,
    children: state.children ?? 0,
    experiences: quoteExperiences(state),
    ...(isTransport && state.origin_governorate_code ? { origin_governorate_code: state.origin_governorate_code } : {}),
    ...(isTransport && state.stay_pattern_code ? { stay_pattern_code: state.stay_pattern_code } : {}),
    ...(isStayOnly && state.departure_date ? { departure_date: state.departure_date } : {}),
    ...(hasAccommodation ? { accommodation_id: state.accommodation_id } : {}),
    ...(hasAccommodation && state.room_allocations?.length ? { room_allocations: state.room_allocations } : {}),
    ...(hasAccommodation && state.meal_plan_key ? { meal_plan_key: state.meal_plan_key } : {}),
    ...(hasAccommodation && state.upgrade_id ? { upgrade_id: state.upgrade_id } : {}),
  }
  return payload as TripRequestQuoteInput
}

export function toSubmitPayload(state: BuilderState, contact: ContactInput, locale: 'ar' | 'en', extras: { notes?: string; website?: string; turnstile_token?: string } = {}): TripRequestInput {
  return {
    ...toQuotePayload(state, locale),
    contact,
    builder_stage: 'submitted',
    source: 'website',
    ...(extras.notes ? { notes: extras.notes } : {}),
    ...(extras.website ? { website: extras.website } : {}),
    ...(extras.turnstile_token ? { turnstile_token: extras.turnstile_token } : {}),
  }
}

/** A stay-only range is usable only once check-out is strictly after check-in. */
function hasValidStayRange(state: BuilderState): boolean {
  return Boolean(state.arrival_date && state.departure_date && state.departure_date > state.arrival_date)
}
