import type {
  AuthBindings,
  SessionRecord,
  SpotifyTokenRecord,
  StateRecord,
} from '../bindings'

const STATE_PREFIX = 'state:'
const SESSION_PREFIX = 'session:'
const TOKEN_PREFIX = 'tokens:'

const safeParse = <T>(value: string | null): T | null => {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch (error) {
    console.error('Failed to parse KV value', error)
    return null
  }
}

export const storeState = async (
  env: AuthBindings,
  state: string,
  record: StateRecord,
  ttlSeconds = 600
): Promise<void> => {
  await env.KV_AUTH_SESSIONS.put(`${STATE_PREFIX}${state}`, JSON.stringify(record), {
    expirationTtl: ttlSeconds,
  })
}

export const loadState = async (env: AuthBindings, state: string): Promise<StateRecord | null> => {
  const raw = await env.KV_AUTH_SESSIONS.get(`${STATE_PREFIX}${state}`)
  return safeParse<StateRecord>(raw)
}

export const deleteState = async (env: AuthBindings, state: string): Promise<void> => {
  await env.KV_AUTH_SESSIONS.delete(`${STATE_PREFIX}${state}`)
}

const calcTtlFromEpoch = (epochSeconds: number, fallbackSeconds: number): number => {
  const now = Math.floor(Date.now() / 1000)
  const ttl = epochSeconds - now
  return ttl > 0 ? ttl : fallbackSeconds
}

export const storeSession = async (
  env: AuthBindings,
  sessionId: string,
  record: SessionRecord
): Promise<void> => {
  const ttlSeconds = calcTtlFromEpoch(record.expiresAt, 3600)
  await env.KV_AUTH_SESSIONS.put(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(record), {
    expirationTtl: ttlSeconds,
  })
}

export const loadSession = async (
  env: AuthBindings,
  sessionId: string
): Promise<SessionRecord | null> => {
  const raw = await env.KV_AUTH_SESSIONS.get(`${SESSION_PREFIX}${sessionId}`)
  return safeParse<SessionRecord>(raw)
}

export const deleteSession = async (env: AuthBindings, sessionId: string): Promise<void> => {
  await env.KV_AUTH_SESSIONS.delete(`${SESSION_PREFIX}${sessionId}`)
}

export const storeSpotifyTokens = async (
  env: AuthBindings,
  userId: string,
  record: SpotifyTokenRecord
): Promise<void> => {
  const ttlSeconds = calcTtlFromEpoch(record.expiresAt, 3600)
  await env.KV_SPOTIFY_TOKENS.put(`${TOKEN_PREFIX}${userId}`, JSON.stringify(record), {
    expirationTtl: ttlSeconds,
  })
}

export const loadSpotifyTokens = async (
  env: AuthBindings,
  userId: string
): Promise<SpotifyTokenRecord | null> => {
  const raw = await env.KV_SPOTIFY_TOKENS.get(`${TOKEN_PREFIX}${userId}`)
  return safeParse<SpotifyTokenRecord>(raw)
}
