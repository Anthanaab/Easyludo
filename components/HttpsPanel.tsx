"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type St = { state: "running" | "ok" | "error"; message: string; at: string };
type Info = {
  supported: boolean; listening?: boolean; status?: St | null;
  cert?: { validTo: string; daysLeft: number; names: string[]; fingerprint: string } | null;
};

export default function HttpsPanel() {
  const [info, setInfo] = useState<Info | null>(null);
  const [phase, setPhase] = useState<"idle" | "waiting" | "done">("idle");
  const [offline, setOffline] = useState(false);
  const [err, setErr] = useState("");
  const [secure, setSecure] = useState(false);
  const [host, setHost] = useState("");
  const baseline = useRef<string | null>(null); // ancien horodatage d'état : on le compare, jamais l'horloge du navigateur

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/https", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const j: Info = await r.json();
      setInfo(j); setOffline(false);
      return j;
    } catch { setOffline(true); return null; }
  }, []);

  useEffect(() => { setSecure(window.isSecureContext && location.protocol === "https:"); setHost(location.hostname); load(); }, [load]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const t = setInterval(async () => {
      const j = await load();
      const s = j?.status;
      if (s && s.at !== baseline.current && (s.state === "ok" || s.state === "error")) setPhase("done");
    }, 2500);
    return () => clearInterval(t);
  }, [phase, load]);

  async function start(regen: boolean) {
    if (regen && !confirm("Régénérer le certificat ? Les appareils qui l'avaient installé devront installer le nouveau.")) return;
    setErr("");
    baseline.current = info?.status?.at ?? null;
    const r = await fetch("/api/https", { method: "POST" });
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? "Erreur");
    setPhase("waiting");
  }

  if (!info) return <section className="sec"><h3>🔒 HTTPS</h3><span className="hint">{offline ? "Indisponible pour le moment." : "Chargement…"}</span></section>;

  if (!info.supported)
    return (
      <section className="sec">
        <h3>🔒 HTTPS</h3>
        <span className="hint">La configuration du HTTPS depuis l'interface est disponible dans le conteneur Proxmox.
          Si c'est ton cas : dans le panneau « Mise à jour » ci-dessus, clique sur <b>Réappliquer la configuration</b>.</span>
      </section>
    );

  const active = !!info.cert && !!info.listening;
  const c = info.cert;
  const s = info.status;
  const running = phase === "waiting";
  const httpsUrl = `https://${host}`;

  return (
    <section className="sec">
      <h3>🔒 HTTPS <span className={`status ${active ? "ok" : "warn"}`}>{active ? "● Actif" : "Non actif"}</span></h3>
      <span className="hint">Le HTTPS est nécessaire pour utiliser la caméra en direct (scan du code-barres). Le certificat est auto-signé :
        le navigateur affiche un avertissement la première fois, tu peux le supprimer en installant le certificat sur l'appareil.</span>

      {secure && <span className="good">✓ Tu es connecté en HTTPS.</span>}
      {!secure && active && <span className="hint">Tu es connecté en HTTP. Adresse HTTPS : <a href={httpsUrl}>{httpsUrl}</a> (avertissement à accepter : « Avancé » → « Continuer »).</span>}

      {c && (
        <div className="quote">
          <b>Certificat</b>
          <span className="hint">Valable pour : {c.names.join(", ")}</span>
          <span className={c.daysLeft < 30 ? "err" : "hint"}>Expire le {new Date(c.validTo).toLocaleDateString("fr-FR")} ({c.daysLeft} jours){c.daysLeft < 30 ? " : à renouveler" : ""}</span>
        </div>
      )}

      {running && (
        <div className="quote">
          <b>⏳ Configuration en cours…</b>
          <span className="hint">{offline ? "Reconnexion…" : s?.state === "running" ? s.message : "Démarrage…"}</span>
        </div>
      )}
      {phase === "done" && s && <b className={s.state === "ok" ? "good" : "err"}>{s.state === "ok" ? "✓ " : "✗ "}{s.message}</b>}
      {!running && phase !== "done" && s?.state === "error" && <span className="err">Dernière tentative : {s.message}</span>}
      {err && <span className="err">{err}</span>}

      {!running && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!active
            ? <button className="btn primary" onClick={() => start(false)}>Activer le HTTPS</button>
            : <button className="btn" onClick={() => start(true)}>↻ Régénérer le certificat</button>}
          {c && <a className="btn" href="/api/https/cert" download>⬇ Télécharger le certificat</a>}
          {active && !secure && <a className="btn primary" href={httpsUrl}>Ouvrir en HTTPS</a>}
        </div>
      )}

      {c && (
        <details>
          <summary className="hint" style={{ cursor: "pointer" }}>Supprimer l'avertissement sur un appareil</summary>
          <div className="hint" style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <span>Télécharge le certificat ci-dessus, puis l'installer comme certificat de confiance (la procédure varie selon l'appareil) :</span>
            <span><b>iPhone / iPad</b> : ouvrir le fichier → Réglages → « Profil téléchargé » → Installer ; puis Réglages → Général → Informations → Réglages des certificats → activer la confiance pour « EasyLudo ».</span>
            <span><b>Android</b> : Paramètres → Sécurité → Chiffrement et identifiants → Installer un certificat → Certificat d'autorité (CA).</span>
            <span><b>Mac / Windows</b> : double-clic sur le fichier, l'ajouter aux certificats de confiance (Trousseau d'accès : « Toujours approuver »).</span>
            <span>Si tu régénères le certificat, il faut recommencer.</span>
          </div>
        </details>
      )}
    </section>
  );
}
