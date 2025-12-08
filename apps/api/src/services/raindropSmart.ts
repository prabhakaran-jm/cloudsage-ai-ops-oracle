// Wrapper for Raindrop SmartComponents
// SmartBuckets, SmartSQL, SmartMemory, SmartInference
// Uses MCP protocol to communicate with Raindrop server

const RAINDROP_API_KEY = process.env.RAINDROP_API_KEY || '';
const RAINDROP_MCP_URL = process.env.RAINDROP_MCP_URL || 'http://localhost:3002';

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

/**
 * Make a request to Raindrop MCP server
 */
async function mcpRequest(method: string, params: any): Promise<any> {
  if (!RAINDROP_API_KEY || RAINDROP_API_KEY === '') {
    // No API key configured, return null to use fallback
    return null;
  }

  const request: MCPRequest = {
    jsonrpc: '2.0',
    id: ++requestId,
    method,
    params: {
      ...params,
      apiKey: RAINDROP_API_KEY,
    },
  };

  try {
    const response = await fetch(`${RAINDROP_MCP_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAINDROP_API_KEY}`,
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

// SmartBuckets wrapper
export const smartBuckets = {
  /**
   * Store data in SmartBuckets
   */
  async put(bucket: string, key: string, data: any): Promise<boolean> {
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartBuckets.put',
        arguments: {
          bucket,
          key,
          data: typeof data === 'string' ? data : JSON.stringify(data),
        },
      });
      return result !== null;
    } catch {
      return false;
    }
  },

  /**
   * Retrieve data from SmartBuckets
   */
  async get(bucket: string, key: string): Promise<any> {
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartBuckets.get',
        arguments: {
          bucket,
          key,
        },
      });
      
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
  async list(bucket: string, prefix: string = ''): Promise<string[]> {
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartBuckets.list',
        arguments: {
          bucket,
          prefix,
        },
      });
      return result?.keys || [];
    } catch {
      return [];
    }
  },

  /**
   * Delete data from SmartBuckets
   */
  async delete(bucket: string, key: string): Promise<boolean> {
    try {
      await mcpRequest('tools/call', {
        name: 'smartBuckets.delete',
        arguments: {
          bucket,
          key,
        },
      });
      return true;
    } catch {
      return false;
    }
  },
};

// SmartSQL wrapper with improved error handling
export const smartSQL = {
  /**
   * Execute a SQL query
   */
  async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartSQL.query',
        arguments: {
          sql,
          params,
        },
      });

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
  async execute(sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId?: string }> {
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartSQL.execute',
        arguments: {
          sql,
          params,
        },
      });

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
  async transaction(queries: Array<{ sql: string; params: any[] }>): Promise<boolean> {
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartSQL.transaction',
        arguments: {
          queries,
        },
      });

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
  async set(namespace: string, key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      await mcpRequest('tools/call', {
        name: 'smartMemory.set',
        arguments: {
          namespace,
          key,
          value: JSON.stringify(value),
          ttl,
        },
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Retrieve data from SmartMemory
   */
  async get(namespace: string, key: string): Promise<any> {
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartMemory.get',
        arguments: {
          namespace,
          key,
        },
      });
      
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
  async delete(namespace: string, key: string): Promise<boolean> {
    try {
      await mcpRequest('tools/call', {
        name: 'smartMemory.delete',
        arguments: {
          namespace,
          key,
        },
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * List keys in a namespace
   */
  async list(namespace: string, prefix: string = ''): Promise<string[]> {
    try {
      const result = await mcpRequest('tools/call', {
        name: 'smartMemory.list',
        arguments: {
          namespace,
          prefix,
        },
      });
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
