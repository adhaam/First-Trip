'use client'

// Trip Builder requests are now worked from the Operations Center work queue
// (src/components/admin/ops/QueueView.tsx), reachable at
// /admin/dashboard?section=queue&type=trip_request, with the full read-only
// request panel and convert action in ItemDetail. This wrapper exists only so a
// stray import of the old manager keeps working instead of breaking the build.
export { QueueView as TripRequestsManager } from '@/components/admin/ops/QueueView'
