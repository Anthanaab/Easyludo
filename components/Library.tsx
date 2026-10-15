"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Game } from "@/lib/db";
import { BRAND_COLOR, ITEM_TYPES, brandOfItem, itemLabel, kindOfItem } from "@/lib/platforms";
import GameCard, { Delta, eur } from "./GameCard";

type By = "type" | "brand" | "kind" | "platform" | "publisher";
type GroupBy = "" | By;
const LABEL: Record<By, string> = { type: "Type d'objet", brand: "Marque", kind: "Type de console", platform: "Console", publisher: "Éditeur" };
const keyOf = (g: Game, by: By) =>
  by === "type" ? itemLabel(g.item_type) : by === "brand" ? brandOfItem(g) : by === "kind" ? kindOfItem(g) : g[by] || "Non renseigné";

export default function Library({ games }: { games: Game[] }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<By, string>>({ type: "", brand: "", kind: "", platform: "", publisher: "" });
  const [sort, setSort] = useState("recent");
  const [groupBy, setGroupBy] = useState<GroupBy>("brand");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState(false);

  // Préférences d'affichage mémorisées sur cet appareil
  useEffect(() => {
    try {
      const v = localStorage.getItem("el.view"); if (v === "grid" || v === "list") setView(v);
      const g = localStorage.getItem("el.group"); if (g !== null) setGroupBy(g as GroupBy);
    } catch {}
  }, []);
  const pick = <T,>(set: (v: T) => void, key: string) => (v: T) => { set(v); try { localStorage.setItem(key, String(v)); } catch {} };

  const options = (by: By) => [...new Set(games.map((g) => keyOf(g, by)))].sort((a, b) => a.localeCompare(b));
  const activeFilters = (Object.keys(f) as By[]).filter((k) => f[k]);

  const shown = useMemo(() => {
    let l = games.filter((g) => activeFilters.every((k) => keyOf(g, k) === f[k]) &&
      (g.title + " " + g.barcode + " " + g.publisher + " " + g.platform).toLowerCase().includes(q.toLowerCase()));
    if (sort === "title") l = [...l].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "value") l = [...l].sort((a, b) => (b.market_price ?? 0) - (a.market_price ?? 0));
    if (sort === "gain") l = [...l].sort((a, b) => ((b.market_price ?? 0) - (b.purchase_price ?? 0)) - ((a.market_price ?? 0) - (a.purchase_price ?? 0)));
    if (sort === "year") l = [...l].sort((a, b) => (a.release_year ?? 9999) - (b.release_year ?? 9999));
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, q, f, sort]);

  const groups = useMemo(() => {
    if (!groupBy) return [["", shown] as [string, Game[]]];
    const m = new Map<string, Game[]>();
    for (const g of shown) m.set(keyOf(g, groupBy), [...(m.get(keyOf(g, groupBy)) ?? []), g]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [shown, groupBy]);

  const sum = (l: Game[], k: "purchase_price" | "market_price") => l.reduce((s, g) => s + (g[k] ?? 0), 0);
  const spent = sum(shown, "purchase_price"), value = sum(shown, "market_price"), gain = value - spent;

  if (!games.length)
    return (
      <div className="empty">
        <div className="big">🕹️</div>
        <h2>Ta ludothèque est vide</h2>
        <p className="hint">Ajoute ton premier jeu en scannant son code-barres ou en le cherchant par titre.</p>
        <Link href="/add" className="btn primary">+ Ajouter un jeu</Link>
      </div>
    );

  return (
    <>
      <div className="stats">
        <div className="stat"><b>{shown.length}</b><span>élément{shown.length > 1 ? "s" : ""}{shown.length !== games.length && ` sur ${games.length}`}</span></div>
        <div className="stat"><b>{eur(spent)}</b><span>total payé</span></div>
        <div className="stat"><b>{eur(value)}</b><span>valeur du marché</span></div>
        <div className="stat"><b className={gain >= 0 ? "good" : "bad"}>{gain >= 0 ? "+" : "−"}{eur(Math.abs(gain))}</b><span>plus-value</span></div>
      </div>

      <div className="toolbar">
        <div className="search"><span>🔍</span><input placeholder="Titre, éditeur, console, code-barres…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className={`btn ${open || activeFilters.length ? "on" : ""}`} onClick={() => setOpen(!open)}>⚙ Filtres{activeFilters.length ? ` (${activeFilters.length})` : ""}</button>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Tri">
          <option value="recent">Plus récents</option><option value="title">Titre A→Z</option><option value="year">Année ↑</option>
          <option value="value">Valeur ↓</option><option value="gain">Plus-value ↓</option>
        </select>
        <select value={groupBy} onChange={(e) => pick<GroupBy>(setGroupBy, "el.group")(e.target.value as GroupBy)} aria-label="Regroupement">
          <option value="">Sans regroupement</option>
          {(Object.keys(LABEL) as By[]).map((k) => <option key={k} value={k}>Grouper : {LABEL[k]}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Affichage">
          <button className={view === "grid" ? "on" : ""} onClick={() => pick(setView, "el.view")("grid")} title="Grille">▦</button>
          <button className={view === "list" ? "on" : ""} onClick={() => pick(setView, "el.view")("list")} title="Liste">☰</button>
        </div>
      </div>

      {open && (
        <div className="filters">
          {(Object.keys(LABEL) as By[]).map((k) => (
            <select key={k} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-label={LABEL[k]}>
              <option value="">{LABEL[k]} : toutes</option>
              {options(k).map((o) => <option key={o}>{o}</option>)}
            </select>
          ))}
        </div>
      )}
      {activeFilters.length > 0 && (
        <div className="chips">
          {activeFilters.map((k) => <button key={k} className="chip" onClick={() => setF({ ...f, [k]: "" })}>{LABEL[k]} : {f[k]} ✕</button>)}
          <button className="chip" style={{ background: "var(--soft)", color: "var(--muted)" }} onClick={() => setF({ type: "", brand: "", kind: "", platform: "", publisher: "" })}>Tout effacer</button>
        </div>
      )}

      {!shown.length && <div className="empty"><div className="big">🔎</div><p className="hint">Aucun jeu ne correspond à ta recherche.</p></div>}
      {groups.map(([name, list]) => (
        <section key={name} style={{ marginBottom: 26 }}>
          {groupBy && list.length > 0 && (
            <h3 className="grp">
              {groupBy === "brand" && <span className="dot" style={{ background: BRAND_COLOR[name] ?? "#888" }} />}
              {name}
              <span className="hint">{list.length} jeu{list.length > 1 ? "x" : ""} · payé {eur(sum(list, "purchase_price"))} · cote {eur(sum(list, "market_price"))}</span>
            </h3>
          )}
          {view === "grid" ? (
            <div className="grid">{list.map((g) => <GameCard key={g.id} g={g} />)}</div>
          ) : (
            <div className="list">
              {list.map((g) => (
                <Link key={g.id} href={`/games/${g.id}`} className="item">
                  <div className="th">{(g.photo || g.cover_url) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={g.photo || g.cover_url} alt="" loading="lazy" /> : "🎮"}</div>
                  <div><div className="t">{g.title}</div><div className="m">{[g.platform, g.publisher, g.release_year].filter(Boolean).join(" · ")}</div></div>
                  <div className="m hide-m">{g.condition || "—"}</div>
                  <div className="num hide-m m">payé {eur(g.purchase_price)}</div>
                  <div className="num"><b>{eur(g.market_price)}</b></div>
                  <div className="num hide-m"><Delta g={g} /></div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
