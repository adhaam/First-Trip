import type { WorkItemRow } from '../work-items'

/**
 * Fixtures for Build Your Trip journeys (migration 049: ops_work_items gains journey_component and
 * converted). A "journey" is a trip_request converted into children: the parent trip_request row
 * itself (converted: true, payment_kind 'journey', amount_total/amount_paid set) plus its component
 * bookings/trip_bookings (journey_component: true, trip_request_id pointing at the parent). Every
 * non-journey row here is a standalone item: journey_component: false, converted: false.
 */

const JOURNEY_PARENT_ID = 'wr-2609-0001'
const JOURNEY_REFERENCE = 'WR-2609-0001'

const commonRow = {
  subtype: null,
  customer_id: 'cust-1',
  customer_name: 'Nour Adel',
  customer_phone: '+201000000000',
  people: 2,
  title_en: '',
  title_ar: '',
  transfer_type: null,
  source: 'website',
  created_at: '2026-09-10T00:00:00Z',
  updated_at: '2026-09-10T00:00:00Z',
}

/** BYT journey: stay + 3 trips, converted, commercial (payment_status is a real status, not the legacy marker). */
export const journeyParentStayAnd3Trips: WorkItemRow = {
  ...commonRow,
  entity_type: 'trip_request',
  entity_id: JOURNEY_PARENT_ID,
  reference: JOURNEY_REFERENCE,
  payment_kind: 'journey',
  status: 'confirmed',
  payment_status: 'partial',
  amount_total: 12000,
  amount_paid: 6000,
  start_date: '2026-10-05',
  end_date: '2026-10-10',
  trip_request_id: null,
  journey_component: false,
  converted: true,
}

export const journeyStayComponent: WorkItemRow = {
  ...commonRow,
  entity_type: 'accommodation_booking',
  entity_id: 'bk-2609-0001',
  reference: 'BK-2609-0001',
  payment_kind: 'journey',
  status: 'confirmed',
  payment_status: 'partial',
  amount_total: 6000,
  amount_paid: 3000,
  start_date: '2026-10-05',
  end_date: '2026-10-10',
  trip_request_id: JOURNEY_PARENT_ID,
  journey_component: true,
  converted: false,
}

function tripComponent(entity_id: string, reference: string, start_date: string): WorkItemRow {
  return {
    ...commonRow,
    entity_type: 'trip_booking',
    entity_id,
    reference,
    payment_kind: 'journey',
    status: 'confirmed',
    payment_status: 'partial',
    amount_total: 2000,
    amount_paid: 1000,
    start_date,
    end_date: start_date,
    trip_request_id: JOURNEY_PARENT_ID,
    journey_component: true,
    converted: false,
  }
}

export const journeyTripComponent1 = tripComponent('tb-2609-0001', 'TB-2609-0001', '2026-10-06')
export const journeyTripComponent2 = tripComponent('tb-2609-0002', 'TB-2609-0002', '2026-10-07')
export const journeyTripComponent3 = tripComponent('tb-2609-0003', 'TB-2609-0003', '2026-10-08')

export const journeyStayAnd3Trips: WorkItemRow[] = [
  journeyParentStayAnd3Trips,
  journeyStayComponent,
  journeyTripComponent1,
  journeyTripComponent2,
  journeyTripComponent3,
]

/** BYT journey: transport-only (no stay component), converted and commercial. */
export const journeyTransportOnlyParent: WorkItemRow = {
  ...commonRow,
  entity_type: 'trip_request',
  entity_id: 'wr-2609-0002',
  reference: 'WR-2609-0002',
  payment_kind: 'journey',
  status: 'confirmed',
  payment_status: 'partial',
  amount_total: 4000,
  amount_paid: 2000,
  start_date: '2026-10-06',
  end_date: '2026-10-06',
  trip_request_id: null,
  journey_component: false,
  converted: true,
}

export const journeyTransportOnlyComponent: WorkItemRow = {
  ...commonRow,
  entity_type: 'trip_booking',
  entity_id: 'tb-2609-0010',
  reference: 'TB-2609-0010',
  payment_kind: 'journey',
  status: 'confirmed',
  payment_status: 'partial',
  amount_total: 4000,
  amount_paid: 2000,
  start_date: '2026-10-06',
  end_date: '2026-10-06',
  trip_request_id: 'wr-2609-0002',
  journey_component: true,
  converted: false,
}

/** BYT journey with a package component, converted and commercial. */
export const journeyWithPackageParent: WorkItemRow = {
  ...commonRow,
  entity_type: 'trip_request',
  entity_id: 'wr-2609-0003',
  reference: 'WR-2609-0003',
  payment_kind: 'journey',
  status: 'confirmed',
  payment_status: 'partial',
  amount_total: 9000,
  amount_paid: 4500,
  start_date: '2026-10-07',
  end_date: '2026-10-12',
  trip_request_id: null,
  journey_component: false,
  converted: true,
}

export const journeyPackageComponent: WorkItemRow = {
  ...commonRow,
  entity_type: 'accommodation_booking',
  entity_id: 'bk-2609-0002',
  reference: 'BK-2609-0002',
  payment_kind: 'journey',
  status: 'confirmed',
  payment_status: 'partial',
  amount_total: 9000,
  amount_paid: 4500,
  start_date: '2026-10-07',
  end_date: '2026-10-12',
  trip_request_id: 'wr-2609-0003',
  journey_component: true,
  converted: false,
}

/** Standalone trip (trip_booking not attached to any trip_request): 100% upfront, per payment-rules. */
export const standaloneTrip: WorkItemRow = {
  ...commonRow,
  entity_type: 'trip_booking',
  entity_id: 'tb-2609-0020',
  reference: 'TB-2609-0020',
  payment_kind: 'trip',
  status: 'confirmed',
  payment_status: 'unpaid',
  amount_total: 1500,
  amount_paid: 0,
  start_date: '2026-10-06',
  end_date: '2026-10-06',
  trip_request_id: null,
  journey_component: false,
  converted: false,
}

/** Standalone package (accommodation_booking, booking_type package): 100% upfront. */
export const standalonePackage: WorkItemRow = {
  ...commonRow,
  entity_type: 'accommodation_booking',
  entity_id: 'bk-2609-0020',
  reference: 'BK-2609-0020',
  payment_kind: 'experience_package',
  status: 'confirmed',
  payment_status: 'unpaid',
  amount_total: 3000,
  amount_paid: 0,
  start_date: '2026-10-08',
  end_date: '2026-10-11',
  trip_request_id: null,
  journey_component: false,
  converted: false,
}

/** Standalone transfer: 100% upfront. */
export const standaloneTransfer: WorkItemRow = {
  ...commonRow,
  entity_type: 'accommodation_booking',
  entity_id: 'bk-2609-0021',
  reference: 'BK-2609-0021',
  payment_kind: 'transfer',
  status: 'confirmed',
  payment_status: 'unpaid',
  amount_total: 800,
  amount_paid: 0,
  start_date: '2026-10-09',
  end_date: '2026-10-09',
  transfer_type: 'hiace',
  trip_request_id: null,
  journey_component: false,
  converted: false,
}

/** A journey that has not yet been made commercial: converted, but with no payment total at all. */
export const journeyNoPaymentParent: WorkItemRow = {
  ...commonRow,
  entity_type: 'trip_request',
  entity_id: 'wr-2609-0004',
  reference: 'WR-2609-0004',
  payment_kind: 'journey',
  status: 'confirmed',
  payment_status: 'converted',
  amount_total: null,
  amount_paid: 0,
  start_date: '2026-10-10',
  end_date: '2026-10-15',
  trip_request_id: null,
  journey_component: false,
  converted: true,
}

/** A legacy journey needing manual financial reconciliation (payment_status carries the 'converted' marker). */
export const legacyJourneyNeedingReconcile: WorkItemRow = {
  ...commonRow,
  entity_type: 'trip_request',
  entity_id: 'wr-2508-0099',
  reference: 'WR-2508-0099',
  payment_kind: 'journey',
  status: 'confirmed',
  payment_status: 'converted',
  amount_total: 5000,
  amount_paid: 2000,
  start_date: '2026-09-01',
  end_date: '2026-09-05',
  trip_request_id: null,
  journey_component: false,
  converted: true,
}
