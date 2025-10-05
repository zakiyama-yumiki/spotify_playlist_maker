import { hashSha256, randomBase64Url } from './crypto'
import { toBase64Url } from './base64'

export const generateCodeVerifier = (): string => {
  return randomBase64Url(32)
}

export const generatePkceState = (): string => {
  return randomBase64Url(16)
}

export const deriveCodeChallenge = async (codeVerifier: string): Promise<string> => {
  const digest = await hashSha256(codeVerifier)
  return toBase64Url(digest)
}
