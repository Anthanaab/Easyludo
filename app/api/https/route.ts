import { NextResponse } from "next/server";
import { denyIfNotAuthed } from "@/lib/session";
import { certInfo, listening, request, status, supported } from "@/lib/https";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  if (!supported()) return NextResponse.json({ supported: false });
  return NextResponse.json({ supported: true, cert: certInfo(), listening: await listening(), status: status() });
}

export async function POST() {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  if (!supported()) return NextResponse.json({ error: "Non disponible hors du conteneur Proxmox" }, { status: 400 });
  return request() === "busy"
    ? NextResponse.json({ error: "Une configuration est déjà en cours" }, { status: 409 })
    : NextResponse.json({ ok: true });
}
