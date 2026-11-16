/* Apply to each workspace's own database. No existing records are changed. */
CREATE TABLE IF NOT EXISTS studio_auth_sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, username TEXT NOT NULL,
 email TEXT NOT NULL, workspace TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS studio_auth_sessions_expiry ON studio_auth_sessions(expires);
CREATE TABLE IF NOT EXISTS studio_auth_tickets (nonce TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS studio_auth_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL);
