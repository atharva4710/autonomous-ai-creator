# 🤖 Autonomous AI Creator — Editorial Intelligence & Publishing Console

> **24/7 Continuous Multi-Cycle Autonomous Publishing Engine powered by Persona-Driven Discovery, Editorial Judgment, Heuristic Memory Deduplication, and Multi-Format LLM Generation.**

---

## 🌟 Overview

**Autonomous AI Creator** is an enterprise-grade autonomous AI agent system designed for continuous 48-hour+ operation without human intervention. The platform autonomously discovers trending domain topics from live RSS feeds, evaluates them using a multi-criteria editorial scoring engine, prevents duplicate coverage using heuristic memory deduplication, generates multi-format content (Blog, LinkedIn, X/Twitter), and publishes directly to a live public feed.

Built with a high-density, dark-mode **Editorial Intelligence & Publishing Console** (inspired by Synapse), the platform provides complete real-time explainability into *why* every topic was chosen, *how* it scored, and *what* alternatives were rejected.

---

## ✨ Key Features

- 🔄 **True 48-Hour Multi-Cycle Autonomy**: Runs an autonomous 15-minute execution loop that continuously discovers fresh topics, scores candidates, generates multi-format posts, and recovers automatically from transient failures (`RUNNING` ↔ `DEGRADED`).
- 📡 **Persona-Driven Live Discovery**: Scans live RSS/news feeds (TechCrunch, Hacker News, Google News, ArXiv) using persona-specific query expansion rules.
- ⚖️ **4-Criteria Editorial Scoring Engine**: Evaluates candidate topics across 4 criteria:
  - **Relevance** (0–100)
  - **Timeliness** (0–100)
  - **Source Quality** (0–100)
  - **Persona Alignment** (0–100)
  *Topics with an overall score below 65 are automatically rejected with documented rationales.*
- 🧠 **Heuristic Memory & Deduplication**: Normalizes titles and text to calculate topic similarity, penalizing duplicate topics to prevent repetitive content publishing.
- 📝 **Multi-Format Content Generation**: Powered by **Groq LLM (`llama-3.3-70b-versatile`)** with automatic fallback to `MockAIProvider` for test environments. Simultaneously generates:
  - 📖 **Blog Article** (4-min read, technical deep-dive)
  - 💼 **LinkedIn Post** (Executive breakdown with actionable takeaways)
  - 🐦 **X (Twitter) Post** (High-impact micro-post with hashtags)
- 📊 **3-Column Synapse Editorial Console UI**:
  - **Left Navigation Rail**: Quick access to Dashboard, Discovery, Create, History, Status, and Activity Log.
  - **Center Workspace**: Agent persona status, real-time pipeline metrics, primary topic rationale cards, score breakdowns, and publication feeds.
  - **Right Autonomous Engine Panel**: Real-time status badge (`RUNNING`), 15-minute countdown timer (`MM:SS`), cycle statistics, and 5-stage automated pipeline checklist.
- 🔍 **Complete Explainability & Activity Auditing**: Detailed modal view for every post showing overall score, criteria scores, editorial selection rationale, rejected alternatives, and source citations.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite 8, TypeScript, Vanilla CSS (Synapse Design Tokens), Lucide-inspired micro-components.
- **Backend**: Node.js, Express, TypeScript, PostgreSQL (`pg` pool) with in-memory fallback storage for serverless/local environments.
- **AI & LLM**: Groq Cloud SDK (`llama-3.3-70b-versatile`), centralized `AIProvider` abstraction.
- **Testing**: Jest, `supertest`, `cross-env` (16 test suites, 197 unit tests, 100% pass rate).

---

## 📁 Repository Architecture

```text
autonomous-ai-creator/
├── backend/
│   ├── src/
│   │   ├── config/             # Centralized env validation & database URL loggers
│   │   ├── controllers/        # Express route controllers (Agent, Discovery, Editorial, Memory, Content, Activity)
│   │   ├── db/                 # PostgreSQL pool connection & schema.sql auto-initialization
│   │   ├── middleware/         # Error handlers & 404 middleware
│   │   ├── models/             # TypeScript interface definitions (Agent, Topic, Decision, Post, Memory)
│   │   ├── repositories/       # Data access repositories (Memory fallback + PostgreSQL)
│   │   ├── routes/             # Express API route declarations
│   │   ├── services/           # Core domain services:
│   │   │   ├── autonomous/     # AutonomousService continuous loop & 5-stage cycle manager
│   │   │   ├── aiProvider.ts   # GroqAIProvider & MockAIProvider implementation
│   │   │   ├── discovery.service.ts
│   │   │   ├── editorial.service.ts
│   │   │   ├── memory.service.ts
│   │   │   ├── contentGeneration.service.ts
│   │   │   └── publishing.service.ts
│   │   ├── utils/              # Query expander, text normalizer, RSS parser, retry helpers
│   │   └── server.ts           # Express server entry point (bound to 0.0.0.0 for Railway)
│   └── tests/                  # 16 Jest test suites (197 tests)
├── frontend/
│   ├── src/
│   │   ├── services/api.ts     # Centralized backend API client
│   │   ├── hooks/              # Custom React hooks (useHealthCheck)
│   │   ├── App.tsx             # 3-Column Editorial Intelligence Console UI
│   │   ├── index.css           # Synapse CSS tokens & typography rules
│   │   └── main.tsx
│   ├── index.html
│   └── vite.config.ts
├── DEPLOYMENT.md               # Railway & Vercel deployment manual
├── SUBMISSION_CHECKLIST.md     # Hackathon criteria & test verification log
├── PROMPTS.md                  # System prompts, persona definitions & LLM templates
└── README.md                   # System documentation
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Node.js**: `v18.x` or higher
- **npm**: `v9.x` or higher
- **Groq API Key**: (Optional, default test mode uses `MockAIProvider`)

### 1. Clone & Configure
```bash
git clone https://github.com/atharva4710/autonomous-ai-creator.git
cd autonomous-ai-creator
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```
*Edit `backend/.env` to configure your settings:*
```env
PORT=5000
NODE_ENV=development
AI_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
DATABASE_URL=postgres://postgres:postgres@localhost:5432/autonomous_ai_creator
AUTONOMOUS_CYCLE_INTERVAL_MS=900000
```

Start backend development server:
```bash
npm run dev
```
*Backend will start on `http://localhost:5000` (listening on `0.0.0.0`).*

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install
cp .env.example .env
```
*Edit `frontend/.env`:*
```env
VITE_API_BASE_URL=http://localhost:5000
```

Start frontend development server:
```bash
npm run dev
```
*Frontend console will open on `http://localhost:5173`.*

---

## 🧪 Running Unit Tests

Run the complete 16-suite test suite in mock mode:
```bash
cd backend
npx cross-env AI_PROVIDER=mock jest --runInBand
```

**Expected Result**:
```text
Test Suites: 16 passed, 16 total
Tests:       197 passed, 197 total
Snapshots:   0 total
Time:        ~45 s
```

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check (`{"status": "ok"}`) |
| `POST` | `/api/agent/init` | Initialize or restore an autonomous agent persona |
| `GET` | `/api/agent/persona?agentId=...` | Retrieve active persona configuration |
| `GET` | `/api/agent/topics?agentId=...` | List all discovered candidate topics |
| `POST` | `/api/agent/discover` | Trigger an on-demand discovery crawl |
| `POST` | `/api/agent/topics/:id/evaluate` | Evaluate single topic using editorial scoring |
| `POST` | `/api/agent/topics/evaluate` | Bulk evaluate all candidate topics |
| `POST` | `/api/agent/generate` | Generate multi-format draft content |
| `POST` | `/api/agent/content/select-format` | Select active format (`blog` \| `linkedin` \| `x`) |
| `POST` | `/api/agent/publish` | Publish selected draft content to feed & memory |
| `GET` | `/api/agent/feed?agentId=...` | Fetch live public post feed |
| `GET` | `/api/agent/status?agentId=...` | Retrieve autonomous cycle status & countdown |
| `GET` | `/api/agent/activity?agentId=...` | Retrieve chronological activity log events |
| `GET` | `/api/agent/posts/:id/explain` | Fetch complete editorial selection rationale |

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
