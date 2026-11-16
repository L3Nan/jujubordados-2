import { env } from "cloudflare:workers";

const COOKIE_NAME = "jujubordados_admin";
const SESSION_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sessionKey() {
  return crypto.subtle.importKey("raw", encoder.encode(env.ADMIN_PASSWORD), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function verifyAdminPassword(candidate: string) {
  const expected = await crypto.subtle.digest("SHA-256", encoder.encode(env.ADMIN_PASSWORD));
  const actual = await crypto.subtle.digest("SHA-256", encoder.encode(candidate));
  const expectedBytes = new Uint8Array(expected);
  const actualBytes = new Uint8Array(actual);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) difference |= expectedBytes[index] ^ actualBytes[index];
  return difference === 0;
}

export async function createAdminSession() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${expires}`;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await sessionKey(), encoder.encode(payload)));
  return `${payload}.${toBase64Url(signature)}`;
}

export async function isAdminSession(request: Request) {
  const cookie = request.headers.get("Cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!cookie) return false;
  const [expiresText, signatureText, extra] = cookie.split(".");
  const expires = Number(expiresText);
  if (extra || !Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000) || expires > Math.floor(Date.now() / 1000) + SESSION_SECONDS + 60) return false;
  try {
    return crypto.subtle.verify("HMAC", await sessionKey(), fromBase64Url(signatureText), encoder.encode(expiresText));
  } catch {
    return false;
  }
}

export function adminCookie(session: string) {
  return `${COOKIE_NAME}=${session}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
