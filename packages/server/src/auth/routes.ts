import { Hono } from 'hono'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { CookieOptions } from 'hono/utils/cookie'
import type { AuthBindings, SessionSyncPayload } from '../bindings'
import {
  deleteSession,
  deleteState,
  loadSession,
  loadSpotifyTokens,
  loadState,
  storeSession,
  storeSpotifyTokens,
  storeState,
} from './storage'
import { buildAuthorizeUrl, buildLogoutUrl, decodeIdToken, exchangeAuthorizationCode } from './auth0'
import { deriveCodeChallenge, generateCodeVerifier, generatePkceState } from '../utils/pkce'
import { encryptString } from '../utils/crypto'

const authApp = new Hono<{ Bindings: AuthBindings }>()

type AuthContext = Context<{ Bindings: AuthBindings }>

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

const buildRedirectPath = (redirectPath: string): string => {
  if (!redirectPath) return '/'
  if (redirectPath.startsWith('http://') || redirectPath.startsWith('https://')) return '/'
  if (!redirectPath.startsWith('/')) return `/${redirectPath}`
  return redirectPath
}

const sessionCookieOptions = (c: AuthContext): CookieOptions => ({
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
  domain: c.env.SESSION_COOKIE_DOMAIN,
})

const setSessionCookie = (c: AuthContext, value: string, maxAge: number) => {
  setCookie(c, c.env.SESSION_COOKIE_NAME, value, {
    ...sessionCookieOptions(c),
    maxAge,
  })
}

const clearSessionCookie = (c: AuthContext) => {
  deleteCookie(c, c.env.SESSION_COOKIE_NAME, {
    ...sessionCookieOptions(c),
    path: '/',
  })
}

authApp.get('/api/auth/login', async (c) => {
  const redirectPath = c.req.query('redirectPath') ?? '/'
  const state = generatePkceState()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await deriveCodeChallenge(codeVerifier)

  await storeState(c.env, state, {
    codeVerifier,
    redirectPath,
    createdAt: new Date().toISOString(),
  })

  const authorizeUrl = buildAuthorizeUrl(c.env, { state, codeChallenge })
  return c.redirect(authorizeUrl)
})

authApp.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')

  if (!code || !state) {
    return c.json({ error: 'invalid_request' }, 400)
  }

  const stateRecord = await loadState(c.env, state)
  await deleteState(c.env, state)

  if (!stateRecord) {
    return c.json({ error: 'invalid_state' }, 400)
  }

  try {
    const tokens = await exchangeAuthorizationCode(c.env, code, stateRecord.codeVerifier)
    const payload = decodeIdToken(tokens.idToken)
    const userId = typeof payload.sub === 'string' ? payload.sub : undefined
    if (!userId) throw new Error('ID token missing sub claim')

    const sessionId = crypto.randomUUID()
    const now = nowSeconds()
    const expiresAt = now + tokens.expiresIn

    const auth0AccessToken = await encryptString(c.env.SESSION_CRYPTO_KEY, tokens.accessToken)
    const auth0RefreshToken = tokens.refreshToken
      ? await encryptString(c.env.SESSION_CRYPTO_KEY, tokens.refreshToken)
      : undefined

    await storeSession(c.env, sessionId, {
      userId,
      auth0AccessToken,
      auth0RefreshToken,
      expiresAt,
      updatedAt: now,
    })

    const redirectTarget = buildRedirectPath(stateRecord.redirectPath)
    const maxAge = Math.max(tokens.expiresIn, 60)
    setSessionCookie(c, sessionId, maxAge)

    return c.redirect(redirectTarget)
  } catch (error) {
    console.error('Auth callback failed', error)
    return c.json({ error: 'callback_failed' }, 502)
  }
})

authApp.get('/api/auth/session', async (c) => {
  const sessionId = getCookie(c, c.env.SESSION_COOKIE_NAME)
  if (!sessionId) {
    return c.json({ authenticated: false })
  }

  const session = await loadSession(c.env, sessionId)
  if (!session) {
    clearSessionCookie(c)
    return c.json({ authenticated: false })
  }

  const spotifyTokens = await loadSpotifyTokens(c.env, session.userId)
  const now = nowSeconds()

  c.header('Cache-Control', 'no-store')

  return c.json({
    authenticated: true,
    userId: session.userId,
    auth0: {
      expiresAt: session.expiresAt,
      updatedAt: session.updatedAt,
    },
    spotify: {
      linked: Boolean(spotifyTokens),
      scope: spotifyTokens?.scope,
      expiresAt: spotifyTokens?.expiresAt ?? null,
      updatedAt: spotifyTokens?.updatedAt ?? null,
      requiresRelink: !spotifyTokens || spotifyTokens.expiresAt <= now,
    },
  })
})

authApp.post('/api/auth/logout', async (c) => {
  const sessionId = getCookie(c, c.env.SESSION_COOKIE_NAME)
  if (sessionId) {
    await deleteSession(c.env, sessionId)
  }
  clearSessionCookie(c)
  return c.redirect(buildLogoutUrl(c.env))
})

authApp.post('/api/internal/auth0/session-sync', async (c) => {
  const signature = c.req.header('X-Session-Sync')
  if (signature !== c.env.SESSION_SYNC_TOKEN) {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }

  let payload: SessionSyncPayload
  try {
    payload = (await c.req.json()) as SessionSyncPayload
  } catch (error) {
    console.error('Failed to parse session-sync payload', error)
    return c.json({ ok: false, error: 'invalid_json' }, 400)
  }

  if (!payload.auth0UserId || !payload.accessToken || typeof payload.expiresAt !== 'number') {
    return c.json({ ok: false, error: 'invalid_payload' }, 400)
  }

  const now = nowSeconds()
  const encryptedAccessToken = await encryptString(c.env.SESSION_CRYPTO_KEY, payload.accessToken)

  const existing = await loadSpotifyTokens(c.env, payload.auth0UserId)

  let encryptedRefreshToken: string | undefined
  if (payload.refreshToken) {
    encryptedRefreshToken = await encryptString(c.env.SESSION_CRYPTO_KEY, payload.refreshToken)
  } else if (existing?.encryptedRefreshToken) {
    encryptedRefreshToken = existing.encryptedRefreshToken
  }

  await storeSpotifyTokens(c.env, payload.auth0UserId, {
    encryptedAccessToken,
    encryptedRefreshToken,
    scope: payload.scope ?? existing?.scope,
    expiresAt: payload.expiresAt,
    updatedAt: now,
  })

  return c.json({ ok: true })
})

export default authApp
