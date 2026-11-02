import type { DraftFields } from '@/lib/trip-requests/draft'
import type { RoomAllocationInput, TransportMode } from '@/lib/trip-requests/schema'
import { isValidArrival, patternsForMode } from './dates'
import { roomsStillValid } from './rooms'
import type { BuilderCatalog, BuilderState } from './types'

const TRANSPORT_MODES: readonly TransportMode[] = ['package_bus', 'hiace', 'stay_only']

export function initialBuilderState(): BuilderState {
  return { locale: 'en', source: 'website', adults: 1, children: 0, experiences: [], contact: {} }
}

function values(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function isTransportMode(value: string | undefined): value is TransportMode {
  return Boolean(value && TRANSPORT_MODES.includes(value as TransportMode))
}

function supportsMode(catalog: BuilderCatalog, origin: string, mode: TransportMode | undefined) {
  const governorate = catalog.governorates.find((item) => item.code === origin)
  return Boolean(governorate && (!mode || mode === 'stay_only' || governorate.transfer_types.includes(mode)))
}

function mergeExperiences(existing: NonNullable<BuilderState['experiences']>, additions: NonNullable<BuilderState['experiences']>) {
  const merged: NonNullable<BuilderState['experiences']> = []
  const seen = new Set<string>()

  for (const experience of [...existing, ...additions]) {
    const key = `${experience.kind}:${experience.id}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(experience)
    if (merged.length === 10) break
  }
  return merged
}

/**
 * Drops anything a stored draft carries that the live catalogue no longer
 * offers (a stay, meal plan, upgrade, trip or package taken offline, an
 * origin no longer served, an arrival date now in the past) so a reload can
 * never send — or price — a selection the customer can't actually book.
 */
export function sanitizeDraft(state: BuilderState, catalog: BuilderCatalog): BuilderState {
  const next: BuilderState = { ...state, experiences: [...(state.experiences ?? [])], contact: { ...(state.contact ?? {}) } }

  if (next.origin_governorate_code && !supportsMode(catalog, next.origin_governorate_code, next.transport_mode)) {
    delete next.origin_governorate_code
  }
  if (next.accommodation_id && !catalog.accommodations.some((item) => item.id === next.accommodation_id)) {
    delete next.accommodation_id
  }
  setStay(next, next, next.accommodation_id, catalog)
  if (next.transport_mode !== 'stay_only' || next.accommodation_id) delete next.no_accommodation
  if (next.departure_date && next.arrival_date && next.departure_date <= next.arrival_date) delete next.departure_date

  next.experiences = (next.experiences ?? []).filter((experience) => experience.kind === 'trip'
    ? catalog.trips.some((item) => item.id === experience.id)
    : catalog.packages.some((item) => item.id === experience.id))
  invalidateArrival(next, catalog)
  return next
}

export function applyPrefill(state: BuilderState, params: Record<string, string | string[] | undefined>, catalog: BuilderCatalog): BuilderState {
  let result: BuilderState = sanitizeDraft(state, catalog)
  const mode = values(params.mode)[0]

  if (isTransportMode(mode)) {
    result = builderReducer(result, { type: 'setMode', mode, catalog })
  }

  const origin = values(params.from)[0]
  if (origin && supportsMode(catalog, origin, result.transport_mode)) {
    result = builderReducer(result, { type: 'setOrigin', origin, catalog })
  }

  const stay = values(params.stay)[0]
  if (stay && catalog.accommodations.some((item) => item.id === stay)) {
    result = builderReducer(result, { type: 'setStay', id: stay, catalog })
  }

  const additions = [
    ...values(params.trip).filter((id) => catalog.trips.some((item) => item.id === id)).map((id) => ({ kind: 'trip' as const, id })),
    ...values(params.package).filter((id) => catalog.packages.some((item) => item.id === id)).map((id) => ({ kind: 'trip_package' as const, id })),
  ]
  result.experiences = mergeExperiences(result.experiences ?? [], additions)
  return result
}

export type BuilderAction =
  | { type: 'setOrigin'; origin?: string; catalog?: BuilderCatalog }
  | { type: 'setMode'; mode?: TransportMode; catalog?: BuilderCatalog }
  | { type: 'setPattern'; pattern?: string; catalog?: BuilderCatalog }
  | { type: 'setArrival'; arrival?: string }
  | { type: 'setDeparture'; departure?: string }
  | { type: 'setTravelers'; adults: number; children: number }
  | { type: 'setStay'; id?: string; catalog?: BuilderCatalog }
  /** Self-arrival only: "I don't need accommodation — trips only". */
  | { type: 'setNoAccommodation' }
  /** Explicit "Continue" on the Travellers step: confirms the counts as they are. */
  | { type: 'confirmTravelers' }
  | { type: 'setRooms'; allocations?: RoomAllocationInput[] }
  | { type: 'useRecommendedRooms' }
  | { type: 'setMeal'; key?: string }
  | { type: 'setUpgrade'; id?: string }
  | { type: 'toggleExperience'; kind: 'trip' | 'trip_package'; id: string }
  | { type: 'removeExperience'; kind: 'trip' | 'trip_package'; id: string }
  | { type: 'setNotes'; notes?: string }
  | { type: 'setContact'; contact: Partial<NonNullable<DraftFields['contact']>> }
  | { type: 'reset' }
  | { type: 'hydrate'; draft: BuilderState }

function invalidateArrival(next: BuilderState, catalog?: BuilderCatalog) {
  if (!catalog || !next.arrival_date) return
  if (!isValidArrival(catalog.schedule, {
    mode: next.transport_mode,
    patternCode: next.stay_pattern_code,
    originCode: next.origin_governorate_code,
    arrivalDate: next.arrival_date,
    today: catalog.today,
  })) {
    delete next.arrival_date
  }
}

function setStay(next: BuilderState, state: BuilderState, id: string | undefined, catalog?: BuilderCatalog) {
  next.accommodation_id = id
  const stay = catalog?.accommodations.find((item) => item.id === id)

  if (!stay) {
    delete next.meal_plan_key
    delete next.upgrade_id
    clearRooms(next)
    return
  }

  // Rooms are server-recommended (auto) until the customer overrides them;
  // a new stay always starts back in auto mode.
  if (id !== state.accommodation_id) clearRooms(next)
  if (next.meal_plan_key && !stay.meal_plans.some((meal) => meal.key === next.meal_plan_key)) {
    delete next.meal_plan_key
  }
  if (next.upgrade_id && !stay.room_upgrades.some((upgrade) => upgrade.id === next.upgrade_id)) {
    delete next.upgrade_id
  }
}

/** Back to auto mode: the server recommends the lowest-priced valid rooms. */
function clearRooms(next: BuilderState) {
  delete next.room_allocations
  delete next.rooms_customized
}

/**
 * Only allocations the customer picked (`rooms_customized`) survive a reload.
 * Drafts saved before the server picked rooms carry the old client-side guess
 * (ceil(people / 2) doubles) without the marker, so they return to auto mode.
 */
function hydrateDraft(draft: BuilderState): BuilderState {
  const next: BuilderState = { ...initialBuilderState(), ...draft }
  if (!next.rooms_customized || !next.room_allocations?.length) clearRooms(next)
  return next
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  if (action.type === 'reset') return initialBuilderState()
  if (action.type === 'hydrate') return hydrateDraft(action.draft)

  const next: BuilderState = {
    ...state,
    experiences: [...(state.experiences ?? [])],
    contact: { ...(state.contact ?? {}) },
  }

  switch (action.type) {
    case 'setOrigin':
      next.origin_governorate_code = action.origin
      invalidateArrival(next, action.catalog)
      break
    case 'setMode': {
      next.transport_mode = action.mode
      if (action.mode === 'stay_only') {
        delete next.origin_governorate_code
        delete next.stay_pattern_code
      } else {
        delete next.departure_date
        delete next.no_accommodation
        const patterns = action.catalog && patternsForMode(action.catalog.schedule, action.mode)
        if (next.stay_pattern_code && patterns && !patterns.some((pattern) => pattern.code === next.stay_pattern_code)) {
          delete next.stay_pattern_code
        }
      }
      invalidateArrival(next, action.catalog)
      break
    }
    case 'setPattern':
      next.stay_pattern_code = action.pattern
      // A preset pattern derives its own return date; a custom hiace booking
      // (action.pattern undefined) keeps any client-chosen departure_date.
      if (action.pattern) delete next.departure_date
      invalidateArrival(next, action.catalog)
      break
    case 'setArrival':
      next.arrival_date = action.arrival
      break
    case 'setDeparture':
      next.departure_date = action.departure
      break
    case 'setTravelers': {
      const people = Math.max(1, Math.floor(action.adults) || 1) + Math.max(0, Math.floor(action.children) || 0)
      next.adults = Math.max(1, Math.floor(action.adults) || 1)
      next.children = Math.max(0, Math.floor(action.children) || 0)
      next.travellers_confirmed = true
      // Keep the customer's own rooms only while they still fit this party;
      // otherwise fall back to the server's recommendation (auto mode).
      if (next.room_allocations && !roomsStillValid(people, next.room_allocations)) clearRooms(next)
      break
    }
    case 'setStay':
      setStay(next, state, action.id, action.catalog)
      if (action.id) delete next.no_accommodation
      break
    case 'setNoAccommodation':
      // Same as removing the stay (rooms, meal plan and upgrade go with it),
      // plus the explicit choice, so the stay step reads as answered.
      setStay(next, state, undefined, undefined)
      next.no_accommodation = true
      break
    case 'confirmTravelers':
      next.adults = Math.max(1, Math.floor(next.adults ?? 1) || 1)
      next.children = Math.max(0, Math.floor(next.children ?? 0) || 0)
      next.travellers_confirmed = true
      break
    case 'setRooms':
      if (action.allocations?.length) {
        next.room_allocations = action.allocations
        next.rooms_customized = true
      } else clearRooms(next)
      break
    case 'useRecommendedRooms':
      clearRooms(next)
      break
    case 'setMeal':
      next.meal_plan_key = action.key
      break
    case 'setUpgrade':
      next.upgrade_id = action.id
      break
    case 'toggleExperience': {
      const experiences = next.experiences ?? []
      const index = experiences.findIndex((item) => item.kind === action.kind && item.id === action.id)
      if (index >= 0) experiences.splice(index, 1)
      else if (experiences.length < 10) experiences.push({ kind: action.kind, id: action.id })
      next.experiences = experiences
      break
    }
    case 'removeExperience':
      next.experiences = (next.experiences ?? []).filter(
        (item) => item.kind !== action.kind || item.id !== action.id,
      )
      break
    case 'setNotes':
      next.notes = action.notes
      break
    case 'setContact':
      next.contact = { ...next.contact, ...action.contact }
      break
  }

  return next
}
