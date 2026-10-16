"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type St = { state: "running" | "ok" | "error"; message: string; at: string };
type Cert = { validTo: string; daysLeft: number; names: string[]; fingerprint: string; subject: string; issuer: string; custom: boolean };
type Info = { supported: boolean; viaUpdate?: boolean; listening?: boolean; cert?: Cert | null; status?: St | null; updateStatus?: St | null };

export default function HttpsPanel() {
  const [info, setInfo] = useState<Info | null>(null);
  const [phase, setPhase] = useState<"idle" | "waiting" | "done" | "moved">("idle");
  const [via, setVia] = useState<"https" | "update">("https");
  const [fails, setFails] = useState(0);
  const [err, setErr] = useState("");
  const [secure, setSecure] = useState(false);
  const [host, setHost] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [files, setFiles] = useState<{ cert?: File; key?: File }>({});
  const [busy, setBusy] = useState(false);
  const baseline = useRef<string | null>(null); // ancien horodatage d'état : on le compare, jamais l'horloge du navigateur

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/https", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const j: Info = await r.json();
      setInfo(j); setFails(0);
      return j;
    } catch { setFails((n) => n + 1); return null; }
  }, []);

  useEffect(() => { setSecure(window.isSecureContext && location.protocol === "https:"); setHost(location.hostname); load(); }, [load]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(via === "update" ? "/api/update" : "/api/https", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const j = await r.json();
        setFails(0);
        const s: St | null = j.status;
        if (s && s.at !== baseline.current && (s.state === "ok" || s.state === "error")) { setPhase("done"); load(); }
      } catch { setFails((n) => n + 1); }
    }, 2500);
    return () => clearInterval(t);
  }, [phase, via, load]);

  // Une fois le HTTPS actif, l'adresse HTTP directe est fermée : la page ne peut plus interroger le serveur
  useEffect(() => {
    if (phase === "waiting" && fails >= 3 && location.protocol === "http:") setPhase("moved");
  }, [fails, phase]);

  async function startSelfSigned() {
    if ((info?.cert) && !confirm("Remplacer le certificat actuel par un certificat auto-signé ? Les appareils qui avaient installé l'ancien devront installer le nouveau.")) return;
    setErr("");
    const cur = info?.viaUpdate ? "update" : "https";
    baseline.current = (cur === "update" ? info?.updateStatus : info?.status)?.at ?? null;
    const r = await fetch("/api/https", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? "Erreur");
    setVia(j.via === "update" ? "update" : "https");
    setFails(0); setPhase("waiting");
  }

  async function startImport() {
    if (!files.cert || !files.key) return;
    setBusy(true); setErr("");
    try {
      const [cert, key] = await Promise.all([files.cert.text(), files.key.text()]);
      baseline.current = info?.status?.at ?? null;
      const r = await fetch("/api/https/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cert, key }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j.error ?? "Erreur");
      else { setVia("https"); setFails(0); setPhase("waiting"); setShowImport(false); setFiles({}); }
    } catch { setErr("Fichier illisible"); }
    setBusy(false);
  }

  if (!info) return <section className="sec"><h3>🔒 HTTPS</h3><span className="hint">{fails ? "Indisponible pour le moment." : "Chargement…"}</span></section>;
  if (!info.supported && !info.viaUpdate)
    return <section className="sec"><h3>🔒 HTTPS</h3><span className="hint">La configuration du HTTPS depuis l'interface est disponible dans le conteneur Proxmox.</span></section>;

  const c = info.cert ?? null;
  const active = !!c && !!info.listening;
  const s = info.viaUpdate ? info.updateStatus : info.status;
  const waiting = phase === "waiting";
  const httpsUrl = `https://${host}`;

  return (
    <section className="sec">
      <h3>🔒 HTTPS <span className={`status ${active ? "ok" : "warn"}`}>{active ? "● Actif" : "Non actif"}</span></h3>
      <span className="hint">
        {active
          ? "Le site n'est accessible qu'en HTTPS : l'adresse HTTP directe (port 3000) est fermée. Le HTTPS est nécessaire pour la caméra en direct."
          : "Active le HTTPS : le site ne sera plus accessible qu'en HTTPS (obligatoire pour la caméra en direct). Un certificat auto-signé est créé automatiquement."}
      </span>

      {secure && <span className="good">✓ Tu es connecté en HTTPS.</span>}
      {!secure && active && <span className="hint">Tu es connecté en HTTP. Adresse HTTPS : <a href={httpsUrl}>{httpsUrl}</a></span>}

      {c && (
        <div className="quote">
          <b>{c.custom ? "Certificat importé" : "Certificat auto-signé"}</b>
          <span className="hint">Valable pour : {c.names.join(", ")}</span>
          {c.custom && <span className="hint">Émis par : {c.issuer}</span>}
          <span className={c.daysLeft < 30 ? "err" : "hint"}>Expire le {new Date(c.validTo).toLocaleDateString("fr-FR")} ({c.daysLeft} jours){c.daysLeft < 30 ? " : à renouveler" : ""}</span>
        </div>
      )}

      {waiting && (
        <div className="quote">
          <b>⏳ Configuration en cours…</b>
          <span className="hint">{s?.state === "running" ? s.message : "Démarrage…"}{via === "update" ? " (installation des services : quelques minutes)" : ""}</span>
        </div>
      )}
      {phase === "moved" && (
        <div className="quote">
          <b>🔒 L'accès HTTP vient d'être fermé</b>
          <span className="hint">Le site n'est plus accessible qu'en HTTPS. Ouvre <a href={httpsUrl}>{httpsUrl}</a> (avertissement du navigateur à accepter pour un certificat auto-signé : « Avancé » → « Continuer »), puis reviens dans Paramètres pour vérifier l'état.</span>
        </div>
      )}
      {phase === "done" && s && <b className={s.state === "ok" ? "good" : "err"}>{s.state === "ok" ? "✓ " : "✗ "}{s.message}</b>}
      {!waiting && phase === "idle" && s?.state === "error" && <span className="err">Dernière tentative : {s.message}</span>}
      {err && <span className="err">{err}</span>}

      {!waiting && phase !== "moved" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className={`btn ${active ? "" : "primary"}`} onClick={startSelfSigned}>🔐 Certificat auto-signé</button>
          {info.supported && <button className={`btn ${showImport ? "on" : ""}`} onClick={() => setShowImport((v) => !v)}>📥 Importer mon certificat</button>}
          {c && <a className="btn" href="/api/https/cert" download>⬇ Télécharger le certificat</a>}
          {active && !secure && <a className="btn primary" href={httpsUrl}>Ouvrir en HTTPS</a>}
        </div>
      )}

      {showImport && !waiting && (
        <div className="quote">
          <b>Importer un certificat existant</b>
          {!secure ? (
            <span className="err">Par sécurité, l'import n'est possible que depuis la version HTTPS du site (une clé privée ne doit pas circuler en HTTP).
              {active ? <> <a href={httpsUrl}>Ouvrir en HTTPS</a>.</> : " Active d'abord le HTTPS avec le certificat auto-signé."}</span>
          ) : (
            <>
              <span className="hint">Formats PEM : certificat (avec sa chaîne si besoin) et clé privée sans mot de passe (.crt / .pem / .key). Le certificat doit couvrir le nom ou l'adresse que tu utilises pour ouvrir le site.</span>
              <div><label>Certificat (.crt, .pem)</label><input type="file" accept=".crt,.pem,.cer,.txt" onChange={(e) => setFiles((f) => ({ ...f, cert: e.target.files?.[0] }))} /></div>
              <div><label>Clé privée (.key, .pem)</label><input type="file" accept=".key,.pem,.txt" onChange={(e) => setFiles((f) => ({ ...f, key: e.target.files?.[0] }))} /></div>
              <div><button className="btn primary" disabled={!files.cert || !files.key || busy} onClick={startImport}>{busy ? "Envoi…" : "Importer et activer"}</button></div>
            </>
          )}
        </div>
      )}

      {c && !c.custom && (
        <details>
          <summary className="hint" style={{ cursor: "pointer" }}>Supprimer l'avertissement sur un appareil</summary>
          <div className="hint" style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <span>Télécharge le certificat ci-dessus, puis installe-le comme certificat de confiance (la procédure varie selon l'appareil) :</span>
            <span><b>iPhone / iPad</b> : ouvrir le fichier → Réglages → « Profil téléchargé » → Installer ; puis Réglages → Général → Informations → Réglages des certificats → activer la confiance pour « EasyLudo ».</span>
            <span><b>Android</b> : Paramètres → Sécurité → Chiffrement et identifiants → Installer un certificat → Certificat d'autorité (CA).</span>
            <span><b>Mac / Windows</b> : double-clic sur le fichier, l'ajouter aux certificats de confiance (Trousseau d'accès : « Toujours approuver »).</span>
            <span>Si tu régénères le certificat, il faut recommencer. Avec un certificat importé (émis par une autorité reconnue), il n'y a aucun avertissement.</span>
          </div>
        </details>
      )}
    </section>
  );
}
