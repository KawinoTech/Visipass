# Visipass Module Documentation

## 1) Authentication Module

### Purpose
Handles sign-in, sign-out, and current-session user resolution.

### Routes
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Behavior
- Login accepts `userId` (`userLoginId`) + password.
- Passwords are verified against `passwordHash` using `bcrypt`.
- JWT is stored in `access_token` cookie (`HttpOnly`).
- Disabled accounts cannot log in and are rejected from active sessions.

---

## 2) Authorization Module

### Purpose
Enforces admin-only access for protected management APIs.

### Core helper
- `src/lib/auth/require-admin.ts`

### Behavior
- Verifies token.
- Loads DB user by token subject.
- Rejects missing/invalid/disabled users.
- Requires both token role and DB role to be `ADMIN`.

---

## 3) Home Module (`/home`)

### Purpose
Main command center for navigation into system functions.

### Features
- Quick stats cards.
- Function cards for user management, visitors, visits, dashboard, reports.
- Admin-gated entry to user management:
  - Admin -> route to `/users/new`
  - Non-admin -> toast: `Unauthorized, please contact admin`

---

## 4) User Management Module (`/users/new`)

### Purpose
Admin workspace for user lifecycle operations.

### Features
- **Overview tab**
  - User list retrieval (`GET /api/users`)
  - Filtering:
    - Search by full name, user ID, email
    - Role filter
    - Status filter (active/disabled)
  - Sorting:
    - Full name, user ID, role, created date
    - Asc/desc direction toggle
  - Edit user modal (role, status, location, floor, name, delete)
- **Create tab**
  - Create user (`POST /api/users`)
  - Domain-locked email composition (`@mua.co.ke`)
  - Head Office floor logic
  - Request-in-flight button locking and saving state
- **Breadcrumb**
  - `Back to Home`

### API routes
- `GET /api/users` (admin-only)
- `POST /api/users` (admin-only)
- `GET /api/users/:id` (admin-only)
- `PATCH /api/users/:id` (admin-only)
- `DELETE /api/users/:id` (admin-only)

---

## 5) UI/UX Standards Implemented

### Preloader system
- Reusable loader component:
  - `src/components/ui/Preloader.tsx`
  - `src/components/ui/preloader.module.css`
- Global route loading:
  - `src/app/loading.tsx`
- Client-action loading overlays and inline loaders for long-running requests.

### Responsiveness
- User management uses responsive grid/form/table wrappers.
- Home module uses breakpoint-based card layout (`1 -> 2 -> 3` columns).
- Horizontal overflow is constrained globally.

### Toast feedback
- Success and error toasts are shown for create, update, auth gate failures, and fetch failures.

---

## 6) Runtime Error Handling

### Current handling
- Database initialization failures return `503` where applicable.
- Validation failures return structured `400` payloads.
- Unauthorized and forbidden access return `401/403`.

### Notes for next iteration
- Add shared response helpers to reduce duplicated error branches.
- Add unified toast utility (shared hook/component) for all pages.
- Add middleware-level account status redirect for page navigation guards.
