import { denyIfNotAuthed } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { isActive } from "@/lib/settings";
import { Candidate, cleanTitle, guessPlatform, igdb, libretroCover, rawg, upcitemdb, wikidata } from "@/lib/sources";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function GET(req: NextRequest) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const barcode = req.nextUrl.searchParams.get("barcode");
  const userPlatform = req.nextUrl.searchParams.get("platform") ?? "";
  let q = req.nextUrl.searchParams.get("q");
  let rawTitle: string | null = null;
  let barcodeCand: Candidate | null = null;

  if (barcode && isActive("upcitemdb")) {
    const u = await upcitemdb(barcode).catch(() => null);
    if (u) {
      rawTitle = u.rawTitle;
      q = cleanTitle(u.rawTitle);
      barcodeCand = { title: q, platform: guessPlatform(u.rawTitle), release_year: null, cover_url: u.image, publisher: "", source: "Code-barres" };
    }
  }
  if (!q) return NextResponse.json({ rawTitle, candidates: [] });

  // Toutes les sources en parallèle ; une source en panne n'empêche pas les autres
  const jobs = [isActive("rawg") && rawg(q), isActive("igdb") && igdb(q), isActive("wikidata") && wikidata(q)];
  const lists = await Promise.all(jobs.map((p) => p || Promise.resolve([] as Candidate[])).map((p) => p.catch(() => [] as Candidate[])));
  const merged: Candidate[] = [];
  for (const c of [...(barcodeCand ? [barcodeCand] : []), ...lists.flat()]) {
    const dup = merged.find((m) => norm(m.title) === norm(c.title) && (!m.platform || !c.platform || m.platform.split(",")[0] === c.platform.split(",")[0]));
    if (!dup) merged.push({ ...c });
    else {
      dup.cover_url ||= c.cover_url;
      dup.publisher ||= c.publisher;
      dup.platform ||= c.platform;
      dup.release_year ||= c.release_year;
      if (!dup.source.includes(c.source)) dup.source += " + " + c.source;
    }
  }
  const top = merged.slice(0, 10);

  // Jaquette de secours : Libretro (consoles rétro) pour les fiches sans image
  await Promise.all(top.filter((c) => !c.cover_url && isActive("libretro")).map(async (c) => {
    const cover = await libretroCover(c.title, userPlatform + "," + c.platform).catch(() => "");
    if (cover) { c.cover_url = cover; c.source += " + Libretro"; }
  }));
  return NextResponse.json({ rawTitle, candidates: top });
}
