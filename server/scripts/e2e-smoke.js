import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
  throw new Error('Set MONGODB_URI and JWT_SECRET in server/.env before running the MongoDB end-to-end smoke test.');
}

const dnsServers = process.env.MONGODB_DNS_SERVERS?.split(',').map(value => value.trim()).filter(Boolean);
if (dnsServers?.length) (await import('node:dns')).default.setServers(dnsServers);
const { app } = await import('../src/app.js');
const { User, Donation } = await import('../src/models.js');
const scratchDb = `veylora_e2e_${Date.now()}`;
const password = 'Veylora-E2E-Strong-Password-1';
const emailTag = randomUUID();
const accounts = [
  { name: 'E2E Donor', organizationName: 'E2E · Community Kitchen', email: `donor-${emailTag}@example.invalid`, role: 'donor' },
  { name: 'E2E Recipient', organizationName: 'E2E · Food Network', email: `recipient-${emailTag}@example.invalid`, role: 'recipient' },
  { name: 'E2E Other Donor', organizationName: 'E2E · Other Kitchen', email: `other-${emailTag}@example.invalid`, role: 'donor' }
];
let server;

async function request(base, route, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  const cookieHeader = response.headers.get('set-cookie');
  return { status: response.status, data, cookie: cookieHeader?.split(';', 1)[0] || cookie };
}

try {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: scratchDb, serverSelectionTimeoutMS: 15000 });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  let donor = await request(base, '/auth/register', { method: 'POST', body: { ...accounts[0], password } });
  assert.equal(donor.status, 201, `donor registration: ${JSON.stringify(donor.data)}`);
  assert.ok(donor.cookie, 'registration establishes a session cookie');
  const donorRecord = await User.findOne({ email: accounts[0].email }).select('+passwordHash').lean();
  assert.ok(donorRecord, 'registration persists the user in MongoDB');
  assert.notEqual(donorRecord.passwordHash, password, 'stored password is a hash');

  assert.equal((await request(base, '/auth/register', { method: 'POST', body: { ...accounts[0], password } })).status, 409, 'duplicate registration is rejected');
  assert.equal((await request(base, '/auth/login', { method: 'POST', body: { email: accounts[0].email, password: 'wrong-password' } })).status, 401, 'wrong password is rejected');
  donor = await request(base, '/auth/login', { method: 'POST', body: { email: accounts[0].email, password } });
  assert.equal(donor.status, 200, 'valid login succeeds');
  assert.equal((await request(base, '/dashboard', { cookie: donor.cookie })).status, 200, 'authenticated dashboard survives a fresh request');

  const donationResponse = await request(base, '/donations', { method: 'POST', cookie: donor.cookie, body: {
    foodName: 'E2E · Seasonal produce', category: 'Produce', quantityKg: 10,
    donor: 'untrusted donor field is ignored', pickupLocation: 'E2E pickup point', pickupDeadline: futureDeadline,
    handlingNotes: 'Keep chilled', allergens: 'None declared'
  } });
  assert.equal(donationResponse.status, 201, `donation creation: ${JSON.stringify(donationResponse.data)}`);
  const donationId = donationResponse.data._id;
  const persistedDonation = await Donation.findById(donationId).lean();
  assert.ok(persistedDonation, 'donation is persisted in MongoDB');
  assert.equal(persistedDonation.donorId.toString(), donorRecord._id.toString(), 'donation ownership uses the signed-in donor');
  assert.equal((await request(base, `/donations/${donationId}`, { method: 'PATCH', cookie: donor.cookie, body: { pickupLocation: 'Updated E2E pickup point' } })).status, 200, 'owner can update a donation');

  let otherDonor = await request(base, '/auth/register', { method: 'POST', body: { ...accounts[2], password } });
  assert.equal(otherDonor.status, 201, 'second donor registration succeeds');
  assert.equal((await request(base, `/donations/${donationId}`, { method: 'PATCH', cookie: otherDonor.cookie, body: { pickupLocation: 'Unauthorized edit' } })).status, 404, 'another donor cannot edit this donation');

  const recipient = await request(base, '/auth/register', { method: 'POST', body: { ...accounts[1], password } });
  assert.equal(recipient.status, 201, 'recipient registration succeeds');
  assert.equal((await request(base, `/donations/${donationId}/reservations`, { method: 'POST', cookie: recipient.cookie, body: { quantityKg: 6 } })).status, 201, 'recipient can reserve available food');
  assert.equal((await request(base, `/donations/${donationId}/reservations`, { method: 'POST', cookie: recipient.cookie, body: { quantityKg: 5 } })).status, 409, 'over-allocation is rejected');
  assert.equal((await request(base, `/donations/${donationId}/reservations`, { method: 'POST', cookie: recipient.cookie, body: { quantityKg: 1 } })).status, 409, 'duplicate active reservation is rejected');

  const recipientList = await request(base, '/donations', { cookie: recipient.cookie });
  assert.equal(recipientList.status, 200);
  const reservation = recipientList.data.find(item => item._id === donationId)?.reservations?.[0];
  assert.ok(reservation?._id, 'reservation is returned from persisted state');
  assert.equal((await request(base, `/donations/${donationId}/reservations/${reservation._id}/collect`, { method: 'PATCH', cookie: recipient.cookie })).status, 200, 'recipient can complete collection');

  const collectedDonation = await Donation.findById(donationId).lean();
  const collectedReservation = collectedDonation.reservations[0];
  assert.equal(collectedReservation.impactEstimateKgCo2e, 15, 'collection saves its estimated emissions value');
  assert.equal(collectedReservation.impactFactorKgCo2ePerKg, 2.5, 'collection saves its factor');
  assert.ok(collectedReservation.impactMethodology, 'collection saves its methodology');
  const recipientDashboard = await request(base, '/dashboard', { cookie: recipient.cookie });
  assert.equal(recipientDashboard.data.collectedKg, 6, 'dashboard counts collected food only');
  assert.equal(recipientDashboard.data.impactEstimateKgCo2e, 15, 'dashboard uses the stored estimate');
  assert.equal((await request(base, '/audit/verify', { cookie: recipient.cookie })).data.valid, true, 'audit chain verifies after the workflow');

  const loggedOut = await request(base, '/auth/logout', { method: 'POST', cookie: recipient.cookie });
  assert.equal(loggedOut.status, 200, 'logout succeeds');
  assert.equal((await request(base, '/dashboard', { cookie: recipient.cookie })).status, 401, 'the copied pre-logout token is revoked');
  assert.equal((await request(base, '/dashboard')).status, 401, 'logged-out visitor cannot load the dashboard');
  const recipientRelogin = await request(base, '/auth/login', { method: 'POST', body: { email: accounts[1].email, password } });
  assert.equal(recipientRelogin.status, 200, 'recipient can sign in again after session revocation');
  assert.equal((await request(base, '/dashboard', { cookie: recipientRelogin.cookie })).status, 200, 'the renewed session works after logout');
  console.log(`PASS: MongoDB e2e auth, persistence, ownership, donation update, reservation limits, collection, saved impact, audit integrity, and logout revocation (isolated DB: ${scratchDb}).`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}
