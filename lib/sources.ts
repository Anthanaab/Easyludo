// Sources de données jeux. Chaque source échoue silencieusement (retourne []) pour ne jamais bloquer la recherche.
export type Candidate = { title: string; platform: string; release_year: number | null; cover_url: string; publisher: string; source: string };

const UA = { "User-Agent": "EasyLudo/0.1 (ludotheque personnelle)" };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

import { PLATFORMS } from "./platforms";
import { cred } from "./settings";

export const guessPlatform = (s: string) => PLATFORMS.find((p) => p.re.test(s))?.name ?? "";
const libretroDirs = (platforms: string) =>
  [...new Set(platforms.split(/,|\//).map((p) => PLATFORMS.find((x) => x.re.test(p))?.libretro).filter(Boolean) as string[])];

// ---------- Libretro Thumbnails : jaquettes rétro, sans clé ----------
const listings = new Map<string, { at: number; names: Map<string, string[]> }>();
const libKey = (file: string) => {
  let n = decodeURIComponent(file).replace(/\.png$/, "").replace(/\s*\(.*$/, "");
  n = n.replace(/^(.*), (The|A|An|Le|La|Les|L')( - |$)/, "$2 $1 ");
  return norm(n);
};
async function libretroNames(dir: string) {
  const hit = listings.get(dir);
  if (hit && Date.now() - hit.at < 24 * 3600e3) return hit.names;
  const r = await fetch(`https://thumbnails.libretro.com/${encodeURIComponent(dir)}/Named_Boxarts/`, { headers: UA });
  if (!r.ok) return new Map<string, string[]>();
  const names = new Map<string, string[]>();
  for (const m of (await r.text()).matchAll(/href="([^"]+\.png)"/g)) {
    const k = libKey(m[1]);
    names.set(k, [...(names.get(k) ?? []), m[1]]);
  }
  listings.set(dir, { at: Date.now(), names });
  return names;
}
const regionRank = (f: string) => (/\(France/.test(f) ? 0 : /\(Europe/.test(f) ? 1 : /\(USA/.test(f) ? 2 : 3) + (/Beta|Proto|Demo|Debug|Unl/.test(f) ? 10 : 0);

export async function libretroCover(title: string, platforms: string): Promise<string> {
  const key = norm(title.replace(/^the /i, "the "));
  for (const dir of libretroDirs(platforms)) {
    const files = (await libretroNames(dir).catch(() => null))?.get(key);
    if (files?.length) {
      const best = [...files].sort((a, b) => regionRank(a) - regionRank(b))[0];
      return `https://thumbnails.libretro.com/${encodeURIComponent(dir)}/Named_Boxarts/${best}`;
    }
  }
  return "";
}

// ---------- RAWG (clé gratuite RAWG_API_KEY) ----------
export async function rawg(q: string): Promise<Candidate[]> {
  const key = cred("RAWG_API_KEY");
  if (!key) return [];
  const r = await fetch(`https://api.rawg.io/api/games?key=${key}&search=${encodeURIComponent(q)}&page_size=8`);
  if (!r.ok) return [];
  const results = ((await r.json()).results ?? []) as any[];
  // La liste ne contient pas l'éditeur : un appel de détail pour les 5 premiers résultats
  const pubs = await Promise.all(results.slice(0, 5).map((g) =>
    fetch(`https://api.rawg.io/api/games/${g.id}?key=${key}`).then((x) => x.json()).then((d) => (d.publishers ?? [])[0]?.name ?? "").catch(() => "")));
  return results.map((g, i) => ({
    title: g.name,
    platform: (g.platforms ?? []).map((p: any) => p.platform.name).slice(0, 3).join(", "),
    release_year: g.released ? Number(g.released.slice(0, 4)) : null,
    cover_url: g.background_image ?? "", publisher: pubs[i] ?? "", source: "RAWG",
  }));
}

// ---------- IGDB (clés Twitch gratuites IGDB_CLIENT_ID / IGDB_CLIENT_SECRET) ----------
let igdbToken: { v: string; exp: number } | null = null;
export async function igdb(q: string): Promise<Candidate[]> {
  const id = cred("IGDB_CLIENT_ID"), secret = cred("IGDB_CLIENT_SECRET");
  if (!id || !secret) return [];
  if (!igdbToken || igdbToken.exp < Date.now()) {
    const t = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`, { method: "POST" });
    if (!t.ok) return [];
    const j = await t.json();
    igdbToken = { v: j.access_token, exp: Date.now() + (j.expires_in - 600) * 1000 };
  }
  const r = await fetch("https://api.igdb.com/v4/games", {
    method: "POST", headers: { "Client-ID": id, Authorization: `Bearer ${igdbToken.v}` },
    body: `search "${q.replace(/"/g, "")}"; fields name,first_release_date,cover.image_id,platforms.name,involved_companies.publisher,involved_companies.company.name; limit 8;`,
  });
  if (!r.ok) return [];
  return ((await r.json()) as any[]).map((g) => ({
    title: g.name,
    platform: (g.platforms ?? []).map((p: any) => p.name).slice(0, 3).join(", "),
    release_year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
    cover_url: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : "",
    publisher: (g.involved_companies ?? []).find((c: any) => c.publisher)?.company?.name ?? "", source: "IGDB",
  }));
}

// ---------- Wikidata (gratuit, sans clé) ----------
export async function wikidata(q: string): Promise<Candidate[]> {
  const s = await fetch(
    `https://www.wikidata.org/w/api.php?action=query&list=search&format=json&srlimit=8&srsearch=${encodeURIComponent(q + " haswbstatement:P31=Q7889")}`,
    { headers: UA });
  if (!s.ok) return [];
  const ids: string[] = ((await s.json()).query?.search ?? []).map((x: any) => x.title).filter((t: string) => /^Q\d+$/.test(t));
  if (!ids.length) return [];
  const sparql = `SELECT ?item ?l (MIN(?date) AS ?d) (SAMPLE(?img) AS ?im) (SAMPLE(?publ) AS ?pub) (GROUP_CONCAT(DISTINCT ?pl;separator=", ") AS ?pls) WHERE {
    VALUES ?item {${ids.map((i) => "wd:" + i).join(" ")}}
    ?item rdfs:label ?l FILTER(lang(?l)="en")
    OPTIONAL{?item wdt:P577 ?date} OPTIONAL{?item wdt:P18 ?img}
    OPTIONAL{?item wdt:P123 ?pb. ?pb rdfs:label ?publ FILTER(lang(?publ)="en")}
    OPTIONAL{?item wdt:P400 ?p. ?p rdfs:label ?pl FILTER(lang(?pl)="en")}
  } GROUP BY ?item ?l`;
  const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql), { headers: UA });
  if (!r.ok) return [];
  const byId = new Map<string, Candidate>();
  for (const b of (await r.json()).results.bindings as any[]) {
    byId.set(b.item.value.split("/").pop(), {
      title: b.l.value,
      platform: (b.pls?.value ?? "").split(", ").slice(0, 3).join(", "),
      release_year: b.d ? new Date(b.d.value).getUTCFullYear() : null,
      cover_url: b.im ? b.im.value.replace("http://", "https://") + "?width=300" : "", publisher: b.pub?.value ?? "", source: "Wikidata",
    });
  }
  return ids.map((i) => byId.get(i)).filter((c): c is Candidate => !!c);
}

// ---------- UPCitemdb : code-barres -> titre + image marchande (essai gratuit ~100/jour) ----------
export async function upcitemdb(code: string): Promise<{ rawTitle: string; image: string } | null> {
  const r = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, { headers: UA });
  if (!r.ok) return null;
  const it = (await r.json()).items?.[0];
  return it?.title ? { rawTitle: it.title, image: (it.images ?? []).find((u: string) => u.startsWith("https://")) ?? "" } : null;
}

export const cleanTitle = (t: string) => t.replace(/\[.*?\]|\(.*?\)/g, " ").split(/ - | – |,/)[0].replace(/\s+/g, " ").trim();
