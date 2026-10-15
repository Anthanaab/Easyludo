// Référentiel des consoles : sert à classer par marque / type et à choisir le dossier Libretro.
// L'ordre compte : les motifs les plus précis viennent avant les plus généraux.
export type Platform = { name: string; re: RegExp; brand: string; kind: "Salon" | "Portable" | "Hybride" | "PC"; libretro?: string };

export const PLATFORMS: Platform[] = [
  { name: "Nintendo Switch", re: /\bswitch\b/i, brand: "Nintendo", kind: "Hybride" },
  { name: "Wii U", re: /\bwii\s?u\b/i, brand: "Nintendo", kind: "Salon", libretro: "Nintendo - Wii U" },
  { name: "Wii", re: /\bwii\b/i, brand: "Nintendo", kind: "Salon", libretro: "Nintendo - Wii" },
  { name: "GameCube", re: /game\s?cube|\bngc\b/i, brand: "Nintendo", kind: "Salon", libretro: "Nintendo - GameCube" },
  { name: "Nintendo 64", re: /nintendo 64|\bn64\b/i, brand: "Nintendo", kind: "Salon", libretro: "Nintendo - Nintendo 64" },
  { name: "Super Nintendo", re: /super nintendo|\bsnes\b|super famicom/i, brand: "Nintendo", kind: "Salon", libretro: "Nintendo - Super Nintendo Entertainment System" },
  { name: "NES", re: /\bnes\b|nintendo entertainment|famicom/i, brand: "Nintendo", kind: "Salon", libretro: "Nintendo - Nintendo Entertainment System" },
  { name: "Game Boy Advance", re: /game\s?boy advance|\bgba\b/i, brand: "Nintendo", kind: "Portable", libretro: "Nintendo - Game Boy Advance" },
  { name: "Game Boy Color", re: /game\s?boy colou?r|\bgbc\b/i, brand: "Nintendo", kind: "Portable", libretro: "Nintendo - Game Boy Color" },
  { name: "Game Boy", re: /game\s?boy|\bgb\b/i, brand: "Nintendo", kind: "Portable", libretro: "Nintendo - Game Boy" },
  { name: "Nintendo 3DS", re: /\b3ds\b/i, brand: "Nintendo", kind: "Portable", libretro: "Nintendo - Nintendo 3DS" },
  { name: "Nintendo DS", re: /nintendo ds|\bnds\b|\bds\b/i, brand: "Nintendo", kind: "Portable", libretro: "Nintendo - Nintendo DS" },
  { name: "PlayStation 5", re: /\bps5\b|playstation 5/i, brand: "Sony", kind: "Salon" },
  { name: "PlayStation 4", re: /\bps4\b|playstation 4/i, brand: "Sony", kind: "Salon" },
  { name: "PlayStation 3", re: /\bps3\b|playstation 3/i, brand: "Sony", kind: "Salon", libretro: "Sony - PlayStation 3" },
  { name: "PlayStation 2", re: /\bps2\b|playstation 2/i, brand: "Sony", kind: "Salon", libretro: "Sony - PlayStation 2" },
  { name: "PSP", re: /\bpsp\b|playstation portable/i, brand: "Sony", kind: "Portable", libretro: "Sony - PlayStation Portable" },
  { name: "PS Vita", re: /\bvita\b/i, brand: "Sony", kind: "Portable", libretro: "Sony - PlayStation Vita" },
  { name: "PlayStation", re: /\bps1\b|\bpsx\b|\bpsone\b|playstation/i, brand: "Sony", kind: "Salon", libretro: "Sony - PlayStation" },
  { name: "Xbox Series X", re: /series x|series s/i, brand: "Microsoft", kind: "Salon" },
  { name: "Xbox One", re: /xbox one/i, brand: "Microsoft", kind: "Salon" },
  { name: "Xbox 360", re: /xbox 360/i, brand: "Microsoft", kind: "Salon", libretro: "Microsoft - Xbox 360" },
  { name: "Xbox", re: /\bxbox\b/i, brand: "Microsoft", kind: "Salon", libretro: "Microsoft - Xbox" },
  { name: "Mega Drive", re: /mega\s?drive|genesis/i, brand: "Sega", kind: "Salon", libretro: "Sega - Mega Drive - Genesis" },
  { name: "Master System", re: /master system/i, brand: "Sega", kind: "Salon", libretro: "Sega - Master System - Mark III" },
  { name: "Saturn", re: /\bsaturn\b/i, brand: "Sega", kind: "Salon", libretro: "Sega - Saturn" },
  { name: "Dreamcast", re: /dreamcast/i, brand: "Sega", kind: "Salon", libretro: "Sega - Dreamcast" },
  { name: "Game Gear", re: /game gear/i, brand: "Sega", kind: "Portable", libretro: "Sega - Game Gear" },
  { name: "PC", re: /\bpc\b|windows|steam/i, brand: "PC", kind: "PC" },
];

export const platformOf = (s: string) => PLATFORMS.find((p) => p.re.test(s.split(",")[0]));
export const brandOf = (s: string) => platformOf(s)?.brand ?? "Autre";
export const kindOf = (s: string) => platformOf(s)?.kind ?? "Autre";

export const BRAND_COLOR: Record<string, string> = {
  Nintendo: "#e4002b", Sony: "#2f6bff", Microsoft: "#16a34a", Sega: "#0891d1", PC: "#6b7280", Autre: "#8b5cf6", "Borne d'arcade": "#ea580c", "Borne de démo": "#0d9488",
};

// Types d'objets de la collection
export type ItemType = "game" | "arcade" | "demo";
export const ITEM_TYPES: { id: ItemType; label: string; icon: string }[] = [
  { id: "game", label: "Jeu", icon: "🎮" },
  { id: "arcade", label: "Borne d'arcade", icon: "🕹️" },
  { id: "demo", label: "Borne de démo", icon: "📺" },
];
export const itemLabel = (t: string) => ITEM_TYPES.find((x) => x.id === t)?.label ?? "Jeu";
export const isCabinet = (t: string) => t === "arcade" || t === "demo";
type Item = { platform: string; item_type?: string };
// Une borne n'a pas de marque de console : elle est classée par son type
export const brandOfItem = (g: Item) => (isCabinet(g.item_type ?? "") ? itemLabel(g.item_type!) : brandOf(g.platform));
export const kindOfItem = (g: Item) => (isCabinet(g.item_type ?? "") ? "Borne" : kindOf(g.platform));
export const ARCADE_SYSTEMS = ["Neo Geo MVS", "CPS-1", "CPS-2", "CPS-3", "JAMMA", "Naomi", "Sega System 16", "Namco System 22", "Taito F3", "Konami", "Atomiswave", "Borne dédiée (monogame)", "Multi-jeux (pandora, etc.)"];
export const CABINET_CONDITIONS = ["Fonctionnelle", "Fonctionnelle (écran ou commandes à revoir)", "À réparer", "Pour pièces", "Restaurée"];
