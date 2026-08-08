// app/crypto.ts
// Client-side E2EE for ChitChat NG — Phase 1 (1:1 text messages).
// Uses ECDH (P-256) to derive a per-conversation AES-GCM key.
// Private keys never leave the browser and are never sent to Supabase.

const DB_NAME = "chitchat-keys";
const STORE_NAME = "keys";

function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Returns this device's keypair, generating and storing one in IndexedDB
// the first time. Every new device/browser gets its own keypair — see
// the "Account/Device loss" limitation noted separately.
export async function getOrCreateKeyPair(userId: string): Promise<CryptoKeyPair> {
  const db = await openKeyDB();

  const existing = await new Promise<CryptoKeyPair | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(userId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (existing) return existing;

  // Note: Web Crypto's ECDH keygen ties extractability to the whole pair.
  // Since the public key must be exportable to share it, the private key
  // is technically extractable too — we simply never call exportKey on it.
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(keyPair, userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return keyPair;
}

export async function exportPublicKeyBase64(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importPublicKeyBase64(base64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

// Both sides derive the SAME AES key from (my private key + their public key)
// and (their private key + my public key) — that's how ECDH works. Neither
// side ever transmits the shared key itself.
export async function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(sharedKey: CryptoKey, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, encoded);
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipherBuf))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptText(sharedKey: CryptoKey, ciphertextB64: string, ivB64: string): Promise<string> {
  const cipherBytes = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, sharedKey, cipherBytes);
  return new TextDecoder().decode(plainBuf);
}