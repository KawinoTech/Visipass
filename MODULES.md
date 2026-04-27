# Visipass Module and Function Documentation

This document lists the current application modules and all exported functions/endpoints in `src`.

## 1) App Shell and Layout Modules

- `src/app/layout.tsx`
  - `RootLayout({ children })`: Root HTML layout wrapper.
- `src/app/loading.tsx`
  - `AppLoading()`: Global loading UI.
- `src/app/page.tsx`
  - `RootPage()`: Root route entry page.
- `src/app/(protected)/layout.tsx`
  - `ProtectedLayout({ children })`: Wrapper for protected pages.
- `src/instrumentation.ts`
  - `register()`: Startup instrumentation registration.

## 2) UI Components Modules

- `src/components/header/AppHeader.tsx`
  - `AppHeader()`: Main app header/navigation bar.
- `src/components/ui/Preloader.tsx`
  - `Preloader(props)`: Reusable loader component.
  - `LoadingOverlay({ label })`: Blocking overlay loader.
- `src/components/auth/IdleLogoutGuard.tsx`
  - `IdleLogoutGuard()`: Idle session timeout guard.

## 3) Theme and Client Store Modules

- `src/lib/theme/theme-store.tsx`
  - `ThemeProvider({ children })`: Theme context provider.
  - `useThemeStore()`: Theme state hook.

## 4) Authentication and Authorization Modules

- `src/lib/auth/require-user.ts`
  - `requireUser(request)`: Validates authenticated user session.
- `src/lib/auth/require-admin.ts`
  - `requireAdmin(request)`: Validates admin-only access.
- `src/app/api/auth/login/route.ts`
  - `POST(req)`: Login endpoint.
- `src/app/api/auth/logout/route.ts`
  - `POST(req)`: Logout endpoint.
- `src/app/api/auth/me/route.ts`
  - `GET(req)`: Current-session user endpoint.

## 5) Logging and Database Modules

- `src/lib/logging/audit.ts`
  - `getRequestMeta(req)`: Extracts request IP and user agent.
  - `writeAuditLog(input)`: Writes audit events to file/DB.
- `src/lib/db/prisma.ts`
  - `prisma`: Prisma client singleton.

## 6) Validation and Bootstrap Modules

- `src/lib/validation/create-user.ts`
  - `USER_ROLES`: Allowed user role constants.
  - `USER_LOCATIONS`: Allowed location constants.
  - `USER_FLOORS`: Allowed floor constants.
  - `MUA_EMAIL_DOMAIN`: Required email domain.
  - `createUserRequestSchema`: User-create request validator.
- `src/lib/validation/index.ts`
  - Central validation exports.
- `src/lib/bootstrap/ensure-default-admin.ts`
  - `ensureDefaultAdmin()`: Seeds/ensures default admin account.
- `src/lib/scheduler/pre-registration-auto-cancel.ts`
  - `startPreRegistrationAutoCancelScheduler()`: Starts auto-cancel scheduler.

## 7) Protected Page Modules

- `src/app/home/page.tsx`
  - `HomePage()`: Command center/home dashboard page.
- `src/app/(protected)/dashboard/page.tsx`
  - `DashboardPage()`: Building/floor live occupancy page.
- `src/app/(protected)/visits/page.tsx`
  - `VisitsPage()`: Visit operations page (check-in workflows).
- `src/app/(protected)/visits/consent-qr/page.tsx`
  - `ConsentQrPage()`: QR consent workflow page.
- `src/app/(protected)/visitors/page.tsx`
  - `VisitorsPage()`: Visitor directory listing page.
- `src/app/(protected)/visitors/VisitorsTable.tsx`
  - `VisitorsTable({ visitors })`: Interactive visitors table component.
- `src/app/(protected)/visitors/[id]/page.tsx`
  - `VisitorDetailPage()`: Visitor profile detail page.
- `src/app/(protected)/preregistration/page.tsx`
  - `PreRegistrationCreatePage()`: Create pre-registration page.
- `src/app/(protected)/pre-registrations/page.tsx`
  - `PreRegistrationsPage()`: Pre-registrations list page.
- `src/app/(protected)/reports/page.tsx`
  - `ReportsPage()`: Reports and export page.
- `src/app/(protected)/audit-logs/page.tsx`
  - `AuditLogsPage()`: Audit log viewer page.
- `src/app/(protected)/users/new/page.tsx`
  - `UserManagementPage()`: User management page.

## 8) Public Page Modules

- `src/app/(public)/login/page.tsx`
  - `LoginPage()`: Login page.
- `src/app/(public)/self-service/page.tsx`
  - `SelfServicePage()`: Self-service visitor pre-registration page.
- `src/app/(public)/visitor-consent/page.tsx`
  - `VisitorConsentPage()`: Public consent capture page.
- `src/app/(public)/qr-generator/page.tsx`
  - `QrGeneratorPage()`: Public QR generator page.

## 9) API Modules: User Management

- `src/app/api/users/route.ts`
  - `GET(req)`: List users.
  - `POST(req)`: Create user.
- `src/app/api/users/[id]/route.ts`
  - `GET(req, context)`: Get user by id.
  - `PATCH(req, context)`: Update user.
  - `DELETE(req, context)`: Delete user.

## 10) API Modules: Visits and Visitors

- `src/app/api/visits/route.ts`
  - `POST(req)`: Create/check-in visit (walk-in and pre-registered flows).
- `src/app/api/visits/[id]/route.ts`
  - `GET(req, context)`: Get visit details.
- `src/app/api/visits/[id]/check-out/route.ts`
  - `POST(req, context)`: Check out active visit.
- `src/app/api/visitors/[id]/check-in/route.ts`
  - `POST(req, context)`: Re-check-in existing visitor from directory.
- `src/app/api/visitors/[id]/preregister/route.ts`
  - `POST(req, context)`: Create preregistration from visitor record.
- `src/app/api/visitors/[id]/blacklist/route.ts`
  - `POST(req, context)`: Blacklist visitor.
- `src/app/api/visitors/[id]/unblacklist/route.ts`
  - `POST(req, context)`: Remove visitor blacklist flag.

## 11) API Modules: Pre-registrations

- `src/app/api/pre-registrations/route.ts`
  - `GET(req)`: List/search pre-registrations.
  - `POST(req)`: Create pre-registration.
- `src/app/api/pre-registrations/my-visitors/route.ts`
  - `GET(req)`: Employee-scoped visitor list.

## 12) API Modules: Dashboard, Reports, Audit

- `src/app/api/dashboard/summary/route.ts`
  - `GET(req)`: Dashboard summary stats.
- `src/app/api/dashboard/active-visits/route.ts`
  - `GET(req)`: Active visits feed.
- `src/app/api/reports/summary/route.ts`
  - `GET(req)`: Report summary metrics.
- `src/app/api/reports/visits.csv/route.ts`
  - `GET(req)`: Visit CSV export.
- `src/app/api/reports/visitors.csv/route.ts`
  - `GET(req)`: Visitors CSV export.
- `src/app/api/audit-logs/route.ts`
  - `GET(req)`: Audit log query endpoint.

## 13) API Modules: Public APIs

- `src/app/api/public/walk-in/route.ts`
  - `GET()`: Public hosts list for self-service.
  - `POST(req)`: Public walk-in pre-registration capture.
- `src/app/api/public/visits/[id]/route.ts`
  - `GET(_req, ctx)`: Public visit detail for consent screens.
- `src/app/api/public/visits/[id]/consent/route.ts`
  - `POST(req, ctx)`: Record consent for visit.
- `src/app/api/public/pre-registrations/[id]/route.ts`
  - `GET(_req, ctx)`: Public pre-registration detail.
- `src/app/api/public/pre-registrations/[id]/consent/route.ts`
  - `POST(req, ctx)`: Record consent for pre-registration.

## 14) API Modules: Utilities

- `src/app/api/employees/route.ts`
  - `GET(req)`: Employee lookup endpoint.
- `src/app/api/qr-code/route.ts`
  - `POST(req)`: Generate QR code data URL from text.
- `src/app/api/theme/me/route.ts`
  - `GET()`: Fetch current theme preference.
- `src/app/api/theme/update/route.ts`
  - `POST(req)`: Update theme preference (currently placeholder behavior).

## 15) Test Modules

- `src/app/api/auth/login/route.test.ts`
- `src/app/api/users/route.test.ts`
- `src/app/api/users/[id]/route.test.ts`
- `src/lib/auth/require-admin.test.ts`
- `src/lib/validation/create-user.test.ts`

These modules validate authentication, authorization, user API behaviors, and schema validation logic.
