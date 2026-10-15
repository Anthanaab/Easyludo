import { denyIfNotAuthed } from "@/lib/session";
import { UPLOAD_DIR } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const EXT: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

export async function POST(req: NextRequest) {
  const denied = await denyIfNotAuthed(); if (denied) return denied;
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || !EXT[file.type])
    return NextResponse.json({ error: "Image JPG/PNG/WebP requise" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Max 10 Mo" }, { status: 400 });
  const name = crypto.randomUUID() + EXT[file.type];
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/api/photos/${name}` });
}
