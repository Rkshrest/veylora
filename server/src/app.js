import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Donation, AuditEntry, User } from './models.js';
import { appendAudit, verifyAuditChain } from './audit.js';
import { estimateImpact, estimateImpactSnapshot, EMISSION_FACTOR_KG_CO2E_PER_KG, IMPACT_METHODOLOGY } from './impact.js';
import { validateDonationInput, reservationDecision } from './domain.js';
import { clearSession, hashPassword, issueSession, ownsDonation, ownsReservation, publicUser, requireAuth, revokeSession, SESSION_COOKIE, validateRegistration, verifyPassword } from './auth.js';

export const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && req.get('origin') && req.get('origin') !== clientOrigin) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }
  next();
});

const cleanDonation = (d) => ({ ...d, impactEstimateKgCo2e: estimateImpact(d.quantityKg), reservedKg: (d.reservations || []).reduce((n, r) => n + r.quantityKg, 0) });
const cleanDonationForUser = (d, user) => {
  const clean = cleanDonation(d);
  if (user.role === 'recipient') clean.reservations = (clean.reservations || []).filter(r => String(r.recipientId) === user.id);
  return clean;
};
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) return res.status(503).json({ error: 'Authentication is not configured. Set JWT_SECRET on the server.' });
    if (!validateRegistration(req.body)) return res.status(400).json({ error: 'Enter a name, organization, valid email, donor or recipient role, and a password of 8–72 bytes.' });
    const email = req.body.email.trim().toLowerCase();
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account with that email already exists. Sign in instead.' });
    const passwordHash = await hashPassword(req.body.password);
    const user = await User.create({ name: req.body.name.trim(), organizationName: req.body.organizationName.trim(), email, passwordHash, role: req.body.role });
    issueSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'An account with that email already exists. Sign in instead.' });
    next(e);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) return res.status(503).json({ error: 'Authentication is not configured. Set JWT_SECRET on the server.' });
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    issueSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));
app.post('/api/auth/logout', async (req, res, next) => {
  try { await revokeSession(req.cookies?.[SESSION_COOKIE]); clearSession(res); res.json({ ok: true }); }
  catch (e) { next(e); }
});

app.get('/api/public/impact', async (_req, res, next) => {
  try {
    const donations = await Donation.find().select('quantityKg foodName reservations').lean();
    const collectedReservations = donations.flatMap(d => d.reservations.filter(r => r.status === 'collected'));
    const collectedKg = collectedReservations.reduce((total, r) => total + r.quantityKg, 0);
    const impactEstimateKgCo2e = collectedReservations.reduce((total, r) => total + (r.impactEstimateKgCo2e ?? estimateImpact(r.quantityKg)), 0);
    res.json({ totalDonations: donations.length, collectedKg: Number(collectedKg.toFixed(1)), impactEstimateKgCo2e: Number(impactEstimateKgCo2e.toFixed(2)), demonstrationRecords: donations.filter(d => d.foodName.startsWith('DEMO ·')).length,
      impactFactorKgCo2ePerKg: EMISSION_FACTOR_KG_CO2E_PER_KG, impactMethodology: IMPACT_METHODOLOGY,
      method: `Each completed rescue stores its factor and methodology; older records use the current ${EMISSION_FACTOR_KG_CO2E_PER_KG} kg CO₂e/kg estimate.` });
  } catch (e) { next(e); }
});

app.use('/api/donations', requireAuth);
app.use('/api/dashboard', requireAuth);
app.use('/api/audit', requireAuth);

app.get('/api/donations', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Please sign in to view donations.' });
    const filter = req.user.role === 'donor'
      ? { donorId: req.user.id }
      : { $or: [{ status: { $in: ['available', 'reserved'] } }, { reservations: { $elemMatch: { recipientId: req.user.id } } }] };
    if (req.query.status) filter.status = req.query.status;
    const donations = await Donation.find(filter).sort({ createdAt: -1 }).lean();
    res.json(donations.map(d => cleanDonationForUser(d, req.user)));
  } catch (e) { next(e); }
});

app.post('/api/donations', async (req, res, next) => {
  try {
    if (req.user?.role !== 'donor') return res.status(403).json({ error: 'A donor account is required to post a donation.' });
    const b = req.body || {};
    if (!validateDonationInput({ ...b, donor: req.user.organizationName })) return res.status(400).json({ error: 'Check required fields, quantity, and future pickup deadline.' });
    const donation = await Donation.create({ ...b, donor: req.user.organizationName, donorId: req.user.id, status: 'available', reservations: [] });
    await appendAudit({ entityId: donation.id, action: 'donation.created', actor: req.user.organizationName, actorId: req.user.id, payload: { foodName: donation.foodName, quantityKg: donation.quantityKg } });
    res.status(201).json(cleanDonation(donation.toObject()));
  } catch (e) { next(e); }
});

app.get('/api/donations/:id', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Please sign in to view this donation.' });
    const d = await Donation.findById(req.params.id).lean();
    if (!d) return res.status(404).json({ error: 'Donation not found.' });
    const isOwner = ownsDonation(req.user, d);
    const isRecipientView = req.user.role === 'recipient' && (['available', 'reserved'].includes(d.status) || d.reservations.some(r => String(r.recipientId) === req.user.id));
    if (!isOwner && !isRecipientView) return res.status(404).json({ error: 'Donation not found.' });
    res.json(cleanDonationForUser(d, req.user));
  }
  catch (e) { next(e); }
});

app.patch('/api/donations/:id', async (req, res, next) => {
  try {
    if (req.user?.role !== 'donor') return res.status(403).json({ error: 'A donor account is required to edit donations.' });
    const body = req.body || {};
    const allowed = ['foodName','category','quantityKg','pickupLocation','pickupDeadline','handlingNotes','allergens'];
    const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'No editable fields supplied.' });
    if ('quantityKg' in patch && (!Number.isFinite(patch.quantityKg) || patch.quantityKg < 0.1)) return res.status(400).json({ error: 'Quantity must be at least 0.1 kg.' });
    if ('pickupDeadline' in patch && (Number.isNaN(Date.parse(patch.pickupDeadline)) || Date.parse(patch.pickupDeadline) <= Date.now())) return res.status(400).json({ error: 'Pickup deadline must be in the future.' });
    const d = await Donation.findOne({ _id: req.params.id, donorId: req.user.id }); if (!d) return res.status(404).json({ error: 'Donation not found.' });
    if (d.status === 'collected' || d.status === 'expired') return res.status(409).json({ error: 'This donation can no longer be edited.' });
    const reservedKg = d.reservations.reduce((sum, r) => sum + r.quantityKg, 0);
    if ('quantityKg' in patch && patch.quantityKg < reservedKg) return res.status(409).json({ error: `Quantity cannot be lower than the ${reservedKg} kg already reserved.` });
    Object.assign(d, patch); d.updatedAt = new Date(); await d.save();
    await appendAudit({ entityId: d.id, action: 'donation.updated', actor: req.user.organizationName, actorId: req.user.id, payload: patch });
    res.json(cleanDonation(d.toObject()));
  } catch (e) { next(e); }
});

app.post('/api/donations/:id/reservations', async (req, res, next) => {
  try {
    if (req.user?.role !== 'recipient') return res.status(403).json({ error: 'A recipient account is required to reserve food.' });
    const { quantityKg } = req.body || {};
    const recipient = req.user.organizationName;
    if (!Number.isFinite(quantityKg) || quantityKg <= 0) return res.status(400).json({ error: 'Enter a positive reservation quantity.' });
    // The conditional update makes the allocation check atomic: simultaneous requests
    // cannot both reserve against the same stale remaining quantity.
    const match = { _id: req.params.id, status: { $in: ['available', 'reserved'] },
      reservations: { $not: { $elemMatch: { $or: [{ recipientId: req.user.id }, { recipient }], status: 'reserved' } } },
      $expr: { $lte: [{ $add: [{ $ifNull: [{ $sum: '$reservations.quantityKg' }, 0] }, quantityKg] }, '$quantityKg'] } };
    const reservation = { recipient, recipientId: req.user.id, quantityKg, status: 'reserved', createdAt: new Date() };
    const d = await Donation.findOneAndUpdate(match, { $push: { reservations: reservation }, $set: { status: 'reserved', updatedAt: new Date() } }, { new: true, runValidators: true });
    if (!d) {
      const exists = await Donation.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ error: 'Donation not found.' });
      const current = await Donation.findById(req.params.id).lean();
      const duplicate = current?.reservations?.some(r => (String(r.recipientId) === req.user.id || r.recipient.toLowerCase() === recipient.toLowerCase()) && r.status === 'reserved');
      const reservedKg = (current?.reservations || []).reduce((sum, r) => sum + r.quantityKg, 0);
      const decision = reservationDecision(current?.quantityKg || 0, reservedKg, quantityKg, duplicate);
      return res.status(409).json({ error: decision.reason === 'duplicate' ? 'This recipient already has an active reservation.' : 'That quantity exceeds the remaining amount or the donation is no longer available.' });
    }
    const savedReservation = d.reservations[d.reservations.length - 1];
    await appendAudit({ entityId: d.id, action: 'reservation.created', actor: recipient, actorId: req.user.id, payload: { reservationId: savedReservation.id, quantityKg } });
    res.status(201).json({ donation: cleanDonationForUser(d.toObject(), req.user), reservation: savedReservation });
  } catch (e) { next(e); }
});

app.patch('/api/donations/:id/reservations/:reservationId/collect', async (req, res, next) => {
  try {
    if (req.user?.role !== 'recipient') return res.status(403).json({ error: 'A recipient account is required to confirm collection.' });
    const d = await Donation.findById(req.params.id); if (!d) return res.status(404).json({ error: 'Donation not found.' });
    const r = d.reservations.id(req.params.reservationId); if (!r) return res.status(404).json({ error: 'Reservation not found.' });
    if (!ownsReservation(req.user, r)) return res.status(404).json({ error: 'Reservation not found.' });
    if (r.status === 'collected') return res.status(409).json({ error: 'Reservation is already collected.' });
    r.status = 'collected'; r.collectedAt = new Date(); Object.assign(r, estimateImpactSnapshot(r.quantityKg));
    const collectedKg = d.reservations.filter(x => x.status === 'collected').reduce((sum, x) => sum + x.quantityKg, 0);
    const outstandingReservation = d.reservations.some(x => x.status === 'reserved');
    d.status = collectedKg >= d.quantityKg ? 'collected' : outstandingReservation ? 'reserved' : 'available';
    d.updatedAt = new Date(); await d.save();
    await appendAudit({ entityId: d.id, action: 'reservation.collected', actor: req.user.organizationName, actorId: req.user.id, payload: { reservationId: r.id, quantityKg: r.quantityKg } });
    res.json({ donation: cleanDonationForUser(d.toObject(), req.user), reservation: r });
  } catch (e) { next(e); }
});

app.get('/api/dashboard', async (req, res, next) => {
  try {
    const filter = req.user.role === 'donor' ? { donorId: req.user.id } : { $or: [{ status: { $in: ['available', 'reserved'] } }, { reservations: { $elemMatch: { recipientId: req.user.id } } }] };
    const donations = await Donation.find(filter).lean();
    const collectedReservations = donations.flatMap(d => d.reservations.filter(r => r.status === 'collected'));
    const collectedKg = collectedReservations.reduce((n, r) => n + r.quantityKg, 0);
    const impactEstimateKgCo2e = collectedReservations.reduce((n, r) => n + (r.impactEstimateKgCo2e ?? estimateImpact(r.quantityKg)), 0);
    const reservedKg = donations.reduce((n, d) => n + d.reservations.filter(r => r.status === 'reserved').reduce((m, r) => m + r.quantityKg, 0), 0);
    res.json({ totalDonations: donations.length, availableListings: donations.filter(d => d.status === 'available' || d.status === 'reserved').length,
      collectedKg: Number(collectedKg.toFixed(1)), reservedKg: Number(reservedKg.toFixed(1)), impactEstimateKgCo2e: Number(impactEstimateKgCo2e.toFixed(2)),
      recentDonations: donations.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6).map(d => cleanDonationForUser(d, req.user)),
      impactMethod: { factorKgCo2ePerKg: EMISSION_FACTOR_KG_CO2E_PER_KG, basis: IMPACT_METHODOLOGY, note: 'Completed rescues preserve the factor and methodology used at collection; legacy records use the current factor.' }, user: req.user });
  } catch (e) { next(e); }
});

app.get('/api/audit/verify', async (_req, res, next) => { try { res.json(await verifyAuditChain()); } catch (e) { next(e); } });
app.get('/api/audit', async (req, res, next) => { try { res.json(await AuditEntry.find({ actorId: req.user.id }).sort({ sequence: -1 }).limit(50).lean()); } catch (e) { next(e); } });

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ error: err.message });
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});
