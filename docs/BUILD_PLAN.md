# CloudSage MVP Build Plan

This document outlines the phased approach to building the CloudSage AI Ops Oracle MVP for The AI Champion Ship hackathon.

---

## Phase 1: Foundation Setup

**Goal:** Set up repo, monorepo tooling, basic Next.js app, and Raindrop project skeleton.

### Tasks:
- [x] Set up repo structure and monorepo tooling
- [ ] Initialize Next.js app in `apps/web`
  - Set up TypeScript + Tailwind CSS
  - Create basic app structure (app/ or pages/)
- [ ] Set up Raindrop project
  - Create Raindrop account/project
  - Configure API keys in `.env`
- [ ] Build minimal API skeleton in `apps/api`
  - Set up basic server structure
  - Create one "hello" endpoint to verify connectivity
- [ ] Commit `ARCHITECTURE.md` with initial design

**Deliverable:** Working Next.js app + one API endpoint that responds

---

## Phase 2: Project CRUD + Auth

**Goal:** Build project management and basic authentication.

### Tasks:
- [ ] Backend: Project CRUD API
  - Create SmartSQL tables for projects
  - Implement routes: `GET /api/projects`, `POST /api/projects`, `GET /api/projects/:id`, `PUT /api/projects/:id`, `DELETE /api/projects/:id`
- [ ] Frontend: Project management UI
  - `ProjectList.tsx` - List all projects
  - `ProjectDetail.tsx` - View/edit single project
  - Create/Edit project forms
- [ ] Basic authentication
  - Email/password auth (simple, no OAuth for MVP)
  - Auth routes: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`
  - Protect API routes with auth middleware
  - Add auth UI (login/register pages)

**Deliverable:** Users can create accounts, log in, and manage projects

---

## Phase 3: Log Ingest + Basic Risk Scoring

**Goal:** Allow log ingestion and show basic risk scores.

### Tasks:
- [ ] Backend: Log ingest API
  - `POST /api/ingest` endpoint
  - Store logs in SmartBuckets
  - Associate logs with projects
- [ ] Frontend: Log ingest UI
  - `LogIngest.tsx` component
  - Text area for pasting logs
  - File upload option (optional)
  - Display recent logs
- [ ] Basic risk scoring stub
  - Local function that returns random/fake risk score (0-100)
  - Simple heuristics (error count, log volume, etc.)
- [ ] Display risk score
  - `RiskPanel.tsx` component
  - Show risk score on project detail page
  - Display risk labels (e.g., "High Error Rate", "Latency Spike")

**Deliverable:** Users can paste logs, see them stored, and view a risk score (fake for now)

---

## Phase 4: Vultr Worker Integration

**Goal:** Stand up Vultr worker service and replace stub with real risk scoring.

### Tasks:
- [ ] Set up Vultr worker service
  - Deploy `services/vultr-worker` to Vultr Cloud Compute
  - Create Dockerfile and deploy
  - Set up environment variables
- [ ] Implement risk scoring model
  - `model.ts` - Basic risk calculation logic
  - Accept log data and return risk score + labels
  - Can start with heuristic-based (no ML needed for MVP)
- [ ] Wire backend to Vultr worker
  - `vultrClient.ts` - HTTP client to call worker
  - Replace stub risk scoring with Vultr worker call
  - Handle errors and timeouts
- [ ] Store risk results
  - Save risk scores to SmartSQL (risk_history table)
  - Store timestamp, score, labels, project_id

**Deliverable:** Real risk scores from Vultr worker, stored in database

---

## Phase 5: SmartInference Forecast Chain

**Goal:** Generate daily forecasts and action plans using SmartInference.

### Tasks:
- [ ] Set up SmartInference forecast chain
  - Create inference pipeline that analyzes:
    - Recent risk scores
    - Log patterns
    - Historical trends
  - Generate daily forecast text
  - Generate 3 concrete actions
- [ ] Store forecasts
  - Save forecasts to SmartBuckets
  - Associate with projects and dates
- [ ] Display forecasts on UI
  - Show daily forecast on project page
  - Display 3 action items
  - Add date selector for historical forecasts
- [ ] Risk trend chart
  - `HistoryChart.tsx` component
  - Query SmartSQL for risk history
  - Display line chart showing risk over time
  - Use a charting library (e.g., recharts, chart.js)

**Deliverable:** Daily forecasts with actions, risk trend visualization

---

## Phase 6: Polish & Feedback

**Goal:** Improve UX, handle edge cases, and prepare for demo.

### Tasks:
- [ ] UI polish
  - Improve styling and layout
  - Add loading states
  - Add error boundaries
  - Responsive design
- [ ] Error handling
  - Handle API errors gracefully
  - Show user-friendly error messages
  - Add retry logic where appropriate
- [ ] Empty states
  - No projects state
  - No logs state
  - No forecasts state
- [ ] Feedback mechanism
  - Add "Accurate" / "Off" buttons to forecasts
  - Store feedback in SmartSQL
  - Use feedback to improve (optional for MVP)
- [ ] Documentation
  - Write `DEMO_SCRIPT.md` with step-by-step demo flow
  - Record a dry-run of the demo
  - Fix any issues found

**Deliverable:** Polished UI, error handling, demo script ready

---

## Phase 7: Final Submission

**Goal:** Record demo video and submit to Devpost.

### Tasks:
- [ ] Record final 3-minute demo video
  - Show problem statement
  - Demonstrate key features
  - Highlight Raindrop SmartComponents usage
  - Highlight Vultr integration
- [ ] Write Devpost project description
  - **Problem:** Solo engineers lack SRE support
  - **Solution:** AI-powered risk prediction and action plans
  - **How you used Raindrop SmartComponents:**
    - SmartBuckets for log storage
    - SmartSQL for risk history and projects
    - SmartMemory for user/project patterns
    - SmartInference for forecast generation
  - **How you used Vultr:**
    - Cloud Compute for risk scoring worker
    - Scalable worker service
- [ ] Optional extras
  - Deploy to Netlify/Vercel
  - Tidy up documentation
  - Add README instructions

**Deliverable:** Devpost submission with video and description

---

## Technical Stack Summary

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend:** Raindrop MCP server (TypeScript)
- **AI/Memory:** Raindrop SmartComponents
  - SmartBuckets: Raw logs and forecasts
  - SmartSQL: Projects, risk history, feedback
  - SmartMemory: User and project patterns
  - SmartInference: Risk forecast and action plans
- **Compute:** Vultr Cloud Compute for risk scoring worker
- **Auth:** Email/password (simple MVP)
- **Deployment:** Netlify/Vercel (optional)

---

## Success Criteria

- ✅ Users can create accounts and manage projects
- ✅ Users can ingest logs and see risk scores
- ✅ Risk scores come from Vultr worker (not stub)
- ✅ Daily forecasts with 3 actions are generated
- ✅ Risk trend chart displays historical data
- ✅ UI is polished and handles errors gracefully
- ✅ Demo video clearly shows the solution

---

## Timeline Estimate

- **Phase 1:** 2-3 hours
- **Phase 2:** 4-6 hours
- **Phase 3:** 3-4 hours
- **Phase 4:** 4-5 hours
- **Phase 5:** 5-6 hours
- **Phase 6:** 3-4 hours
- **Phase 7:** 2-3 hours

**Total:** ~23-31 hours

---

## Notes

- Keep it simple for hackathon - focus on core features
- Fake/stub implementations are fine initially, replace incrementally
- Prioritize working demo over perfect code
- Test each phase before moving to next
- Commit frequently with clear messages

