// Raindrop manifest - defines SmartComponents and endpoints
// This is a template - update with actual SmartComponent configurations

export default {
  // SmartBuckets configuration
  smartBuckets: {
    buckets: [
      {
        name: 'logs',
        description: 'Raw log entries for projects',
        retention: '30d', // Keep logs for 30 days
        compression: true,
      },
      {
        name: 'forecasts',
        description: 'Generated forecasts for projects',
        retention: '90d', // Keep forecasts for 90 days
        compression: false,
      },
    ],
  },

  // SmartSQL table definitions
  smartSQL: {
    tables: [
      {
        name: 'users',
        description: 'User accounts',
        schema: {
          id: { type: 'string', primaryKey: true },
          email: { type: 'string', unique: true, required: true },
          password_hash: { type: 'string', required: true },
          created_at: { type: 'timestamp', default: 'now()' },
          updated_at: { type: 'timestamp', default: 'now()' },
        },
        indexes: ['email'],
      },
      {
        name: 'projects',
        description: 'User projects',
        schema: {
          id: { type: 'string', primaryKey: true },
          user_id: { type: 'string', required: true, foreignKey: 'users.id' },
          name: { type: 'string', required: true },
          description: { type: 'string' },
          created_at: { type: 'timestamp', default: 'now()' },
          updated_at: { type: 'timestamp', default: 'now()' },
        },
        indexes: ['user_id', 'created_at'],
      },
      {
        name: 'risk_history',
        description: 'Risk score history for projects',
        schema: {
          id: { type: 'string', primaryKey: true },
          project_id: { type: 'string', required: true, foreignKey: 'projects.id' },
          score: { type: 'number', required: true },
          labels: { type: 'json', required: true },
          factors: { type: 'json' },
          timestamp: { type: 'timestamp', default: 'now()' },
        },
        indexes: ['project_id', 'timestamp'],
      },
      {
        name: 'forecast_feedback',
        description: 'User feedback on forecasts',
        schema: {
          id: { type: 'string', primaryKey: true },
          forecast_id: { type: 'string', required: true },
          user_id: { type: 'string', required: true, foreignKey: 'users.id' },
          accurate: { type: 'boolean', required: true },
          comment: { type: 'string' },
          timestamp: { type: 'timestamp', default: 'now()' },
        },
        indexes: ['forecast_id', 'user_id'],
      },
    ],
  },

  // SmartMemory namespaces
  smartMemory: {
    namespaces: [
      {
        name: 'user',
        description: 'User preferences and patterns',
        ttl: '90d',
      },
      {
        name: 'project',
        description: 'Project-specific patterns and baselines',
        ttl: '90d',
      },
    ],
  },

  // SmartInference chains
  smartInference: {
    chains: [
      {
        name: 'forecast_generation',
        description: 'Generate daily forecast with actionable insights',
        inputs: [
          {
            source: 'smartSQL',
            query: 'SELECT * FROM risk_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT 30',
            param: 'projectId',
          },
          {
            source: 'smartBuckets',
            bucket: 'logs',
            prefix: 'logs/{projectId}/',
          },
          {
            source: 'smartMemory',
            namespace: 'project',
            key: 'project:{projectId}:baseline',
          },
        ],
        prompt: `
          Analyze the risk history, recent logs, and project baseline to generate:
          1. A daily forecast text (2-3 sentences) describing the current risk situation
          2. Three concrete, actionable items the user should take
          3. A confidence score (0-100) based on data quality
          
          Consider:
          - Risk trend (increasing/decreasing/stable)
          - Top risk factors from labels
          - Log patterns and error rates
          - Historical baseline metrics
          
          Return JSON: { forecastText: string, actions: string[], confidence: number }
        `,
        model: 'claude-sonnet-4',
        outputFormat: 'json',
      },
    ],
  },

  // API endpoint mappings (if needed)
  endpoints: {
    '/api/projects': {
      methods: ['GET', 'POST'],
      auth: true,
    },
    '/api/ingest': {
      methods: ['POST'],
      auth: true,
    },
    '/api/forecast': {
      methods: ['GET'],
      auth: true,
    },
  },
};
