import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { app } from './app.js';

// Optional override for networks whose default resolver refuses Atlas SRV lookups.
const dnsServers = process.env.MONGODB_DNS_SERVERS?.split(',').map(value => value.trim()).filter(Boolean);
if (dnsServers?.length) dns.setServers(dnsServers);

const port = process.env.PORT || 4000;
if (!process.env.MONGODB_URI) {
  console.error('MongoDB is not configured. Copy server/.env.example to server/.env and set MONGODB_URI.');
  process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI).then(() => {
  app.listen(port, () => console.log(`Veylora API listening on port ${port}`));
}).catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
