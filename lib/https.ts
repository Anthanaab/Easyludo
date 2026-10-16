// Configuration du HTTPS depuis l'interface : même principe que la mise à jour
// (l'app dépose un fichier-demande, systemd lance « easyludo-https --from-web » en root, l'état revient par un fichier).
import fs from "fs";
import path from "path";
import net from "net";
import { X509Certificate, createPrivateKey } from "crypto";
import { DATA_DIR } from "./db";
import * as updater from "./updater";

const UNIT = process.env.EASYLUDO_HTTPS_UNIT || "/etc/systemd/system/easyludo-https.path";
const TLS_DIR = process.env.EASYLUDO_TLS_DIR || "/etc/easyludo/tls";
const HTTPS_PORT = Number(process.env.EASYLUDO_HTTPS_PORT || 443);
const STATUS = path.join(DATA_DIR, "https-status.json");
const REQUEST = path.join(DATA_DIR, "https.request");
const IMPORT_DIR = path.join(DATA_DIR, "tls-import");
const STALE_MS = 15 * 60e3;

export type HttpsStatus = { state: "running" | "ok" | "error"; message: string; at: string };
export type CertInfo = { validTo: string; daysLeft: number; names: string[]; fingerprint: string; subject: string; issuer: string; custom: boolean };

export const supported = () => fs.existsSync(/*turbopackIgnore: true*/ UNIT);
const certFile = () => path.join(TLS_DIR, "cert.pem");

function modeFile() {
  try { return fs.readFileSync(/*turbopackIgnore: true*/ path.join(TLS_DIR, "mode"), "utf8").trim(); } catch { return "selfsigned"; }
}

export function certPem(): Buffer | null {
  try { return fs.readFileSync(/*turbopackIgnore: true*/ certFile()); } catch { return null; }
}

export function certInfo(): CertInfo | null {
  const pem = certPem();
  if (!pem) return null;
  try {
    const c = new X509Certificate(pem);
    const end = new Date(c.validTo);
    return {
      validTo: end.toISOString(),
      daysLeft: Math.floor((end.getTime() - Date.now()) / 86400e3),
      names: (c.subjectAltName ?? "").split(",").map((s) => s.trim().replace(/^(DNS|IP Address):/, "")).filter(Boolean),
      fingerprint: c.fingerprint256,
      subject: c.subject.replace(/\n/g, ", "),
      issuer: c.issuer.replace(/\n/g, ", "),
      custom: modeFile() === "custom",
    };
  } catch { return null; }
}

// Caddy répond-il sur le port HTTPS ? (test TCP local, sans vérifier le certificat)
export const listening = () =>
  new Promise<boolean>((resolve) => {
    const s = net.connect({ host: "127.0.0.1", port: HTTPS_PORT, timeout: 1500 });
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("timeout", () => { s.destroy(); resolve(false); });
    s.once("error", () => resolve(false));
  });

export function status(): HttpsStatus | null {
  try {
    const s = JSON.parse(fs.readFileSync(STATUS, "utf8")) as HttpsStatus;
    if (s.state === "running" && Date.now() - Date.parse(s.at) > STALE_MS) return { ...s, state: "error", message: "Configuration interrompue" };
    return s;
  } catch { return null; }
}

export function request(): "ok" | "busy" {
  if (status()?.state === "running") return "busy";
  fs.writeFileSync(REQUEST, new Date().toISOString());
  return "ok";
}

// Si les services HTTPS ne sont pas encore installés (conteneur plus ancien), la demande passe par la mise à jour,
// dont le script les installe puis configure le HTTPS.
export const viaUpdateSupported = () => !supported() && updater.supported();
export const updateStatus = () => updater.status();

export function requestSelfSigned(): "ok" | "busy" | "via-update" | "via-update-busy" | "unsupported" {
  if (supported()) return request();
  if (updater.supported()) return updater.request() === "busy" ? "via-update-busy" : "via-update";
  return "unsupported";
}

// Import d'un certificat personnel : on valide ici (lisible, non expiré, clé qui correspond), puis le script root le réinstalle.
export function stageImport(certText: string, keyText: string): { error?: string } {
  if (certText.length > 100_000 || keyText.length > 20_000) return { error: "Fichier trop volumineux" };
  if (!/-----BEGIN CERTIFICATE-----/.test(certText)) return { error: "Le certificat doit être au format PEM (-----BEGIN CERTIFICATE-----)" };
  if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(keyText)) return { error: "La clé privée doit être au format PEM (-----BEGIN PRIVATE KEY-----)" };
  if (/ENCRYPTED/.test(keyText)) return { error: "Clé privée protégée par mot de passe : non supportée (retire le mot de passe)" };
  let cert: X509Certificate;
  try { cert = new X509Certificate(certText); } catch { return { error: "Certificat illisible" }; }
  if (new Date(cert.validTo).getTime() < Date.now()) return { error: "Ce certificat est expiré" };
  try {
    if (!cert.checkPrivateKey(createPrivateKey(keyText))) return { error: "La clé privée ne correspond pas à ce certificat" };
  } catch { return { error: "Clé privée illisible" }; }
  if (status()?.state === "running") return { error: "Une configuration est déjà en cours" };
  fs.rmSync(/*turbopackIgnore: true*/ IMPORT_DIR, { recursive: true, force: true });
  fs.mkdirSync(/*turbopackIgnore: true*/ IMPORT_DIR, { mode: 0o700 });
  fs.writeFileSync(path.join(IMPORT_DIR, "cert.pem"), certText.trim() + "\n", { mode: 0o600 });
  fs.writeFileSync(path.join(IMPORT_DIR, "key.pem"), keyText.trim() + "\n", { mode: 0o600 });
  fs.writeFileSync(REQUEST, new Date().toISOString());
  return {};
}
