import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, chmodSync, readFileSync} from 'node:fs';
import {dirname} from 'node:path';

export function openAuthDatabase(path) {
  mkdirSync(dirname(path), {recursive: true, mode: 0o700});
  const sqlite = new DatabaseSync(path);
  chmodSync(path, 0o600);
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  sqlite.exec(readFileSync(new URL('../drizzle/0001_password_auth.sql', import.meta.url), 'utf8'));
  function statement(sql, args = []) {
    return {
      bind: (...values) => statement(sql, values),
      first: async () => sqlite.prepare(sql).get(...args) || null,
      run: async () => ({meta: {changes: Number(sqlite.prepare(sql).run(...args).changes)}}),
      rows: () => sqlite.prepare(sql).all(...args),
    };
  }
  return {
    prepare: statement,
    async batch(statements) {
      // No awaits inside the transaction: other requests cannot interleave.
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(s => ({results: s.rows()}));
        sqlite.exec('COMMIT'); return results;
      } catch (error) {sqlite.exec('ROLLBACK'); throw error;}
    },
    close: () => sqlite.close(),
  };
}
