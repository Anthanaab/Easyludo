// Registre des sources (sans dépendance serveur : utilisé aussi par la page Paramètres).
export type SourceMeta = {
  id: string; group: "Fiches de jeux" | "Prix du marché" | "Liens de recherche de prix";
  label: string; desc: string; keys: { name: string; label: string }[]; help?: string;
};

export const SOURCES: SourceMeta[] = [
  { id: "wikidata", group: "Fiches de jeux", label: "Wikidata", desc: "Titre, année, plateformes, éditeur. Gratuit, sans clé.", keys: [] },
  { id: "libretro", group: "Fiches de jeux", label: "Libretro Thumbnails", desc: "Jaquettes des consoles rétro (NES à PS3, Sega…). Gratuit, sans clé.", keys: [] },
  { id: "upcitemdb", group: "Fiches de jeux", label: "UPCitemdb (code-barres)", desc: "Titre et photo à partir du code-barres, surtout les codes américains. Gratuit, ~100 requêtes/jour (résultats mémorisés).", keys: [] },
  { id: "rawg", group: "Fiches de jeux", label: "RAWG", desc: "Fiches complètes avec jaquette et éditeur.", keys: [{ name: "RAWG_API_KEY", label: "Clé API" }], help: "https://rawg.io/apidocs" },
  { id: "igdb", group: "Fiches de jeux", label: "IGDB (Twitch)", desc: "Jaquettes HD, éditeur, plateformes.", keys: [{ name: "IGDB_CLIENT_ID", label: "Client ID" }, { name: "IGDB_CLIENT_SECRET", label: "Client Secret" }], help: "https://dev.twitch.tv/console" },

  { id: "pricecharting", group: "Prix du marché", label: "PriceCharting", desc: "Cote loose / complet / neuf, convertie en euros. API payante.", keys: [{ name: "PRICECHARTING_TOKEN", label: "Token API" }], help: "https://www.pricecharting.com/api-documentation" },
  { id: "ebay", group: "Prix du marché", label: "eBay (annonces en cours)", desc: "Prix médian des annonces eBay.fr (prix demandés, pas vendus) et reconnaissance des codes-barres européens. Clé gratuite.", keys: [{ name: "EBAY_CLIENT_ID", label: "App ID (Client ID)" }, { name: "EBAY_CLIENT_SECRET", label: "Cert ID (Client Secret)" }], help: "https://developer.ebay.com" },

  { id: "link_ebay_sold", group: "Liens de recherche de prix", label: "eBay — ventes terminées", desc: "Ouvre les ventes réelles sur eBay.fr.", keys: [] },
  { id: "link_leboncoin", group: "Liens de recherche de prix", label: "Leboncoin", desc: "Ouvre la recherche Leboncoin.", keys: [] },
  { id: "link_vinted", group: "Liens de recherche de prix", label: "Vinted", desc: "Ouvre la recherche Vinted.", keys: [] },
  { id: "link_rakuten", group: "Liens de recherche de prix", label: "Rakuten", desc: "Ouvre la recherche Rakuten.", keys: [] },
  { id: "link_pricecharting", group: "Liens de recherche de prix", label: "PriceCharting (site)", desc: "Ouvre la recherche sur pricecharting.com (consultation gratuite).", keys: [] },
];
