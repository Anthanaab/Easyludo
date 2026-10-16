import { NextResponse } from "next/server";
import { denyIfNotAuthed } from "@/lib/session";
import { certInfo, listening, requestSelfSigned, status, supported, updateStatus, viaUpdateSupported } from "@/lib/https";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const ok = supported();
  if (!ok && !viaUpdateSupported()) return NextResponse.json({ supported: false });
  return NextResponse.json({
    supported: ok, viaUpdate: !ok,
    cert: certInfo(), listening: await listening(),
    status: status(), updateStatus: ok ? null : updateStatus(),
  });
}

// Certificat auto-signé : active le HTTPS (ou le régénère)
export async function POST() {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const r = requestSelfSigned();
  if (r === "unsupported") return NextResponse.json({ error: "Non disponible hors du conteneur Proxmox" }, { status: 400 });
  if (r === "busy" || r === "via-update-busy") return NextResponse.json({ error: "Une configuration est déjà en cours" }, { status: 409 });
  return NextResponse.json({ ok: true, via: r === "via-update" ? "update" : "https" });
}
