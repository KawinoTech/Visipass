# Visipass Technical Documentation

## 1. Overview

Visipass is a Next.js 15 App Router application for visitor lifecycle management at MUA.
It supports:

- reception-led check-in operations,
- self-service visitor pre-registration and consent,
- visitor directory and blacklist management,
- reporting and audit visibility.

The system combines:

- server-rendered pages for protected modules,
- client-side workflows for interactive forms,
- API routes for business operations,
- Prisma ORM over MySQL/PostgreSQL-compatible schemas,
- JWT cookie authentication with role-based authorization.

## 2. Technology Stack

- Framework: `next@15` (App Router)
- Language: TypeScript
- UI: React 19 + CSS Modules
- Validation: `zod`
- Password hashing: `bcryptjs`
- Auth tokens: `jsonwebtoken`
- QR generation: `qrcode`
- Database ORM: Prisma (`@prisma/client`)
- Tests: Vitest

## 3. Repository Structure

- `src/app`: pages, layouts, and API routes
- `src/components`: reusable UI/header/auth components
- `src/lib`: auth, db, logging, validation, scheduler, bootstrap logic
- `prisma`: engine-specific schema files
- `logs`: runtime audit log file output (`audit.log`)
- `middleware.ts`: route-level access gate for browser navigation

## 4. Runtime Architecture

### 4.1 Application layers

- **Presentation layer**: pages under `src/app/(public)` and `src/app/(protected)`.
- **API layer**: endpoints under `src/app/api/**/route.ts`.
- **Domain/service helpers**: reusable modules under `src/lib/**`.
- **Persistence layer**: Prisma client (`src/lib/db/prisma.ts`) + schema models (`prisma/*.prisma`).

### 4.2 Request flow (protected page)

1. Browser requests a protected route.
2. `middleware.ts` checks if route is public.
3. If protected, middleware validates token existence and calls `/api/auth/me`.
4. If invalid, user is redirected to `/login` and auth cookies are cleared.
5. If valid, route resolves and page loads.

### 4.3 Request flow (protected API)

1. Route calls `requireUser()` or `requireAdmin()`.
2. JWT is validated using `JWT_SECRET`.
3. DB user is loaded and checked for `isActive`.
4. Role checks are applied route-by-route.
5. Business logic executes and returns JSON response.

## 5. Authentication and Authorization

## 5.1 Authentication

- Login endpoint: `POST /api/auth/login`
- Token cookie: `access_token` (legacy fallback `token`)
- Token payload includes user identity + role.
- Logout endpoint clears auth cookies.

## 5.2 Authorization

- `requireUser(request)`: allows any authenticated active user.
- `requireAdmin(request)`: allows authenticated active admin user.
- Many operational routes add stricter role checks (e.g., Admin + Receptionist).

## 6. Data Model

Primary entities from Prisma schema:

- `User`: staff accounts, roles, branch/floor assignment, active status.
- `Visitor`: person profile, optional company/contact/doc details, blacklist status.
- `Visit`: lifecycle record (`PENDING`, `CHECKED_IN`, `CHECKED_OUT`, `CANCELLED`), host and consent timestamps.
- `PreRegistration`: expected arrivals, host assignment, conversion tracking, consent timestamp.
- `GuestCard`: issued/returned guest card lifecycle (linked one-to-one with `Visit`).
- `AuditLog`: event-based operation logs (`SUCCESS`/`FAILURE`).

Enumerations define controlled values for user role/location/floor, visit status, pre-registration status, and audit status.

## 7. Core Functional Modules

## 7.1 Home and Command Center

- Route: `/home`
- Displays operational summary stats and navigation cards.
- For privileged roles, includes active-visitor check-out control table.

## 7.2 Visit Operations

- Route: `/visits`
- Supports:
  - walk-in check-in,
  - pre-registered check-in,
  - self-service conversion.
- Enforces host selection/floor assignment and document capture rules.
- Handles consent validity window with `CONSENT_EXPIRY_DAYS`.

## 7.3 Self-Service

- Route: `/self-service`
- Public form for walk-in data capture.
- Creates pre-registration record through `POST /api/public/walk-in`.
- Uses QR flow (`/visitor-consent`) and polling/manual consent fallback.

## 7.4 Visitors Directory

- Routes: `/visitors`, `/visitors/[id]`
- Search/filter/sort visitor list.
- Supports rapid operational actions:
  - check in again,
  - pre-register,
  - blacklist/unblacklist.

## 7.5 Dashboard, Reports, and Audit Logs

- `/dashboard`: live occupancy and floor visualization.
- `/reports`: summary metrics and CSV exports.
- `/audit-logs`: filterable security/operation event history.

## 8. API Surface (High-Level)

Grouped endpoint families:

- **Auth**: `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- **Users**: `/api/users`, `/api/users/[id]`
- **Visits**: `/api/visits`, `/api/visits/[id]`, `/api/visits/[id]/check-out`
- **Visitors**: `/api/visitors/[id]/check-in|preregister|blacklist|unblacklist`
- **Pre-registrations**: `/api/pre-registrations`, `/api/pre-registrations/my-visitors`
- **Dashboard**: `/api/dashboard/summary|active-visits`
- **Reports**: `/api/reports/summary`, `/api/reports/visits.csv`, `/api/reports/visitors.csv`
- **Public/Kiosk**: `/api/public/walk-in`, `/api/public/.../consent`
- **Utilities**: `/api/qr-code`, `/api/theme/me`, `/api/theme/update`

For detailed module-by-module function inventory, see `MODULES.md`.

## 9. Logging and Observability

Audit logging helper: `src/lib/logging/audit.ts`

- `writeAuditLog()` writes to:
  - file (`logs/audit.log`) always,
  - `AuditLog` DB table when delegate is available.
- `getRequestMeta()` captures IP and user-agent for audit context.
- Operation routes log success/failure events with optional metadata.

Scheduler logging:

- `startPreRegistrationAutoCancelScheduler()` logs sweep startup/result/failure to server console.

## 10. Startup Tasks and Schedulers

`src/instrumentation.ts` runs on Node runtime startup and:

1. Ensures default admin account exists (`ensureDefaultAdmin()`).
2. Starts daily pre-registration auto-cancel scheduler.

Auto-cancel scheduler:

- Module: `src/lib/scheduler/pre-registration-auto-cancel.ts`
- Default run time: daily at 17:00 server time.
- Cancels stale `PENDING` pre-registrations whose `expectedAt` is before tomorrow start.

## 11. Configuration

Key environment variables used by code:

- `JWT_SECRET` - JWT signing/verification secret.
- `DATABASE_URL_MYSQL` - preferred DB connection URL.
- `DATABASE_URL` / `DATABASE_URL_POSTGRES` - fallback DB URLs.
- `AUDIT_LOG_FILE` - optional audit file path override.
- `CONSENT_EXPIRY_DAYS` - consent validity period (default 90).
- `SELF_SERVICE_ROUTING_USER_LOGIN_ID` - optional fixed routing account for self-service.
- `NEXT_PUBLIC_IDLE_LOGOUT_MINUTES` - frontend idle logout control.
- `NODE_ENV`, `NEXT_RUNTIME` - runtime behavior gates.

## 12. Security Considerations

- Passwords are hashed (`bcrypt`) and never stored in plaintext.
- Session cookie is `HttpOnly`; `secure` is enforced in production.
- Disabled users are denied both UI and API operations.
- Authorization is explicit at API handler level (defense in depth).
- Sensitive operations are audit-logged with actor/request metadata.

## 13. Error Handling Strategy

- Validation failures: `400` with field/form error payloads where applicable.
- Authentication failures: `401`.
- Authorization failures: `403`.
- Not found / invalid state: `404` / `409` / `410` depending on context.
- Database initialization outages: `503`.
- Unexpected failures: `500` with safe error messages.

## 14. Testing

Current automated tests cover:

- auth login route behavior,
- admin guard logic,
- user routes,
- create-user schema validation.

Run:

- `npm test` (one-off)
- `npm run test:watch` (watch mode)

## 15. Build and Run

Install dependencies:

- `npm install`

Database init (default MySQL path):

- `npm run prisma:generate`
- `npm run db:init`

Run in development:

- `npm run dev`

Production build/start:

- `npm run build`
- `npm run start`

## 16. Related Project Docs

- `MODULES.md`: module + exported function inventory.
- `FRONTEND_URLS.md`: route quick reference.
- `DATABASE_SWITCHING.md`: MySQL/PostgreSQL switch guidance.
- `TESTING.md`: testing notes and practices.
