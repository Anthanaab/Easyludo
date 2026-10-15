import { NextRequest, NextResponse } from "next/server";
import { MIN_PASSWORD, hasPassword, setPassword } from "@/lib/auth";
import { withSession } from "@/lib/authApi";

// Première configuration uniquement : refusée dès qu'un mot de passe existe
export async function POST(req: NextRequest) {
  if (hasPassword()) return NextResponse.json({ error: "Déjà configuré" }, { status: 403 });
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || password.length < MIN_PASSWORD)
    return NextResponse.json({ error: `Au moins ${MIN_PASSWORD} caractères` }, { status: 400 });
  setPassword(password);
  return withSession(req);
}
