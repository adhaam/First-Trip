import assert from 'node:assert/strict'
import test from 'node:test'
import {
  updateAdminStatus,
  type AdminStatusUpdateClient,
  type StatusUpdateResponse,
} from './admin-status-update'

type Row = { id: string; status: string; notes?: string }

class FakeStatusUpdateClient implements AdminStatusUpdateClient<Row> {
  readonly row: Row | null
  readCalls = 0
  updateCalls: Array<{ patch: Record<string, unknown>; currentStatus?: string }> = []
  stale = false

  constructor(status: string | null) {
    this.row = status ? { id: 'request-1', status } : null
  }

  async readStatus(): Promise<StatusUpdateResponse<{ status: string }>> {
    this.readCalls += 1
    return { data: this.row ? { status: this.row.status } : null, error: null }
  }

  async update(_id: string, patch: Record<string, unknown>, currentStatus?: string): Promise<StatusUpdateResponse<Row>> {
    this.updateCalls.push({ patch, currentStatus })
    if (!this.row || this.stale || (currentStatus !== undefined && this.row.status !== currentStatus)) {
      return { data: null, error: null }
    }
    Object.assign(this.row, patch)
    return { data: this.row, error: null }
  }
}

test('admin status update allows a valid transition and guards it with the read status', async () => {
  const client = new FakeStatusUpdateClient('new')

  const result = await updateAdminStatus(client, 'accommodation_booking', 'request-1', {
    status: 'pending',
  })

  assert.deepEqual(result, { kind: 'updated', data: { id: 'request-1', status: 'pending' } })
  assert.equal(client.readCalls, 1)
  assert.equal(client.updateCalls[0].currentStatus, 'new')
})

test('admin status update rejects an invalid transition before writing', async () => {
  const client = new FakeStatusUpdateClient('new')

  const result = await updateAdminStatus(client, 'trip_booking', 'request-1', {
    status: 'completed',
  })

  assert.deepEqual(result, { kind: 'invalid_transition', allowed: ['new', 'contacted', 'checking_availability', 'cancelled'] })
  assert.equal(client.updateCalls.length, 0)
})

test('admin status update reports a stale row when compare-and-swap updates nothing', async () => {
  const client = new FakeStatusUpdateClient('pending')
  client.stale = true

  const result = await updateAdminStatus(client, 'accommodation_booking', 'request-1', {
    status: 'confirmed',
  })

  assert.deepEqual(result, { kind: 'stale_status' })
  assert.equal(client.updateCalls[0].currentStatus, 'pending')
})

test('admin status update skips the status read for a patch without a status change', async () => {
  const client = new FakeStatusUpdateClient('confirmed')

  const result = await updateAdminStatus(client, 'accommodation_booking', 'request-1', {
    notes: 'Customer called',
  })

  assert.deepEqual(result, { kind: 'updated', data: { id: 'request-1', status: 'confirmed', notes: 'Customer called' } })
  assert.equal(client.readCalls, 0)
  assert.equal(client.updateCalls[0].currentStatus, undefined)
})
