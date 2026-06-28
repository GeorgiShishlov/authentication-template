# CLAUDE.md

@.claude/claude-memory-bank.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack authentication demo with a Node.js/Express backend and a Next.js frontend. Users can register, log in, and view their profile. Auth state is maintained via httpOnly JWT cookies.

## Commands

### Backend (`backend/`)
```bash
npm run dev      # Development with nodemon (auto-restart)
npm start        # Production start
```
Backend runs on `http://localhost:3001`.

### Frontend (`frontend/`)
```bash
npm run dev      # Next.js dev server
npm run build    # Production build
npm run lint     # ESLint
```
Frontend runs on `http://localhost:3000`.

Both servers must run simultaneously for the app to work.

## Architecture

### Backend (`backend/src/`)
- `app.js` — Express entry point; registers middleware and routes, calls `initializeDatabase()` before listening
- `config/database.js` — Opens SQLite file at `backend/database.sqlite`, creates `users` table on first run; exports `getDb()` singleton
- `models/User.js` — DB access layer: `createUser`, `findUserByEmail`, `findUserById`, `verifyPassword` (bcrypt)
- `middleware/auth.js` — JWT verification; reads token from `req.cookies.token` or `Authorization` header; sets `req.userId`
- `routes/auth.js` — `POST /api/auth/register`, `POST /api/auth/login` (sets httpOnly cookie), `POST /api/auth/logout` (clears cookie)
- `routes/profile.js` — `GET /api/profile/me` (protected by `authMiddleware`)

Backend requires a `backend/.env` with `PORT` and `JWT_SECRET`.

### Frontend (`frontend/`)
- Next.js App Router with TypeScript and Tailwind CSS v4
- `lib/api.ts` — Thin fetch wrapper (`apiCall`) that always sends `credentials: 'include'` for cookies; exports `authAPI` object covering all auth endpoints
- `app/page.tsx` — Combined login/register form (client component); redirects to `/profile` on success
- `app/profile/page.tsx` — Protected profile page; redirects to `/` if `getProfile()` throws (unauthenticated)

### Auth Flow
1. Login → backend sets `token` httpOnly cookie (7 days)
2. Frontend pages call `authAPI.getProfile()` on mount; if it fails, redirect to `/`
3. Logout → backend clears cookie → frontend redirects to `/`

## Next.js Version Note

This project uses Next.js 16 (see `frontend/AGENTS.md`). APIs and conventions may differ from older versions. Before making changes, check `node_modules/next/dist/docs/` for the current behavior.
