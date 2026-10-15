import { denyIfNotAuthed } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { allQuotes } from "@/lib/prices";

export async function GET(req: NextRequest) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const p = req.nextUrl.searchParams;
  return NextResponse.json(await allQuotes({
    title: p.get("title") ?? "", platform: p.get("platform") ?? "", barcode: p.get("barcode") ?? "", condition: p.get("condition") ?? "" }));
}
