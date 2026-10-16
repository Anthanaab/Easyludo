"use client";
import { useEffect, useState } from "react";
import { SOURCES } from "@/lib/sourcesMeta";
import UpdatePanel from "./UpdatePanel";
import HttpsPanel from "./HttpsPanel";

type State = { id: string; enabled: boolean; keysOk: boolean; keys: { name: string; set: boolean }[] };

export default function SettingsForm() {
  const [state, setState] = useState<State[]>([]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [pwd, setPwd] = useState({ current: "", next: "" });
  const [pwdMsg, setPwdMsg] = useState("");

  const load = () => fetch("/api/settings").then((r) => r.json()).then((j) => setState(j.sources));
  useEffect(() => { load(); }, []);

  async function send(body: object, done = "Enregistré ✓") {
    const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setMsg(r.ok ? done : "Erreur d'enregistrement");
    await load();
  }
  const toggle = (id: string, enabled: boolean) => send({ enabled: { [id]: enabled } });
  const saveKeys = async (names: string[]) => {
    await send({ keys: Object.fromEntries(names.map((n) => [n, keys[n] ?? ""])) }, "Clé enregistrée ✓");
    setKeys((k) => Object.fromEntries(Object.entries(k).filter(([n]) => !names.includes(n))));
  };

  async function changePassword() {
    const r = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pwd) });
    const j = await r.json().catch(() => ({}));
    setPwdMsg(r.ok ? "Mot de passe modifié ✓ (les autres appareils sont déconnectés)" : j.error ?? "Erreur");
    if (r.ok) setPwd({ current: "", next: "" });
  }

  if (!state.length) return <p className="hint">Chargement…</p>;
  const groups = [...new Set(SOURCES.map((s) => s.group))];
  return (
    <div className="page">
      <div>
        <h2>Paramètres des sources</h2>
        <span className="hint">Active ou désactive chaque source. Une source avec clé n'est utilisée que si la clé est renseignée. </span>
        {msg && <b className="good">{msg}</b>}
      </div>
      {groups.map((g) => (
        <section key={g} className="sec">
          <h3>{g}</h3>
          {SOURCES.filter((s) => s.group === g).map((s) => {
            const st = state.find((x) => x.id === s.id)!;
            const keySet = (n: string) => st.keys.find((x) => x.name === n)?.set;
            return (
              <div key={s.id} className="src-card" style={{ opacity: st.enabled ? 1 : 0.6 }}>
                <div className="src-head">
                  <label className="switch" aria-label={s.label}>
                    <input type="checkbox" checked={st.enabled} onChange={(e) => toggle(s.id, e.target.checked)} /><i />
                  </label>
                  <div className="grow">
                    <b style={{ color: "var(--text)" }}>{s.label}</b>
                    <span className="hint">{s.desc}{s.help && <> · <a href={s.help} target="_blank" rel="noreferrer">obtenir une clé</a></>}</span>
                  </div>
                  <span className={`status ${!st.enabled ? "" : st.keysOk ? "ok" : "warn"}`}>
                    {!st.enabled ? "Désactivée" : st.keysOk ? "● Active" : "Clé manquante"}
                  </span>
                </div>
                {s.keys.map((k) => (
                  <div key={k.name}>
                    <label>{k.label} {keySet(k.name) && <span className="good">✓ renseignée</span>}</label>
                    <input type="password" autoComplete="off" placeholder={keySet(k.name) ? "•••••••• (laisser vide pour conserver)" : "Coller la clé ici"}
                      value={keys[k.name] ?? ""} onChange={(e) => setKeys({ ...keys, [k.name]: e.target.value })} />
                  </div>
                ))}
                {s.keys.length > 0 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn primary small" disabled={!s.keys.some((k) => keys[k.name]?.trim())} onClick={() => saveKeys(s.keys.map((k) => k.name))}>Enregistrer</button>
                    {s.keys.some((k) => keySet(k.name)) &&
                      <button className="btn danger small" onClick={() => send({ keys: Object.fromEntries(s.keys.map((k) => [k.name, null])) }, "Clé supprimée")}>Supprimer la clé</button>}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
      <section className="sec">
        <h3>📤 Données</h3>
        <span className="hint">Télécharge toute la collection au format CSV (s'ouvre dans Excel, Numbers ou LibreOffice) : titres, prix, plus-value, états, notes.</span>
        <div><a className="btn" href="/api/export" download>⬇ Exporter la collection (CSV)</a></div>
      </section>
      <UpdatePanel />
      <HttpsPanel />
      <section className="sec">
        <h3>🔒 Sécurité</h3>
        <div className="row">
          <div><label>Mot de passe actuel</label><input type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} /></div>
          <div><label>Nouveau mot de passe (8 caractères min.)</label><input type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} /></div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn primary small" disabled={!pwd.current || pwd.next.length < 8} onClick={changePassword}>Changer le mot de passe</button>
          {pwdMsg && <span className={pwdMsg.includes("✓") ? "good" : "err"}>{pwdMsg}</span>}
        </div>
      </section>
    </div>
  );
}
