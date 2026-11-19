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
