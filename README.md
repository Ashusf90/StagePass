# StagePass — Multi-Vendor Event Ticketing & Seat Reservation System

A full-stack MERN (MongoDB, Express.js, React, Node.js) event ticketing and seat reservation platform featuring atomic seat locking, idempotent payment webhooks, cryptographic QR ticket verification, and role-based dashboards for Attendees, Organizers, and Admins.

---

## Key Features

- **JWT Authentication & RBAC**: Access + rotated refresh tokens with SHA-256 token hashing and Role-Based Access Control across `attendee`, `organizer`, and `admin` roles.
- **Atomic 10-Minute Seat Locking**: Conditional `findOneAndUpdate` seat locks prevent double-booking under concurrent requests, paired with partial-batch rollback, lazy expiry checks, and a background cleanup job (`15s` interval).
- **Idempotent Checkout & Payment Webhooks**: Supports `Idempotency-Key` checkout replays, promo code discounts, HMAC-SHA256 webhook signature verification, and `PaymentWebhookEvent` deduplication via unique `providerEventId` indexes.
- **Cryptographic QR Ticketing & Gate Check-In**: Generates signed QR JWT payloads rendered as scannable QR codes (`qrcode.react`) and enforces single-use venue admission via atomic `checkedInAt: null` updates.
- **Multi-Role Interfaces**:
  - **Attendee**: Event discovery with search/category/date filters, interactive seat map & GA tier selector, live `MM:SS` hold countdown, checkout, QR pass wallet, and eligible self-service cancellations/refunds.
  - **Organizer**: Studio KPIs, event & dynamic seat-map/tier builder, section-level sales analytics, promo code management, and Gate QR Verification tool.
  - **Admin**: Organizer & event moderation queues, platform-wide booking ledger, webhook idempotency logs, and audit trail inspection.

---

## Tech Stack

- **Backend**: Node.js, Express.js, TypeScript (`tsx`), Mongoose, MongoDB (`mongodb-memory-server` fallback when `MONGODB_URI` is unset), Zod, `bcryptjs`, `jsonwebtoken`, `express-rate-limit`
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, `qrcode.react`

---

## Project Structure

```text
├── server.ts                  # Express + Vite server entry point (port 3000)
├── server/
│   ├── config/                # env.ts, db.ts (Mongoose + MemoryServer fallback)
│   ├── models/                # User, Event, Seat, Booking, PaymentWebhookEvent, AuditLog
│   ├── services/              # auth, seatLock, payment, booking, ticket, event services
│   ├── controllers/           # HTTP route handlers
│   ├── routes/                # auth, events, bookings, tickets, admin, webhooks
│   ├── middlewares/           # auth (JWT/RBAC), validate (Zod), rateLimiter, errorHandler
│   ├── jobs/                  # lockCleanupJob.ts
│   ├── utils/                 # crypto.ts (JWT, QR signing, HMAC), errors.ts
│   └── seed/                  # seedData.ts
└── src/
    ├── api/client.ts          # Fetch client with automatic JWT refresh rotation
    ├── context/               # AuthContext.tsx, ToastContext.tsx
    ├── components/            # DiscoveryPage, SeatSelectorView, TicketsPage,
    │                          # OrganizerDashboard, AdminPanel, AuthModal, Header
    └── types/api.ts           # Shared frontend TypeScript types

Getting Started
1. Install Dependencies
Bash
npm install
2. Configure Environment Variables
Copy .env.example to .env and set your configuration (optional for local development):
Env
MONGODB_URI=""
JWT_ACCESS_SECRET="change-me-access-secret-32-chars-min"
JWT_REFRESH_SECRET="change-me-refresh-secret-32-chars-min"
QR_SIGNING_SECRET="change-me-qr-signing-secret-32-chars"
PAYMENT_WEBHOOK_SECRET="change-me-webhook-hmac-secret-32-chars"
Note: If MONGODB_URI is left empty, StagePass automatically starts an in-memory MongoDB instance via mongodb-memory-server and seeds sample users, events, seats, bookings, and audit logs on startup.
3. Run in Development
Bash
npm run dev
The application and API run together on http://localhost:3000.
4. Type Check & Production Build
Bash
npm run lint
npm run build
npm start
Seeded Demo Accounts
All seeded accounts use password Password123! and can also be accessed via one-click sign-in inside the Sign In modal:
Role	Name	Email	Notes
Attendee	Alex Rivera	alex@stagepass.io	Pre-seeded confirmed booking (SP-8492KL) with QR pass
Organizer (Approved)	Elena Vance	elena@luminaevents.com	Owns seeded Concert, Festival & Summit events
Organizer (Pending)	Marcus Chen	marcus@horizonlive.io	Pending admin approval (The Glass Menagerie)
Admin	Nadia Sterling	admin@stagepass.io	Platform moderation, webhook logs & audit trail
Sample promo codes for seeded events: EARLY20 (20% off), MEMBER10 (10% off), SOLSTICE15 (15% off).
API Endpoints Overview
Authentication (/api/auth)
POST /api/auth/register — Register an attendee or organizer account
POST /api/auth/login — Authenticate and receive access + rotated refresh tokens
POST /api/auth/refresh — Rotate refresh token and issue fresh access token
POST /api/auth/logout — Revoke active refresh token
GET /api/auth/me — Fetch authenticated user profile
Events (/api/events)
GET /api/events — List published & approved events (search, category, date)
GET /api/events/:id — Get event details, live seat map, and tier availability
POST /api/events — (Organizer/Admin) Create event and generate seat/tier inventory
PATCH /api/events/:id — (Organizer/Admin) Update event status or add/update promo codes
GET /api/events/organizer/mine — (Organizer/Admin) List organizer's own events with sales metrics
GET /api/events/:id/analytics — (Organizer/Admin) Section occupancy and recent bookings
Seat Locking & Bookings (/api/bookings)
POST /api/bookings/lock — Atomically hold up to 8 seats/tiers for 10 minutes
DELETE /api/bookings/:id/lock — Release an active hold early
POST /api/bookings/:id/checkout — Validate lock ownership, apply promo code, create PaymentIntent (Idempotency-Key supported)
POST /api/bookings/:id/confirm-sandbox — Dispatch HMAC-signed webhook via sandbox payment gateway (also supports simulateDuplicateProviderEventId testing)
GET /api/bookings/me — List attendee's bookings and QR passes
GET /api/bookings/:id — Fetch single booking details
POST /api/bookings/:id/cancel — Cancel eligible confirmed booking, process refund, and release seats
Payment Webhooks (/api/webhooks)
POST /api/webhooks/payment — Verify x-stagepass-signature HMAC-SHA256 header, enforce idempotency on providerEventId, transition seats locked -> booked, confirm booking, and issue signed QR token
Ticket Verification (/api/tickets)
POST /api/tickets/verify — (Organizer/Admin) Verify signed QR token, check event match, and atomically mark checkedInAt once
Admin Moderation (/api/admin)
GET /api/admin/overview — Platform metrics, organizers, events, bookings, webhook events, and audit logs
PATCH /api/admin/organizers/:id/status — Approve or suspend an organizer
PATCH /api/admin/events/:id/moderation — Approve or reject an event listing
