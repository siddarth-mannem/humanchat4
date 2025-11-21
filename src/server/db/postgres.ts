import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const pool = new Pool({ connectionString: env.databaseUrl, max: 10 });

pool.on('connect', (client) => {
  if (!env.postgresCryptoKey) {
    return;
  }
  client
    .query('SELECT set_config($1, $2, false)', ['humanchat.crypto_key', env.postgresCryptoKey])
    .catch((error: Error) => {
      logger.warn('Failed to prime humanchat.crypto_key parameter', error);
    });
});

pool.on('error', (error: Error) => {
  logger.error('PostgreSQL pool error', error);
});

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> => {
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
};

export const transaction = async <T>(handler: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
