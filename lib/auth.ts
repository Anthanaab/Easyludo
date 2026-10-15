import crypto from "crypto";
import db from "./db";

const get = (k: string) => (db.prepare("SELECT value FROM settings WHERE key = ?").get(k) as { value: string } | undefined)?.value;
const put = (k: string, v: string) =>
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(k, v);

export const COOKIE = "easyludo_session";
export const SESSION_DAYS = 30;
export const MIN_PASSWORD = 8;

// Si EASYLUDO_PASSWORD est défini, il fait foi (pratique en hébergement). Sinon : mot de passe haché dans la base.
export const envPassword = () => process.env.EASYLUDO_PASSWORD || "";
export const hasPassword = () => !!envPassword() || !!get("auth.hash");

function secret() {
  let s = get("auth.secret");
  if (!s) { s = crypto.randomBytes(32).toString("hex"); put("auth.secret", s); }
  return s;
}
const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("hex");
const safeEqual = (a: string, b: string) => {
  const x = crypto.createHash("sha256").update(a).digest(), y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y);
};

export function verifyPassword(pw: string): boolean {
  if (envPassword()) return safeEqual(pw, envPassword());
  const stored = get("auth.hash");
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(pw, salt, 64).toString("hex");
  return safeEqual(test, hash);
}

// Change le mot de passe et invalide toutes les sessions ouvertes (rotation du secret)
export function setPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  put("auth.hash", `${salt}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`);
  put("auth.secret", crypto.randomBytes(32).toString("hex"));
}

export function makeToken(): string {
  const exp = String(Date.now() + SESSION_DAYS * 86400e3);
  return `${exp}.${sign(exp)}`;
}
export function checkToken(token: string | undefined): boolean {
  if (!token || !hasPassword()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

// Anti force brute : 5 échecs par IP => blocage 5 minutes (en mémoire)
const fails = new Map<string, { n: number; until: number }>();
export function throttled(ip: string) {
  const f = fails.get(ip);
  return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0;
}
export function recordFail(ip: string) {
  const f = fails.get(ip) ?? { n: 0, until: 0 };
  f.n += 1;
  if (f.n >= 5) { f.until = Date.now() + 5 * 60e3; f.n = 0; }
  fails.set(ip, f);
}
export const clearFails = (ip: string) => fails.delete(ip);
