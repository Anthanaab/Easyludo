import db from "./db";

// UPC-A (12 chiffres) et EAN-13 (le même code précédé d'un 0) désignent le même produit : on compare sans zéros de tête.
export const normBarcode = (c: string) => c.replace(/\D/g, "").replace(/^0+/, "");

type Owned = { id: number; title: string; platform: string; publisher: string; release_year: number | null; cover_url: string; photo: string };

// Exemplaires déjà dans la ludothèque (détection de doublon + les infos d'une fiche déjà saisie servent de « mémoire »)
export function ownedBy(code: string): Owned[] {
  const n = normBarcode(code);
  if (!n) return [];
  const rows = db.prepare("SELECT id, title, platform, publisher, release_year, cover_url, photo, barcode FROM games WHERE barcode != ''").all() as (Owned & { barcode: string })[];
  return rows.filter((r) => normBarcode(r.barcode) === n);
}

// Cache des résultats externes : économise le quota des services gratuits et garde le résultat hors ligne
export function cached(code: string): { title: string; image: string; source: string } | null {
  return (db.prepare("SELECT title, image, source FROM barcode_cache WHERE code = ?").get(normBarcode(code)) as { title: string; image: string; source: string } | undefined) ?? null;
}
export function remember(code: string, title: string, image: string, source: string) {
  const n = normBarcode(code);
  if (!n || !title) return;
  db.prepare("INSERT INTO barcode_cache (code, title, image, source) VALUES (?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET title=excluded.title, image=excluded.image, source=excluded.source, at=datetime('now')")
    .run(n, title, image, source);
}
