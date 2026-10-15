import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, checkToken } from "./auth";

export async function isAuthed() {
  return checkToken((await cookies()).get(COOKIE)?.value);
}

// Contrôle de session au niveau des routes API (en plus du proxy : défense en profondeur)
export async function denyIfNotAuthed() {
  return (await isAuthed()) ? null : NextResponse.json({ error: "Non connecté" }, { status: 401 });
}
