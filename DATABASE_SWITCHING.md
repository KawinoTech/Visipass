# Database Engine Switching (MySQL/PostgreSQL)

Visipass now has two Prisma schema files:

- `prisma/schema.mysql.prisma`
- `prisma/schema.postgresql.prisma`

## 1) Set env vars

In `.env`, define both URLs:

- `DATABASE_URL_MYSQL` = `mysql://user:password@host:3306/visipass`
- `DATABASE_URL_POSTGRES` = `postgresql://user:password@host:5432/visipass?schema=public`

Runtime currently uses `DATABASE_URL_MYSQL`.

## 2) Generate Prisma client for that engine

- MySQL: `npm run prisma:generate:mysql`
- PostgreSQL: `npm run prisma:generate:postgres`

## 3) Create/update tables

- MySQL: `npm run db:init:mysql`
- PostgreSQL: `npm run db:init:postgres`

## 4) Start app

- `npm run dev`

## Notes

- Default scripts remain MySQL-oriented:
  - `npm run prisma:generate`
  - `npm run prisma:migrate`
  - `npm run db:init`
- If you switch engines, always regenerate Prisma client first before running the app.
