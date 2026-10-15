import db, { Game } from "@/lib/db";
import { isAuthed } from "@/lib/session";
import { redirect } from "next/navigation";
import Library from "@/components/Library";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isAuthed())) redirect("/login");
  const games = db.prepare("SELECT * FROM games ORDER BY created_at DESC, id DESC").all() as Game[];
  return <Library games={games} />;
}
