import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from './models.js';

export const SESSION_COOKIE = 'veylora_session';
const SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const jwtSecret = () => process.env.JWT_SECRET;

export function sessionCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_AGE_MS };
}

export function issueSession(res, user) {
  if (!jwtSecret()) throw new Error('JWT_SECRET is not configured.');
  const token = jwt.sign({ sub: user.id, role: user.role, sessionVersion: user.sessionVersion ?? 0 }, jwtSecret(), { expiresIn: '7d', issuer: 'veylora' });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function revokeSession(token) {
  if (!token || !jwtSecret()) return;
  try {
    const claims = jwt.verify(token, jwtSecret(), { issuer: 'veylora' });
    await User.updateOne({ _id: claims.sub, sessionVersion: claims.sessionVersion ?? 0 }, { $inc: { sessionVersion: 1 } });
  } catch (error) {
    if (error.name !== 'TokenExpiredError' && error.name !== 'JsonWebTokenError' && error.name !== 'NotBeforeError') throw error;
  }
}

export function clearSession(res) {
  const { maxAge, ...options } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE, options);
}

export async function requireAuth(req, res, next) {
  if (!jwtSecret()) return res.status(503).json({ error: 'Authentication is not configured. Set JWT_SECRET on the server.' });
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    const claims = jwt.verify(token, jwtSecret(), { issuer: 'veylora' });
    const user = await User.findById(claims.sub).select('name organizationName email role sessionVersion').lean();
    if (!user || user.role !== claims.role || Number(user.sessionVersion || 0) !== Number(claims.sessionVersion || 0)) return res.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });
    req.user = { ...user, id: String(user._id) };
    next();
  } catch {
    return res.status(401).json({ error: 'Your session is invalid or expired. Please sign in again.' });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: 'Your account does not have access to this action.' });
}

export const ownsDonation = (user, donation) => user?.role === 'donor' && String(donation?.donorId) === user.id;
export const ownsReservation = (user, reservation) => user?.role === 'recipient' && String(reservation?.recipientId) === user.id;
export const hashPassword = password => bcrypt.hash(password, 12);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

export function validateRegistration(body = {}) {
  const validEmail = typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) && body.email.length <= 254;
  const passwordBytes = typeof body.password === 'string' ? Buffer.byteLength(body.password, 'utf8') : 0;
  return typeof body.name === 'string' && body.name.trim().length > 0 && body.name.length <= 100 &&
    typeof body.organizationName === 'string' && body.organizationName.trim().length > 0 && body.organizationName.length <= 120 &&
    validEmail && passwordBytes >= 8 && passwordBytes <= 72 && ['donor', 'recipient'].includes(body.role);
}

export const publicUser = user => ({ id: String(user._id || user.id), name: user.name, organizationName: user.organizationName, email: user.email, role: user.role });
