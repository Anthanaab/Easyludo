import { NextRequest, NextResponse } from "next/server";
import { denyIfNotAuthed } from "@/lib/session";
import { current, latest, logTail, request, status, supported } from "@/lib/updater";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  if (!supported()) return NextResponse.json({ supported: false });
  const [cur, lat] = await Promise.all([current(), latest(req.nextUrl.searchParams.get("refresh") === "1")]);
  return NextResponse.json({
    supported: true, current: cur, latest: lat.v, latestError: lat.error,
    updateAvailable: !!(cur && lat.v && cur.sha !== lat.v.sha),
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
