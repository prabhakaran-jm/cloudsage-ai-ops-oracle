// Database initialization for SmartSQL
// Creates tables if they don't exist

export async function initDatabase(db: any): Promise<boolean> {
  try {
    console.log('[CloudSage] Initializing database tables...');

    let created = 0;

    try {
      await db.executeQuery({
        sqlQuery: `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT,
          updated_at TEXT
        )`,
        format: 'json'
      });
      created++;
    } catch (e: any) {
      console.warn('[CloudSage] Users table already exists or error:', e?.message || e);
    }

    try {
      await db.executeQuery({
        sqlQuery: `CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_at TEXT,
          updated_at TEXT
        )`,
        format: 'json'
      });
      created++;
    } catch (e: any) {
      console.warn('[CloudSage] Projects table already exists or error:', e?.message || e);
    }

    try {
      await db.executeQuery({
        sqlQuery: `CREATE TABLE IF NOT EXISTS risk_history (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          score INTEGER NOT NULL,
          labels TEXT,
          factors TEXT,
          timestamp TEXT
        )`,
        format: 'json'
      });
      created++;
    } catch (e: any) {
      console.warn('[CloudSage] risk_history table already exists or error:', e?.message || e);
    }

    if (created > 0) {
      console.log('[CloudSage] ✓ Database tables created/verified');
      return true;
    }

    console.warn('[CloudSage] No tables created (all attempts failed)');
    return false;
  } catch (error: any) {
    console.error('[CloudSage] Database initialization failed:', error?.message || error);
    console.log('[CloudSage] ⚠ Will use in-memory fallback storage');
    return false;
  }
}
