import { NextResponse } from "next/server";
import { denyIfNotAuthed } from "@/lib/session";
import { current, latest, logTail, request, status, supported } from "@/lib/updater";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  if (!supported()) return NextResponse.json({ supported: false });
  const [cur, lat] = await Promise.all([current(), latest()]);
  return NextResponse.json({
    supported: true, current: cur, latest: lat,
    updateAvailable: !!(cur && lat && cur.sha !== lat.sha),
    status: status(), log: logTail(),
  });
}

export async function POST() {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  if (!supported()) return NextResponse.json({ error: "Non disponible hors du conteneur Proxmox" }, { status: 400 });
  return request() === "busy"
    ? NextResponse.json({ error: "Une mise à jour est déjà en cours" }, { status: 409 })
    : NextResponse.json({ ok: true });
}
