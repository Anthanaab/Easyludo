import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export const DATA_DIR = process.env.EASYLUDO_DATA_DIR || path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "easyludo.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  barcode TEXT NOT NULL DEFAULT '',
  release_year INTEGER,
  cover_url TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  purchase_price REAL,
  market_price REAL,
  market_price_date TEXT,
  condition TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  price REAL NOT NULL, source TEXT NOT NULL DEFAULT 'manuel',
  at TEXT NOT NULL DEFAULT (datetime('now'))
);`);
db.pragma("foreign_keys = ON");

// Migration pour les bases créées avant l'ajout de l'éditeur
if (!(db.prepare("PRAGMA table_info(games)").all() as { name: string }[]).some((c) => c.name === "publisher"))
  db.exec("ALTER TABLE games ADD COLUMN publisher TEXT NOT NULL DEFAULT ''");

export type Game = {
  id: number; title: string; platform: string; publisher: string; barcode: string;
  release_year: number | null; cover_url: string; photo: string;
  purchase_price: number | null; market_price: number | null;
  market_price_date: string | null; condition: string; notes: string; created_at: string;
};

export const FIELDS = ["title","platform","publisher","barcode","release_year","cover_url","photo",
  "purchase_price","market_price","condition","notes"] as const;

export default db;

const TEXT_FIELDS = ["title","platform","publisher","barcode","cover_url","photo","condition","notes"];
export function normalize(b: Record<string, unknown>) {
  return FIELDS.map((f) => (b[f] === "" || b[f] == null ? (TEXT_FIELDS.includes(f) ? "" : null) : b[f]));
}
