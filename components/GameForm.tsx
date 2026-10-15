"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/db";
import Scanner from "./Scanner";
import { PLATFORMS, brandOf, kindOf } from "@/lib/platforms";

type Cand = { title: string; platform: string; release_year: number | null; cover_url: string; publisher: string; source: string };
type F = Record<string, string>;

const empty: F = { title: "", platform: "", publisher: "", barcode: "", release_year: "", cover_url: "", photo: "",
  purchase_price: "", market_price: "", condition: "", notes: "" };
const CONDITIONS = ["", "Neuf scellé", "Complet (CIB)", "Boîte sans notice", "Cartouche/disque seul", "Abîmé"];

type Quote = { source: string; label: string; detail?: string; url?: string; values: { label: string; eur: number }[] };
type PriceRes = { quotes: Quote[]; links: { id: string; label: string; url: string }[]; asked: number };
type Hist = { price: number; source: string; at: string };

export default function GameForm({ game, history = [] }: { game?: Game; history?: Hist[] }) {
  const router = useRouter();
  const [f, setF] = useState<F>(() =>
    game ? Object.fromEntries(Object.keys(empty).map((k) => [k, String((game as any)[k] ?? "")])) : empty);
  const [scanning, setScanning] = useState(false);
  const [cands, setCands] = useState<Cand[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState<PriceRes | null>(null);
  const [priceSource, setPriceSource] = useState("");
  const [pricing, setPricing] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function lookup(params: Record<string, string>) {
    setBusy(true); setMsg(""); setCands([]);
    const j = await fetch("/api/lookup?" + new URLSearchParams(params)).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!j) return setMsg("Recherche impossible.");
    setCands(j.candidates);
    if (params.barcode && !j.rawTitle) setMsg("Code-barres inconnu : cherche par titre ci-dessous.");
    else if (!j.candidates.length) setMsg("Aucun résultat.");
    if (j.rawTitle && !f.title) set("title", j.rawTitle);
  }

  const onCode = useCallback((code: string) => {
    setScanning(false);
    setF((p) => ({ ...p, barcode: code }));
    lookup({ barcode: code, platform: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(c: Cand) {
    setF((p) => ({ ...p, title: c.title, platform: p.platform || c.platform.split(",")[0], publisher: c.publisher || p.publisher,
      release_year: String(c.release_year ?? ""), cover_url: c.cover_url }));
    setCands([]);
  }

  async function estimate() {
    setPricing(true); setPrices(null);
    const j = await fetch("/api/price?" + new URLSearchParams({ title: f.title, platform: f.platform, barcode: f.barcode, condition: f.condition }))
      .then((r) => r.json()).catch(() => null);
    setPricing(false); setPrices(j);
  }
  const usePrice = (eur: number, source: string) => { set("market_price", String(eur)); setPriceSource(source); };

  async function upload(file: File) {
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (j.url) set("photo", j.url); else setMsg(j.error ?? "Échec de l'envoi");
  }

  async function save() {
    if (!f.title.trim()) return setMsg("Le titre est requis.");
    setBusy(true);
    const r = await fetch(game ? `/api/games/${game.id}` : "/api/games", {
      method: game ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, price_source: priceSource }) });
    setBusy(false);
    if (!r.ok) return setMsg((await r.json()).error ?? "Erreur");
    router.push("/"); router.refresh();
  }

  async function remove() {
    if (!game || !confirm(`Supprimer « ${game.title} » ?`)) return;
    await fetch(`/api/games/${game.id}`, { method: "DELETE" });
    router.push("/"); router.refresh();
  }

  const img = f.photo || f.cover_url;
  const eurFmt = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const gain = f.market_price && f.purchase_price ? Number(f.market_price) - Number(f.purchase_price) : null;

  return (
    <div className="page">
      <h2>{game ? "Modifier le jeu" : "Ajouter un jeu"}</h2>

      <section className="sec">
        <h3><i>🔎</i>Identifier le jeu</h3>
        <div className="scanbox">
          <button className={`btn ${scanning ? "" : "primary"}`} style={{ justifyContent: "center", padding: 12 }} onClick={() => setScanning((s) => !s)}>
            {scanning ? "✕ Arrêter le scan" : "📷 Scanner le code-barres de la boîte"}
          </button>
          {scanning && <Scanner onCode={onCode} />}
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="…ou chercher par titre (ex : Zelda Ocarina of Time)" value={f.title} onChange={(e) => set("title", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup({ q: f.title, platform: f.platform })} />
            <button className="btn" onClick={() => lookup({ q: f.title, platform: f.platform })} disabled={busy || !f.title}>{busy ? "…" : "Chercher"}</button>
          </div>
          <span className="hint">Astuce : renseigne la plateforme avant de chercher pour obtenir la bonne jaquette.</span>
          {msg && <span className={/requis|Échec|impossible/.test(msg) ? "err" : "hint"}>{msg}</span>}
          <div className="cands">
            {cands.map((c, i) => (
              <button key={i} className="btn cand" onClick={() => pick(c)}>
                {c.cover_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.cover_url} alt="" /> : <span className="ph">🎮</span>}
                <span style={{ minWidth: 0 }}>
                  <b>{c.title}</b><br />
                  <span className="hint">{[c.platform, c.publisher, c.release_year].filter(Boolean).join(" · ")}</span>
                  <span className="src">{c.source}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <h3><i>📝</i>Informations</h3>
        <div className="split">
          <div className="photo">
            <div className="frame">{img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" /> : <div className="noimg">🎮</div>}</div>
            <label className="drop">📸 {f.photo ? "Changer ma photo" : "Ajouter ma photo"}
              <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {f.photo && <button className="btn small" onClick={() => set("photo", "")}>Retirer ma photo</button>}
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <div><label>Titre *</label><input value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
            <div className="row">
              <div>
                <label>Plateforme</label>
                <input list="platforms" value={f.platform} onChange={(e) => set("platform", e.target.value)} placeholder="Switch, PS2, Mega Drive…" />
                <datalist id="platforms">{PLATFORMS.map((p) => <option key={p.name} value={p.name} />)}</datalist>
                {f.platform && <span className="hint">{brandOf(f.platform)} · {kindOf(f.platform)}</span>}
              </div>
              <div><label>Éditeur</label><input value={f.publisher} onChange={(e) => set("publisher", e.target.value)} placeholder="Nintendo, Capcom…" /></div>
            </div>
            <div className="row">
              <div><label>Année de sortie</label><input value={f.release_year} onChange={(e) => set("release_year", e.target.value)} inputMode="numeric" /></div>
              <div><label>Code-barres</label><input value={f.barcode} onChange={(e) => set("barcode", e.target.value)} inputMode="numeric" /></div>
            </div>
            <div>
              <label>État</label>
              <select value={f.condition} onChange={(e) => set("condition", e.target.value)}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c || "— Non précisé —"}</option>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <h3><i>💶</i>Prix {gain != null && <span className={`pill ${gain >= 0 ? "good" : "bad"}`}>{gain >= 0 ? "+" : "−"}{eurFmt(Math.abs(gain))}</span>}</h3>
        <div className="row">
          <div><label>Prix d'achat (€)</label><input value={f.purchase_price} onChange={(e) => set("purchase_price", e.target.value.replace(",", "."))} inputMode="decimal" placeholder="0.00" /></div>
          <div>
            <label>Prix du marché (€)</label>
            <input value={f.market_price} onChange={(e) => set("market_price", e.target.value.replace(",", "."))} inputMode="decimal" placeholder="0.00" />
            {game?.market_price_date && <span className="hint">Mis à jour le {game.market_price_date.slice(0, 10)}</span>}
          </div>
        </div>
        <div>
          <button className="btn" onClick={estimate} disabled={pricing || !f.title}>{pricing ? "Recherche des prix…" : "💶 Estimer le prix du marché"}</button>
        </div>
        {prices && (
          <div style={{ display: "grid", gap: 8 }}>
            {prices.quotes.map((q) => (
              <div key={q.source} className="quote">
                <b>{q.label}</b>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {q.values.map((v) => (
                    <button key={v.label} className="btn small" onClick={() => usePrice(v.eur, q.label)}>{v.label} : <b>{eurFmt(v.eur)}</b></button>
                  ))}
                </div>
                {q.detail && <span className="hint">{q.detail}</span>}
              </div>
            ))}
            {!prices.quotes.length && <span className="hint">
              {prices.asked ? "Aucun prix trouvé par les sources actives." : <>Aucune source de prix automatique active. <a href="/settings">Ajouter une clé PriceCharting ou eBay</a>.</>}</span>}
            {!!prices.links.length && <div className="hint">Vérifier à la main :{" "}
              {prices.links.map((l, i) => <span key={l.id}>{i > 0 && " · "}<a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></span>)}</div>}
          </div>
        )}
        {history.length > 0 && (
          <div><label>Historique de la cote</label>
            <div className="hist">{history.map((h, i) => <span key={i}>{h.at.slice(0, 10)} · <b>{h.price} €</b> · {h.source}</span>)}</div></div>
        )}
      </section>

      <section className="sec">
        <h3><i>🗒️</i>Notes</h3>
        <textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Édition, version, défauts, souvenirs…" />
      </section>

      <div className="actions">
        <div>{game && <button className="btn danger" onClick={remove}>🗑 Supprimer</button>}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => router.push("/")}>Annuler</button>
          <button className="btn primary" onClick={save} disabled={busy}>{busy ? "…" : game ? "Enregistrer" : "Ajouter à la ludothèque"}</button>
        </div>
      </div>
    </div>
  );
}
