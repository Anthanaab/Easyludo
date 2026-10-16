import { denyIfNotAuthed } from "@/lib/session";
import { certPem } from "@/lib/https";

// Certificat public (jamais la clé privée) : à installer sur les appareils pour supprimer l'avertissement du navigateur
export async function GET() {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const pem = certPem();
  if (!pem) return new Response("Aucun certificat", { status: 404 });
  return new Response(new Uint8Array(pem), { headers: {
    "Content-Type": "application/x-x509-ca-cert",
    "Content-Disposition": 'attachment; filename="easyludo.crt"',
    "Cache-Control": "no-store" } });
}
