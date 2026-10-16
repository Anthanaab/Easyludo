// Configuration du HTTPS depuis l'interface : même principe que la mise à jour
// (l'app dépose un fichier-demande, systemd lance « easyludo-https --from-web » en root, l'état revient par un fichier).
import fs from "fs";
import path from "path";
import net from "net";
import { X509Certificate } from "crypto";
import { DATA_DIR } from "./db";

const UNIT = process.env.EASYLUDO_HTTPS_UNIT || "/etc/systemd/system/easyludo-https.path";
const TLS_DIR = process.env.EASYLUDO_TLS_DIR || "/etc/easyludo/tls";
const HTTPS_PORT = Number(process.env.EASYLUDO_HTTPS_PORT || 443);
const STATUS = path.join(DATA_DIR, "https-status.json");
const REQUEST = path.join(DATA_DIR, "https.request");
const STALE_MS = 15 * 60e3;

export type HttpsStatus = { state: "running" | "ok" | "error"; message: string; at: string };
export type CertInfo = { validTo: string; daysLeft: number; names: string[]; fingerprint: string };

export const supported = () => fs.existsSync(/*turbopackIgnore: true*/ UNIT);
const certFile = () => path.join(TLS_DIR, "cert.pem");

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
