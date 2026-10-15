import { NextRequest, NextResponse } from "next/server";
import { COOKIE, SESSION_DAYS, makeToken } from "./auth";

export const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

export function withSession(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, makeToken(), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400,
    // Cookie "secure" uniquement en HTTPS (sinon il serait refusé en local)
    secure: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
  });
  return res;
}
