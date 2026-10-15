import { NextRequest, NextResponse } from "next/server";
import { MIN_PASSWORD, envPassword, setPassword, verifyPassword } from "@/lib/auth";
import { withSession } from "@/lib/authApi";
import { denyIfNotAuthed } from "@/lib/session";

export async function POST(req: NextRequest) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  if (envPassword()) return NextResponse.json({ error: "Le mot de passe est défini par EASYLUDO_PASSWORD (variable d'environnement)." }, { status: 400 });
  const { current, next } = await req.json().catch(() => ({}));
  if (typeof current !== "string" || !verifyPassword(current)) return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 401 });
  if (typeof next !== "string" || next.length < MIN_PASSWORD) return NextResponse.json({ error: `Au moins ${MIN_PASSWORD} caractères` }, { status: 400 });
  setPassword(next); // invalide les autres sessions
  return withSession(req); // garde celle-ci ouverte
}
