const toBinaryString = (bytes: Uint8Array | ArrayBuffer): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i])
  }
  return binary
}

const fromBinaryString = (binary: string): Uint8Array => {
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export const toBase64 = (data: Uint8Array | ArrayBuffer): string => {
  return btoa(toBinaryString(data))
}

export const fromBase64 = (value: string): Uint8Array => {
  return fromBinaryString(atob(value))
}

export const toBase64Url = (data: Uint8Array | ArrayBuffer): string => {
  return toBase64(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

export const fromBase64Url = (value: string): Uint8Array => {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = base64.length % 4
  if (padding === 2) base64 += '=='
  else if (padding === 3) base64 += '='
  else if (padding !== 0) throw new Error('Invalid base64url string')
  return fromBase64(base64)
}
