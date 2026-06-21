import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Gets a type-safe 32-byte Buffer key derived from ENCRYPTION_KEY or AUTH_SECRET.
 */
function getKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    "rhea-default-connector-fallback-secret-key-32-chars-long";
  
  // Use SHA-256 to consistently hash the secret into a type-safe 32-byte buffer
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a string value using AES-256-GCM.
 * Returns a colon-separated string: iv_hex:auth_tag_hex:encrypted_hex
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a GCM encrypted string (format: iv_hex:auth_tag_hex:encrypted_hex)
 * back to plain UTF-8 text.
 */
export function decrypt(encryptedText: string): string {
  try {
    const key = getKey();
    const parts = encryptedText.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted text format (expected 3 parts)");
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err: any) {
    console.error("[crypto] Decryption failed:", err.message);
    throw new Error("Decryption failed. Please verify your encryption keys.");
  }
}
