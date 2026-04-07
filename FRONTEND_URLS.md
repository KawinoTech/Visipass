# Visipass Frontend URLs

Use this as a quick reference for app routes.

## Public

- `/` - Visipass command center homepage
- `/login` - Login page

## Protected

- `/dashboard` - Dashboard
- `/users/new` - Admin: Create user
- `/visitors` - Visitors list
- `/visitors/[id]` - Visitor detail
- `/visits` - Visit operations
- `/pre-registrations` - Pre-registration flows
- `/reports` - Reports and exports

## Notes

- Protected routes are wrapped by `src/app/(protected)/layout.tsx`.
- Route groups `(public)` and `(protected)` are folder organizers and do not appear in URL paths.
