// Database initialization for SmartSQL
// Creates tables if they don't exist

export async function initDatabase(db: any): Promise<boolean> {
  try {
    console.log('[CloudSage] Initializing database tables...');

    // Create tables using SmartSQL executeQuery with textQuery (per Raindrop docs)
    await db.executeQuery({
      textQuery: `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      )`,
      format: 'json'
    });

    await db.executeQuery({
      textQuery: `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT,
        updated_at TEXT
      )`,
      format: 'json'
    });

    await db.executeQuery({
      textQuery: `CREATE TABLE IF NOT EXISTS risk_history (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        labels TEXT,
        factors TEXT,
        timestamp TEXT
      )`,
      format: 'json'
    });

    console.log('[CloudSage] ✓ Database tables created');
    return true;
  } catch (error: any) {
    console.error('[CloudSage] Database initialization failed:', error?.message || error);
    console.log('[CloudSage] ⚠ Will use in-memory fallback storage');
    return false;
  }
}
