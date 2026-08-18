# Barangay Puerto Relief Inventory & Distribution Monitoring System

A full-stack web application built for Barangay Puerto, Cagayan de Oro City, powered by **React 18 + Tailwind CSS** on the frontend and **Node.js + Express + Prisma ORM** on the backend.

---

## 📁 Monorepo Directory Architecture

```
brgy-puerto/
├── frontend/                          — React 18, Vite 5, Tailwind CSS & Zustand
│   ├── src/                           — UI components, pages, stores, API client
│   ├── public/                        — Static branding assets & icons
│   ├── index.html                     — App HTML entry point
│   ├── package.json                   — Frontend dependencies & scripts
│   └── vite.config.js                 — Vite dev server & bundler config
│
├── backend/                           — Node.js & Express REST API Service (Prisma ORM)
│   ├── server.js                      — Express server entry point (Port 5000)
│   ├── package.json                   — Backend dependencies (@prisma/client, Express, JWT, bcryptjs)
│   ├── prisma/
│   │   ├── schema.prisma              — Relational database models & schema
│   │   ├── seed.js                    — Database seeder (Admin, Staff, Puroks, Sectors, Categories)
│   │   └── dev.db                     — SQLite database file (Local Development)
│   ├── db/
│   │   └── prisma.js                  — Prisma Client singleton instance
│   ├── services/
│   │   └── dbHelper.js                — Database helpers for logs, notifications & stock transactions
│   ├── controllers/                   — Route handlers with Prisma async transactions
│   ├── routes/                        — REST endpoints (/api/...)
│   └── middleware/                    — JWT auth & RBAC guards
│
├── package.json                       — Root orchestration scripts
└── netlify.toml                       — Deployment configuration
```

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
Run the installation for both frontend and backend:
```bash
npm run install:all
```

### 2. Set Up Database with Prisma (Backend)
Navigate to `backend/` or run from root:
```bash
# Push schema to create SQLite database
npm run db:push --prefix backend

# Seed default admin, staff, puroks, and relief packages
npm run db:seed --prefix backend
```

### 3. Start the Backend API Server
```bash
npm run dev:backend
```
*The Express API will listen on `http://localhost:5000`.*

### 4. Start the Frontend Dev Server
In a separate terminal window:
```bash
npm run dev:frontend
```
*The Vite frontend dev server will launch at `http://localhost:5174` (or `http://localhost:5173`).*

---

## 🗄️ Database Management with Prisma

- **Prisma Studio (Visual Database GUI)**:
  ```bash
  cd backend
  npm run db:studio
  ```
- **Deploying to Production with PostgreSQL**:
  1. Set your `DATABASE_URL` in `backend/.env` (e.g., Supabase, Neon, or Render PostgreSQL URL):
     ```env
     DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
     ```
  2. Change provider in `backend/prisma/schema.prisma`:
     ```prisma
     datasource db {
       provider = "postgresql"
       url      = env("DATABASE_URL")
     }
     ```
  3. Run `npm run db:push` and `npm run db:seed`.

---

## 🔑 Default Login Credentials (Seeded)

- **Admin Account**:
  - Username: `admin`
  - Password: `Admin@1234`
  - Role: `Admin`

- **Staff Account**:
  - Username: `staff01`
  - Password: `Staff@1234`
  - Role: `Staff`
