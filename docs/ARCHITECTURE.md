# CloudSage Architecture

## Overview

CloudSage is a monorepo application consisting of:
1. **Next.js Frontend** (`apps/web`) - User interface
2. **Raindrop API Backend** (`apps/api`) - Main API server using Raindrop SmartComponents
3. **Vultr Worker Service** (`services/vultr-worker`) - Risk scoring computation service

---

## System Architecture

```
┌─────────────────┐
│   Next.js Web   │
│   (apps/web)    │
└────────┬────────┘
         │ HTTP/REST
         │
┌────────▼─────────────────┐
│   Raindrop API Backend    │
│   (apps/api)              │
│                           │
│  ┌─────────────────────┐  │
│  │  SmartBuckets       │  │  Raw logs, forecasts
│  │  SmartSQL           │  │  Projects, risk history
│  │  SmartMemory        │  │  User/project patterns
│  │  SmartInference     │  │  Forecast generation
│  └─────────────────────┘  │
└────────┬───────────────────┘
         │ HTTP API
         │
┌────────▼──────────────┐
│  Vultr Worker        │
│  (services/          │
│   vultr-worker)      │
│                      │
│  Risk Scoring Model  │
└──────────────────────┘
```

---

## Component Details

### 1. Frontend (`apps/web`)

**Technology:** Next.js 14+ (App Router), TypeScript, Tailwind CSS

**Key Components:**
- `Layout.tsx` - Main app layout wrapper
- `ProjectList.tsx` - List all user projects
- `ProjectDetail.tsx` - View/edit single project with risk dashboard
- `LogIngest.tsx` - UI for pasting/uploading logs
- `RiskPanel.tsx` - Display current risk score and labels
- `HistoryChart.tsx` - Visualize risk trends over time

**API Communication:**
- `lib/apiClient.ts` - Centralized API client for backend calls
- Uses fetch/axios for HTTP requests
- Handles authentication tokens

**Routing:**
- Uses Next.js App Router (`app/` directory)
- Pages: `/`, `/projects`, `/projects/[id]`, `/login`, `/register`

---

### 2. Backend API (`apps/api`)

**Technology:** Raindrop MCP Server (TypeScript), Node.js

**Structure:**
```
apps/api/
├── src/
│   ├── index.ts              # Main server entry
│   ├── routes/
│   │   ├── auth.ts           # Authentication endpoints
│   │   ├── projects.ts       # Project CRUD
│   │   ├── ingest.ts         # Log ingestion
│   │   └── forecast.ts       # Forecast retrieval
│   └── services/
│       ├── raindropSmart.ts  # SmartComponents wrapper
│       ├── vultrClient.ts    # Vultr worker client
│       └── riskLogic.ts      # Risk aggregation
└── raindrop.manifest.ts       # SmartComponents config
```

**Raindrop SmartComponents Usage:**

1. **SmartBuckets**
   - Store raw log data (keyed by project_id, timestamp)
   - Store generated forecasts (keyed by project_id, date)
   - Fast ingestion and retrieval

2. **SmartSQL**
   - `projects` table: id, name, user_id, created_at, updated_at
   - `risk_history` table: id, project_id, score, labels, timestamp
   - `forecast_feedback` table: id, forecast_id, accurate, user_id, timestamp
   - Relational queries for history and trends

3. **SmartMemory**
   - Store user preferences and patterns
   - Store project-specific patterns (e.g., typical error rates)
   - Context for personalized forecasts

4. **SmartInference**
   - Chain that analyzes:
     - Recent risk scores (from SmartSQL)
     - Log patterns (from SmartBuckets)
     - Historical trends (from SmartSQL)
     - User patterns (from SmartMemory)
   - Generates:
     - Daily forecast text
     - 3 concrete action items

**API Endpoints:**
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/ingest` - Ingest logs for a project
- `GET /api/forecast/:projectId` - Get forecast for project
- `GET /api/risk-history/:projectId` - Get risk history for chart

---

### 3. Vultr Worker Service (`services/vultr-worker`)

**Technology:** Node.js/TypeScript (or Python), Docker

**Purpose:** Offload risk scoring computation to scalable cloud compute

**Structure:**
```
services/vultr-worker/
├── src/
│   ├── main.ts        # HTTP server entry
│   └── model.ts       # Risk scoring logic
└── Dockerfile         # Container definition
```

**API:**
- `POST /score` - Accept log data, return risk score and labels
  - Input: `{ projectId, logs, metadata }`
  - Output: `{ score: 0-100, labels: string[], timestamp }`

**Risk Scoring Logic:**
- Analyze log patterns (error rates, latency, volume)
- Calculate heuristic risk score
- Return top risk labels (e.g., "High Error Rate", "Latency Spike", "Memory Pressure")

**Deployment:**
- Deployed to Vultr Cloud Compute
- Containerized with Docker
- Environment variables for configuration
- Auto-scaling based on load (optional)

---

## Data Flow

### Log Ingestion Flow:
1. User pastes logs in `LogIngest.tsx`
2. Frontend sends `POST /api/ingest` with logs and project_id
3. Backend stores logs in SmartBuckets
4. Backend calls Vultr worker `POST /score` with log data
5. Vultr worker calculates risk score and returns it
6. Backend stores risk score in SmartSQL (risk_history table)
7. Frontend refreshes to show new risk score

### Forecast Generation Flow:
1. User views project detail page
2. Frontend requests `GET /api/forecast/:projectId`
3. Backend checks SmartBuckets for today's forecast (cached)
4. If not cached, triggers SmartInference chain:
   - Reads recent risk scores from SmartSQL
   - Reads log patterns from SmartBuckets
   - Reads historical trends from SmartSQL
   - Generates forecast text and 3 actions
5. Backend stores forecast in SmartBuckets
6. Frontend displays forecast and actions

### Risk History Chart Flow:
1. User views project detail page
2. Frontend requests `GET /api/risk-history/:projectId?days=30`
3. Backend queries SmartSQL for risk_history records
4. Returns array of { timestamp, score } points
5. Frontend renders line chart using charting library

---

## Authentication & Authorization

**MVP Approach:** Simple email/password authentication

- User registration: `POST /api/auth/register`
- User login: `POST /api/auth/login` → returns JWT token
- Protected routes: Validate JWT token in middleware
- User sessions: Store in SmartSQL or SmartMemory

**Future:** OAuth, API keys, team management

---

## Deployment

### Frontend:
- **Netlify** or **Vercel**
- Configured in `infra/deploy/netlify.toml` or `infra/deploy/vercel.json`
- Environment variables: `NEXT_PUBLIC_API_URL`

### Backend:
- **Raindrop Platform** (hosted)
- Environment variables: `RAINDROP_API_KEY`, `VULTR_WORKER_URL`

### Vultr Worker:
- **Vultr Cloud Compute**
- Deployed via Docker
- Environment variables: `PORT`, `API_KEY` (for auth)

---

## Environment Variables

### Frontend (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Backend (`.env`):
```
RAINDROP_API_KEY=your_raindrop_key
VULTR_WORKER_URL=https://your-worker.vultr.com
PORT=3001
```

### Vultr Worker (`.env`):
```
PORT=8080
API_KEY=your_worker_auth_key
```

---

## Security Considerations

- **API Authentication:** JWT tokens for user auth
- **Worker Authentication:** API key for Vultr worker calls
- **Input Validation:** Validate all user inputs
- **Rate Limiting:** Prevent abuse of ingest endpoints
- **CORS:** Configure CORS for frontend domain
- **Environment Variables:** Never commit secrets

---

## Scalability Notes

- **SmartBuckets:** Handles high-volume log ingestion
- **SmartSQL:** Efficient queries for risk history
- **Vultr Worker:** Can scale horizontally based on load
- **Caching:** Forecasts cached in SmartBuckets (daily)
- **Future:** Add Redis for session management, queue for async processing

---

## Future Enhancements

- Real-time risk score updates (WebSockets)
- ML-based risk scoring (replace heuristics)
- Multi-project dashboards
- Alert notifications (email/Slack)
- Team collaboration features
- API for external integrations
- Advanced analytics and reporting
