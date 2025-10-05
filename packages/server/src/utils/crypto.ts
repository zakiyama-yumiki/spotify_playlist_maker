import { fromBase64, toBase64, toBase64Url } from './base64'

const keyCache = new Map<string, Promise<CryptoKey>>()

const encodeText = (value: string): Uint8Array => {
  return new TextEncoder().encode(value)
}

const decodeText = (data: ArrayBuffer): string => {
  return new TextDecoder().decode(data)
}

const importAesKey = (secret: string): Promise<CryptoKey> => {
  const cached = keyCache.get(secret)
  if (cached) return cached

  const promise = crypto.subtle.importKey(
    'raw',
    fromBase64(secret),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )

  keyCache.set(secret, promise)
  return promise
}

export const encryptString = async (secret: string, plainText: string): Promise<string> => {
  const key = await importAesKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encodeText(plainText))
  return `${toBase64(iv)}:${toBase64(cipher)}`
}

export const decryptString = async (secret: string, encrypted: string): Promise<string> => {
  const [ivPart, payload] = encrypted.split(':')
  if (!ivPart || !payload) throw new Error('Invalid encrypted payload format')
  const key = await importAesKey(secret)
  const iv = fromBase64(ivPart)
  const cipher = fromBase64(payload)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return decodeText(plain)
}

export const encryptJSON = async <T>(secret: string, value: T): Promise<string> => {
  return encryptString(secret, JSON.stringify(value))
}

export const decryptJSON = async <T>(secret: string, encrypted: string): Promise<T> => {
  const text = await decryptString(secret, encrypted)
  return JSON.parse(text) as T
}

export const hashSha256 = async (value: string): Promise<ArrayBuffer> => {
  return crypto.subtle.digest('SHA-256', encodeText(value))
}

export const randomBase64Url = (bytes: number): string => {
  const array = crypto.getRandomValues(new Uint8Array(bytes))
  return toBase64Url(array)
}
