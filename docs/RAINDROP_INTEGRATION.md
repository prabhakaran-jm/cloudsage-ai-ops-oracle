# Raindrop SmartComponents Integration Guide

This document outlines how to integrate Raindrop SmartComponents into CloudSage.

## Current Status

We currently have **stub implementations** using in-memory storage. To complete the hackathon submission, we need to integrate actual Raindrop SmartComponents.

## Integration Points

### 1. SmartBuckets Integration

**Current:** In-memory Map storage in `apps/api/src/routes/ingest.ts` and `apps/api/src/routes/forecast.ts`

**Replace with SmartBuckets for:**
- Raw log storage (keyed by `project_id` and `timestamp`)
- Forecast storage (keyed by `project_id` and `date`)

**Files to update:**
- `apps/api/src/routes/ingest.ts` - Replace `logs` Map with SmartBuckets
- `apps/api/src/routes/forecast.ts` - Replace `forecasts` Map with SmartBuckets
- `apps/api/src/services/raindropSmart.ts` - Add SmartBuckets wrapper functions

**Example integration:**
```typescript
// Store logs in SmartBuckets
await smartBuckets.put(`logs/${projectId}/${timestamp}`, logData);

// Retrieve logs from SmartBuckets
const logs = await smartBuckets.list(`logs/${projectId}/`);
```

### 2. SmartSQL Integration

**Current:** In-memory Map storage in:
- `apps/api/src/routes/projects.ts` - Projects storage
- `apps/api/src/routes/ingest.ts` - Risk history storage
- `apps/api/src/routes/auth.ts` - Users storage

**Replace with SmartSQL for:**
- `projects` table: id, name, user_id, description, created_at, updated_at
- `risk_history` table: id, project_id, score, labels, timestamp, factors
- `forecast_feedback` table: id, forecast_id, accurate, user_id, timestamp
- `users` table: id, email, password_hash, created_at

**Files to update:**
- `apps/api/src/routes/projects.ts` - Replace projects Map with SmartSQL queries
- `apps/api/src/routes/ingest.ts` - Replace riskHistory Map with SmartSQL
- `apps/api/src/routes/auth.ts` - Replace users Map with SmartSQL
- `apps/api/src/services/raindropSmart.ts` - Add SmartSQL wrapper functions

**Example integration:**
```typescript
// Create project in SmartSQL
await smartSQL.query(
  'INSERT INTO projects (id, name, user_id, created_at) VALUES (?, ?, ?, ?)',
  [projectId, name, userId, new Date()]
);

// Query risk history
const history = await smartSQL.query(
  'SELECT * FROM risk_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?',
  [projectId, limit]
);
```

### 3. SmartMemory Integration

**Current:** Not implemented

**Add SmartMemory for:**
- User preferences (notification settings, default views)
- Project-specific patterns (typical error rates, baseline metrics)
- User behavior patterns (frequently accessed projects, preferred time ranges)

**Files to create/update:**
- `apps/api/src/services/raindropSmart.ts` - Add SmartMemory wrapper functions
- `apps/api/src/routes/projects.ts` - Store/retrieve user preferences
- `apps/api/src/services/forecastService.ts` - Use SmartMemory for personalized forecasts

**Example integration:**
```typescript
// Store user pattern
await smartMemory.set(`user:${userId}:preferences`, {
  defaultView: 'dashboard',
  alertThreshold: 70
});

// Retrieve project baseline
const baseline = await smartMemory.get(`project:${projectId}:baseline`);
```

### 4. SmartInference Integration

**Current:** Stub implementation in `apps/api/src/services/forecastService.ts`

**Replace with SmartInference for:**
- Daily forecast generation
- Action item generation
- Risk trend analysis

**Files to update:**
- `apps/api/src/services/forecastService.ts` - Replace stub with SmartInference chain
- `apps/api/raindrop.manifest.ts` - Define SmartInference chain configuration

**Example integration:**
```typescript
// Define inference chain in manifest
const inferenceChain = {
  inputs: [
    { source: 'smartSQL', query: 'SELECT * FROM risk_history WHERE project_id = ?' },
    { source: 'smartBuckets', path: `logs/${projectId}/` },
    { source: 'smartMemory', key: `project:${projectId}:baseline` }
  ],
  prompt: 'Analyze risk trends and generate daily forecast with 3 actions',
  outputs: ['forecastText', 'actions', 'confidence']
};

// Use SmartInference
const forecast = await smartInference.run(inferenceChain, { projectId });
```

## Setup Steps

### 1. Get Raindrop API Key

1. Register for the hackathon (if not already done)
2. Check welcome email for Raindrop credits/coupon code
3. Create Raindrop account and get API key
4. Add to `.env`:
   ```
   RAINDROP_API_KEY=your_api_key_here
   ```

### 2. Install Raindrop MCP Server

Follow the [Raindrop Setup Guide](https://raindrop.docs.liquidmetal.ai/) to:
- Install Raindrop MCP Server
- Configure Claude Code or Gemini CLI
- Set up your development environment

### 3. Update raindrop.manifest.ts

Define your SmartComponents configuration:

```typescript
export default {
  smartBuckets: {
    buckets: ['logs', 'forecasts'],
    policies: {
      logs: { retention: '30d', compression: true },
      forecasts: { retention: '90d', compression: false }
    }
  },
  smartSQL: {
    tables: [
      {
        name: 'projects',
        schema: {
          id: 'string PRIMARY KEY',
          name: 'string',
          user_id: 'string',
          description: 'string',
          created_at: 'timestamp',
          updated_at: 'timestamp'
        }
      },
      {
        name: 'risk_history',
        schema: {
          id: 'string PRIMARY KEY',
          project_id: 'string',
          score: 'number',
          labels: 'json',
          timestamp: 'timestamp',
          factors: 'json'
        }
      },
      // ... more tables
    ]
  },
  smartMemory: {
    namespaces: ['user', 'project'],
    ttl: '90d'
  },
  smartInference: {
    chains: [
      {
        name: 'forecast_generation',
        inputs: ['risk_history', 'logs', 'baseline'],
        model: 'claude-sonnet',
        outputFormat: 'json'
      }
    ]
  }
};
```

### 4. Update raindropSmart.ts Service

Create wrapper functions for each SmartComponent:

```typescript
// apps/api/src/services/raindropSmart.ts
import { RaindropClient } from '@raindrop/mcp-server';

const client = new RaindropClient(process.env.RAINDROP_API_KEY);

export const smartBuckets = {
  async put(key: string, data: any) {
    return client.smartBuckets.put(key, data);
  },
  async get(key: string) {
    return client.smartBuckets.get(key);
  },
  async list(prefix: string) {
    return client.smartBuckets.list(prefix);
  }
};

export const smartSQL = {
  async query(sql: string, params: any[]) {
    return client.smartSQL.query(sql, params);
  },
  async execute(sql: string, params: any[]) {
    return client.smartSQL.execute(sql, params);
  }
};

export const smartMemory = {
  async set(key: string, value: any) {
    return client.smartMemory.set(key, value);
  },
  async get(key: string) {
    return client.smartMemory.get(key);
  }
};

export const smartInference = {
  async run(chainName: string, inputs: any) {
    return client.smartInference.run(chainName, inputs);
  }
};
```

### 5. Migration Strategy

To migrate from in-memory to Raindrop:

1. **Phase 1:** Keep in-memory as fallback, add Raindrop alongside
2. **Phase 2:** Migrate read operations first (queries)
3. **Phase 3:** Migrate write operations (inserts/updates)
4. **Phase 4:** Remove in-memory fallbacks

## Testing Raindrop Integration

1. **Test SmartBuckets:**
   - Store a log entry
   - Retrieve logs for a project
   - Verify data persistence

2. **Test SmartSQL:**
   - Create a project
   - Query projects by user
   - Insert risk history record
   - Query risk history

3. **Test SmartMemory:**
   - Store user preferences
   - Retrieve project baseline
   - Verify TTL expiration

4. **Test SmartInference:**
   - Generate a forecast
   - Verify forecast quality
   - Check action items relevance

## Resources

- [Raindrop Setup Guide](https://raindrop.docs.liquidmetal.ai/)
- [Raindrop Full Documentation](https://raindrop.docs.liquidmetal.ai/)
- [SmartBuckets Docs](https://raindrop.docs.liquidmetal.ai/smart-buckets)
- [SmartSQL Docs](https://raindrop.docs.liquidmetal.ai/smart-sql)
- [SmartMemory Docs](https://raindrop.docs.liquidmetal.ai/smart-memory)
- [SmartInference Docs](https://raindrop.docs.liquidmetal.ai/smart-inference)
- [LiquidMetal Discord](https://discord.gg/liquidmetal) - For support

## Next Steps

1. ✅ Get Raindrop API key from hackathon welcome email
2. ✅ Set up Raindrop MCP Server
3. ✅ Configure raindrop.manifest.ts
4. ✅ Implement SmartBuckets integration
5. ✅ Implement SmartSQL integration
6. ✅ Implement SmartMemory integration
7. ✅ Implement SmartInference integration
8. ✅ Test all integrations
9. ✅ Update documentation

## Notes

- Raindrop provides $500 in credits for hackathon participants
- Use Claude Code or Gemini CLI as your AI coding assistant
- Join Discord for real-time support
- Office hours available weekly for expert help

