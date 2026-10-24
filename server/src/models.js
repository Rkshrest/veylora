import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  organizationName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  sessionVersion: { type: Number, default: 0 },
  role: { type: String, required: true, enum: ['donor', 'recipient'] },
  createdAt: { type: Date, default: Date.now }
});

const reservationSchema = new mongoose.Schema({
  recipient: { type: String, required: true, trim: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  quantityKg: { type: Number, required: true, min: 0.01 },
  status: { type: String, enum: ['reserved', 'collected'], default: 'reserved' },
  impactFactorKgCo2ePerKg: { type: Number, min: 0 },
  impactEstimateKgCo2e: { type: Number, min: 0 },
  impactMethodology: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
  collectedAt: Date
}, { _id: true });

const donationSchema = new mongoose.Schema({
  foodName: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, required: true, enum: ['Produce', 'Prepared meals', 'Bakery', 'Dairy', 'Pantry', 'Other'] },
  quantityKg: { type: Number, required: true, min: 0.1 },
  donor: { type: String, required: true, trim: true, maxlength: 100 },
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  pickupLocation: { type: String, required: true, trim: true, maxlength: 200 },
  pickupDeadline: { type: Date, required: true },
  handlingNotes: { type: String, trim: true, maxlength: 1000, default: '' },
  allergens: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['available', 'reserved', 'collected', 'expired'], default: 'available' },
  reservations: { type: [reservationSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
donationSchema.index({ status: 1, pickupDeadline: 1 });

const auditSchema = new mongoose.Schema({
  sequence: { type: Number, required: true, unique: true },
  entityId: { type: String, required: true },
  action: { type: String, required: true },
  actor: { type: String, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  timestamp: { type: Date, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  previousHash: { type: String, required: true },
  hash: { type: String, required: true }
});

export const Donation = mongoose.models.Donation || mongoose.model('Donation', donationSchema);
export const AuditEntry = mongoose.models.AuditEntry || mongoose.model('AuditEntry', auditSchema);
export const User = mongoose.models.User || mongoose.model('User', userSchema);
