export {
  BUILDER_STAGES,
  EXPERIENCE_KINDS,
  TRANSPORT_MODES,
  TRIP_REQUEST_SOURCES,
  contactSchema,
  experienceSelectionSchema,
  roomAllocationSchema,
  tripRequestSchema,
} from './schema'
export type {
  BuilderStage,
  ContactInput,
  ExperienceKind,
  ExperienceSelection,
  RoomAllocationInput,
  TransportMode,
  TripRequestInput,
  TripRequestSource,
} from './schema'

export {
  buildTripRequestRow,
  resolveJourneyDates,
  toQuoteRequest,
  tripRequestPaymentParts,
} from './build'
export type { JourneyDates, JourneyDatesResult, PaymentPart } from './build'

export { DRAFT_VERSION, parseDraft, serializeDraft, tripRequestDraftSchema } from './draft'
export type { DraftFields, ParseDraftResult, TripRequestDraft } from './draft'

export { createTripRequest } from './service'
export type { CreateTripRequestResult } from './service'
