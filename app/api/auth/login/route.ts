import { NextRequest, NextResponse } from "next/server";
import { clearFails, hasPassword, recordFail, throttled, verifyPassword } from "@/lib/auth";
import { clientIp, withSession } from "@/lib/authApi";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const wait = throttled(ip);
  if (wait) return NextResponse.json({ error: `Trop d'essais. Réessaie dans ${Math.ceil(wait / 60)} min.` }, { status: 429 });
  const { password } = await req.json().catch(() => ({ password: "" }));
  await new Promise((r) => setTimeout(r, 400)); // ralentit les essais automatisés
  if (!hasPassword() || typeof password !== "string" || !verifyPassword(password)) {
    recordFail(ip);
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }
  clearFails(ip);
  return withSession(req);
}
