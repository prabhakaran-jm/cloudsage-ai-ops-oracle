// Wrapper for Raindrop SmartComponents
// SmartBuckets, SmartSQL, SmartMemory, SmartInference
// Uses MCP protocol to communicate with Raindrop server

interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

let requestId = 0;

// Helper to safely get env vars
function getEnvVar(key: string, env?: any): string {
  // Check passed env first
  if (env && env[key]) {
    return env[key];
  }
  
  // Check global process.env if available
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {
    // Ignore error if process is not defined
  }

  // Defaults
  if (key === 'RAINDROP_MCP_URL') return 'http://localhost:3002';
  
  return '';
}

/**
 * Make a request to Raindrop MCP server
 */
async function mcpRequest(method: string, params: any, env?: any): Promise<any> {
  const apiKey = getEnvVar('RAINDROP_API_KEY', env);
  const rawUrl = getEnvVar('RAINDROP_MCP_URL', env);
  const mcpUrl = rawUrl?.replace(/\/+$/, '') || '';

  if (!apiKey) {
    // No API key configured, return null to use fallback
    return null;
  }

  const request: MCPRequest = {
    jsonrpc: '2.0',
    id: ++requestId,
    method,
    params: {
      ...params,
      apiKey,
    },
  };

  try {
    const response = await fetch(`${mcpUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.statusText}`);
    }

    const data = await response.json() as MCPResponse;
    
    if (data.error) {
      throw new Error(`MCP error: ${data.error.message}`);
    }

    return data.result;
  } catch (error: any) {
    // Fallback: if MCP server not available, return null to use in-memory fallback
    console.warn(`Raindrop MCP not available (${error.message}), using fallback`);
    return null;
  }
}

/**
 * Escape a value for safe SQL interpolation
 * This is used because Raindrop SmartSQL executeQuery doesn't support parameterized queries
 */
function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  // String: escape single quotes by doubling them
  const str = String(value);
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Interpolate SQL parameters into the query string
 * Replaces ? or ?N placeholders with properly escaped values
 */
function interpolateSqlParams(sql: string, params: any[]): string {
  if (!params || params.length === 0) {
    return sql;
  }
  
  let paramIndex = 0;
  // Replace ?N (numbered) or ? (positional) placeholders
  return sql.replace(/\?(\d+)?/g, (match, num) => {
    const index = num ? parseInt(num, 10) - 1 : paramIndex++;
    if (index >= params.length) {
      console.warn(`[SmartSQL] Missing parameter at index ${index}`);
      return 'NULL';
    }
    return escapeSqlValue(params[index]);
  });
}

// SmartBuckets wrapper
// Uses native Raindrop SmartBucket API when available (in Raindrop runtime)
// Falls back to MCP for local development
export const smartBuckets = {
  /**
   * Get the SmartBucket instance from env based on bucket name
   */
  _getBucket(bucket: string, env?: any): any {
    if (!env) return null;
    
    // Map bucket names to env properties (uppercase in generated types)
    const bucketMap: Record<string, string> = {
      'logs': 'LOGS',
      'forecasts': 'FORECASTS',
      'users': 'USERS', // Will be available after redeploy with updated manifest
      'projects': 'PROJECTS', // Will be available after redeploy with updated manifest
      'risk-history': 'RISK_HISTORY',
    };
    
    const envKey = bucketMap[bucket.toLowerCase()];
    if (envKey && env[envKey]) {
      return env[envKey];
    }
    
    // Try direct uppercase access
    const upperKey = bucket.toUpperCase();
    if (env[upperKey]) {
      return env[upperKey];
    }
    
    // Fallback: use LOGS bucket for users/projects until separate buckets are available
    if (bucket === 'users' || bucket === 'projects') {
      if (env.LOGS) {
        console.log(`[SmartBuckets] Using LOGS bucket for ${bucket} (separate bucket not yet available)`);
        return env.LOGS;
      }
    }
    
    return null;
  },

  /**
   * Store data in SmartBuckets
   */
  async put(bucket: string, key: string, data: any, env?: any): Promise<boolean> {
    // Try native Raindrop API first
    const bucketInstance = this._getBucket(bucket, env);
    if (bucketInstance) {
      try {
        // Try different method signatures that Raindrop SmartBucket might use
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        
        // Method 1: put(key, value)
        if (typeof bucketInstance.put === 'function') {
          await bucketInstance.put(key, dataStr);
          console.log(`[SmartBuckets] Successfully stored ${bucket}/${key} using native API`);
          return true;
        }
        
        // Method 2: put({ key, value }) or similar
        if (typeof bucketInstance.set === 'function') {
          await bucketInstance.set(key, dataStr);
          console.log(`[SmartBuckets] Successfully stored ${bucket}/${key} using native set API`);
          return true;
        }
      } catch (error: any) {
        console.warn(`[SmartBuckets] Native put failed for ${bucket}/${key}:`, error.message);
        console.warn(`[SmartBuckets] Bucket instance methods:`, Object.keys(bucketInstance || {}));
      }
    }
    
    // Fallback to MCP for local development
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartBuckets.put',
        arguments: {
          bucket,
          key,
          data: typeof data === 'string' ? data : JSON.stringify(data),
        },
      }, env);
      return result !== null;
    } catch {
      return false;
    }
  },

  /**
   * Retrieve data from SmartBuckets
   */
  async get(bucket: string, key: string, env?: any): Promise<any> {
    // Try native Raindrop API first
    const bucketInstance = this._getBucket(bucket, env);
    if (bucketInstance) {
      try {
        let result = null;
        
        // Method 1: get(key) - might return metadata or Response-like object
        if (typeof bucketInstance.get === 'function') {
          result = await bucketInstance.get(key);
        }
        // Method 2: get({ key }) or similar
        else if (typeof bucketInstance.fetch === 'function') {
          result = await bucketInstance.fetch(key);
        }
        
        if (result) {
          // SmartBucket.get() might return a Response-like object
          // Try text() first (most common for Response objects)
          if (typeof result.text === 'function') {
            try {
              const text = await result.text();
              console.log(`[SmartBuckets] Read content via .text() for ${bucket}/${key}, length: ${text.length}`);
              try {
                return JSON.parse(text);
              } catch {
                return text;
              }
            } catch (error: any) {
              console.warn(`[SmartBuckets] .text() failed for ${bucket}/${key}:`, error.message);
            }
          }
          // Check if result has json() method
          if (typeof result.json === 'function') {
            try {
              const data = await result.json();
              console.log(`[SmartBuckets] Read content via .json() for ${bucket}/${key}`);
              return data;
            } catch (error: any) {
              console.warn(`[SmartBuckets] .json() failed for ${bucket}/${key}:`, error.message);
            }
          }
          // Check if result has a body stream
          if (result.body && typeof result.body.getReader === 'function') {
            // Read stream
            const reader = result.body.getReader();
            const chunks: Uint8Array[] = [];
            let done = false;
            while (!done) {
              const { value, done: streamDone } = await reader.read();
              done = streamDone;
              if (value) chunks.push(value);
            }
            // Combine all chunks into a single Uint8Array
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
              combined.set(chunk, offset);
              offset += chunk.length;
            }
            const text = new TextDecoder().decode(combined);
            try {
              return JSON.parse(text);
            } catch {
              return text;
            }
          }
          // Check if data is in a property (from MCP response format)
          else if (result.data) {
            const data = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
            try {
              return JSON.parse(data);
            } catch {
              return result.data;
            }
          }
          // If result is just metadata (has key, size, etc. but no actual data fields)
          // This means SmartBucket.get() returned metadata, not content
          // The actual content might need to be read from the bucket differently
          if (result.key && result.size && !result.id && !result.email && !result.name && !result.password_hash) {
            // This is metadata object - SmartBucket.get() returns metadata by default
            // We need to fetch the actual content - try using the bucket's get method differently
            // or treat the result as a Response and read its body
            console.warn(`[SmartBuckets] Got metadata object for ${bucket}/${key}, size: ${result.size}`);
            console.warn(`[SmartBuckets] Result type:`, typeof result);
            console.warn(`[SmartBuckets] Result keys:`, Object.keys(result));
            
            // Try to get content - the metadata object might have the data embedded
            // or we need to make another call to get the body
            // Check if result has any data-like properties
            if (result.value !== undefined) {
              try {
                const data = typeof result.value === 'string' ? JSON.parse(result.value) : result.value;
                console.log(`[SmartBuckets] Found data in .value property for ${bucket}/${key}`);
                return data;
              } catch {
                return result.value;
              }
            }
            
            // Check customMetadata
            if (result.customMetadata && result.customMetadata.data) {
              try {
                const data = JSON.parse(result.customMetadata.data);
                console.log(`[SmartBuckets] Found data in customMetadata for ${bucket}/${key}`);
                return data;
              } catch {
                return result.customMetadata.data;
              }
            }
            
            // The metadata object itself doesn't contain the data
            // We need to read the actual content from the bucket
            // Since .text() and .json() didn't work, the result might not be Response-like
            // Try one more thing: check if the result itself can be converted to string/JSON
            // Some bucket APIs return metadata that needs to be treated differently
            
            // Last attempt: check if result has a toString() that might give us the data
            // Or if result itself is the data wrapped in metadata
            console.error(`[SmartBuckets] Cannot extract content from metadata object for ${bucket}/${key}`);
            console.error(`[SmartBuckets] Result structure:`, JSON.stringify(result, null, 2).substring(0, 500));
            
            // Return null to indicate failure - caller should handle this
            return null;
          }
          // Direct string data
          else if (typeof result === 'string') {
            try {
              return JSON.parse(result);
            } catch {
              return result;
            }
          }
          // Object - might be the actual data (has id, email, name, etc.)
          else {
            // Check if this looks like actual data (has expected fields)
            if (result.id || result.email || result.name || result.password_hash) {
              return result;
            }
            // Otherwise might be metadata, return as-is but log warning
            console.warn(`[SmartBuckets] Unclear if result is data or metadata for ${bucket}/${key}`);
            return result;
          }
        }
        return null;
      } catch (error: any) {
        console.warn(`[SmartBuckets] Native get failed for ${bucket}/${key}:`, error.message);
        console.warn(`[SmartBuckets] Bucket instance methods:`, Object.keys(bucketInstance || {}));
      }
    }
    
    // Fallback to MCP for local development
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartBuckets.get',
        arguments: {
          bucket,
          key,
        },
      }, env);
      
      if (result && result.data) {
        try {
          return JSON.parse(result.data);
        } catch {
          return result.data;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * List keys in a bucket with prefix
   */
  async list(bucket: string, prefix: string = '', env?: any): Promise<string[]> {
    // Try native Raindrop API first
    const bucketInstance = this._getBucket(bucket, env);
    if (bucketInstance) {
      try {
        let result = null;
        
        // Method 1: list({ prefix })
        if (typeof bucketInstance.list === 'function') {
          result = await bucketInstance.list({ prefix });
        }
        // Method 2: list(prefix) or keys(prefix)
        else if (typeof bucketInstance.keys === 'function') {
          result = await bucketInstance.keys({ prefix });
        }
        
        if (result) {
          // Raindrop SmartBucket.list() returns {objects: [{key: ...}, ...], delimitedPrefixes: [...], ...}
          // Extract keys from objects array
          if (result.objects && Array.isArray(result.objects)) {
            const keys = result.objects.map((obj: any) => obj.key).filter((key: string) => key);
            console.log(`[SmartBuckets] Extracted ${keys.length} keys from list result for ${bucket} with prefix ${prefix}`);
            return keys;
          }
          // Fallback: check if result has keys property
          if (result.keys && Array.isArray(result.keys)) {
            return result.keys;
          }
          // Fallback: if result is an array, return it
          if (Array.isArray(result)) {
            return result;
          }
          // Last resort: return empty array
          console.warn(`[SmartBuckets] Unexpected list result format for ${bucket}:`, JSON.stringify(result).substring(0, 200));
          return [];
        }
        return [];
      } catch (error: any) {
        console.warn(`[SmartBuckets] Native list failed for ${bucket}:`, error.message);
        console.warn(`[SmartBuckets] Bucket instance methods:`, Object.keys(bucketInstance || {}));
      }
    }
    
    // Fallback to MCP for local development
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartBuckets.list',
        arguments: {
          bucket,
          prefix,
        },
      }, env);
      return result?.keys || [];
    } catch {
      return [];
    }
  },

  /**
   * Delete data from SmartBuckets
   */
  async delete(bucket: string, key: string, env?: any): Promise<boolean> {
    // Try native Raindrop API first
    const bucketInstance = this._getBucket(bucket, env);
    if (bucketInstance && typeof bucketInstance.delete === 'function') {
      try {
        await bucketInstance.delete(key);
        return true;
      } catch (error: any) {
        console.warn(`[SmartBuckets] Native delete failed for ${bucket}/${key}:`, error.message);
      }
    }
    
    // Fallback to MCP for local development
    try {
      await mcpRequest('tools/call', {
        name: 'smartBuckets.delete',
        arguments: {
          bucket,
          key,
        },
      }, env);
      return true;
    } catch {
      return false;
    }
  },
};

// SmartSQL wrapper with improved error handling and native binding support
export const smartSQL = {
  /**
   * Execute a SQL query
   */
  async query(sql: string, params: any[] = [], env?: any): Promise<any[]> {
    try {
      // Prefer native SmartSQL binding if available
      const mainDb = (env && (env.MAIN_DB || env.main_db)) as any;
      if (mainDb?.executeQuery) {
        // Raindrop SmartSQL doesn't seem to support parameterized queries via executeQuery
        // Interpolate values directly with proper escaping
        const interpolatedSql = interpolateSqlParams(sql, params);
        const result = await mainDb.executeQuery({
          sqlQuery: interpolatedSql,
          format: 'json',
        });
        const rows = result?.rows || [];
        console.log(`[SmartSQL] (native) Query returned ${rows.length} rows`);
        return rows;
      }

      // Fallback to MCP
      const result = await mcpRequest(
        'tools/call',
        {
          name: 'smartSQL.query',
          arguments: {
            sql,
            params,
          },
        },
        env
      );

      if (result === null) {
        console.warn('[SmartSQL] Query failed - MCP unavailable:', sql.substring(0, 50));
        throw new Error('SmartSQL unavailable');
      }

      const rows = result?.rows || [];
      console.log(`[SmartSQL] Query returned ${rows.length} rows:`, sql.substring(0, 50));
      return rows;
    } catch (error: any) {
      console.error('[SmartSQL] Query error:', error.message);
      throw error;
    }
  },

  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE)
   */
  async execute(sql: string, params: any[] = [], env?: any): Promise<{ affectedRows: number; insertId?: string }> {
    try {
      // Prefer native SmartSQL binding if available
      const mainDb = (env && (env.MAIN_DB || env.main_db)) as any;
      if (mainDb?.executeQuery) {
        // Raindrop SmartSQL doesn't seem to support parameterized queries via executeQuery
        // Interpolate values directly with proper escaping
        const interpolatedSql = interpolateSqlParams(sql, params);
        const result = await mainDb.executeQuery({
          sqlQuery: interpolatedSql,
          format: 'json',
        });
        const affectedRows = result?.affectedRows || result?.rowCount || 0;
        console.log(`[SmartSQL] (native) Execute affected ${affectedRows} rows`);
        return { affectedRows, insertId: result?.insertId };
      }

      // Fallback to MCP
      const result = await mcpRequest(
        'tools/call',
        {
          name: 'smartSQL.execute',
          arguments: {
            sql,
            params,
          },
        },
        env
      );

      if (result === null) {
        console.warn('[SmartSQL] Execute failed - MCP unavailable:', sql.substring(0, 50));
        throw new Error('SmartSQL unavailable');
      }

      const affectedRows = result?.affectedRows || 0;
      console.log(`[SmartSQL] Execute affected ${affectedRows} rows:`, sql.substring(0, 50));
      return result || { affectedRows: 0 };
    } catch (error: any) {
      console.error('[SmartSQL] Execute error:', error.message);
      throw error;
    }
  },

  /**
   * Execute a transaction
   */
  async transaction(queries: Array<{ sql: string; params: any[] }>, env?: any): Promise<boolean> {
    try {
      // Native transaction not exposed; fall back to MCP when available
      const result = await mcpRequest(
        'tools/call',
        {
          name: 'smartSQL.transaction',
          arguments: {
            queries,
          },
        },
        env
      );

      if (result === null) {
        console.warn('[SmartSQL] Transaction failed - MCP unavailable');
        throw new Error('SmartSQL unavailable');
      }

      console.log(`[SmartSQL] Transaction completed: ${queries.length} queries`);
      return true;
    } catch (error: any) {
      console.error('[SmartSQL] Transaction error:', error.message);
      throw error;
    }
  },
};

// SmartMemory wrapper
export const smartMemory = {
  /**
   * Store data in SmartMemory
   */
  async set(namespace: string, key: string, value: any, ttl?: number, env?: any): Promise<boolean> {
    try {
      await mcpRequest('tools/call', {
        name: 'smartMemory.set',
        arguments: {
          namespace,
          key,
          value: JSON.stringify(value),
          ttl,
        },
      }, env);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Retrieve data from SmartMemory
   */
  async get(namespace: string, key: string, env?: any): Promise<any> {
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartMemory.get',
        arguments: {
          namespace,
          key,
        },
      }, env);
      
      if (result && result.value) {
        try {
          return JSON.parse(result.value);
        } catch {
          return result.value;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Delete data from SmartMemory
   */
  async delete(namespace: string, key: string, env?: any): Promise<boolean> {
    try {
      await mcpRequest('tools/call', {
        name: 'smartMemory.delete',
        arguments: {
          namespace,
          key,
        },
      }, env);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * List keys in a namespace
   */
  async list(namespace: string, prefix: string = '', env?: any): Promise<string[]> {
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartMemory.list',
        arguments: {
          namespace,
          prefix,
        },
      }, env);
      return result?.keys || [];
    } catch {
      return [];
    }
  },
};

// SmartInference wrapper
export const smartInference = {
  /**
   * Run an inference chain
   */
  async run(chainName: string, inputs: Record<string, any>): Promise<any> {
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartInference.run',
        arguments: {
          chainName,
          inputs,
        },
      });
      return result;
    } catch (error: any) {
      console.error('SmartInference error:', error);
      return null;
    }
  },

  /**
   * List available inference chains
   */
  async listChains(): Promise<string[]> {
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartInference.list',
        arguments: {},
      });
      return result?.chains || [];
    } catch {
      return [];
    }
  },
};

// Helper to check if Raindrop is available
export async function isRaindropAvailable(): Promise<boolean> {
  try {
    const result = await mcpRequest('ping', {});
    return result !== null;
  } catch {
    return false;
  }
}
