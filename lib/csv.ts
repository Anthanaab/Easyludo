import type { Game } from "./db";
import { brandOfItem, itemLabel, kindOfItem } from "./platforms";

// Les titres viennent aussi de sources externes : on neutralise les débuts de cellule qu'Excel interpréterait comme une formule.
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const num = (n: number | null) => (n == null ? "" : String(n).replace(".", ",")); // décimales à la française

const HEAD = ["Type", "Titre", "Plateforme / système", "Marque", "Catégorie", "Éditeur", "Année", "Code-barres", "État",
  "Prix d'achat (€)", "Prix du marché (€)", "Plus-value (€)", "Cote mise à jour le", "Notes", "Ajouté le"];

export function toCsv(games: Game[]): string {
  const rows = games.map((g) => [
    itemLabel(g.item_type), g.title, g.platform, brandOfItem(g), kindOfItem(g), g.publisher, g.release_year ?? "", g.barcode, g.condition,
    num(g.purchase_price), num(g.market_price),
    g.purchase_price != null && g.market_price != null ? num(Math.round((g.market_price - g.purchase_price) * 100) / 100) : "",
    g.market_price_date?.slice(0, 10) ?? "", g.notes, g.created_at.slice(0, 10),
  ]);
  // BOM UTF-8 : Excel reconnaît les accents ; séparateur « ; » pour les Excel en français
  return "﻿" + [HEAD, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
