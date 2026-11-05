import crypto from 'crypto';

const PREFIX = 'enc:v1:';

function encryptionKey(): Buffer | null {
  const secret = process.env.ENCRYPTION_KEY;
  return secret ? crypto.createHash('sha256').update(secret).digest() : null;
}

export const isEncryptionConfigured = () => encryptionKey() !== null;

export const isProtected = (value: string | null | undefined) => Boolean(value?.startsWith(PREFIX));

// Encrypts a secret for storage. Without ENCRYPTION_KEY it stays readable, so a store
// can still log in, and the server log says so.
export function protectSecret(value: string): string {
  const key = encryptionKey();
  if (!key) {
    console.error('ENCRYPTION_KEY is not set, so a secret was stored without encryption.');
    return value;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

// Reads a stored secret. Values saved before encryption was added are returned as they are.
export function revealSecret(value: string): string;
export function revealSecret(value: string | null | undefined): string | null;
export function revealSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value;

  const key = encryptionKey();
  if (!key) throw new Error('ENCRYPTION_KEY is needed to read a stored secret.');

  const data = Buffer.from(value.slice(PREFIX.length), 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
