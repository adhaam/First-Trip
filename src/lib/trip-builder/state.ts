import type { DraftFields } from '@/lib/trip-requests/draft'
import type { RoomAllocationInput, TransportMode } from '@/lib/trip-requests/schema'
import { isValidArrival, patternsForMode } from './dates'
import { suggestRooms } from './rooms'
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

export function applyPrefill(state: BuilderState, params: Record<string, string | string[] | undefined>, catalog: BuilderCatalog): BuilderState {
  let result: BuilderState = { ...state, experiences: [...(state.experiences ?? [])] }
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
  | { type: 'setRooms'; allocations?: RoomAllocationInput[] }
  | { type: 'setMeal'; key?: string }
  | { type: 'setUpgrade'; id?: string }
  | { type: 'toggleExperience'; kind: 'trip' | 'trip_package'; id: string }
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

function sameAllocations(left: RoomAllocationInput[] | undefined, right: RoomAllocationInput[]) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function setStay(next: BuilderState, state: BuilderState, id: string | undefined, catalog?: BuilderCatalog) {
  next.accommodation_id = id
  const stay = catalog?.accommodations.find((item) => item.id === id)

  if (!stay) {
    delete next.meal_plan_key
    delete next.upgrade_id
    delete next.room_allocations
    return
  }

  if (id !== state.accommodation_id) {
    next.room_allocations = suggestRooms((next.adults ?? 1) + (next.children ?? 0))
  }
  if (next.meal_plan_key && !stay.meal_plans.some((meal) => meal.key === next.meal_plan_key)) {
    delete next.meal_plan_key
  }
  if (next.upgrade_id && !stay.room_upgrades.some((upgrade) => upgrade.id === next.upgrade_id)) {
    delete next.upgrade_id
  }
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  if (action.type === 'reset') return initialBuilderState()
  if (action.type === 'hydrate') return { ...initialBuilderState(), ...action.draft }

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
      invalidateArrival(next, action.catalog)
      break
    case 'setArrival':
      next.arrival_date = action.arrival
      break
    case 'setDeparture':
      next.departure_date = action.departure
      break
    case 'setTravelers': {
      const previousPeople = (state.adults ?? 1) + (state.children ?? 0)
      const people = Math.max(1, Math.floor(action.adults) || 1) + Math.max(0, Math.floor(action.children) || 0)
      const previousSuggestion = suggestRooms(previousPeople)
      next.adults = Math.max(1, Math.floor(action.adults) || 1)
      next.children = Math.max(0, Math.floor(action.children) || 0)
      if (state.accommodation_id && (!state.room_allocations || sameAllocations(state.room_allocations, previousSuggestion))) {
        next.room_allocations = suggestRooms(people)
      }
      break
    }
    case 'setStay':
      setStay(next, state, action.id, action.catalog)
      break
    case 'setRooms':
      next.room_allocations = action.allocations
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
    case 'setNotes':
      next.notes = action.notes
      break
    case 'setContact':
      next.contact = { ...next.contact, ...action.contact }
      break
  }

  return next
}
