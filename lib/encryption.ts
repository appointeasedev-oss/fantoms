// lib/encryption.ts
// This file needs to work in both Node.js (for API routes) and browser environments.

// Use globalThis.crypto for Web Crypto API, which works in both browser and Node.js 15+
// For older Node.js versions, 'crypto' module might be needed, but Next.js usually runs on newer Node.js.
// Assuming modern Node.js environment for Next.js API routes.

const ALGORITHM = 'aes-256-cbc';
const KEY_DERIVATION_ALGORITHM = 'PBKDF2';
const HASH_ALGORITHM = 'SHA-256';
const ITERATIONS = 100000; // Number of iterations for PBKDF2
const KEY_LENGTH = 32; // 256 bits for AES-256
const IV_LENGTH = 16; // 128 bits for AES-CBC IV

// Hardcoded passphrase - NOT SECURE FOR PRODUCTION. This is for obfuscation only.
const PASSPHRASE = 'SatvikSingh';
const SALT = new TextEncoder().encode('fantoms-salt'); // Fixed salt for key derivation

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordBuffer = new TextEncoder().encode(passphrase);
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: KEY_DERIVATION_ALGORITHM },
    false,
    ['deriveKey']
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: KEY_DERIVATION_ALGORITHM,
      salt: salt,
      iterations: ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    baseKey,
    { name: 'AES-CBC', length: KEY_LENGTH * 8 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(text: string): Promise<string> {
  if (!text) return ''; // Handle empty string case

  const key = await deriveKey(PASSPHRASE, SALT);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(text);

  const cipher = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: iv },
    key,
    encoded
  );

  // Node.js Buffer for base64 encoding/decoding
  const ivBase64 = Buffer.from(iv).toString('base64');
  const cipherBase64 = Buffer.from(cipher).toString('base64');

  return `${ivBase64}:${cipherBase64}`;
}

export async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return ''; // Handle empty string case

  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    // If it's not in the expected encrypted format, assume it's plain text.
    // This handles cases where data might have been stored unencrypted previously.
    return encryptedText;
  }

  try {
    const iv = Buffer.from(parts[0], 'base64');
    const cipher = Buffer.from(parts[1], 'base64');

    const key = await deriveKey(PASSPHRASE, SALT);

    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv },
      key,
      cipher
    );

    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error("Decryption failed, returning original text:", e);
    // Fallback to returning the original text if decryption fails.
    // This is important for backward compatibility if some data was stored unencrypted.
    return encryptedText;
  }
}