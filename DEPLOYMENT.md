# Autonomous AI Creator — Production Deployment & Operation Guide

This document provides complete instructions for deploying the **Autonomous AI Creator** platform to production environments.

---

## 1. Architecture & Hosting Strategy

- **Backend Service (Always-On)**: Host on **Railway** or **Render** as a single always-on background web service.
  - *Why*: The autonomous scheduler operates in-process via a robust timer loop (`setInterval`). It must remain continuously active to discover topics and publish posts without requiring external HTTP triggers or CRON calls.
- **Database (PostgreSQL)**: Host on **Railway PostgreSQL**, **Render PostgreSQL**, or **Neon**.
  - *Why*: Provides persistent storage for personas, discovered topics, editorial decisions, multi-format generated posts, activity logs, and memories across process restarts.
- **Frontend App**: Host on **Vercel** or **Netlify** as a static Single Page Application (SPA).
  - *Why*: Highly responsive UI built with Vite and React that queries the live backend API.

---

## 2. Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | `5000` | Port for Express server (automatically supplied by Railway/Render). |
| `NODE_ENV` | Recommended | `production` | Environment mode. |
| `CORS_ORIGIN` | Required in Prod | `https://your-app.vercel.app` | Allowed CORS origin for frontend requests. |
| `AI_PROVIDER` | Required | `groq` | Set to `groq` for production generation; `mock` for test isolation. |
| `GROQ_API_KEY` | Required if `groq` | `gsk_...` | API key from Groq Console. |
| `GROQ_MODEL` | Optional | `llama-3.3-70b-versatile` | Groq LLM model identifier. |
| `DATABASE_URL` | Required | `postgres://user:pass@host:5432/dbname` | Full PostgreSQL connection URL with SSL enabled. |
| `AUTONOMOUS_CYCLE_INTERVAL_MS` | Optional | `900000` | Interval between autonomous execution cycles (15 mins = 900000 ms). |

### Frontend (`frontend/.env`)

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Required | `https://your-backend.up.railway.app` | Base URL of the live deployed backend server. |

---

## 3. Database Setup (PostgreSQL)

1. Provision a PostgreSQL 15+ database instance (e.g. Railway or Render).
2. Copy the database connection URL (`DATABASE_URL`).
3. The backend automatically initializes schema migrations upon server startup (`backend/src/db/schema.sql`).
4. Schema verifies and creates tables:
   - `agents`
   - `topics`
   - `editorial_decisions`
   - `posts`
   - `memories`
   - `activity_events`

---

## 4. Backend Deployment Procedure (Railway / Render)

1. Connect your GitHub repository to Railway or Render.
2. Select the `/backend` subdirectory for the build root if prompted.
3. Configure **Build Command**: `npm run build`
4. Configure **Start Command**: `npm start` (or `node dist/server.js`)
5. Configure Environment Variables in the hosting dashboard:
   - `AI_PROVIDER` = `groq`
   - `GROQ_API_KEY` = `<your-production-groq-key>`
   - `GROQ_MODEL` = `llama-3.3-70b-versatile`
   - `DATABASE_URL` = `<your-postgresql-url>`
   - `CORS_ORIGIN` = `https://<your-frontend-domain>.vercel.app`
   - `AUTONOMOUS_CYCLE_INTERVAL_MS` = `900000`
6. Deploy the service and note the assigned HTTPS domain.

---

## 5. Frontend Deployment Procedure (Vercel / Netlify)

1. Connect your GitHub repository to Vercel or Netlify.
2. Set **Root Directory**: `frontend`
3. Build Settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Configure Environment Variables:
   - `VITE_API_BASE_URL` = `https://<your-backend-domain>.up.railway.app`
5. Deploy and verify HTTPS URL.

---

## 6. Hackathon Evaluator Production Verification Procedure

To verify production readiness against the hackathon evaluator:

1. **Verify Backend Health**:
   - Send `GET https://your-backend.up.railway.app/health`
   - Expected Response: `HTTP 200 OK` -> `{"status": "ok"}`

2. **Initialize Persona Agent**:
   - Send `POST https://your-backend.up.railway.app/api/agent/init`
   - Body:
     ```json
     {
       "persona": {
         "name": "Ada",
         "domain": "AI Security"
       }
     }
     ```
   - Expected Response: `HTTP 201 Created` -> `{"agentId": "agent-xxxxxxxx"}`
   - *Note*: The backend returns the `agentId` immediately and starts the autonomous background loop.

3. **Check Feed Immediately**:
   - Send `GET https://your-backend.up.railway.app/api/agent/feed?agentId=agent-xxxxxxxx`
   - Expected Response: `HTTP 200 OK` -> `{"posts": []}` (empty array before first cycle completes).

4. **Observe Autonomous Operation**:
   - Do **NOT** send any manual publishing or generation requests.
   - Wait for the autonomous cycle to run (15 minutes or configured interval).
   - Query feed again: `GET /api/agent/feed?agentId=agent-xxxxxxxx`
   - Expected Response: `{"posts": [{"id": "...", "createdAt": "...", "text": "...", "rationale": "...", "sources": [...]}]}`

5. **Verify Process Restart Recovery**:
   - Restart the backend container or process on Railway/Render.
   - Send `GET /api/agent/feed?agentId=agent-xxxxxxxx`
   - Previous published posts remain intact from PostgreSQL.
   - Active autonomous loops automatically resume without calling `/init` again.

---

## 7. Security Audit & Best Practices

- **Zero Hardcoded Secrets**: `GROQ_API_KEY` and `DATABASE_URL` credentials are strictly loaded from environment variables.
- **Git Safety**: `.env` and `*.key` files are explicitly included in `.gitignore` and are not tracked in version control.
- **API Error Protection**: Stack traces, database passwords, and internal file paths are masked from HTTP error responses.
