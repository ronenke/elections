import { NextResponse } from "next/server";
import { checkCredentials, createSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const role = username && password ? checkCredentials(username, password) : null;
  if (!role) {
    await new Promise(r => setTimeout(r, 400));
    return NextResponse.json({ error: "שם משתמש או סיסמה שגויים" }, { status: 401 });
  }
  const token = await createSessionToken(username!, role);
  const res = NextResponse.json({ ok: true, role, home: role === "admin" ? "/admin" : "/" });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 14 * 86400 });
  return res;
}
