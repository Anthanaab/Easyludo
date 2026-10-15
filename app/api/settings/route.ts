import { denyIfNotAuthed } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { SOURCES } from "@/lib/sourcesMeta";
import { cred, hasKeys, isEnabled, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Ne renvoie jamais les clés elles-mêmes : seulement si elles sont renseignées.
export async function GET() {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  return NextResponse.json({
    sources: SOURCES.map((s) => ({ id: s.id, enabled: isEnabled(s.id), keysOk: hasKeys(s.id),
      keys: s.keys.map((k) => ({ name: k.name, set: !!cred(k.name) })) })),
  });
}

export async function PUT(req: NextRequest) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const b = await req.json() as { enabled?: Record<string, boolean>; keys?: Record<string, string | null> };
  const known = new Set(SOURCES.map((s) => s.id));
  const knownKeys = new Set(SOURCES.flatMap((s) => s.keys.map((k) => k.name)));
  for (const [id, on] of Object.entries(b.enabled ?? {})) if (known.has(id)) setSetting("enabled." + id, on ? "1" : "0");
  for (const [name, v] of Object.entries(b.keys ?? {})) {
    if (!knownKeys.has(name)) continue;
    if (v === null) setSetting("key." + name, null);
    else if (v.trim()) setSetting("key." + name, v.trim());
  }
  return NextResponse.json({ ok: true });
}
