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

export function checkCredentials(username: string, password: string): boolean {
  const u = process.env.ADMIN_USERNAME ?? "";
  const p = process.env.ADMIN_PASSWORD ?? "";
  if (!u || !p) return false;
  // evaluate both to keep timing uniform
  const okU = timingSafeEqual(username, u);
  const okP = timingSafeEqual(password, p);
  return okU && okP;
}

export async function createSessionToken(username: string): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  const payload = b64url(enc.encode(JSON.stringify({ u: username, exp })));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<{ username: string } | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await hmac(payload);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const { u, exp } = JSON.parse(new TextDecoder().decode(Uint8Array.from(fromB64url(payload), c => c.charCodeAt(0)))) as { u: string; exp: number };
    if (typeof exp !== "number" || Date.now() > exp) return null;
    return { username: u };
  } catch {
    return null;
  }
}
