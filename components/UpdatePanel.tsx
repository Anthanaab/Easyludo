"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type V = { sha: string; subject: string; date: string };
type St = { state: "running" | "ok" | "error"; message: string; from: string; to: string; at: string };
type Info = { supported: boolean; current: V | null; latest: V | null; updateAvailable: boolean; status: St | null; log: string };

const short = (v: V | null) => (v ? v.sha.slice(0, 7) : "?");
const day = (v: V | null) => (v?.date ? new Date(v.date).toLocaleDateString("fr-FR") : "");

export default function UpdatePanel() {
  const [info, setInfo] = useState<Info | null>(null);
  const [phase, setPhase] = useState<"idle" | "waiting" | "done">("idle");
  const [offline, setOffline] = useState(false);
  const [err, setErr] = useState("");
  const baseline = useRef<string | null>(null); // horodatage de l'ancien état : on le compare, jamais l'horloge du navigateur

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/update", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setInfo(await r.json()); setOffline(false);
    } catch { setOffline(true); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pendant la mise à jour : l'app redémarre, on continue d'interroger jusqu'à son retour
  useEffect(() => {
    if (phase !== "waiting") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/update", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const j: Info = await r.json();
        setInfo(j); setOffline(false);
        const s = j.status;
        if (s && s.at !== baseline.current && (s.state === "ok" || s.state === "error")) {
          setPhase("done");
          if (s.state === "ok") setTimeout(() => window.location.reload(), 2500);
        }
      } catch { setOffline(true); }
    }, 3000);
    return () => clearInterval(t);
  }, [phase]);

  async function start() {
    if (!confirm("Mettre à jour EasyLudo ? L'application sera indisponible quelques minutes (une sauvegarde est faite avant).")) return;
    setErr("");
    baseline.current = info?.status?.at ?? null;
    const r = await fetch("/api/update", { method: "POST" });
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? "Erreur");
    setPhase("waiting");
  }

  if (!info) return <section className="sec"><h3>⬆️ Mise à jour</h3><span className="hint">{offline ? "Indisponible pour le moment." : "Chargement…"}</span></section>;

  if (!info.supported)
    return (
      <section className="sec">
        <h3>⬆️ Mise à jour</h3>
        <span className="hint">La mise à jour depuis l'interface est disponible dans le conteneur Proxmox. Si c'est ton cas et que ce message s'affiche,
          lance <code>update</code> une première fois dans le conteneur pour l'activer.</span>
      </section>
    );

  const s = info.status;
  const running = phase === "waiting";
  return (
    <section className="sec">
      <h3>⬆️ Mise à jour</h3>
      <div className="row">
        <div><label>Version installée</label><b>{short(info.current)}</b> <span className="hint">{day(info.current)}</span>
          <div className="hint">{info.current?.subject}</div></div>
        <div><label>Dernière version disponible</label><b>{short(info.latest)}</b> <span className="hint">{day(info.latest)}</span>
          <div className="hint">{info.latest?.subject ?? "Impossible de contacter GitHub pour le moment."}</div></div>
      </div>

      {running && (
        <div className="quote">
          <b>⏳ Mise à jour en cours…</b>
          <span className="hint">{offline ? "L'application redémarre, reconnexion automatique…" : s?.state === "running" ? s.message : "Démarrage…"}</span>
          <span className="hint">Ne ferme pas cette page : elle se rechargera toute seule à la fin.</span>
        </div>
      )}
      {phase === "done" && s && (
        <div className="quote">
          <b className={s.state === "ok" ? "good" : "err"}>{s.state === "ok" ? "✓ " : "✗ "}{s.message}</b>
          {s.state === "ok" && <span className="hint">Rechargement…</span>}
          {s.state === "error" && info.log && <pre className="hint" style={{ whiteSpace: "pre-wrap", margin: 0, maxHeight: 220, overflow: "auto" }}>{info.log}</pre>}
        </div>
      )}
      {!running && phase !== "done" && s?.state === "error" && <span className="err">Dernière tentative : {s.message}</span>}
      {err && <span className="err">{err}</span>}

      {!running && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn primary" onClick={start} disabled={!info.updateAvailable}>
            {info.updateAvailable ? "Mettre à jour maintenant" : "✓ À jour"}
          </button>
          <button className="btn small" onClick={load}>Vérifier</button>
          <span className="hint">Une sauvegarde est faite avant ; retour automatique à la version précédente si la compilation échoue.</span>
        </div>
      )}
    </section>
  );
}
