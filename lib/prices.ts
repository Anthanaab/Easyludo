// Sources de prix. Chaque source échoue silencieusement (null) sans bloquer les autres.
import { cred, isActive } from "./settings";
import { ebayToken } from "./ebay";
import { SOURCES } from "./sourcesMeta";

export type Quote = {
  source: string; label: string; detail?: string; url?: string;
  values: { label: string; eur: number }[]; // plusieurs valeurs possibles (loose / complet / neuf)
};
export type PriceLink = { id: string; label: string; url: string };
export type PriceQuery = { title: string; platform: string; barcode: string; condition: string };

const UA = { "User-Agent": "EasyLudo/0.1 (ludotheque personnelle)" };
let fx: { rate: number; at: number } | null = null;
async function usdToEur() {
  if (fx && Date.now() - fx.at < 24 * 3600e3) return fx.rate;
  const j = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR").then((r) => r.json());
  fx = { rate: j.rates.EUR, at: Date.now() };
  return fx.rate;
}
const round = (n: number) => Math.round(n * 100) / 100;

export async function pricecharting(q: PriceQuery): Promise<Quote | null> {
  const t = cred("PRICECHARTING_TOKEN");
  const params = new URLSearchParams({ t });
  if (q.barcode) params.set("upc", q.barcode); else params.set("q", `${q.title} ${q.platform}`.trim());
  const r = await fetch("https://www.pricecharting.com/api/product?" + params, { headers: UA });
  if (!r.ok) return null;
  const j = await r.json();
  if (j.status !== "success") return null;
  const rate = await usdToEur();
  const val = (label: string, cents?: number) => (cents ? { label, eur: round((cents / 100) * rate) } : null);
  const values = [val("Seul (loose)", j["loose-price"]), val("Complet (CIB)", j["cib-price"]), val("Neuf", j["new-price"])]
    .filter((v): v is { label: string; eur: number } => !!v);
  if (!values.length) return null;
  return { source: "pricecharting", label: "PriceCharting", values,
    detail: `Fiche trouvée : ${j["product-name"]} (${j["console-name"]}) — cote en USD convertie au taux du jour`,
    url: `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(q.title)}` };
}

export async function ebay(q: PriceQuery): Promise<Quote | null> {
  const token = await ebayToken();
  if (!token) return null;
  const params = new URLSearchParams({ q: `${q.title} ${q.platform}`.trim(), category_ids: "139973", limit: "50" });
  const r = await fetch("https://api.ebay.com/buy/browse/v1/item_summary/search?" + params, {
    headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_FR" } });
  if (!r.ok) return null;
  const prices = ((await r.json()).itemSummaries ?? [])
    .filter((i: any) => i.price?.currency === "EUR").map((i: any) => Number(i.price.value)).filter((n: number) => n > 0).sort((a: number, b: number) => a - b);
  if (prices.length < 3) return null;
  const median = prices[Math.floor(prices.length / 2)];
  return { source: "ebay", label: "eBay (annonces en cours)", values: [{ label: "Prix médian", eur: round(median) }],
    detail: `${prices.length} annonces, de ${prices[0]} € à ${prices[prices.length - 1]} €. Prix demandés : souvent au-dessus des prix réellement vendus.`,
    url: `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(q.title + " " + q.platform)}` };
}

export function links(q: PriceQuery): PriceLink[] {
  const s = encodeURIComponent(`${q.title} ${q.platform}`.trim());
  const all: Record<string, string> = {
    link_ebay_sold: `https://www.ebay.fr/sch/i.html?_nkw=${s}&LH_Sold=1&LH_Complete=1`,
    link_leboncoin: `https://www.leboncoin.fr/recherche?text=${s}`,
    link_vinted: `https://www.vinted.fr/catalog?search_text=${s}`,
    link_rakuten: `https://fr.shopping.rakuten.com/search/${s}`,
    link_pricecharting: `https://www.pricecharting.com/search-products?type=prices&q=${s}`,
  };
  return SOURCES.filter((m) => m.id in all && isActive(m.id)).map((m) => ({ id: m.id, label: m.label, url: all[m.id] }));
}

export async function allQuotes(q: PriceQuery) {
  const jobs: Promise<Quote | null>[] = [];
  if (isActive("pricecharting")) jobs.push(pricecharting(q).catch(() => null));
  if (isActive("ebay")) jobs.push(ebay(q).catch(() => null));
  return { quotes: (await Promise.all(jobs)).filter((x): x is Quote => !!x), links: links(q), asked: jobs.length };
}
