// Mise à jour depuis l'interface : l'app (sans droits root) dépose un fichier-demande,
// systemd (easyludo-update.path) lance « update --from-web » en root et écrit l'état dans un fichier lu ici.
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { DATA_DIR } from "./db";

const UNIT = process.env.EASYLUDO_UPDATE_UNIT || "/etc/systemd/system/easyludo-update.path";
const CONF = process.env.EASYLUDO_CONF || "/etc/easyludo.conf";
const STATUS = path.join(DATA_DIR, "update-status.json");
const LOG = path.join(DATA_DIR, "update.log");
const REQUEST = path.join(DATA_DIR, "update.request");
const STALE_MS = 30 * 60e3;

export type Version = { sha: string; subject: string; date: string };
export type UpdateStatus = { state: "running" | "ok" | "error"; message: string; from: string; to: string; at: string };

// Disponible uniquement dans le conteneur installé par le script Proxmox
export const supported = () => fs.existsSync(/*turbopackIgnore: true*/ UNIT);

function conf() {
  const out: Record<string, string> = {};
  try {
    for (const l of fs.readFileSync(/*turbopackIgnore: true*/ CONF, "utf8").split("\n")) {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {}
  return { branch: out.EASYLUDO_BRANCH || "main" };
}

const git = (args: string[], timeout = 5000) =>
  new Promise<string>((resolve, reject) =>
    execFile("git", args, { cwd: process.cwd(), timeout }, (e, out, err) =>
      e ? reject(new Error((err || e.message).trim().split("\n").pop())) : resolve(out.trim())));

const parse = (out: string): Version => {
  const [sha, subject, date] = out.split("\n");
  return { sha, subject, date };
};

export async function current(): Promise<Version | null> {
  try { return parse(await git(["log", "-1", "--format=%H%n%s%n%cI"])); } catch { return null; }
}

// Même chemin que le script « update » (git fetch) : pas de limite d'API GitHub, même réseau que la mise à jour réelle.
let cache: { at: number; v: Version | null; error: string } | null = null;
export async function latest(): Promise<{ v: Version | null; error: string }> {
  if (cache && Date.now() - cache.at < 5 * 60e3 && cache.v) return { v: cache.v, error: "" };
  const { branch } = conf();
  try {
    await git(["fetch", "--quiet", "--depth", "1", "origin", branch], 20000);
    const v = parse(await git(["log", "-1", "--format=%H%n%s%n%cI", "FETCH_HEAD"]));
    cache = { at: Date.now(), v, error: "" };
    return { v, error: "" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    cache = { at: Date.now(), v: cache?.v ?? null, error };
    return { v: cache.v, error };
  }
}

export function status(): UpdateStatus | null {
  try {
    const s = JSON.parse(fs.readFileSync(STATUS, "utf8")) as UpdateStatus;
    // Un « running » vieux de plus de 30 min est un reste d'incident : on ne bloque pas de nouvelles demandes
    if (s.state === "running" && Date.now() - Date.parse(s.at) > STALE_MS) return { ...s, state: "error", message: "Mise à jour interrompue" };
    return s;
  } catch { return null; }
}

export function logTail(lines = 40) {
  try { return fs.readFileSync(LOG, "utf8").split("\n").slice(-lines).join("\n").trim(); } catch { return ""; }
}

// Dépose la demande ; systemd la détecte et lance la mise à jour en root.
export function request(): "ok" | "busy" {
  if (status()?.state === "running") return "busy";
  fs.writeFileSync(REQUEST, new Date().toISOString());
  return "ok";
}
