import { denyIfNotAuthed } from "@/lib/session";
import db, { FIELDS, Game, normalize } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  return NextResponse.json(db.prepare("SELECT * FROM games ORDER BY created_at DESC, id DESC").all() as Game[]);
}

export async function POST(req: NextRequest) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const b = await req.json();
  if (!b.title?.trim()) return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  const hasPrice = b.market_price != null && b.market_price !== "";
  const r = db.prepare(
    `INSERT INTO games (${FIELDS.join(",")}, market_price_date)
     VALUES (${FIELDS.map(() => "?").join(",")}, ${hasPrice ? "datetime('now')" : "NULL"})`
  ).run(...normalize(b));
  if (hasPrice) db.prepare("INSERT INTO price_history (game_id, price, source) VALUES (?, ?, ?)").run(r.lastInsertRowid, Number(b.market_price), b.price_source || "manuel");
  return NextResponse.json({ id: r.lastInsertRowid });
}
