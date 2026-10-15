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
  return { repo: out.EASYLUDO_REPO ?? "", branch: out.EASYLUDO_BRANCH || "main" };
}

const git = (args: string[]) =>
  new Promise<string>((resolve, reject) =>
    execFile("git", args, { cwd: process.cwd(), timeout: 5000 }, (e, out) => (e ? reject(e) : resolve(out.trim()))));

export async function current(): Promise<Version | null> {
  try {
    const [sha, subject, date] = (await git(["log", "-1", "--format=%H%n%s%n%cI"])).split("\n");
    return { sha, subject, date };
  } catch { return null; }
}

let cache: { at: number; v: Version | null } | null = null;
export async function latest(): Promise<Version | null> {
  if (cache && Date.now() - cache.at < 5 * 60e3) return cache.v;
  const { repo, branch } = conf();
  if (!repo) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}`,
      { headers: { Accept: "application/vnd.github+json", "User-Agent": "EasyLudo" }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return cache?.v ?? null;
    const j = await r.json();
    const v = { sha: j.sha, subject: String(j.commit?.message ?? "").split("\n")[0], date: j.commit?.committer?.date ?? "" };
    cache = { at: Date.now(), v };
    return v;
  } catch { return cache?.v ?? null; }
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
