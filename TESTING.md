# Unit Testing Guide

## What is covered now

### 1) Validation tests
File: `src/lib/validation/create-user.test.ts`

Test cases:
- Accept valid create-user payload.
- Reject wrong email domain (must be `@mua.co.ke`).
- Reject floor when location is not `HEAD_OFFICE`.
- Reject weak password.

### 2) Authorization guard tests
File: `src/lib/auth/require-admin.test.ts`

Test cases:
- Missing token -> `401`.
- Invalid payload (no user id) -> `401`.
- Disabled account -> `403`.
- Non-admin role -> `403`.
- Active admin -> success.

### 3) API route unit tests (with mocks)
Files:
- `src/app/api/auth/login/route.test.ts`
- `src/app/api/users/route.test.ts`
- `src/app/api/users/[id]/route.test.ts`

Covered cases:
- Login:
  - missing credentials -> `400`
  - user not found -> `401`
  - wrong password -> `401`
  - valid credentials -> `200`
- Users route:
  - GET non-admin -> `403`
  - GET admin success -> `200`
  - POST invalid payload -> `400`
  - POST valid payload -> `201`
- Users-by-id route:
  - GET non-admin -> `403`
  - GET missing user -> `404`
  - GET success -> `200`
  - PATCH empty payload -> `400`
  - PATCH invalid location/floor -> `400`
  - PATCH success -> `200`

---

## How to run tests

## 1) Install dependencies
```bash
npm install
```

## 2) Run once (CI style)
```bash
npm test
```

## 3) Run in watch mode (local dev)
```bash
npm run test:watch
```

---

## Notes

- Test runner: **Vitest** (`vitest.config.ts`).
- Alias `@/` is supported in tests.
- Current tests are unit tests only (fast and isolated).
- API route tests are isolated with mocked `prisma`, `requireAdmin`, `bcrypt`, and `jwt`.
- Next recommended step: add API route tests for:
  - `POST /api/auth/login`
  - `POST /api/users`
  - `PATCH /api/users/:id`
