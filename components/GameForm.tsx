"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/db";
import Scanner from "./Scanner";
import PhotoScan from "./PhotoScan";
import { ARCADE_SYSTEMS, CABINET_CONDITIONS, ITEM_TYPES, PLATFORMS, brandOfItem, isCabinet, kindOfItem } from "@/lib/platforms";

type Cand = { title: string; platform: string; release_year: number | null; cover_url: string; publisher: string; source: string };
type F = Record<string, string>;

const empty: F = { title: "", item_type: "game", platform: "", publisher: "", barcode: "", release_year: "", cover_url: "", photo: "",
  purchase_price: "", market_price: "", condition: "", notes: "" };
const CONDITIONS = ["", "Neuf scellé", "Complet (CIB)", "Boîte sans notice", "Cartouche/disque seul", "Abîmé"];

type Quote = { source: string; label: string; detail?: string; url?: string; values: { label: string; eur: number }[] };
type PriceRes = { quotes: Quote[]; links: { id: string; label: string; url: string }[]; asked: number; manual?: boolean };
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
  // Le flux caméra en direct n'est autorisé qu'en HTTPS (ou localhost) ; la photo fonctionne partout
  const [secure, setSecure] = useState(true);
  useEffect(() => setSecure(window.isSecureContext), []);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const [owned, setOwned] = useState<{ id: number; title: string; platform: string }[]>([]);

  const BARCODE_MSG: Record<string, string> = {
    unknown: "Code-barres lu, mais absent des bases consultées (surtout les codes européens). Saisis le titre : le code sera mémorisé et reconnu la prochaine fois.",
    rate_limited: "Limite quotidienne du service de code-barres atteinte (environ 100 par jour). Saisis le titre, ou réessaie demain.",
    error: "Service de code-barres injoignable pour le moment. Saisis le titre ci-dessous.",
    no_source: "Aucune source de code-barres n'est active (Paramètres). Saisis le titre ci-dessous.",
  };

  async function lookup(params: Record<string, string>) {
    setBusy(true); setMsg(""); setCands([]); setOwned([]);
    const j = await fetch("/api/lookup?" + new URLSearchParams(params)).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!j || j.error) return setMsg("Recherche impossible.");
    setCands(j.candidates);
    if (!params.barcode) { if (!j.candidates.length) setMsg("Aucun résultat."); return; }
    // Scan : la fiche se remplit toute seule avec le meilleur résultat (en ajout ; en modification on propose seulement)
    setOwned(j.barcode?.owned ?? []);
    if (j.candidates.length) {
      if (!game) pick(j.candidates[0], true);
      setMsg(game ? "Résultats pour ce code-barres : choisis le bon." : `✓ Trouvé (${j.candidates[0].source}) : vérifie les informations ci-dessous.${j.candidates.length > 1 ? " D'autres résultats sont possibles." : ""}`);
    } else setMsg(BARCODE_MSG[j.barcode?.status ?? "unknown"]);
  }

  const onCode = useCallback((code: string) => {
    setScanning(false);
    setF((p) => ({ ...p, barcode: code }));
    lookup({ barcode: code, platform: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(c: Cand, keepList = false) {
    setF((p) => ({ ...p, title: c.title, platform: p.platform || c.platform.split(",")[0], publisher: c.publisher || p.publisher,
      release_year: String(c.release_year ?? ""), cover_url: c.cover_url }));
    if (!keepList) setCands([]);
  }

  async function estimate() {
    setPricing(true); setPrices(null);
    const j = await fetch("/api/price?" + new URLSearchParams({ title: f.title, platform: f.platform, barcode: f.barcode, condition: f.condition, item_type: f.item_type }))
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

  const cab = isCabinet(f.item_type);
  const conditions = cab ? ["", ...CABINET_CONDITIONS] : CONDITIONS;
  const img = f.photo || f.cover_url;
  const eurFmt = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const gain = f.market_price && f.purchase_price ? Number(f.market_price) - Number(f.purchase_price) : null;

  return (
    <div className="page">
      <h2>{game ? "Modifier la fiche" : "Ajouter à la ludothèque"}</h2>

      <div className="seg types" role="group" aria-label="Type d'objet">
        {ITEM_TYPES.map((t) => (
          <button key={t.id} className={f.item_type === t.id ? "on" : ""} onClick={() => { set("item_type", t.id); setScanning(false); }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <section className="sec">
        <h3><i>🔎</i>{cab ? "Identifier la borne" : "Identifier le jeu"}</h3>
        <div className="scanbox">
          {!cab && (
            <div style={{ display: "grid", gap: 8 }}>
              {secure && (
                <button className={`btn ${scanning ? "" : "primary"}`} style={{ justifyContent: "center", padding: 12 }} onClick={() => setScanning((s) => !s)}>
                  {scanning ? "✕ Arrêter le scan" : "📷 Scanner le code-barres en direct"}
                </button>
              )}
              {scanning && secure && <Scanner onCode={onCode} />}
              {!scanning && <PhotoScan onCode={onCode} primary={!secure} />}
              {!secure && <span className="hint">Le scan en direct demande une connexion HTTPS, non disponible ici : la photo du code-barres fonctionne dans tous les cas.</span>}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder={cab ? "Chercher le jeu de la borne (ex : Street Fighter II)" : "…ou chercher par titre (ex : Zelda Ocarina of Time)"} value={f.title} onChange={(e) => set("title", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup({ q: f.title, platform: f.platform })} />
            <button className="btn" onClick={() => lookup({ q: f.title, platform: f.platform })} disabled={busy || !f.title}>{busy ? "…" : "Chercher"}</button>
          </div>
          {!cab && <span className="hint">Astuce : renseigne la plateforme avant de chercher pour obtenir la bonne jaquette.</span>}
          {msg && <span className={/requis|Échec|impossible/.test(msg) ? "err" : msg.startsWith("✓") ? "good" : "hint"}>{msg}</span>}
          {owned.length > 0 && (
            <span className="quote">
              <b>⚠ Déjà dans ta ludothèque</b>
              <span className="hint">{owned.map((o, i) => <span key={o.id}>{i > 0 && " · "}<a href={`/games/${o.id}`}>{o.title}{o.platform ? ` (${o.platform})` : ""}</a></span>)} — tu peux quand même ajouter un autre exemplaire.</span>
            </span>
          )}
          {cands.length > 1 && !!f.title && <span className="hint">Autres résultats possibles (clique pour remplacer) :</span>}
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
            <div className="frame">{img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" /> : <div className="noimg">{f.item_type === "arcade" ? "🕹️" : f.item_type === "demo" ? "📺" : "🎮"}</div>}</div>
            <label className="drop">📸 {f.photo ? "Changer ma photo" : "Ajouter ma photo"}
              <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {f.photo && <button className="btn small" onClick={() => set("photo", "")}>Retirer ma photo</button>}
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <div><label>{cab ? "Nom de la borne / du jeu *" : "Titre *"}</label><input value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
            <div className="row">
              <div>
                <label>{f.item_type === "arcade" ? "Système / carte" : f.item_type === "demo" ? "Console de la borne" : "Plateforme"}</label>
                <input list="platforms" value={f.platform} onChange={(e) => set("platform", e.target.value)}
                  placeholder={f.item_type === "arcade" ? "Neo Geo MVS, CPS-2, JAMMA…" : "Switch, PS2, Mega Drive…"} />
                <datalist id="platforms">{(f.item_type === "arcade" ? ARCADE_SYSTEMS : PLATFORMS.map((p) => p.name)).map((n) => <option key={n} value={n} />)}</datalist>
                {(f.platform || cab) && <span className="hint">{brandOfItem(f as any)} · {kindOfItem(f as any)}</span>}
              </div>
              <div><label>{cab ? "Constructeur / éditeur" : "Éditeur"}</label><input value={f.publisher} onChange={(e) => set("publisher", e.target.value)} placeholder={cab ? "Taito, Capcom, SNK, Sega…" : "Nintendo, Capcom…"} /></div>
            </div>
            <div className="row">
              <div><label>Année de sortie</label><input value={f.release_year} onChange={(e) => set("release_year", e.target.value)} inputMode="numeric" /></div>
              {!cab ? <div><label>Code-barres</label><input value={f.barcode} onChange={(e) => set("barcode", e.target.value)} inputMode="numeric" /></div> : <div />}
            </div>
            <div>
              <label>{cab ? "État de fonctionnement" : "État"}</label>
              <select value={f.condition} onChange={(e) => set("condition", e.target.value)}>
                {conditions.map((c) => <option key={c} value={c}>{c || "— Non précisé —"}</option>)}
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
          <button className="btn" onClick={estimate} disabled={pricing || !f.title}>{pricing ? "Recherche des prix…" : cab ? "🔎 Chercher des annonces" : "💶 Estimer le prix du marché"}</button>
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
            {!prices.quotes.length && !prices.manual && <span className="hint">
              {prices.asked ? "Aucun prix trouvé par les sources actives." : <>Aucune source de prix automatique active. <a href="/settings">Ajouter une clé PriceCharting ou eBay</a>.</>}</span>}
            {!!prices.links.length && <div className="hint">{prices.manual ? "Pas de cote automatique pour les bornes, compare les annonces :" : "Vérifier à la main :"}{" "}
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
        <textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder={cab ? "Dimensions, écran (CRT/LCD), nombre de joueurs, jeux installés, historique…" : "Édition, version, défauts, souvenirs…"} />
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
