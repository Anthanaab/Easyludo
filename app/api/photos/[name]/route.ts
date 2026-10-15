import { denyIfNotAuthed } from "@/lib/session";
import { UPLOAD_DIR } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

const TYPE: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const { name } = await params;
  const safe = path.basename(name);
  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, safe));
    return new Response(buf, { headers: {
      "Content-Type": TYPE[path.extname(safe)] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
