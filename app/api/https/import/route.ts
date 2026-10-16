import { NextRequest, NextResponse } from "next/server";
import { denyIfNotAuthed } from "@/lib/session";
import { stageImport, supported } from "@/lib/https";

export async function POST(req: NextRequest) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  if (!supported()) return NextResponse.json({ error: "Active d'abord le HTTPS (certificat auto-signé), puis reviens ici" }, { status: 400 });
  // Une clé privée ne doit jamais transiter en clair : import refusé hors HTTPS (Caddy ajoute X-Forwarded-Proto)
  if (req.headers.get("x-forwarded-proto") !== "https" && process.env.EASYLUDO_ALLOW_HTTP_IMPORT !== "1")
    return NextResponse.json({ error: "Importe le certificat depuis la version HTTPS du site (la clé privée ne doit pas circuler en HTTP)" }, { status: 400 });
  const { cert, key } = await req.json().catch(() => ({}));
  if (typeof cert !== "string" || typeof key !== "string") return NextResponse.json({ error: "Certificat et clé requis" }, { status: 400 });
  const r = stageImport(cert, key);
  return r.error ? NextResponse.json({ error: r.error }, { status: 400 }) : NextResponse.json({ ok: true });
}
