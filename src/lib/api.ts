import { NextResponse } from "next/server";
/** JSON response that no browser, CDN or Next cache may keep. */
export function json(body: unknown, init: ResponseInit = {}) {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  res.headers.set("Pragma", "no-cache");
  return res;
}
