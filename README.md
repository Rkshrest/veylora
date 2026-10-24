# Veylora

**Recover value. Reveal impact.** Veylora is a food rescue platform built with React, Vite, Express, MongoDB, and Mongoose.

## What is included

- Public landing page with mission, workflow, SDG context, and persisted impact totals.
- Donor and recipient registration/login with bcrypt password hashes and signed HTTP-only session cookies.
- Protected dashboard, refresh-persistent sessions, logout, and server-enforced role/ownership rules.
- Dashboard totals calculated from the signed-in user's accessible persisted donation and reservation records.
- Create, list, inspect, and edit donation listings.
- Reserve part of a listing and mark each reservation collected.
- Atomic MongoDB reservation writes prevent duplicate active reservations and over-allocation when requests overlap.
- Hash-linked audit events with `GET /api/audit/verify` integrity verification.
- A local, clearly labelled impact estimate: **2.5 kg CO₂e per kg of food collected**, from the versioned [local factor dataset](server/src/data/emission-factors.json). This is a simplified demonstration planning factor, not measured or independently verified. Food types and supply chains differ, so it should not be presented as a verified footprint or impact claim.
- Optional, clearly labelled demonstration seed records.

## Requirements

- Node.js 20 or newer and npm.
- MongoDB Community running locally, or a MongoDB Atlas cluster. No paid APIs or API keys are needed.

## Install and run locally

1. Install the root development tool:

   ```bash
   npm install
   ```

2. Install server and client dependencies:

   ```bash
   npm install --prefix server
   npm install --prefix client
   ```

3. Start MongoDB. For a local MongoDB Community install, start its MongoDB service. For Atlas, create a database user, allow the development machine's IP in Network Access, and copy the connection URI. Never commit credentials.

4. Create `server/.env` by copying `server/.env.example`, then set `MONGODB_URI` to the local URI or Atlas connection string. Generate a long random server-only JWT key with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   Keep both values in `server/.env`; never place them in `client/.env` or `VITE_*` variables. Git ignores real `.env` files while retaining `.env.example` templates.

   ```env
   PORT=4000
   MONGODB_URI=mongodb://127.0.0.1:27017/veylora
   CLIENT_ORIGIN=http://localhost:5173
   JWT_SECRET=your_generated_random_value
   ```

   If Node reports `querySrv ECONNREFUSED` for an Atlas `mongodb+srv` URI on a network whose default resolver rejects SRV queries, add `MONGODB_DNS_SERVERS=8.8.8.8` to `server/.env` and restart the backend. Atlas must also allow the machine's current public IP in Project → Network Access; select **Add Current IP Address** rather than allowing all IPs.

5. In the repository root, start frontend and backend:

   ```bash
   npm run dev
   ```

   Visit [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:4000/api/health](http://localhost:4000/api/health).

   To run them separately, use two terminals from the project root:

   ```bash
   npm run dev --prefix server
   npm run dev --prefix client
   ```

6. Optional: create demonstration donations in a separate terminal:

   ```bash
   npm run seed:demo --prefix server
   ```

   The seed command is idempotent for its demo donor and does not clear existing records. Seeded names and donors are prefixed `DEMO`.

## Verify

```bash
npm test
npm run build
npm run test:e2e --prefix server
```

The server unit tests cover registration validation, password hashing, account ownership helpers, donation validation, reservation decision rules, and impact arithmetic. The end-to-end smoke test connects to the configured MongoDB cluster using a uniquely named temporary database, exercises the HTTP auth and donation workflow, then drops only that temporary database. It requires `MONGODB_URI` and `JWT_SECRET` in `server/.env` and never clears the application's configured database.

### Manual authentication smoke test

With MongoDB, `JWT_SECRET`, and both dev servers running:

1. Open `/register`, create one donor account and one recipient account with different emails.
2. Sign out, sign in with each account, then refresh `/dashboard`; the account should remain signed in.
3. Sign out and use browser Back; `/dashboard` should redirect to sign in. Open `/dashboard` in a private window and confirm the same redirect.
4. Try a wrong password and register the same email again; each should show an error.
5. Post a donation as the donor, then reserve and mark it collected as the recipient. Sign in as a different donor and try editing the first donor's listing; the API should deny access.

These database-backed steps are documented for manual verification; they are not represented as automated end-to-end tests.

## API overview

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | API health |
| POST | `/api/auth/register` | Create a donor or recipient account and session |
| POST | `/api/auth/login` | Verify credentials and create session |
| GET | `/api/auth/me` | Restore the signed-in user after refresh |
| POST | `/api/auth/logout` | Clear the HTTP-only session cookie |
| GET | `/api/public/impact` | Public aggregate from persisted records |
| GET | `/api/dashboard` | Authenticated derived summary and recent listings |
| GET | `/api/donations` | List donations |
| POST | `/api/donations` | Create listing |
| GET | `/api/donations/:id` | Read listing |
| PATCH | `/api/donations/:id` | Update editable listing details |
| POST | `/api/donations/:id/reservations` | Reserve a quantity atomically |
| PATCH | `/api/donations/:id/reservations/:reservationId/collect` | Mark a reservation collected |
| GET | `/api/audit` | Read the latest audit events |
| GET | `/api/audit/verify` | Verify the complete hash-linked chain |

## Production deployment handoff

The frontend and API are separate deployables. Vite builds the browser app; it does not host Express or MongoDB. No hosting provider has been selected, so there are no provider-specific deployment files in this repository. Choose a static frontend host and a Node.js API host, then follow their dashboard-specific steps below.

### Frontend (static site)

1. Connect the repository to a static hosting service and set its project/root directory to `client`.
2. Set the build command to `npm run build` and the publish/output directory to `dist`.
3. Add the build-time variable `VITE_API_URL=https://<your-api-host>/api`. This is a public URL included in browser code, not a secret. The production client intentionally reports a configuration error rather than calling localhost if this variable is missing.
4. Configure the host's SPA fallback so unknown paths serve `/index.html` with status 200. This is needed for direct visits and refreshes of `/login`, `/register`, and `/dashboard`; exact rewrite syntax depends on the selected host.
5. Use HTTPS. Record the final frontend origin for the API's `CLIENT_ORIGIN` setting.

### Backend (Node.js web service)

1. Connect the same repository as a Node service and set its project/root directory to `server`.
2. Use `npm start` as the start command. The service listens on the platform-provided `PORT` (with 4000 as the local fallback).
3. Enter these variables in the API host dashboard. Keep values in the dashboard's secret/environment settings; do not add them to source files or commit them.

   | Variable | Value to enter | Secret? |
   |---|---|---|
   | `MONGODB_URI` | MongoDB Atlas connection string for the production database | Yes |
   | `JWT_SECRET` | A newly generated, long random signing secret | Yes |
   | `CLIENT_ORIGIN` | Exact HTTPS origin of the deployed frontend, without a trailing slash | No |
   | `NODE_ENV` | `production` | No |
   | `PORT` | Usually supplied automatically by the host; set only if required | No |
   | `MONGODB_DNS_SERVERS` | Optional comma-separated resolver IPs only if Atlas SRV lookup fails on the host | No |

4. Confirm the health endpoint `https://<your-api-host>/api/health` returns `{"status":"ok"}`. The API begins listening only after Mongoose connects.
5. The session cookie is `Secure` in production and uses `SameSite=Lax`. Use a frontend and API on the same site (for example, separate subdomains of one custom domain), or configure a same-origin API proxy. Unrelated default hosting domains may cause browsers to withhold the session cookie.

### MongoDB Atlas

Create a production database user with access only to the Veylora database, store its URI only in the API host settings, and allow the API host's outbound network access in Atlas Network Access. Prefer a stable egress IP or private networking when available; do not expose the database to every IP address for production. Configure backups before storing real operational data.

### Deployment verification checklist

- [ ] Frontend HTTPS URL opens and the landing-page navigation works.
- [ ] Refresh direct visits to `/login`, `/register`, and `/dashboard`; the static host must return the SPA rather than a 404.
- [ ] API health endpoint returns `{"status":"ok"}` and its logs do not show a database connection error.
- [ ] Register a donor and recipient, sign in, refresh the dashboard, and verify protected access.
- [ ] Create a donation as the donor; refresh and confirm the record is still present.
- [ ] Reserve and collect it as a recipient; confirm persisted status and impact totals.
- [ ] Log out, refresh, and confirm protected pages require signing in again.

Do not call the app deployed until the frontend, API, and database have passed these checks together. After deployment, rotate any temporary or development credentials before using real data.

The landing page displays the official SDG 2, 12, and 13 icon artwork from externally hosted image files, so an internet connection is needed to load them. The page includes the UN's requested link and disclaimer; Veylora is not endorsed by the UN. See the [UN SDG communications materials and usage guidance](https://www.un.org/sustainabledevelopment/news/communications-material/).

## Current limitations

- Email ownership is not verified, and the MVP does not include account recovery, email verification, or login rate limiting. Add these before public production use.
- Donations created before account ownership was added remain stored and visible to recipients while active. They have no `donorId`, so no new donor account can edit them. Historical reservations without `recipientId` remain preserved but cannot be managed by a newly registered recipient account.
- Donor confirmation, recipient coordination, expiry automation, and notifications are manual.
- The audit chain detects edits/reordering in the current database sequence and appends are ordered within one API process; it is not an external immutable ledger. Run one API instance for this MVP. A privileged database operator could rewrite the entire chain.
- The impact factor is intentionally simple and illustrative, not a life-cycle assessment.
