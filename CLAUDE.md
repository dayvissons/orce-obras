# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # production build
npm run db:push      # sync Prisma schema → Supabase (runs migrations)
npm run db:generate  # regenerate Prisma client after schema changes
npm run db:studio    # open Prisma Studio GUI for the database
```

No lint or test scripts are configured.

## Required environment variables

Copy `.env.example` to `.env.local`. All five vars must be set:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase pooler URL (pgbouncer, transaction mode, port 6543) |
| `DIRECT_URL` | Supabase direct URL (session mode, port 5432) — used by Prisma migrations |
| `NEXTAUTH_URL` | Full app URL (`http://localhost:3000` for dev) |
| `NEXTAUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |

`DATABASE_URL` must include `?pgbouncer=true` because Supabase routes it through a connection pooler.

## Architecture

**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Prisma ORM · NextAuth v4 · Supabase (PostgreSQL)

### Data model

The core domain is an **Obra** (construction project). Every Obra has **ObraMembers** (users with `role: "owner" | "editor"`). Two cost categories hang off each Obra:

- **Servico** (labor/services) — tracks a contractor (`prestador`), category, total value, and zero-to-many **Pagamento** records (partial payments with date + optional note).
- **Material** — tracks an item, category, total value, and zero-to-many **FormaPagamento** records (payment method + amount, e.g. PIX, credit card).

### API layer (`src/app/api/`)

Every route handler follows the same pattern:
1. `getServerSession(authOptions)` — reject 401 if not authenticated.
2. `checkAccess(obraId, userId)` — query `ObraMember` by `{ obraId_userId }` unique index; reject 403 if not a member.
3. Execute Prisma query and return JSON.

The `checkAccess` helper is defined locally in each route file (not shared). Nested routes create/replace child records in a single Prisma write using nested `create`/`deleteMany` — e.g., PUT on a Servico deletes all its Pagamentos and re-creates them from the request body.

The invite endpoint (`/api/obras/[obraId]/convidar`) looks up a user by email and upserts an ObraMember. The invited user must have logged in at least once (their User row must already exist).

### Auth (`src/lib/auth.ts`)

NextAuth v4 with the Prisma adapter (stores sessions/accounts in DB). Google OAuth is the only provider. The `session` callback injects `user.id` into the session object — this is how `session.user.id` is available in API routes and why `src/types/next-auth.d.ts` extends the Session type.

### Client pages

`src/app/obras/[obraId]/page.tsx` is a single large `"use client"` component. All UI for the obra detail view — tabs (Resumo / Serviços / Materiais), four modal bottom-sheets, and all fetch calls — lives in this one file. There are no separate component files. The home page (`src/app/page.tsx`) is the obras list.

### Prisma client (`src/lib/prisma.ts`)

Singleton pattern via `globalThis` to prevent multiple client instances during Next.js hot reload in development.
