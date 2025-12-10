ALTER TABLE users
  ALTER COLUMN is_online SET DEFAULT TRUE;

ALTER TABLE users
  ALTER COLUMN display_mode SET DEFAULT 'normal';

ALTER TABLE users
  ALTER COLUMN conversation_type SET DEFAULT 'free';

UPDATE users
SET is_online = TRUE
WHERE is_online = FALSE;

UPDATE users
SET display_mode = 'normal'
WHERE display_mode IS NULL;
