import { Hono } from 'hono'

type AuthBindings = {
  SPOTIFY_CLIENT_ID: string
  SPOTIFY_REDIRECT_URI: string
  KV_NAMESPACE_OAUTH_STATES: KVNamespace
}

type AuthorizeRequest = {
  redirectPath?: unknown
}

type StoredAuthorizeState = {
  codeVerifier: string
  redirectPath: string | null
  scope: string
  createdAt: string
}

const SCOPES = ['playlist-modify-private', 'playlist-modify-public'] as const

const toBase64 = (input: Uint8Array): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input).toString('base64')
  }

  let binary = ''
  input.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const toBase64Url = (input: Uint8Array | ArrayBuffer): string => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

const randomBase64Url = (size: number): string => {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

const createCodeChallenge = async (codeVerifier: string): Promise<string> => {
  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier))
  return toBase64Url(digest)
}

const normalizeRedirectPath = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  if (!trimmed.startsWith('/')) {
    return null
  }
  return trimmed
}

export const createAuthRouter = () => {
  const router = new Hono<{ Bindings: AuthBindings }>()

  router.post('/authorize', async (c) => {
    const scope = SCOPES.join(' ')

    const clientId = c.env.SPOTIFY_CLIENT_ID
    const redirectUri = c.env.SPOTIFY_REDIRECT_URI
    if (!clientId || !redirectUri) {
      return c.json({ error: 'server_not_configured' }, 500)
    }

    let body: AuthorizeRequest = {}
    if (c.req.header('content-type')?.includes('application/json')) {
      try {
        body = await c.req.json<AuthorizeRequest>()
      } catch (error) {
        console.error('authorize body parse failed', error)
        return c.json({ error: 'invalid_body' }, 400)
      }
    }

    const redirectPath = normalizeRedirectPath(body.redirectPath)

    const state = randomBase64Url(32)
    const codeVerifier = randomBase64Url(64)
    let codeChallenge: string
    try {
      codeChallenge = await createCodeChallenge(codeVerifier)
    } catch (error) {
      console.error('code_challenge generation failed', error)
      return c.json({ error: 'authorize_failed' }, 500)
    }

    const statePayload: StoredAuthorizeState = {
      codeVerifier,
      redirectPath,
      scope,
      createdAt: new Date().toISOString(),
    }

    try {
      await c.env.KV_NAMESPACE_OAUTH_STATES.put(state, JSON.stringify(statePayload), {
        expirationTtl: 600,
      })
    } catch (error) {
      console.error('state storage failed', error)
      return c.json({ error: 'authorize_failed' }, 500)
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    const authorizeUrl = `https://accounts.spotify.com/authorize?${params.toString()}`
    return c.json({ authorizeUrl })
  })

  return router
}

export type { AuthBindings }

export default createAuthRouter()
