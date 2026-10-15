import db, { Game } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { denyIfNotAuthed } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const games = db.prepare("SELECT * FROM games ORDER BY item_type, platform, title").all() as Game[];
  return new Response(toCsv(games), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="easyludo-${new Date().toISOString().slice(0, 10)}.csv"`,
    "Cache-Control": "no-store" } });
}
