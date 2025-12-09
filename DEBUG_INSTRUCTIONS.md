# Debugging Instructions for Risk Score Update Issue

## Quick Summary
The Risk Dashboard panel doesn't update after log ingestion, but Historical Trends does. We've added extensive logging to trace the issue.

## Step 1: Build and Deploy Backend with Logging

```bash
cd apps/api
npm run build
raindrop deploy
```

## Step 2: Test Log Ingestion

1. Open the web app in browser
2. Open browser DevTools Console (F12)
3. Navigate to a project
4. Ingest some logs with errors (paste logs with "ERROR" or "FATAL" keywords)
5. Watch the console output

## Step 3: Check Backend Logs

After ingesting logs, check the backend logs for these key messages:

```
[Ingest] Calculating risk score for X logs
[Ingest] Vultr worker returned: {...} OR [Ingest] Local calculation returned: {...}
[getRiskHistory] Found X entries for project project_xxx
[getRiskHistory] Latest entry: {...}
[handleGetProject] Risk history entries: X
[handleGetProject] Returning risk score: {...}
```

## Step 4: Check Frontend Logs

In browser console, look for:

```
[ProjectDetail] Refresh triggered after log ingestion
[ProjectDetail] Loading project: project_xxx
[ProjectDetail] Received data: {...}
[ProjectDetail] Risk score from API: {...}
[ProjectDetail] Setting risk score: {...}
```

## Step 5: Analyze the Gap

Compare the data at each step:
1. What risk score is calculated during ingestion?
2. What risk score is stored in the database?
3. What risk score is returned by getRiskHistory()?
4. What risk score is returned by handleGetProject()?
5. What risk score is received by the frontend?
6. Is setRiskScore() being called?

## Common Issues to Check

### Issue 1: Timing/Race Condition
**Symptom**: Frontend calls getProject() before risk score is committed to DB
**Solution**: Add a small delay or use the risk score from ingestion response

### Issue 2: Database Not Persisting
**Symptom**: storeRiskScore() fails silently, falls back to in-memory
**Solution**: Check SmartSQL connection, verify INSERT succeeds

### Issue 3: State Not Updating
**Symptom**: setRiskScore() is called but component doesn't re-render
**Solution**: Check React state management, ensure riskScore prop changes

### Issue 4: Wrong Data Returned
**Symptom**: getRiskHistory() returns old data
**Solution**: Check SQL query ORDER BY, verify timestamp is correct

### Issue 5: Frontend Caching
**Symptom**: API returns correct data but frontend shows old data
**Solution**: Check if there's caching in apiClient or browser

## Gemini CLI Analysis Prompt

Use the detailed prompt in `GEMINI_DEBUG_PROMPT.md`:

```bash
# Copy the content of GEMINI_DEBUG_PROMPT.md and paste it to Gemini CLI
cat GEMINI_DEBUG_PROMPT.md
```

Or use this condensed version:

```
I have a Next.js + Node.js app where the Risk Dashboard doesn't update after log ingestion, but Historical Trends does.

Data Flow:
1. Ingest logs → storeRiskScore() → risk_history table
2. Frontend calls loadProject() → getProject() API
3. getProject() calls getRiskHistory(projectId, 1) to get latest score
4. Returns project + riskScore
5. Frontend calls setRiskScore(data.riskScore)

Historical Trends works because it calls a different endpoint that queries risk_history directly with limit=30.

Risk Dashboard doesn't work - it shows old score even though new score is in database.

I've added logging at each step. What should I check to find the root cause?

Key files:
- apps/api/src/routes/ingest.ts (storeRiskScore, getRiskHistory)
- apps/api/src/routes/projects.ts (handleGetProject)
- apps/web/app/projects/[id]/page.tsx (loadProject, state management)

Hypothesis: Either timing issue (getProject called before commit), or state management issue (setRiskScore not triggering re-render), or data format issue (factors not being included).
```

## Expected Findings

Based on the code analysis, the most likely issues are:

1. **Race Condition**: `loadProject()` is called immediately after ingestion, but the database write might not be committed yet
2. **Fallback Storage**: The in-memory fallback might be out of sync with the database
3. **State Update**: React might not be detecting the state change if the object reference is the same

## Recommended Fixes

### Fix 1: Use Ingestion Response (Immediate)
Instead of calling `loadProject()` after ingestion, use the risk score returned in the ingestion response:

```typescript
// In LogIngest.tsx
const result = await apiClient.ingestLogs(projectId, logContent);
if (result.riskScore) {
  // Pass risk score directly to parent
  onIngested(result.riskScore);
}

// In page.tsx
const handleRefresh = (newRiskScore?: RiskScore) => {
  if (newRiskScore) {
    setRiskScore(newRiskScore);
  }
  loadProject();
  loadForecast();
  loadRiskHistory();
};
```

### Fix 2: Add Delay (Temporary)
Add a small delay before refreshing:

```typescript
const handleRefresh = async () => {
  console.log('[ProjectDetail] Refresh triggered after log ingestion');
  await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
  loadProject();
  loadForecast();
  loadRiskHistory();
};
```

### Fix 3: Force State Update
Ensure React detects the state change:

```typescript
if (data.riskScore) {
  console.log('[ProjectDetail] Setting risk score:', data.riskScore);
  setRiskScore({...data.riskScore}); // Create new object reference
}
```

## Next Steps

1. Deploy the backend with logging
2. Test log ingestion and collect logs
3. Analyze the logs to identify where the data flow breaks
4. Apply the appropriate fix based on findings
5. Verify the fix works
6. Remove debug logging (or keep for production debugging)
