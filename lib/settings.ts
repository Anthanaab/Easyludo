import db from "./db";
import { SOURCES } from "./sourcesMeta";

const get = (k: string) => (db.prepare("SELECT value FROM settings WHERE key = ?").get(k) as { value: string } | undefined)?.value;
export const setSetting = (k: string, v: string | null) =>
  v === null ? db.prepare("DELETE FROM settings WHERE key = ?").run(k)
             : db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(k, v);

// Identifiants : saisis dans les Paramètres, sinon variables d'environnement (.env.local)
export const cred = (name: string) => get("key." + name) || process.env[name] || "";
export const isEnabled = (id: string) => get("enabled." + id) !== "0";
export const hasKeys = (id: string) => (SOURCES.find((s) => s.id === id)?.keys ?? []).every((k) => !!cred(k.name));
export const isActive = (id: string) => isEnabled(id) && hasKeys(id);
