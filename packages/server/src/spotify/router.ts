import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { deriveCodeChallenge, generateCodeVerifier, generatePkceState } from '../utils/pkce'
import type { SpotifyBindings, SpotifyProfile } from './types'
import {
  consumeAuthorizeState,
  deleteSession,
  loadSession,
  loadSpotifyTokens,
  persistSpotifyTokens,
  SESSION_TTL_SECONDS,
  storeAuthorizeState,
  storeSession,
  touchSession,
} from './storage'
import {
  exchangeAuthorizationCode,
  fetchSpotifyProfile,
  SpotifyOAuthError,
  type TokenEndpointResponse,
} from './oauth'
import { TOKEN_REFRESH_THRESHOLD_SECONDS, buildApiUrl, spotifyApiFetch } from './client'

const SCOPES = [
  'playlist-modify-private',
  'playlist-modify-public',
  'user-read-email',
] as const

const DEFAULT_REDIRECT_PATH = '/'
const SESSION_PROVIDER = 'spotify'
const SPOTIFY_USER_PREFIX = 'spotify:'

type SpotifyContext = Context<{ Bindings: SpotifyBindings }>

const normalizeRedirectPath = (value: unknown): string => {
  if (typeof value !== 'string') return DEFAULT_REDIRECT_PATH
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) return DEFAULT_REDIRECT_PATH
  return trimmed.length === 0 ? DEFAULT_REDIRECT_PATH : trimmed
}

const buildAuthorizeUrl = (
  clientId: string,
  redirectUri: string,
  scope: string,
  state: string,
  codeChallenge: string
): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `https://accounts.spotify.com/authorize?${params.toString()}`
}

const isSecureRequest = (req: Request): boolean => {
  const forwardedProto = req.headers.get('x-forwarded-proto')
  if (forwardedProto) {
    return forwardedProto.split(',')[0]?.trim().toLowerCase() === 'https'
  }
  return new URL(req.url).protocol === 'https:'
}

const setSessionCookie = (c: SpotifyContext, sessionId: string) => {
  const env = c.env
  const cookieName = env.SESSION_COOKIE_NAME
  const cookieDomain = env.SESSION_COOKIE_DOMAIN || undefined

  setCookie(c, cookieName, sessionId, {
    httpOnly: true,
    secure: isSecureRequest(c.req.raw),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    domain: cookieDomain,
  })
}

const clearSessionCookie = async (c: SpotifyContext) => {
  const env = c.env
  const cookieName = env.SESSION_COOKIE_NAME
  const cookieDomain = env.SESSION_COOKIE_DOMAIN || undefined
  const sessionId = getCookie(c, cookieName)
  if (sessionId) {
    await deleteSession(env, sessionId)
  }

  deleteCookie(c, cookieName, {
    path: '/',
    domain: cookieDomain,
    secure: isSecureRequest(c.req.raw),
  })
}

const prefixUserId = (id: string): string => `${SPOTIFY_USER_PREFIX}${id}`
const extractSpotifyUserId = (value: string): string =>
  value.startsWith(SPOTIFY_USER_PREFIX) ? value.slice(SPOTIFY_USER_PREFIX.length) : value

const ensureEnvConfigured = (env: SpotifyBindings): string | null => {
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_REDIRECT_URI || !env.SPOTIFY_CLIENT_SECRET) {
    return 'spotify_env_incomplete'
  }
  if (!env.SESSION_COOKIE_NAME || !env.SESSION_CRYPTO_KEY) {
    return 'session_env_incomplete'
  }
  return null
}

const handleTokenPersistence = async (
  env: SpotifyBindings,
  userId: string,
  tokens: TokenEndpointResponse,
  fallbackScope: string
) => {
  const existing = await loadSpotifyTokens(env, userId)
  const scope = tokens.scope ?? fallbackScope ?? existing?.scope ?? fallbackScope
  const refreshToken = tokens.refresh_token ?? existing?.refreshToken ?? null
  return persistSpotifyTokens(env, {
    userId,
    accessToken: tokens.access_token,
    refreshToken,
    scope,
    expiresIn: tokens.expires_in,
  })
}

const handleProfileFetch = async (accessToken: string): Promise<SpotifyProfile> => {
  return fetchSpotifyProfile(accessToken)
}

const authorizeHandler = async (c: SpotifyContext) => {
  const env = c.env
  const configError = ensureEnvConfigured(env)
  if (configError) {
    return c.json({ error: configError }, { status: 500 })
  }

  const scope = SCOPES.join(' ')
  const state = generatePkceState()
  const codeVerifier = generateCodeVerifier()
  let codeChallenge: string
  try {
    codeChallenge = await deriveCodeChallenge(codeVerifier)
  } catch (error) {
    console.error('code_challenge_generation_failed', error)
    return c.json({ error: 'authorize_failed' }, { status: 500 })
  }

  const redirectPath = normalizeRedirectPath(c.req.query('redirectPath'))

  try {
    await storeAuthorizeState(env, state, {
      codeVerifier,
      redirectPath,
      scope,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('state_storage_failed', error)
    return c.json({ error: 'authorize_failed' }, { status: 500 })
  }

  const authorizeUrl = buildAuthorizeUrl(
    env.SPOTIFY_CLIENT_ID,
    env.SPOTIFY_REDIRECT_URI,
    scope,
    state,
    codeChallenge
  )

  return c.redirect(authorizeUrl, 302)
}

const callbackHandler = async (c: SpotifyContext) => {
  const env = c.env
  const configError = ensureEnvConfigured(env)
  if (configError) {
    return c.json({ error: configError }, { status: 500 })
  }

  const code = c.req.query('code')
  const state = c.req.query('state')

  if (!code || !state) {
    return c.json({ error: 'invalid_callback_parameters' }, { status: 400 })
  }

  const stored = await consumeAuthorizeState(env, state)
  if (!stored) {
    return c.json({ error: 'invalid_state' }, { status: 400 })
  }

  let tokenResponse: TokenEndpointResponse
  try {
    tokenResponse = await exchangeAuthorizationCode(env, { code, codeVerifier: stored.codeVerifier })
  } catch (error) {
    if (error instanceof SpotifyOAuthError) {
      console.error('token_exchange_failed', error)
      return c.json({ error: error.kind }, { status: 502 })
    }
    console.error('token_exchange_unexpected_error', error)
    return c.json({ error: 'token_exchange_failed' }, { status: 502 })
  }

  const scope = tokenResponse.scope ?? stored.scope

  let profile: SpotifyProfile
  try {
    profile = await handleProfileFetch(tokenResponse.access_token)
  } catch (error) {
    console.error('profile_fetch_failed', error)
    return c.json({ error: 'profile_fetch_failed' }, { status: 502 })
  }

  if (!profile?.id) {
    console.error('profile_missing_id')
    return c.json({ error: 'profile_invalid' }, { status: 502 })
  }

  const userId = prefixUserId(profile.id)

  try {
    await handleTokenPersistence(env, userId, tokenResponse, scope)
  } catch (error) {
    console.error('token_persist_failed', error)
    return c.json({ error: 'token_persist_failed' }, { status: 500 })
  }

  const sessionId = crypto.randomUUID()
  try {
    await storeSession(env, sessionId, {
      provider: SESSION_PROVIDER,
      userId,
      updatedAt: Math.floor(Date.now() / 1000),
    })
  } catch (error) {
    console.error('session_store_failed', error)
    return c.json({ error: 'session_store_failed' }, { status: 500 })
  }

  setSessionCookie(c, sessionId)

  return c.redirect(stored.redirectPath || DEFAULT_REDIRECT_PATH, 302)
}

const resolveSession = async (c: SpotifyContext): Promise<{ sessionId: string; userId: string } | null> => {
  const env = c.env
  const cookieName = env.SESSION_COOKIE_NAME
  const sessionId = getCookie(c, cookieName)
  if (!sessionId) return null

  const session = await loadSession(env, sessionId)
  if (!session) return null

  await touchSession(env, sessionId)
  return { sessionId, userId: session.userId }
}

const sessionHandler = async (c: SpotifyContext) => {
  const env = c.env
  const sessionInfo = await resolveSession(c)
  if (!sessionInfo) {
    return c.json({
      authenticated: false,
      provider: SESSION_PROVIDER,
      userId: null,
      spotify: { linked: false, expiresAt: null, requiresRelink: false },
    })
  }

  const tokens = await loadSpotifyTokens(env, sessionInfo.userId)
  const now = Math.floor(Date.now() / 1000)
  const requiresRelink =
    !tokens || (!tokens.refreshToken && tokens.expiresAt - now <= TOKEN_REFRESH_THRESHOLD_SECONDS)
  return c.json({
    authenticated: true,
    provider: SESSION_PROVIDER,
    userId: sessionInfo.userId,
    spotify: {
      linked: Boolean(tokens),
      expiresAt: tokens?.expiresAt ?? null,
      requiresRelink,
    },
  })
}

const ensureAuthenticated = async (c: SpotifyContext): Promise<{ sessionId: string; userId: string } | null> => {
  const session = await resolveSession(c)
  if (!session) {
    c.json({ error: 'not_authenticated' }, { status: 401 })
    return null
  }
  return session
}

const proxyGetMe = async (c: SpotifyContext, userId: string) => {
  const env = c.env
  const result = await spotifyApiFetch(env, userId, buildApiUrl('/me'))
  if (result.status === 'not_linked') {
    return c.json({ error: 'not_linked' }, { status: 401 })
  }
  if (result.status === 'requires_relink') {
    await clearSessionCookie(c)
    return c.json({ error: 'requires_relink' }, { status: 401 })
  }
  return result.response
}

const proxySearch = async (c: SpotifyContext, userId: string) => {
  const query = c.req.query('q')
  if (!query) {
    return c.json({ error: 'missing_query' }, { status: 400 })
  }
  const type = c.req.query('type') ?? 'track'
  const limit = c.req.query('limit')
  const offset = c.req.query('offset')

  const params = new URLSearchParams()
  params.set('q', query)
  params.set('type', type)
  if (limit) params.set('limit', limit)
  if (offset) params.set('offset', offset)

  const env = c.env
  const result = await spotifyApiFetch(env, userId, buildApiUrl('/search', params))
  if (result.status === 'not_linked') {
    return c.json({ error: 'not_linked' }, { status: 401 })
  }
  if (result.status === 'requires_relink') {
    await clearSessionCookie(c)
    return c.json({ error: 'requires_relink' }, { status: 401 })
  }
  return result.response
}

const proxyCreatePlaylist = async (c: SpotifyContext, userId: string) => {
  let body: { name?: unknown; description?: unknown; public?: unknown }
  try {
    body = await c.req.json()
  } catch (error) {
    return c.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    return c.json({ error: 'invalid_name' }, { status: 400 })
  }

  const payload = {
    name: body.name,
    description: typeof body.description === 'string' ? body.description : undefined,
    public: typeof body.public === 'boolean' ? body.public : false,
  }

  const env = c.env
  const url = buildApiUrl(`/users/${encodeURIComponent(extractSpotifyUserId(userId))}/playlists`)
  const result = await spotifyApiFetch(env, userId, url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'content-type': 'application/json',
    },
  })

  if (result.status === 'not_linked') {
    return c.json({ error: 'not_linked' }, { status: 401 })
  }
  if (result.status === 'requires_relink') {
    await clearSessionCookie(c)
    return c.json({ error: 'requires_relink' }, { status: 401 })
  }

  return result.response
}

const proxyAddTracks = async (c: SpotifyContext, userId: string) => {
  const playlistId = c.req.param('playlistId')
  if (!playlistId) {
    return c.json({ error: 'missing_playlist_id' }, { status: 400 })
  }

  let body: { uris?: unknown }
  try {
    body = await c.req.json()
  } catch (error) {
    return c.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (!Array.isArray(body.uris) || body.uris.some((uri) => typeof uri !== 'string')) {
    return c.json({ error: 'invalid_uris' }, { status: 400 })
  }

  const env = c.env
  const url = buildApiUrl(`/playlists/${encodeURIComponent(playlistId)}/tracks`)
  const result = await spotifyApiFetch(env, userId, url, {
    method: 'POST',
    body: JSON.stringify({ uris: body.uris }),
    headers: {
      'content-type': 'application/json',
    },
  })

  if (result.status === 'not_linked') {
    return c.json({ error: 'not_linked' }, { status: 401 })
  }
  if (result.status === 'requires_relink') {
    await clearSessionCookie(c)
    return c.json({ error: 'requires_relink' }, { status: 401 })
  }

  return result.response
}

const createSpotifyApiRouter = () => {
  const router = new Hono<{ Bindings: SpotifyBindings }>()

  router.get('/connect', authorizeHandler)
  router.get('/session', sessionHandler)

  router.get('/me', async (c) => {
    const session = await ensureAuthenticated(c)
    if (!session) return c.res
    return proxyGetMe(c, session.userId)
  })

  router.get('/search', async (c) => {
    const session = await ensureAuthenticated(c)
    if (!session) return c.res
    return proxySearch(c, session.userId)
  })

  router.post('/playlists', async (c) => {
    const session = await ensureAuthenticated(c)
    if (!session) return c.res
    return proxyCreatePlaylist(c, session.userId)
  })

  router.post('/playlists/:playlistId/tracks', async (c) => {
    const session = await ensureAuthenticated(c)
    if (!session) return c.res
    return proxyAddTracks(c, session.userId)
  })

  return router
}

const createSpotifyAuthRouter = () => {
  const router = new Hono<{ Bindings: SpotifyBindings }>()

  router.get('/callback', callbackHandler)

  return router
}

export { createSpotifyApiRouter, createSpotifyAuthRouter }
