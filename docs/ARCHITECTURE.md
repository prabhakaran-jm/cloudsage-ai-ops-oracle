# CloudSage Architecture

## Overview

CloudSage is a monorepo application consisting of:
1. **Next.js Frontend** (`apps/web`) - User interface
2. **Raindrop API Backend** (`apps/api`) - Main API server using Raindrop SmartComponents
3. **Vultr Worker Service** (`services/vultr-worker`) - Risk scoring computation service

**Current Status (Dec 12, 2025):**
- ✅ All 4 Raindrop SmartComponents integrated meaningfully
- ✅ SmartInference chain branching (critical/preventive/standard)
- ✅ SmartBuckets context sampling for historical analysis
- ✅ Authorization guards with project ownership validation
- ✅ Rate limiting on expensive endpoints
- ✅ Friendly error messages
- ✅ Unit test coverage
- ✅ Production-ready security and reliability features

---

## System Architecture

```
┌─────────────────┐
│   Next.js Web   │
│   (apps/web)    │
│   Netlify       │
└────────┬────────┘
         │ HTTP/REST
         │
┌────────▼─────────────────┐
│   Raindrop API Backend    │
│   (apps/api)              │
│                           │
│  ┌─────────────────────┐  │
│  │  SmartBuckets       │  │  Logs, forecasts, context
│  │  SmartSQL           │  │  Users, projects, risk_history
│  │  SmartMemory        │  │  User patterns, baselines
│  │  SmartInference     │  │  Chain branching forecasts
│  └─────────────────────┘  │
│                           │
│  ┌─────────────────────┐  │
│  │  Middleware         │  │  Auth, rate limiting, authz
│  │  Services           │  │  Vultr client, forecast chains
│  │  Utils              │  │  Error messages, logger
│  └─────────────────────┘  │
└────────┬───────────────────┘
         │ HTTP API + Auth
         │
┌────────▼──────────────┐
│  Vultr Worker        │
│  (services/          │
│   vultr-worker)      │
│                      │
│  Risk Scoring Model  │
│  (142ms avg latency) │
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
- `ForecastPanel.tsx` - AI forecast with chain steps visualization
- `HistoryChart.tsx` - Visualize risk trends over time
- `PlatformBadges.tsx` - Raindrop/Vultr branding

**API Communication:**
- `lib/apiClient.ts` - Centralized API client for backend calls
- Handles authentication tokens
- Error handling with user-friendly messages

**Routing:**
- Uses Next.js App Router (`app/` directory)
- Pages: `/`, `/projects`, `/projects/[id]`, `/login`, `/register`, `/pricing`

**Recent Improvements:**
- Loading states for all async operations
- Vultr status badge with latency display
- Chain steps visualization in forecast panel
- Sample logs button for instant demo

---

### 2. Backend API (`apps/api`)

**Technology:** Raindrop Platform (Hono.js), TypeScript

**Structure:**
```
apps/api/
├── src/
│   ├── api/
│   │   └── index.ts              # Main Hono app with all routes
│   ├── routes/
│   │   ├── auth.ts               # Authentication endpoints
│   │   ├── projects.ts           # Project CRUD
│   │   ├── ingest.ts             # Log ingestion
│   │   └── forecast.ts           # Forecast retrieval
│   ├── services/
│   │   ├── raindropSmart.ts      # SmartComponents wrapper (771 lines)
│   │   ├── smartInferenceChains.ts # Chain branching logic (520 lines)
│   │   ├── vultrClient.ts        # Vultr worker client
│   │   ├── forecastService.ts    # Forecast orchestration
│   │   ├── userPreferences.ts    # SmartMemory wrapper
│   │   └── riskLogic.ts          # Local risk calculation fallback
│   ├── middleware/
│   │   └── rateLimit.ts          # In-memory rate limiting
│   ├── utils/
│   │   ├── errorMessages.ts     # Friendly error mapping
│   │   └── logger.ts             # Structured logging
│   └── __tests__/
│       └── units.test.ts         # Unit test suite
└── raindrop.manifest.ts          # SmartComponents config
```

**Raindrop SmartComponents Usage:**

1. **SmartBuckets** - Intelligent log storage
   - Hierarchical key structure (`projectId/timestamp/logId`)
   - Forecast caching with 24-hour TTL
   - **Context sampling** - Retrieves last 10 logs for historical analysis in forecasts
   - Native API with MCP fallback for resilience
   - Used for: logs, forecasts, project/user fallback storage

2. **SmartSQL** - Production-grade analytics
   - 3 tables: `users`, `projects`, `risk_history`
   - Complex trend analysis (7-day rolling averages, slope calculations)
   - Proper indexes and parameter interpolation (SQL injection prevention)
   - Transaction safety with graceful fallbacks
   - Used for: user data, project ownership, risk history queries

3. **SmartMemory** - AI that learns
   - User preferences (alert thresholds, ignored patterns)
   - Action completion tracking (learns which actions you prioritize)
   - Project baselines (30-score rolling averages for anomaly detection)
   - Cross-session persistence for continuous improvement
   - Used for: personalization, pattern learning, forecast filtering

4. **SmartInference** - Advanced AI orchestration
   - **Chain branching** - Dynamically selects AI path:
     - 🚨 Critical (score ≥70): `critical_incident_response` chain
     - 📈 Preventive (rising + score >50): `preventive_forecast` chain
     - ✓ Standard: `forecast_generation` chain
   - Multi-step chains visible in UI (transparent AI reasoning)
   - Chain steps logged: `chainSteps` array returned with forecast
   - Confidence scoring based on data quality
   - Heuristic fallback for resilience
   - Used for: forecast generation with context-aware routing

**API Endpoints:**

**Authentication:**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/workos/*` - WorkOS SSO integration

**Projects:**
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details (with authz guard)
- `PUT /api/projects/:id` - Update project (with authz guard)
- `DELETE /api/projects/:id` - Delete project (with authz guard)

**Log Ingestion:**
- `POST /api/ingest/:projectId` - Ingest logs (rate limited: 100/min, authz guard)
- `GET /api/ingest/:projectId` - Get logs (authz guard)

**Forecasts:**
- `GET /api/forecast/:projectId` - Get forecast (rate limited: 60/min, authz guard)
- `GET /api/forecast/:projectId/history` - Get forecast history (authz guard)
- `GET /api/forecast/:projectId/risk-history` - Get risk history (authz guard)

**Infrastructure:**
- `GET /api/vultr/status` - Vultr worker health + latency
- `GET /api/analytics/trends` - Cross-project risk trends

**Security & Reliability Features:**

1. **Authorization Guards** (`ensureProjectAccess`)
   - Validates project ownership before access
   - Checks SmartSQL first, falls back to SmartBuckets
   - Returns 403 (Forbidden) or 404 (Not Found) appropriately
   - Applied to: all project-scoped endpoints

2. **Rate Limiting** (`middleware/rateLimit.ts`)
   - In-memory per-user-per-path limiting
   - Ingest: 100 requests/minute
   - Forecast: 60 requests/minute
   - Returns 429 with `retryAfter` seconds

3. **Friendly Error Messages** (`utils/errorMessages.ts`)
   - Maps technical errors to user-friendly messages
   - SQL constraints → "You already have a project with this name"
   - Vultr timeouts → "Using local calculation instead"
   - Generic fallback for unknown errors

4. **Unit Tests** (`__tests__/units.test.ts`)
   - Risk scoring logic tests
   - Error message mapping tests
   - Authorization guard tests
   - Fast execution (no server required)

---

### 3. Vultr Worker Service (`services/vultr-worker`)

**Technology:** Node.js/TypeScript, Docker

**Purpose:** Offload risk scoring computation to scalable cloud compute

**Structure:**
```
services/vultr-worker/
├── src/
│   ├── main.ts        # HTTP server entry
│   └── model.ts       # Risk scoring logic
├── Dockerfile         # Container definition
└── ecosystem.config.cjs # PM2 config
```

**API:**
- `GET /health` - Health check (returns status, service name, timestamp)
- `POST /score` - Accept log data, return risk score and labels
  - Input: `{ projectId, logs: LogEntry[], metadata? }`
  - Output: `{ riskScore: { score: 0-100, labels: string[], factors: {...}, timestamp } }`
  - Auth: Bearer token + X-API-Key header

**Risk Scoring Logic:**
- Analyzes 5 risk factors:
  - Error rate (40 points max)
  - Log volume (25 points)
  - Latency indicators (20 points)
  - Memory pressure (10 points)
  - CPU usage (5 points)
- Returns top risk labels (e.g., "High Error Rate", "Latency Issues", "Critical")
- 142ms average latency (measured and displayed in UI)

**Deployment:**
- Deployed to Vultr Cloud Compute
- Custom domain: `worker.cloudcarta.com:8080` (DNS-only, bypasses Cloudflare proxy)
- Infrastructure as code: Terraform in `/infra/vultr/terraform/`
- Health monitoring with automatic retries and fallback

**Integration:**
- Called on every log ingestion
- Retry logic: 3 attempts with exponential backoff
- Fallback to local calculation if unavailable
- Latency tracked and displayed in UI badge

---

## Data Flow

### Log Ingestion Flow:
1. User pastes logs in `LogIngest.tsx` or clicks "Load Sample Logs"
2. Frontend sends `POST /api/ingest/:projectId` with logs
3. **Authorization:** `ensureProjectAccess` validates ownership
4. **Rate Limiting:** Checks 100 req/min limit
5. Backend stores logs in SmartBuckets (`logs/{projectId}/{timestamp}/{logId}`)
6. Backend calls Vultr worker `POST /score` with log data
7. Vultr worker calculates risk score (142ms avg) and returns it
8. Backend stores risk score in SmartSQL (`risk_history` table)
9. Backend also stores in SmartBuckets for fast retrieval
10. Frontend refreshes to show new risk score with Vultr latency badge

### Forecast Generation Flow:
1. User views project detail page or clicks "Refresh Forecast"
2. Frontend requests `GET /api/forecast/:projectId?force=true`
3. **Authorization:** `ensureProjectAccess` validates ownership
4. **Rate Limiting:** Checks 60 req/min limit
5. Backend checks SmartBuckets for today's forecast (cached, 24h TTL)
6. If not cached or `force=true`, triggers SmartInference chain:
   - **Step 1:** Gather context (risk history from SmartSQL, project baseline from SmartMemory)
   - **Step 2:** SmartBuckets context sampling (last 10 logs for historical incidents)
   - **Step 3:** Load user preferences from SmartMemory (ignored patterns, preferred actions)
   - **Step 4:** **Chain branching** - Select chain based on risk:
     - If `avgScore >= 70`: `critical_incident_response` chain
     - Else if `trend === 'increasing' && avgScore > 50`: `preventive_forecast` chain
     - Else: `forecast_generation` chain
   - **Step 5:** Run SmartInference with selected chain
   - **Step 6:** Personalize actions based on learned preferences
7. Backend stores forecast in SmartBuckets with `chainSteps` array
8. Frontend displays forecast, actions, and chain execution steps

### Risk History Chart Flow:
1. User views project detail page
2. Frontend requests `GET /api/forecast/:projectId/risk-history?limit=30`
3. **Authorization:** `ensureProjectAccess` validates ownership
4. Backend queries SmartSQL for `risk_history` records
5. Returns array of `{ timestamp, score, labels }` points
6. Frontend renders line chart using canvas API

---

## Authentication & Authorization

**Current Implementation:**

1. **WorkOS AuthKit** - Enterprise-ready authentication
   - Email magic links, OAuth (Google/Microsoft), SAML/OIDC
   - Passwordless account detection
   - JWT token generation for API access
   - 1M MAU free tier

2. **Authorization Guards** (`ensureProjectAccess`)
   - Validates `userId` from JWT matches `project.user_id`
   - Checks SmartSQL first, falls back to SmartBuckets
   - Applied to all project-scoped endpoints
   - Returns 403 (Forbidden) or 404 (Not Found)

3. **Rate Limiting**
   - Per-user-per-path in-memory limiting
   - Prevents abuse of expensive endpoints
   - Returns 429 with retry-after header

**Future:** Team management, role-based access control (RBAC)

---

## Security & Reliability

### Security Features
- ✅ **Authorization guards** - Project ownership validation
- ✅ **Rate limiting** - Prevents abuse (100 req/min ingest, 60 req/min forecast)
- ✅ **Input validation** - Zod schemas for all API inputs
- ✅ **SQL injection prevention** - Parameter interpolation in SmartSQL
- ✅ **JWT token validation** - Secure authentication
- ✅ **CORS configuration** - Restricted to frontend domain
- ✅ **Environment variable security** - Secrets in Raindrop manifest

### Reliability Features
- ✅ **Graceful fallbacks** - SmartSQL → SmartBuckets → in-memory
- ✅ **Vultr worker retries** - 3 attempts with exponential backoff
- ✅ **Local calculation fallback** - If Vultr unavailable
- ✅ **Error handling** - Friendly user-facing messages
- ✅ **Health monitoring** - Vultr status badge with latency
- ✅ **Unit tests** - Core business logic coverage

---

## Deployment

### Frontend:
- **Netlify** - Static site hosting
- Environment variables: `NEXT_PUBLIC_API_URL`, WorkOS, Stripe keys
- Auto-deploy on git push to `main`

### Backend:
- **Raindrop Platform** - Serverless API hosting
- Environment variables in Raindrop manifest:
  - `RAINDROP_API_KEY`, `RAINDROP_MCP_URL`
  - `VULTR_WORKER_URL`, `VULTR_API_KEY`
  - `JWT_SECRET`
- Deploy: `raindrop build deploy --start --amend`

### Vultr Worker:
- **Vultr Cloud Compute** - Custom worker service
- Custom domain: `worker.cloudcarta.com:8080` (DNS-only)
- Infrastructure as code: Terraform
- Deploy: `./infra/deploy/deploy-vultr-worker.sh`

---

## Environment Variables

### Frontend (Netlify):
```
NEXT_PUBLIC_API_URL=https://cloudsage-api.01kbv4q1d3d0twvhykd210v58w.lmapp.run/api
WORKOS_CLIENT_ID=client_...
WORKOS_API_KEY=sk_...
WORKOS_REDIRECT_URI=https://steady-melomakarona-42c054.netlify.app/api/auth/callback
WORKOS_COOKIE_PASSWORD=<32+ char secret>
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_...
```

### Backend (Raindrop):
```
RAINDROP_API_KEY=<raindrop_key>
RAINDROP_MCP_URL=<mcp_url>
VULTR_WORKER_URL=http://worker.cloudcarta.com:8080
VULTR_API_KEY=<vultr_worker_key>
JWT_SECRET=<jwt_secret>
```

### Vultr Worker:
```
PORT=8080
API_KEY=<worker_auth_key>
```

---

## Scalability Notes

- **SmartBuckets:** Handles high-volume log ingestion with hierarchical keys
- **SmartSQL:** Efficient queries for risk history with proper indexes
- **Vultr Worker:** Can scale horizontally based on load
- **Caching:** Forecasts cached in SmartBuckets (24-hour TTL)
- **Rate Limiting:** Prevents abuse, but in-memory (consider Redis for multi-instance)
- **Future:** Add Vultr Valkey (Redis-compatible) for distributed rate limiting and real-time features

---

## Recent Improvements (Dec 12, 2025)

### SmartInference Chain Branching
- Conditional chain selection based on risk level and trend
- Three distinct chains: critical, preventive, standard
- Chain steps logged and visible in UI for transparency

### SmartBuckets Context Sampling
- Retrieves last 10 logs for historical incident analysis
- Enriches forecast context with similar past incidents
- Graceful fallback if SmartBuckets unavailable

### Authorization Guards
- `ensureProjectAccess` middleware validates project ownership
- Applied to all project-scoped endpoints
- Prevents unauthorized access to other users' projects

### Rate Limiting
- In-memory per-user-per-path limiting
- Ingest: 100 requests/minute
- Forecast: 60 requests/minute
- Returns 429 with retry-after header

### Friendly Error Messages
- Maps technical errors to user-friendly messages
- SQL constraints, Vultr timeouts, validation errors
- Improves user experience significantly

### Unit Tests
- Core business logic tests (risk scoring, error mapping)
- Fast execution without server dependency
- Foundation for test-driven development

---

## Future Enhancements

- Real-time risk score updates (Vultr Valkey pub/sub)
- ML-based risk scoring (replace heuristics with trained models)
- Multi-project dashboards and team management
- Alert notifications (email/Slack/Discord)
- Auto-remediation suggestions (AI-generated code fixes)
- Advanced analytics and reporting
- Mobile app for on-the-go monitoring
- Distributed rate limiting (Redis/Valkey)

---

**Last Updated:** December 12, 2025  
**Version:** Production-ready (hackathon submission)  
**Track:** Best Small Startup Agents
