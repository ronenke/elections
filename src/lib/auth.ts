/**
 * Single fixed admin credential (ADMIN_USERNAME / ADMIN_PASSWORD env vars) and an HMAC-signed
 * session cookie. Uses Web Crypto so it works in both the Node runtime and the Edge middleware.
 */
export const SESSION_COOKIE = "elections_session";
const SESSION_DAYS = 14;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET env var must be set (at least 16 characters)");
  return s;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): string {
  const b = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return atob(b);
}

async function hmac(data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export type Role = "admin" | "viewer";

/**
 * Two fixed accounts:
 *  - admin:  ADMIN_USERNAME / ADMIN_PASSWORD — everything.
 *  - viewer: VIEWER_USERNAME (default "user") / VIEWER_PASSWORD (default: same as ADMIN_PASSWORD) — the board only.
 */
export function checkCredentials(username: string, password: string): Role | null {
  const au = process.env.ADMIN_USERNAME ?? "";
  const ap = process.env.ADMIN_PASSWORD ?? "";
  const vu = process.env.VIEWER_USERNAME ?? "user";
  const vp = process.env.VIEWER_PASSWORD ?? ap;
  if (!au || !ap) return null;
  // evaluate all comparisons to keep timing uniform
  const isAdmin = timingSafeEqual(username, au) && timingSafeEqual(password, ap);
  const isViewer = timingSafeEqual(username, vu) && timingSafeEqual(password, vp);
  if (isAdmin) return "admin";
  if (isViewer) return "viewer";
  return null;
}

export async function createSessionToken(username: string, role: Role): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  const payload = b64url(enc.encode(JSON.stringify({ u: username, r: role, exp })));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<{ username: string; role: Role } | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await hmac(payload);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const { u, r, exp } = JSON.parse(new TextDecoder().decode(Uint8Array.from(fromB64url(payload), c => c.charCodeAt(0)))) as { u: string; r?: Role; exp: number };
    if (typeof exp !== "number" || Date.now() > exp) return null;
    return { username: u, role: r === "viewer" ? "viewer" : "admin" };
  } catch {
    return null;
  }
}
