import crypto from "crypto";

const SECRET = process.env.KAI_TOKEN_SECRET || "";

function key() {
  // derive 32-byte key
  return crypto.createHash("sha256").update(SECRET).digest();
}

export function encryptJson(obj: unknown): string {
  if (!SECRET || SECRET.length < 32) throw new Error("KAI_TOKEN_SECRET must be 32+ chars");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptJson<T>(b64: string): T {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(out.toString("utf8")) as T;
}
