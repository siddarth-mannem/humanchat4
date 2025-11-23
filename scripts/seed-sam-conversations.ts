import 'dotenv/config';

import { query } from '../src/server/db/postgres.js';
import { ensureSamConversation } from '../src/server/services/conversationService.js';

const run = async (): Promise<void> => {
  const { rows } = await query<{ id: string }>('SELECT id FROM users', []);
  if (rows.length === 0) {
    console.log('No users found. Nothing to seed.');
    return;
  }

  let created = 0;
  for (const row of rows) {
    const conversation = await ensureSamConversation(row.id);
    if (conversation) {
      created += 1;
      console.log(`Ensured Sam conversation for user ${row.id} -> ${conversation.id}`);
    }
  }

  console.log(`Ensured Sam conversations for ${created} users.`);
};

run().catch((error) => {
  console.error('Failed to seed Sam conversations', error);
  process.exitCode = 1;
});
