import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
export const dynamic = "force-dynamic";
export async function GET() {
  const s = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  const res = NextResponse.json(s ? { username: s.username, role: s.role } : { role: null }, { status: s ? 200 : 401 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
