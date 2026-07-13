const DB_NAME = "swp-secure-login";
const DB_VERSION = 1;
const STORE_NAME = "cryptoKeys";
const KEY_ID = "remember-password-aes";
const RECORD_KEY = "swpRememberedCredentialsV1";
const ENABLED_KEY = "swpRememberPassword";

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
}

function base64ToBytes(value) {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open secure credential storage."));
  });
}

async function readStoredKey() {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(KEY_ID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read credential key."));
    });
  } finally {
    db.close();
  }
}

async function writeStoredKey(key) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(key, KEY_ID);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Could not store credential key."));
    });
  } finally {
    db.close();
  }
}

async function getOrCreateKey() {
  if (!window.crypto?.subtle) throw new Error("Web Crypto is not available.");
  const existing = await readStoredKey().catch(() => null);
  if (existing) return existing;
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  await writeStoredKey(key);
  return key;
}

export function isRememberPasswordEnabled() {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export async function saveRememberedCredentials({ username, password }) {
  const normalizedUsername = String(username || "").trim();
  const normalizedPassword = String(password || "");
  if (!normalizedUsername || !normalizedPassword) return;

  const key = await getOrCreateKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify({ username: normalizedUsername, password: normalizedPassword }));
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  const record = {
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted))
  };
  window.localStorage.setItem(RECORD_KEY, JSON.stringify(record));
  window.localStorage.setItem(ENABLED_KEY, "true");
}

export async function loadRememberedCredentials() {
  if (!isRememberPasswordEnabled()) return null;
  const raw = window.localStorage.getItem(RECORD_KEY);
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    const key = await readStoredKey();
    if (!key) return null;
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(record.iv) },
      key,
      base64ToBytes(record.ciphertext)
    );
    const value = JSON.parse(new TextDecoder().decode(decrypted));
    return {
      username: String(value.username || ""),
      password: String(value.password || "")
    };
  } catch {
    return null;
  }
}

export function clearRememberedCredentials() {
  try {
    window.localStorage.removeItem(RECORD_KEY);
    window.localStorage.removeItem(ENABLED_KEY);
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
}
