import { denyIfNotAuthed } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { isActive } from "@/lib/settings";
import { cached, ownedBy, remember } from "@/lib/barcodes";
import { Candidate, cleanTitle, ebayByGtin, guessPlatform, igdb, libretroCover, rawg, upcitemdb, wikidata } from "@/lib/sources";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// Même jeu si l'une des plateformes de l'un figure parmi celles de l'autre (Wikidata en liste plusieurs : « Wii U, Nintendo Switch »)
const platformSet = (p: string) => new Set(p.split(",").map((x) => norm(x)).filter(Boolean));
const samePlatform = (a: string, b: string) => {
  const A = platformSet(a), B = platformSet(b);
  return !A.size || !B.size || [...A].some((x) => B.has(x));
};
type BarcodeStatus = "found" | "unknown" | "rate_limited" | "error" | "no_source";

export async function GET(req: NextRequest) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const barcode = req.nextUrl.searchParams.get("barcode");
  const userPlatform = req.nextUrl.searchParams.get("platform") ?? "";
  let q = req.nextUrl.searchParams.get("q");
  let barcodeCand: Candidate | null = null;
  let status: BarcodeStatus = "unknown";
  const owned = barcode ? ownedBy(barcode) : [];

  if (barcode) {
    // 1. Ta ludothèque (doublon + infos déjà saisies)  2. Cache  3. UPCitemdb  4. eBay
    if (owned.length) {
      const o = owned[0];
      q = o.title; status = "found";
      barcodeCand = { title: o.title, platform: o.platform, release_year: o.release_year, cover_url: o.photo || o.cover_url, publisher: o.publisher, source: "Ta ludothèque" };
    } else {
      let hit = cached(barcode);
      let reason: "unknown" | "rate_limited" | "error" = "unknown";
      let asked = false;
      if (hit) { hit = { ...hit, source: hit.source + " (mémorisé)" }; }
      else {
        if (isActive("upcitemdb")) { asked = true; const r = await upcitemdb(barcode); if (r.hit) hit = { title: r.hit.rawTitle, image: r.hit.image, source: r.hit.source }; else reason = r.reason ?? "unknown"; }
        if (!hit && isActive("ebay")) { asked = true; const r = await ebayByGtin(barcode); if (r.hit) hit = { title: r.hit.rawTitle, image: r.hit.image, source: r.hit.source }; else if (reason !== "rate_limited" && r.reason === "error") reason = "error"; }
        if (hit) remember(barcode, hit.title, hit.image, hit.source);
      }
      if (hit) {
        status = "found";
        q = cleanTitle(hit.title);
        barcodeCand = { title: q, platform: guessPlatform(hit.title), release_year: null, cover_url: hit.image, publisher: "", source: `Code-barres · ${hit.source}` };
      } else status = asked ? reason : "no_source";
    }
  }
  if (!q) return NextResponse.json({ candidates: [], barcode: barcode ? { status, owned: owned.map(({ id, title, platform }) => ({ id, title, platform })) } : undefined });

  // Toutes les sources en parallèle ; une source en panne n'empêche pas les autres
  const jobs = [isActive("rawg") && rawg(q), isActive("igdb") && igdb(q), isActive("wikidata") && wikidata(q)];
  const lists = await Promise.all(jobs.map((p) => p || Promise.resolve([] as Candidate[])).map((p) => p.catch(() => [] as Candidate[])));
  const merged: Candidate[] = [];
  for (const c of [...(barcodeCand ? [barcodeCand] : []), ...lists.flat()]) {
    const dup = merged.find((m) => norm(m.title) === norm(c.title) && samePlatform(m.platform, c.platform));
    if (!dup) merged.push({ ...c });
    else {
      // Titre de revendeur (« Super Mario: Odyssey ») : on préfère le nom officiel d'une base de jeux ; un titre déjà saisi par toi reste prioritaire
      if (dup.source.startsWith("Code-barres")) dup.title = c.title;
      dup.cover_url ||= c.cover_url;
      dup.publisher ||= c.publisher;
      dup.platform ||= c.platform;
      dup.release_year ||= c.release_year;
      if (!dup.source.includes(c.source)) dup.source += " + " + c.source;
    }
  }
  // Une fiche issue du code-barres n'a ni année ni éditeur : on les reprend d'une fiche de même titre (identiques d'une plateforme à l'autre)
  for (const m of merged) {
    if (!m.source.startsWith("Code-barres") || (m.publisher && m.release_year)) continue;
    const twin = merged.find((o) => o !== m && norm(o.title) === norm(m.title) && (o.publisher || o.release_year));
    if (twin) { m.publisher ||= twin.publisher; m.release_year ||= twin.release_year; }
  }
  const top = merged.slice(0, 10);

  // Jaquette de secours : Libretro (consoles rétro) pour les fiches sans image
  await Promise.all(top.filter((c) => !c.cover_url && isActive("libretro")).map(async (c) => {
    const cover = await libretroCover(c.title, userPlatform + "," + c.platform).catch(() => "");
    if (cover) { c.cover_url = cover; c.source += " + Libretro"; }
  }));
  return NextResponse.json({
    candidates: top,
    barcode: barcode ? { status, owned: owned.map(({ id, title, platform }) => ({ id, title, platform })) } : undefined,
  });
}
