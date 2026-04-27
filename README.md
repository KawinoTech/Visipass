# Visipass

Visitor management platform built with Next.js, Prisma, and role-based access control.

## What It Does

Visipass supports:

- staff authentication and role-based access (`ADMIN`, `RECEPTIONIST`, `SECURITY`, `EMPLOYEE`)
- visitor check-in operations (walk-in, pre-registered, self-service)
- visitor directory actions (re-check-in, preregister, blacklist/unblacklist)
- consent capture workflows (including QR-based consent)
- dashboard, reports/CSV exports, and audit logs

## Tech Stack

- Next.js 15 (App Router) + React 19
- TypeScript
- Prisma ORM
- MySQL/PostgreSQL schema support
- Zod validation
- JWT auth + bcrypt password hashing
- Vitest for tests

## Project Structure

- `src/app` - pages, layouts, API routes
- `src/components` - shared UI components
- `src/lib` - auth, db, logging, validation, scheduler
- `prisma` - Prisma schema files
- `logs` - runtime audit logs

## Prerequisites

- Node.js 18+
- npm
- MySQL or PostgreSQL instance

## Environment Variables

Create `.env` with at least:

- `JWT_SECRET`
- `DATABASE_URL_MYSQL` (preferred runtime default), or
- `DATABASE_URL` / `DATABASE_URL_POSTGRES`

Optional:

- `AUDIT_LOG_FILE`
- `CONSENT_EXPIRY_DAYS`
- `SELF_SERVICE_ROUTING_USER_LOGIN_ID`
- `NEXT_PUBLIC_IDLE_LOGOUT_MINUTES`

## Installation

```bash
npm install
```

## Database Setup

Default (MySQL):

```bash
npm run prisma:generate
npm run db:init
```

Explicit engine options:

```bash
npm run prisma:generate:mysql
npm run db:init:mysql

npm run prisma:generate:postgres
npm run db:init:postgres
```

## Run Locally

```bash
npm run dev
```

App runs on [http://localhost:3000](http://localhost:3000).

## Build for Production

```bash
npm run build
npm run start
```

## Testing

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

## Authentication and Access

- login via `/login`
- protected pages are gated by middleware + `/api/auth/me`
- API access control enforced with:
  - `requireUser`
  - `requireAdmin`

## Logging

- Audit logs are written to:
  - file: `logs/audit.log`
  - database: `AuditLog` table (when delegate available)
- Core helper: `src/lib/logging/audit.ts`

## Scheduled Jobs

On server startup (`src/instrumentation.ts`):

- ensures default admin exists
- starts daily pre-registration auto-cancel scheduler

## Key Documentation

- `TECHNICAL_DOCUMENTATION.md` - full technical guide
- `MODULES.md` - module/function inventory
- `FRONTEND_URLS.md` - route reference
- `DATABASE_SWITCHING.md` - DB engine switching notes
- `TESTING.md` - testing details

## Notes

- Keep `.env` out of version control.
- Regenerate Prisma client whenever switching schema engine.
