// Caractéristiques propres à chaque type de borne (stockées en JSON dans la colonne « details »).
// Module sans dépendance serveur : utilisé par le formulaire, les routes API et l'export.
export type DetailValue = string | number | boolean;
export type Details = Record<string, DetailValue>;
export type CabinetType = "arcade" | "demo";
export type DetailField = {
  key: string; label: string; kind: "select" | "text" | "number" | "bool";
  options?: string[]; placeholder?: string; unit?: string;
};

const SCREEN_SIZE: DetailField = { key: "screen_size", label: "Taille de l'écran", kind: "number", unit: "pouces" };
const DIMENSIONS: DetailField = { key: "dimensions", label: "Dimensions (H × L × P)", kind: "text", placeholder: "ex. 180 × 65 × 80 cm" };

export const DETAIL_FIELDS: Record<CabinetType, DetailField[]> = {
  // Borne de jeux : une machine d'arcade pour jouer
  arcade: [
    { key: "format", label: "Format de la borne", kind: "select", options: ["Upright (droite)", "Cabaret", "Cocktail (table)", "Bartop / mini", "Cockpit (assis)", "Candy cab", "Autre"] },
    { key: "players", label: "Nombre de joueurs", kind: "select", options: ["1", "2", "3", "4", "Plus de 4"] },
    { key: "screen", label: "Type d'écran", kind: "select", options: ["CRT (tube)", "LCD / LED", "Projection", "Autre"] },
    SCREEN_SIZE,
    { key: "content", label: "Contenu de la borne", kind: "select", options: ["Monogame (jeu d'origine)", "Multi-jeux", "Kit JAMMA / carte seule", "Sans carte"] },
    { key: "games_count", label: "Nombre de jeux installés", kind: "number" },
    { key: "coin", label: "Monnayeur", kind: "select", options: ["Monnayeur d'origine", "Free play / bouton crédit", "Sans monnayeur"] },
    { key: "origin", label: "Origine", kind: "select", options: ["Originale d'époque", "Reproduction", "Fabrication maison", "Restaurée"] },
    DIMENSIONS,
  ],
  // Borne de démo : présentoir ou kiosque de magasin pour essayer une console ou des jeux
  demo: [
    { key: "display_type", label: "Type de présentoir", kind: "select", options: ["Borne interactive (kiosque)", "Présentoir de comptoir", "Présentoir carton (PLV)", "Meuble de démonstration", "Console de démo (demo unit)", "Autre"] },
    { key: "demo_content", label: "Contenu de la démo", kind: "text", placeholder: "ex. disque démo jouable, vidéo en boucle, jeux en libre essai" },
    { key: "screen", label: "Écran", kind: "select", options: ["Écran intégré", "Sans écran (se branche sur un écran)", "Autre"] },
    SCREEN_SIZE,
    { key: "origin", label: "Provenance", kind: "select", options: ["Retirée d'un magasin", "Fournie par l'éditeur / constructeur (PLV)", "Revendeur", "Autre"] },
    { key: "has_key", label: "Clé / serrure fournie", kind: "bool" },
    { key: "has_psu", label: "Alimentation d'origine fournie", kind: "bool" },
    DIMENSIONS,
  ],
};

export const CABINET_INFO: Record<CabinetType, { title: string; blurb: string; icon: string; conditions: string[] }> = {
  arcade: {
    title: "Caractéristiques de la borne de jeux", icon: "🕹️",
    blurb: "Machine d'arcade pour jouer : jeu d'origine, multi-jeux, cocktail, bartop…",
    conditions: ["Fonctionnelle", "Fonctionnelle (écran ou commandes à revoir)", "À réparer", "Pour pièces", "Restaurée"],
  },
  demo: {
    title: "Caractéristiques de la borne de démo", icon: "📺",
    blurb: "Borne de démonstration de magasin (PLV) : kiosque ou présentoir pour essayer une console ou des jeux.",
    conditions: ["Fonctionnelle (démo se lance)", "Allume mais démo à réparer", "Structure seule (sans console)", "Pour pièces", "Restaurée"],
  },
};

export const isCabinetType = (t: string): t is CabinetType => t === "arcade" || t === "demo";

export function parseDetails(raw: unknown): Details {
  if (raw && typeof raw === "object") return raw as Details;
  try { const j = JSON.parse(String(raw ?? "{}")); return j && typeof j === "object" ? j : {}; } catch { return {}; }
}

// Ne garde que les champs connus du type, avec des valeurs valides : rien d'autre n'est enregistré
export function sanitizeDetails(type: string, raw: unknown): Details {
  if (!isCabinetType(type)) return {};
  const input = parseDetails(raw);
  const out: Details = {};
  for (const f of DETAIL_FIELDS[type]) {
    const v = input[f.key];
    if (v === undefined || v === null || v === "") continue;
    if (f.kind === "select" && typeof v === "string" && f.options!.includes(v)) out[f.key] = v;
    else if (f.kind === "text" && typeof v === "string" && v.trim()) out[f.key] = v.trim().slice(0, 120);
    else if (f.kind === "number") { const n = Number(v); if (Number.isFinite(n) && n >= 0 && n < 100000) out[f.key] = n; }
    else if (f.kind === "bool" && v === true) out[f.key] = true;
  }
  return out;
}

const valueText = (f: DetailField, v: DetailValue) =>
  f.kind === "bool" ? "oui" : f.kind === "number" && f.unit ? `${v} ${f.unit}` : String(v);

// Libellé complet « Format : Upright ; Joueurs : 2 » (export CSV)
export function detailsText(type: string, details: Details): string {
  if (!isCabinetType(type)) return "";
  return DETAIL_FIELDS[type].filter((f) => details[f.key] !== undefined).map((f) => `${f.label} : ${valueText(f, details[f.key])}`).join(" ; ");
}

// Puces courtes pour les cartes de la liste
export function detailChips(type: string, d: Details): string[] {
  const chips: string[] = [];
  if (type === "arcade") {
    if (d.format) chips.push(String(d.format).replace(/ \(.*\)$/, ""));
    if (d.players) chips.push(`${d.players} joueur${d.players === "1" ? "" : "s"}`);
    if (d.screen) chips.push(`${String(d.screen).replace(/ \(.*\)$/, "")}${d.screen_size ? ` ${d.screen_size}″` : ""}`);
    if (d.content) chips.push(String(d.content).replace(/ \(.*\)$/, ""));
  } else if (type === "demo") {
    if (d.display_type) chips.push(String(d.display_type).replace(/ \(.*\)$/, ""));
    if (d.demo_content) chips.push(String(d.demo_content));
    if (d.origin) chips.push(String(d.origin).replace(/ \(.*\)$/, ""));
  }
  return chips;
}
