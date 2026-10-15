import { NextRequest, NextResponse } from "next/server";
import { COOKIE, checkToken } from "@/lib/auth";

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (checkToken(req.cookies.get(COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
