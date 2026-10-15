"use client";
import { useState } from "react";

export default function LoginForm({ setup, next }: { setup: boolean; next: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (setup && pw !== pw2) return setErr("Les deux mots de passe ne correspondent pas.");
    setBusy(true); setErr("");
    const r = await fetch(setup ? "/api/auth/setup" : "/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok) { window.location.href = next; return; }
    setBusy(false);
    setErr((await r.json().catch(() => ({}))).error ?? "Erreur");
  }

  return (
    <form onSubmit={submit} className="sec" style={{ maxWidth: 400, margin: "8vh auto 0" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>🎮</div>
        <h2 style={{ margin: "4px 0" }}>{setup ? "Créer le mot de passe" : "Connexion"}</h2>
        <span className="hint">{setup ? "Premier lancement : choisis le mot de passe qui protégera la ludothèque." : "Entre le mot de passe pour accéder à la ludothèque."}</span>
      </div>
      <div><label>Mot de passe</label>
        <input type="password" autoFocus autoComplete={setup ? "new-password" : "current-password"} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      {setup && <div><label>Confirmer (8 caractères minimum)</label>
        <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>}
      {err && <span className="err">{err}</span>}
      <button className="btn primary" style={{ justifyContent: "center", padding: 12 }} disabled={busy || !pw}>{busy ? "…" : setup ? "Créer et entrer" : "Se connecter"}</button>
    </form>
  );
}
