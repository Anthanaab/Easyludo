import Link from "next/link";
import type { Game } from "@/lib/db";
import { BRAND_COLOR, brandOf } from "@/lib/platforms";

export const eur = (n: number | null) => (n == null ? "—" : n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 }));
export const delta = (g: Game) => (g.market_price != null && g.purchase_price != null ? g.market_price - g.purchase_price : null);

export function Delta({ g }: { g: Game }) {
  const d = delta(g);
  if (d == null) return null;
  return <span className={`pill ${d >= 0 ? "good" : "bad"}`}>{d >= 0 ? "+" : "−"}{eur(Math.abs(d))}</span>;
}

export default function GameCard({ g }: { g: Game }) {
  const img = g.photo || g.cover_url;
  return (
    <Link href={`/games/${g.id}`} className="card">
      <div className="cover">
        {img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={g.title} loading="lazy" /> : <div className="noimg">🎮</div>}
        {g.platform && <span className="badge" style={{ background: BRAND_COLOR[brandOf(g.platform)] }}>{g.platform}</span>}
      </div>
      <div className="info">
        <div className="t">{g.title}</div>
        <div className="m">{[g.publisher, g.release_year].filter(Boolean).join(" · ") || "—"}</div>
        {g.condition && <div className="m">{g.condition}</div>}
        <div className="prices">
          <div><b>{eur(g.market_price)}</b><div className="m">payé {eur(g.purchase_price)}</div></div>
          <Delta g={g} />
        </div>
      </div>
    </Link>
  );
}
