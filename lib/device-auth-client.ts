import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'krown-device-auth';
const STORE = 'keys';
const KEY_NAME = 'device-signing-key';
const DEVICE_ID_KEY = 'krown_device_id';

interface DeviceKeyDb {
  keys: {
    key: string;
    value: CryptoKey;
  };
}

async function db(): Promise<IDBPDatabase<DeviceKeyDb>> {
  return openDB<DeviceKeyDb>(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
    },
  });
}

function base64Url(bytes: ArrayBuffer | Uint8Array) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export function getDeviceId() {
  return typeof window !== 'undefined' ? localStorage.getItem(DEVICE_ID_KEY) : null;
}

async function getKey() {
  const database = await db();
  return database.get(STORE, KEY_NAME);
}

async function createKey() {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify'],
  ) as Promise<CryptoKeyPair>;
}

async function fingerprint() {
  const material = [navigator.userAgent, navigator.platform, screen.width, screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return base64Url(digest);
}

/** Enrolls this browser/device against a one-time Super Admin activation PIN. */
export async function activateDevice(activationPin: string, metadata: {
  browser?: string;
  operatingSystem?: string;
} = {}) {
  const keyPair = await createKey();
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const credentialIdBytes = crypto.getRandomValues(new Uint8Array(18));
  const credentialId = base64Url(credentialIdBytes);

  const response = await fetch('/api/devices/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: activationPin.trim(),
      deviceFingerprint: await fingerprint(),
      credentialId,
      credentialPublicKey: JSON.stringify(publicJwk),
      browser: metadata.browser || navigator.userAgent.slice(0, 120),
      operatingSystem: metadata.operatingSystem || navigator.platform.slice(0, 120),
    }),
  });

  const json = await response.json();
  if (!response.ok || !json?.data?.id) throw new Error(json?.error || 'Device activation failed');

  const database = await db();
  await database.put(STORE, keyPair.privateKey, KEY_NAME);
  localStorage.setItem(DEVICE_ID_KEY, json.data.id);
  localStorage.setItem('krown_device_reference', json.data.public_reference || '');
  localStorage.setItem('krown_device_branch_id', json.data.branch_id || '');
  localStorage.setItem('krown_device_type', json.data.device_type || '');
  return json.data;
}

export async function createDeviceProof(deviceId: string) {
  const key = await getKey();
  if (!key) throw new Error('This device is not activated.');

  const challengeResponse = await fetch(`/api/devices/challenge?deviceId=${encodeURIComponent(deviceId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  });
  const challengeJson = await challengeResponse.json();
  if (!challengeResponse.ok || !challengeJson?.data?.challenge) {
    throw new Error(challengeJson?.error || 'Unable to verify this device');
  }

  const challenge = String(challengeJson.data.challenge);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    fromBase64Url(challenge),
  );

  return { challenge, signature: base64Url(signature) };
}
