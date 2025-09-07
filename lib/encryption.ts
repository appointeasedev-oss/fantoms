// lib/encryption.ts
// User password-based encryption system for Pantry data security

const ALGORITHM = 'AES-256-CBC';
const KEY_DERIVATION_ALGORITHM = 'PBKDF2';
const HASH_ALGORITHM = 'SHA-256';
const ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits for AES-256
const IV_LENGTH = 16; // 128 bits for AES-CBC IV

// Fixed salt for password verification (different from data encryption salt)
const VERIFICATION_SALT = new TextEncoder().encode('fantoms-verify-salt');

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordBuffer = new TextEncoder().encode(password);
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

// Generate a unique salt for each pantry (pantryId + bucket)
function generateDataSalt(pantryId: string, bucket: string): Uint8Array {
  const combined = `${pantryId}:${bucket}:fantoms-data-salt`;
  return new TextEncoder().encode(combined.slice(0, 16).padEnd(16, '0'));
}

// Encrypt data using user password
export async function encryptWithPassword(text: string, password: string, pantryId: string, bucket: string): Promise<string> {
  if (!text || !password) return text; // Return as-is if missing

  const salt = generateDataSalt(pantryId, bucket);
  const key = await deriveKey(password, salt);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(text);

  const cipher = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: iv },
    key,
    encoded
  );

  const ivBase64 = Buffer.from(iv).toString('base64');
  const cipherBase64 = Buffer.from(cipher).toString('base64');

  return `enc:${ivBase64}:${cipherBase64}`;
}

// Decrypt data using user password
export async function decryptWithPassword(encryptedText: string, password: string, pantryId: string, bucket: string): Promise<string> {
  if (!encryptedText || !password) return encryptedText;

  // Check if data is encrypted (starts with 'enc:')
  if (!encryptedText.startsWith('enc:')) {
    return encryptedText; // Return as-is if not encrypted (backward compatibility)
  }

  const parts = encryptedText.slice(4).split(':'); // Remove 'enc:' prefix
  if (parts.length !== 2) {
    return encryptedText; // Invalid format, return as-is
  }

  try {
    const salt = generateDataSalt(pantryId, bucket);
    const key = await deriveKey(password, salt);
    const iv = Buffer.from(parts[0], 'base64');
    const cipher = Buffer.from(parts[1], 'base64');

    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv },
      key,
      cipher
    );

    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error("Decryption failed:", e);
    throw new Error("Invalid password or corrupted data");
  }
}

// Create password verification hash (for login verification)
export async function createPasswordVerification(password: string): Promise<string> {
  const key = await deriveKey(password, VERIFICATION_SALT);
  const testData = new TextEncoder().encode('fantoms-password-verify');
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const cipher = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: iv },
    key,
    testData
  );

  const ivBase64 = Buffer.from(iv).toString('base64');
  const cipherBase64 = Buffer.from(cipher).toString('base64');

  return `verify:${ivBase64}:${cipherBase64}`;
}

// Verify password against stored verification hash
export async function verifyPassword(password: string, verificationHash: string): Promise<boolean> {
  if (!verificationHash.startsWith('verify:')) {
    return false;
  }

  const parts = verificationHash.slice(7).split(':'); // Remove 'verify:' prefix
  if (parts.length !== 2) {
    return false;
  }

  try {
    const key = await deriveKey(password, VERIFICATION_SALT);
    const iv = Buffer.from(parts[0], 'base64');
    const cipher = Buffer.from(parts[1], 'base64');

    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv },
      key,
      cipher
    );

    const decryptedText = new TextDecoder().decode(decrypted);
    return decryptedText === 'fantoms-password-verify';
  } catch (e) {
    return false;
  }
}