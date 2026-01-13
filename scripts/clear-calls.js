import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function clearCalls() {
  try {
    const result = await pool.query(`
      DELETE FROM call_sessions 
      WHERE status IN ('initiated', 'accepted', 'connected')
    `);
    console.log(`Cleared ${result.rowCount} old call sessions`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

clearCalls();
