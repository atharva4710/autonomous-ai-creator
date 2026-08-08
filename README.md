# Autonomous AI Creator

An autonomous, multi-agent AI system designed to build, compile, test, evaluate, and iterate web applications.

---

## Project Structure

This workspace is organized as a monorepo split into two main operational parts: frontend and backend.

```text
autonomous-ai-creator/
├── frontend/         # React/Next.js/Vite Web Interface
├── backend/          # Node.js/Python server managing AI orchestration & workspaces
├── docs/             # Technical specifications, API reference, and architecture guides
├── README.md         # This main project documentation
├── PROMPTS.md        # AI Agent prompts and guideline templates
├── .gitignore        # Global git exclusions
└── .env.example      # Shared environment variables template
```

---

## Directory Overview

### 🎨 [Frontend](file:///c:/Users/Atharva/Desktop/autonomous-ai-creator/frontend)
Contains the visual dashboard, workspace visualization, output previews, and agent status feeds.

### ⚙️ [Backend](file:///c:/Users/Atharva/Desktop/autonomous-ai-creator/backend)
Contains the API endpoints, multi-agent scheduler, code compiling servers, and sandboxed test executor.

### 📄 [Docs](file:///c:/Users/Atharva/Desktop/autonomous-ai-creator/docs)
Detailed specifications, user manuals, flowcharts, and system architecture manuals.

---

## Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/atharva4710/autonomous-ai-creator.git
   cd autonomous-ai-creator
   ```

2. **Setup Environment**:
   ```bash
   cp .env.example .env
   ```
   *Edit the `.env` file and insert your API keys and configuration.*

3. **Install Dependencies**:
   *Check individual readmes in `frontend/` and `backend/` for setup commands.*
