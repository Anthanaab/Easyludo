import { denyIfNotAuthed } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { allQuotes, links } from "@/lib/prices";

export async function GET(req: NextRequest) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const p = req.nextUrl.searchParams;
  const q = {
    title: p.get("title") ?? "", platform: p.get("platform") ?? "", barcode: p.get("barcode") ?? "", condition: p.get("condition") ?? "" };
  // Pas de cote automatique pour les bornes (les bases de prix ne couvrent que les jeux) : liens d'annonces seulement
  if (p.get("item_type") === "arcade" || p.get("item_type") === "demo")
    return NextResponse.json({ quotes: [], links: links({ ...q, platform: "" , title: q.title + (p.get("item_type") === "arcade" ? " borne arcade" : " borne démo") }), asked: 0, manual: true });
  return NextResponse.json(await allQuotes(q));
}
