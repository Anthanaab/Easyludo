import db, { Game } from "@/lib/db";
import GameForm from "@/components/GameForm";
import { notFound, redirect } from "next/navigation";
import { isAuthed } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) redirect("/login");
  const { id } = await params;
  const g = db.prepare("SELECT * FROM games WHERE id = ?").get(id) as Game | undefined;
  if (!g) notFound();
  const history = db.prepare("SELECT price, source, at FROM price_history WHERE game_id = ? ORDER BY at DESC, id DESC LIMIT 8").all(id) as { price: number; source: string; at: string }[];
  return <GameForm game={g} history={history} />;
}
