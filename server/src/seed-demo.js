import 'dotenv/config';
import mongoose from 'mongoose';
import { Donation } from './models.js';
import { appendAudit } from './audit.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
await mongoose.connect(process.env.MONGODB_URI);
if (await Donation.exists({ donor: 'DEMO · Green Table Cafeteria' })) {
  console.log('Demonstration records already exist; no changes made.');
} else {
  const now = Date.now();
  const rows = [
    { foodName: 'DEMO · Market vegetable boxes', category: 'Produce', quantityKg: 18, donor: 'DEMO · Green Table Cafeteria', pickupLocation: 'Campus kitchen, north loading door', pickupDeadline: new Date(now + 36e5 * 8), handlingNotes: 'Keep cool; bring reusable crates.', allergens: 'None known' },
    { foodName: 'DEMO · Lentil and rice trays', category: 'Prepared meals', quantityKg: 12, donor: 'DEMO · Cedar Hall Dining', pickupLocation: 'Cedar Hall service entrance', pickupDeadline: new Date(now + 36e5 * 5), handlingNotes: 'Refrigerate promptly. Sealed trays.', allergens: 'May contain sesame' },
    { foodName: 'DEMO · Assorted bakery rolls', category: 'Bakery', quantityKg: 7.5, donor: 'DEMO · Hearth & Grain', pickupLocation: '14 College Road, rear counter', pickupDeadline: new Date(now + 36e5 * 3), handlingNotes: 'Ambient; paper bags available.', allergens: 'Wheat, may contain dairy' }
  ];
  const created = await Donation.insertMany(rows);
  for (const d of created) await appendAudit({ entityId: d.id, action: 'donation.created', actor: d.donor, payload: { foodName: d.foodName, quantityKg: d.quantityKg, demonstrationData: true } });
  console.log(`Added ${created.length} clearly labelled demonstration donations.`);
}
await mongoose.disconnect();
