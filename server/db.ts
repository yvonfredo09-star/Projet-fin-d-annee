import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEFAULT_KEYWORDS, DEFAULT_SOURCES } from './snapshotData.ts';

const DB_PATH = path.resolve(process.cwd(), 'veille.db');

export const db = new DatabaseSync(DB_PATH);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function initDatabase(): void {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Analyste Veille',
      organization TEXT NOT NULL DEFAULT 'Laboratoire R&D',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      default_domain TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'RSS',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_fetched_at TEXT,
      last_status TEXT NOT NULL DEFAULT 'En attente',
      item_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL UNIQUE,
      domain TEXT NOT NULL,
      weight INTEGER NOT NULL DEFAULT 2
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      original_url TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      published_at TEXT NOT NULL,
      collected_at TEXT NOT NULL,
      raw_excerpt TEXT NOT NULL,
      ai_summary TEXT NOT NULL,
      key_points_json TEXT NOT NULL,
      domain TEXT NOT NULL,
      opportunity_type TEXT NOT NULL,
      matched_keywords_json TEXT NOT NULL,
      relevance_score INTEGER NOT NULL,
      ai_engine TEXT NOT NULL,
      human_relevant INTEGER,
      summary_rating INTEGER,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      duplicate_of_id TEXT,
      dedup_method TEXT,
      similarity_score REAL
    );

    CREATE INDEX IF NOT EXISTS idx_items_canonical_url ON items(canonical_url);
    CREATE INDEX IF NOT EXISTS idx_items_content_hash ON items(content_hash);
    CREATE INDEX IF NOT EXISTS idx_items_domain ON items(domain);
    CREATE INDEX IF NOT EXISTS idx_items_is_duplicate ON items(is_duplicate);

    CREATE TABLE IF NOT EXISTS collection_runs (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      mode TEXT NOT NULL,
      sources_count INTEGER NOT NULL,
      raw_fetched INTEGER NOT NULL,
      duplicates_removed INTEGER NOT NULL,
      new_items INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      status TEXT NOT NULL,
      log_summary TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bulletins (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cadence TEXT NOT NULL,
      period_label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      item_ids_json TEXT NOT NULL,
      markdown_content TEXT NOT NULL,
      html_content TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default demo user if empty
  const userCountRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (userCountRow.cnt === 0) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, full_name, email, password_hash, role, organization, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'usr-demo-01',
      'Claire Moreau',
      'claire.moreau@vigielab.fr',
      hashPassword('VigieLab2026!'),
      'Responsable Veille R&D',
      'Cellule Veille R&D',
      now,
      now
    );
  }

  // Seed default sources if empty
  const sourceCountRow = db.prepare('SELECT COUNT(*) as cnt FROM sources').get() as { cnt: number };
  if (sourceCountRow.cnt === 0) {
    const insertSource = db.prepare(`
      INSERT INTO sources (id, name, url, default_domain, source_type, enabled, last_status, item_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `);
    for (const s of DEFAULT_SOURCES) {
      insertSource.run(s.id, s.name, s.url, s.defaultDomain, s.sourceType, s.enabled ? 1 : 0, 'Prêt');
    }
  }

  // Seed default keywords if empty
  const kwCountRow = db.prepare('SELECT COUNT(*) as cnt FROM keywords').get() as { cnt: number };
  if (kwCountRow.cnt === 0) {
    const insertKw = db.prepare('INSERT OR IGNORE INTO keywords (term, domain, weight) VALUES (?, ?, ?)');
    for (const kw of DEFAULT_KEYWORDS) {
      insertKw.run(kw.term, kw.domain, kw.weight);
    }
  }

  // Seed default settings
  const defaultSettings: Record<string, string> = {
    scheduleCadence: 'daily',
    dedupThreshold: '0.72',
    collectionMode: 'snapshot',
    ollamaEndpoint: 'http://localhost:11434',
    ollamaModel: 'mistral',
    preferLocalOllama: 'false',
  };
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }
}

export function getSettingsMap(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

