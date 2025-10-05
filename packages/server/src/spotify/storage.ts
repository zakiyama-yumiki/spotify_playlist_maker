import { decryptString, encryptString } from '../utils/crypto'
import {
  type SpotifyBindings,
  type SpotifyTokenState,
  type StoredAuthorizeState,
  type StoredSession,
  type StoredSpotifyTokenRecord,
} from './types'

export const STATE_TTL_SECONDS = 600
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

const stateKey = (state: string): string => `state:${state}`
const sessionKey = (sessionId: string): string => `session:${sessionId}`
const tokenKey = (userId: string): string => `tokens:spotify:${userId}`

export const storeAuthorizeState = async (
  env: SpotifyBindings,
  state: string,
  payload: StoredAuthorizeState
): Promise<void> => {
  await env.KV_NAMESPACE_OAUTH_STATES.put(stateKey(state), JSON.stringify(payload), {
    expirationTtl: STATE_TTL_SECONDS,
  })
}

export const consumeAuthorizeState = async (
  env: SpotifyBindings,
  state: string
): Promise<StoredAuthorizeState | null> => {
  const key = stateKey(state)
  const raw = await env.KV_NAMESPACE_OAUTH_STATES.get(key)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as StoredAuthorizeState
    await env.KV_NAMESPACE_OAUTH_STATES.delete(key)
    return parsed
  } catch (error) {
    console.error('authorize_state_parse_failed', error)
    return null
  }
}

export const storeSession = async (
  env: SpotifyBindings,
  sessionId: string,
  session: StoredSession
): Promise<void> => {
  await env.KV_AUTH_SESSIONS.put(sessionKey(sessionId), JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  })
}

export const loadSession = async (
  env: SpotifyBindings,
  sessionId: string
): Promise<StoredSession | null> => {
  const raw = await env.KV_AUTH_SESSIONS.get(sessionKey(sessionId))
  if (!raw) return null

  try {
    return JSON.parse(raw) as StoredSession
  } catch (error) {
    console.error('session_parse_failed', error)
    return null
  }
}

export const deleteSession = async (env: SpotifyBindings, sessionId: string): Promise<void> => {
  await env.KV_AUTH_SESSIONS.delete(sessionKey(sessionId))
}

export const touchSession = async (env: SpotifyBindings, sessionId: string): Promise<void> => {
  const session = await loadSession(env, sessionId)
  if (!session) return
  session.updatedAt = Math.floor(Date.now() / 1000)
  await storeSession(env, sessionId, session)
}

const getStoredTokenRecord = async (
  env: SpotifyBindings,
  userId: string
): Promise<StoredSpotifyTokenRecord | null> => {
  const raw = await env.KV_SPOTIFY_TOKENS.get(tokenKey(userId))
  if (!raw) return null

  try {
    return JSON.parse(raw) as StoredSpotifyTokenRecord
  } catch (error) {
    console.error('token_record_parse_failed', error)
    return null
  }
}

export const deleteSpotifyTokens = async (env: SpotifyBindings, userId: string): Promise<void> => {
  await env.KV_SPOTIFY_TOKENS.delete(tokenKey(userId))
}

export const loadSpotifyTokens = async (
  env: SpotifyBindings,
  userId: string
): Promise<SpotifyTokenState | null> => {
  const record = await getStoredTokenRecord(env, userId)
  if (!record) return null

  const secret = env.SESSION_CRYPTO_KEY
  try {
    const accessToken = await decryptString(secret, record.encryptedAccessToken)
    const refreshToken = record.encryptedRefreshToken
      ? await decryptString(secret, record.encryptedRefreshToken)
      : null

    return {
      accessToken,
      refreshToken,
      scope: record.scope,
      expiresAt: record.expiresAt,
      updatedAt: record.updatedAt,
    }
  } catch (error) {
    console.error('token_decrypt_failed', error)
    return null
  }
}

type PersistTokenParams = {
  userId: string
  accessToken: string
  refreshToken: string | null
  scope: string
  expiresIn: number
}

export const persistSpotifyTokens = async (
  env: SpotifyBindings,
  params: PersistTokenParams
): Promise<SpotifyTokenState> => {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresAt = nowSeconds + params.expiresIn

  const secret = env.SESSION_CRYPTO_KEY
  const encryptedAccessToken = await encryptString(secret, params.accessToken)
  const encryptedRefreshToken = params.refreshToken
    ? await encryptString(secret, params.refreshToken)
    : null

  const record: StoredSpotifyTokenRecord = {
    encryptedAccessToken,
    encryptedRefreshToken,
    scope: params.scope,
    expiresAt,
    updatedAt: nowSeconds,
  }

  await env.KV_SPOTIFY_TOKENS.put(tokenKey(params.userId), JSON.stringify(record), {
    expirationTtl: Math.max(params.expiresIn, 3600),
  })

  return {
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    scope: params.scope,
    expiresAt,
    updatedAt: nowSeconds,
  }
}
