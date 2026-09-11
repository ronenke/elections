import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const PUBLIC = ["/login", "/api/login", "/favicon.ico", "/_next", "/icon"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some(p => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p))) return NextResponse.next();
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    if (session.role === "admin") return NextResponse.next();
    // viewer: the board and what it needs, nothing else
    const viewerOk = pathname === "/" || pathname === "/api/logout" || pathname === "/api/me" || (pathname === "/api/state" && req.method === "GET");
    if (viewerOk) return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "forbidden", message: "אין הרשאה — משתמש צפייה בלבד" }, { status: 403 });
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
