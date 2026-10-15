import { denyIfNotAuthed } from "@/lib/session";
import db, { FIELDS, normalize } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Ctx) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const { id } = await params;
  const g = db.prepare("SELECT * FROM games WHERE id = ?").get(id);
  return g ? NextResponse.json(g) : NextResponse.json({ error: "Introuvable" }, { status: 404 });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const { id } = await params;
  const b = await req.json();
  if (!b.title?.trim()) return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  const old = db.prepare("SELECT market_price FROM games WHERE id = ?").get(id) as { market_price: number | null } | undefined;
  if (!old) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const vals = normalize(b);
  const priceChanged = (b.market_price === "" ? null : b.market_price ?? null) !== old.market_price;
  db.prepare(
    `UPDATE games SET ${FIELDS.map((f) => `${f}=?`).join(",")}${priceChanged ? ", market_price_date=datetime('now')" : ""} WHERE id=?`
  ).run(...vals, id);
  if (priceChanged && b.market_price !== "" && b.market_price != null)
    db.prepare("INSERT INTO price_history (game_id, price, source) VALUES (?, ?, ?)").run(id, Number(b.market_price), b.price_source || "manuel");
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const { id } = await params;
  db.prepare("DELETE FROM games WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
