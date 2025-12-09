# Risk Score Not Updating - Debug Analysis Request

## Problem Statement
After ingesting logs in the AI Ops Oracle application, the **Historical Trends chart updates correctly**, but the **Risk Dashboard panel does not show the updated risk score**. The risk score remains at its previous value even though new data has been calculated and stored.

## System Architecture
- **Frontend**: Next.js 14 (apps/web) - React with TypeScript
- **Backend**: Hono API (apps/api) - Node.js with Raindrop Framework
- **Database**: SmartSQL (Raindrop's SQL service) with in-memory fallback
- **Storage**: SmartBuckets (Raindrop's object storage) with in-memory fallback

## Data Flow (Expected)
1. User ingests logs via `LogIngest` component → calls `apiClient.ingestLogs()`
2. Backend `/api/ingest/:projectId` endpoint:
   - Stores logs in SmartBuckets
   - Calculates risk score (via Vultr worker or local calculation)
   - Stores risk score in `risk_history` table via `storeRiskScore()`
   - Returns response with risk score
3. Frontend `onIngested` callback → calls `handleRefresh()`
4. `handleRefresh()` calls `loadProject()`, `loadForecast()`, `loadRiskHistory()`
5. `loadProject()` fetches `/api/projects/:projectId` which should return latest risk score
6. Backend `handleGetProject()`:
   - Fetches project from database
   - Calls `getRiskHistory(projectId, 1)` to get latest risk score
   - Returns project + riskScore
7. Frontend updates state: `setRiskScore(data.riskScore)`
8. `RiskPanel` component re-renders with new risk score

## What Works
✅ Historical Trends chart updates (uses `loadRiskHistory()` → `/api/forecast/:projectId/risk-history`)
✅ Risk score is calculated correctly (verified in backend logs)
✅ Risk score is stored in database (verified via `storeRiskScore()`)

## What Doesn't Work
❌ Risk Dashboard panel doesn't update after ingestion
❌ The main risk score display remains at old value
❌ Risk factors (error rate, log volume, latency) don't refresh

## Recent Fixes Applied
1. Updated `getRiskHistory()` to include `factors` field in SQL query:
   ```sql
   SELECT score, labels, factors, timestamp FROM risk_history ...
   ```
2. Updated `handleGetProject()` to include factors from history:
   ```javascript
   factors: riskHistory[0].factors || {}
   ```

## Key Code Sections

### Backend: apps/api/src/routes/ingest.ts
- `handleIngestLogs()` - Ingests logs and calculates risk score
- `storeRiskScore()` - Stores risk score in risk_history table
- `getRiskHistory()` - Retrieves risk history from database

### Backend: apps/api/src/routes/projects.ts
- `handleGetProject()` - Returns project + latest risk score from history

### Frontend: apps/web/app/projects/[id]/page.tsx
- `loadProject()` - Fetches project and risk score
- `handleRefresh()` - Called after log ingestion
- State management: `riskScore` state variable

### Frontend: apps/web/components/RiskPanel.tsx
- Displays risk score, labels, and factors
- Receives `riskScore` prop from parent

### Frontend: apps/web/lib/apiClient.ts
- `getProject()` - API call to fetch project
- `ingestLogs()` - API call to ingest logs

## Debugging Questions

### 1. State Management Issue?
- Is `setRiskScore()` being called with the new data?
- Is React re-rendering the RiskPanel component?
- Is there a stale closure or race condition?

### 2. API Response Issue?
- Is `handleGetProject()` returning the latest risk score?
- Is there a caching issue in the API?
- Is `getRiskHistory()` returning the most recent entry?

### 3. Database/Storage Issue?
- Is `storeRiskScore()` successfully writing to the database?
- Is there an eventual consistency delay?
- Is the in-memory fallback being used instead of the database?

### 4. Timing Issue?
- Is `loadProject()` being called before the risk score is stored?
- Is there a race condition between ingestion and refresh?
- Should we add a delay or polling mechanism?

### 5. Data Format Issue?
- Is the risk score data structure correct?
- Are the factors being parsed correctly (JSON.parse)?
- Is there a type mismatch between backend and frontend?

## Request for Gemini

Please analyze the code flow and identify:

1. **Root Cause**: Why is the Risk Dashboard not updating when Historical Trends is?
2. **Specific Bug**: Point to the exact line(s) of code causing the issue
3. **Solution**: Provide a concrete fix with code changes
4. **Verification**: How to verify the fix works

Consider:
- The difference between how Historical Trends gets data vs Risk Dashboard
- Potential race conditions or timing issues
- State management in React
- API response structure
- Database query results

## Additional Context

### Historical Trends Works Because:
It calls a different endpoint: `/api/forecast/:projectId/risk-history` which directly queries the risk_history table with a limit of 30 entries.

### Risk Dashboard Doesn't Work Because:
It relies on `getProject()` which calls `/api/projects/:projectId`, which internally calls `getRiskHistory(projectId, 1)` to get just the latest entry.

**Hypothesis**: There might be a difference in how these two endpoints query or return data, or there's a timing issue where the project endpoint is called before the risk score is committed to the database.

## Files to Analyze
1. `apps/api/src/routes/ingest.ts` - Lines 180-220 (storeRiskScore, getRiskHistory)
2. `apps/api/src/routes/projects.ts` - Lines 180-210 (handleGetProject)
3. `apps/web/app/projects/[id]/page.tsx` - Lines 40-80 (loadProject, handleRefresh)
4. `apps/web/components/RiskPanel.tsx` - Entire file (rendering logic)

## Expected Output
Provide a detailed analysis with:
- Root cause explanation
- Code fix (specific lines to change)
- Why the fix works
- Any additional recommendations
