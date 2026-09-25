import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccess, canManageCatalogue, canManageStaff, isStaffRole } from './staff-policy'

test('only owners manage staff, for every method', () => {
  for (const method of ['GET', 'POST', 'PATCH']) {
    assert.equal(canAccess('owner', method, '/api/admin/staff'), true)
    assert.equal(canAccess('admin', method, '/api/admin/staff'), false)
    assert.equal(canAccess('operations', method, '/api/admin/staff/abc'), false)
  }
  assert.equal(canManageStaff('owner'), true)
  assert.equal(canManageStaff('admin'), false)
})

test('admins can change the catalogue; operations can only read it', () => {
  assert.equal(canAccess('admin', 'PATCH', '/api/admin/accommodations/1'), true)
  assert.equal(canAccess('operations', 'GET', '/api/admin/accommodations'), true)
  assert.equal(canAccess('operations', 'PATCH', '/api/admin/accommodations/1'), false)
  assert.equal(canAccess('operations', 'POST', '/api/admin/sinai-trips'), false)
  assert.equal(canAccess('operations', 'PUT', '/api/admin/site-settings'), false)
  assert.equal(canAccess('operations', 'POST', '/api/admin/transport/exceptions'), false)
  assert.equal(canManageCatalogue('operations'), false)
})

test('operations can do operational writes but never delete', () => {
  assert.equal(canAccess('operations', 'PATCH', '/api/admin/trip-requests/1'), true)
  assert.equal(canAccess('operations', 'POST', '/api/admin/trip-requests/1/convert'), true)
  assert.equal(canAccess('operations', 'POST', '/api/admin/payments'), true)
  assert.equal(canAccess('operations', 'PATCH', '/api/admin/bookings/1'), true)
  assert.equal(canAccess('operations', 'DELETE', '/api/admin/bookings/1'), false)
  assert.equal(canAccess('operations', 'PATCH', '/api/admin/me'), true)
})

test('prefixes match whole path segments only', () => {
  assert.equal(canAccess('operations', 'POST', '/api/admin/bookingsX'), false)
  assert.equal(canAccess('operations', 'POST', '/api/admin/staffing'), false)
  assert.equal(canAccess('admin', 'GET', '/api/admin/staff/'), false)
})

test('unknown admin routes default to manager-only writes', () => {
  assert.equal(canAccess('operations', 'POST', '/api/admin/some-new-thing'), false)
  assert.equal(canAccess('admin', 'POST', '/api/admin/some-new-thing'), true)
})

test('the audit log is owner/admin only', () => {
  assert.equal(canAccess('operations', 'GET', '/api/admin/audit'), false)
  assert.equal(canAccess('admin', 'GET', '/api/admin/audit'), true)
})

test('role values are validated', () => {
  assert.equal(isStaffRole('owner'), true)
  assert.equal(isStaffRole('superadmin'), false)
  assert.equal(isStaffRole(undefined), false)
})
