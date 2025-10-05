import type { AuthBindings } from '../bindings'
import { fromBase64Url } from '../utils/base64'

export type AuthorizeRequest = {
  state: string
  codeChallenge: string
}

export type TokenExchangeResult = {
  accessToken: string
  refreshToken?: string
  idToken: string
  expiresIn: number
  tokenType: string
}

const textDecoder = new TextDecoder()

const buildAuth0Url = (domain: string, path: string): string => {
  const normalized = domain.startsWith('https://') ? domain : `https://${domain}`
  return `${normalized.replace(/\/$/u, '')}${path}`
}

export const buildAuthorizeUrl = (
  env: AuthBindings,
  params: AuthorizeRequest
): string => {
  const search = new URLSearchParams({
    response_type: 'code',
    client_id: env.AUTH0_CLIENT_ID,
    redirect_uri: env.AUTH0_CALLBACK_URL,
    audience: env.AUTH0_AUDIENCE,
    scope: 'openid profile email offline_access',
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  })

  if (env.AUTH0_SPOTIFY_CONNECTION) {
    search.set('connection', env.AUTH0_SPOTIFY_CONNECTION)
  }

  return `${buildAuth0Url(env.AUTH0_DOMAIN, '/authorize')}?${search.toString()}`
}

export const exchangeAuthorizationCode = async (
  env: AuthBindings,
  code: string,
  codeVerifier: string
): Promise<TokenExchangeResult> => {
  const response = await fetch(buildAuth0Url(env.AUTH0_DOMAIN, '/oauth/token'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: env.AUTH0_CLIENT_ID,
      client_secret: env.AUTH0_CLIENT_SECRET,
      code,
      redirect_uri: env.AUTH0_CALLBACK_URL,
      code_verifier: codeVerifier,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Auth0 token exchange failed: ${response.status} ${text}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    id_token: string
    expires_in: number
    token_type: string
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  }
}

export const decodeIdToken = (idToken: string): Record<string, unknown> => {
  const segments = idToken.split('.')
  if (segments.length < 2) throw new Error('Invalid ID token format')
  const payloadBytes = fromBase64Url(segments[1])
  const payload = textDecoder.decode(payloadBytes)
  return JSON.parse(payload) as Record<string, unknown>
}

export const buildLogoutUrl = (env: AuthBindings): string => {
  const search = new URLSearchParams({
    returnTo: env.AUTH0_LOGOUT_RETURN_TO,
    client_id: env.AUTH0_CLIENT_ID,
  })
  return `${buildAuth0Url(env.AUTH0_DOMAIN, '/v2/logout')}?${search.toString()}`
}
