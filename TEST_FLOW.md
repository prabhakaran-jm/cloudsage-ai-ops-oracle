# Test Flow for Risk Score Update

## Setup
1. Build backend: `cd apps/api && npm run build`
2. Deploy backend: `raindrop deploy` (in apps/api)
3. Start frontend: `cd apps/web && npm run dev`
4. Open browser to http://localhost:3000
5. Open DevTools Console (F12)

## Test Steps

### Step 1: Navigate to Project
1. Login to the app
2. Go to Projects page
3. Click on a project (or create a new one)
4. Note the current risk score (if any)

### Step 2: Ingest Logs with Errors
Paste this sample log content:

```
2024-12-09 10:15:23 INFO Application started successfully
2024-12-09 10:15:24 INFO Database connection established
2024-12-09 10:15:25 ERROR Failed to connect to cache server: Connection timeout
2024-12-09 10:15:26 WARN Retrying cache connection...
2024-12-09 10:15:27 ERROR Cache connection failed after 3 retries
2024-12-09 10:15:28 FATAL Critical system failure: Unable to initialize cache layer
2024-12-09 10:15:29 ERROR Service degraded: Running without cache
2024-12-09 10:15:30 INFO Fallback mode activated
2024-12-09 10:15:31 ERROR Request failed: Database query timeout
2024-12-09 10:15:32 ERROR Request failed: Database query timeout
```

### Step 3: Click "Analyze Logs"

### Step 4: Watch Console Output

You should see this sequence:

**Backend logs** (check Raindrop logs or local server):
```
[Ingest] Calculating risk score for X logs
[Ingest] Vultr worker returned: {...} OR [Ingest] Local calculation returned: {...}
[getRiskHistory] Found X entries for project project_xxx
```

**Frontend logs** (browser console):
```
[LogIngest] Ingestion result: {message: "...", count: 10, riskScore: {...}}
[LogIngest] Risk score from ingestion: {score: 65, labels: [...], factors: {...}}
[LogIngest] Calling onIngested with risk score: {score: 65, ...}
[ProjectDetail] Refresh triggered after log ingestion
[ProjectDetail] Using immediate risk score from ingestion response: {score: 65, ...}
[RiskPanel] Risk score prop changed: {score: 65, ...}
```

### Step 5: Verify UI Updates

Check that the Risk Dashboard shows:
- ✅ Updated risk score number (e.g., 65)
- ✅ Updated risk level (e.g., "High Risk Level")
- ✅ Updated risk factors/labels
- ✅ Updated metrics (Error Rate, Log Volume, Latency)

### Step 6: Verify Historical Trends

Check that the Historical Trends chart:
- ✅ Shows a new data point
- ✅ Chart updates with the new score

## Expected Results

### If Working Correctly:
- Risk Dashboard updates immediately after ingestion
- No need to refresh the page
- Risk score matches the calculated value
- All metrics are displayed

### If Still Not Working:

#### Scenario A: Backend doesn't return riskScore
**Console shows**: `[LogIngest] Risk score from ingestion: undefined`
**Fix**: Check backend ingest.ts - ensure riskScore is included in response

#### Scenario B: Frontend doesn't receive riskScore
**Console shows**: `[LogIngest] Ingestion result: {message: "...", count: 10}` (no riskScore)
**Fix**: Check API response format, verify backend is actually returning it

#### Scenario C: onIngested not called
**Console shows**: No `[LogIngest] Calling onIngested...` message
**Fix**: Check LogIngest.tsx - ensure onIngested callback is being called

#### Scenario D: handleRefresh doesn't update state
**Console shows**: `[ProjectDetail] Using immediate risk score...` but no `[RiskPanel] Risk score prop changed`
**Fix**: Check state management - ensure setRiskScore is creating a new object

#### Scenario E: RiskPanel doesn't re-render
**Console shows**: `[RiskPanel] Risk score prop changed` but UI doesn't update
**Fix**: Check React rendering - might be a key or memo issue

## Debugging Commands

### Check backend logs (if deployed to Raindrop):
```bash
cd apps/api
raindrop logs
```

### Check if risk score is in database:
Look for `[getRiskHistory] Found X entries` in logs

### Force refresh:
Reload the page and check if the new risk score appears

### Check network tab:
1. Open DevTools Network tab
2. Filter for "ingest"
3. Check the response payload - should include `riskScore` field

## Common Issues

### Issue: riskScore is undefined in response
**Cause**: Backend calculation failed or wasn't included in response
**Solution**: Check backend logs for errors in risk calculation

### Issue: State updates but UI doesn't
**Cause**: React not detecting state change
**Solution**: Ensure new object reference: `setRiskScore({...newRiskScore})`

### Issue: Race condition still occurs
**Cause**: Multiple state updates happening simultaneously
**Solution**: Use functional state update: `setRiskScore(prev => newRiskScore || prev)`

### Issue: Factors are empty
**Cause**: Backend not including factors in response
**Solution**: Verify `getRiskHistory` includes factors field in SQL query
