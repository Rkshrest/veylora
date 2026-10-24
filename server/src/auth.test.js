import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, ownsDonation, ownsReservation, validateRegistration, verifyPassword } from './auth.js';

const account = overrides => ({ name: 'Asha', organizationName: 'Community Kitchen', email: 'asha@example.org', password: 'strong-pass-1', role: 'recipient', ...overrides });

test('registration accepts donor and recipient accounts with valid details', () => {
  assert.equal(validateRegistration(account()), true);
  assert.equal(validateRegistration(account({ role: 'donor' })), true);
});
test('registration rejects weak passwords, malformed email, and unsupported roles', () => {
  assert.equal(validateRegistration(account({ password: 'tiny' })), false);
  assert.equal(validateRegistration(account({ email: 'not-an-email' })), false);
  assert.equal(validateRegistration(account({ role: 'admin' })), false);
});
test('password hashes are not plaintext and verify against the original password', async () => {
  const hash = await hashPassword('strong-pass-1');
  assert.notEqual(hash, 'strong-pass-1');
  assert.equal(await verifyPassword('strong-pass-1', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});
test('ownership checks are bound to both the expected role and account id', () => {
  const donor = { id: 'donor-1', role: 'donor' }, recipient = { id: 'recipient-1', role: 'recipient' };
  assert.equal(ownsDonation(donor, { donorId: 'donor-1' }), true);
  assert.equal(ownsDonation({ ...donor, id: 'donor-2' }, { donorId: 'donor-1' }), false);
  assert.equal(ownsReservation(recipient, { recipientId: 'recipient-1' }), true);
  assert.equal(ownsReservation({ ...recipient, role: 'donor' }, { recipientId: 'recipient-1' }), false);
});
