import { config } from 'dotenv';
import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

// Load environment from .env.backend.local
config({ path: resolve(process.cwd(), '.env.backend.local') });

const MIGRATIONS_DIR = resolve('src/server/db/migrations');
const MIGRATIONS_TABLE = '__migrations';

const log = (message: string): void => {
  process.stdout.write(`${message}\n`);
};

const run = async (): Promise<void> => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const client = await pool.connect();
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
          id serial PRIMARY KEY,
          filename text UNIQUE NOT NULL,
          executed_at timestamptz NOT NULL DEFAULT now()
        )`
      );

      const { rows } = await client.query<{ filename: string }>(`SELECT filename FROM ${MIGRATIONS_TABLE}`);
      const applied = new Set(rows.map((row) => row.filename));

      const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
      const filenames = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
        .map((entry) => entry.name)
        .sort((a, b) => (a > b ? 1 : -1));

      for (const filename of filenames) {
        if (applied.has(filename)) {
          log(`Skipping ${filename} (already applied)`);
          continue;
        }

        const migrationSql = await readFile(resolve(MIGRATIONS_DIR, filename), 'utf8');
        if (!migrationSql.trim()) {
          log(`Skipping ${filename} (empty file)`);
          continue;
        }

        log(`Applying ${filename}...`);
        await client.query('BEGIN');
        try {
          await client.query(migrationSql);
          await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`, [filename]);
          await client.query('COMMIT');
          log(`Applied ${filename}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

run().catch((error: unknown) => {
  console.error('Migration failed', error);
  process.exitCode = 1;
});
