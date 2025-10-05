import type { SpotifyBindings, SpotifyProfile } from './types'

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const PROFILE_ENDPOINT = 'https://api.spotify.com/v1/me'

export type TokenEndpointResponse = {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

export class SpotifyOAuthError extends Error {
  constructor(
    message: string,
    readonly kind: 'token_exchange_failed' | 'token_refresh_failed' | 'profile_fetch_failed',
    readonly status: number,
    readonly spotifyError?: string
  ) {
    super(message)
  }
}

const parseTokenResponse = async (
  response: Response,
  kind: SpotifyOAuthError['kind']
): Promise<TokenEndpointResponse> => {
  if (response.ok) {
    return (await response.json()) as TokenEndpointResponse
  }

  let spotifyError: string | undefined
  try {
    const text = await response.text()
    if (text) {
      try {
        const body = JSON.parse(text) as { error?: unknown }
        if (typeof body?.error === 'string') {
          spotifyError = body.error
        } else if (body?.error && typeof body.error === 'object') {
          const errorObj = body.error as { message?: unknown }
          if (typeof errorObj.message === 'string') spotifyError = errorObj.message
        }
      } catch (parseError) {
        spotifyError = text.slice(0, 200)
      }
    }
  } catch (error) {
    console.error('token_response_parse_failed', error)
  }

  throw new SpotifyOAuthError('Spotify token request failed', kind, response.status, spotifyError)
}

export const exchangeAuthorizationCode = async (
  env: SpotifyBindings,
  params: { code: string; codeVerifier: string }
): Promise<TokenEndpointResponse> => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
    client_id: env.SPOTIFY_CLIENT_ID,
    client_secret: env.SPOTIFY_CLIENT_SECRET,
    code_verifier: params.codeVerifier,
  })

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  return parseTokenResponse(response, 'token_exchange_failed')
}

export const refreshAccessToken = async (
  env: SpotifyBindings,
  refreshToken: string
): Promise<TokenEndpointResponse> => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.SPOTIFY_CLIENT_ID,
    client_secret: env.SPOTIFY_CLIENT_SECRET,
  })

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  return parseTokenResponse(response, 'token_refresh_failed')
}

export const fetchSpotifyProfile = async (accessToken: string): Promise<SpotifyProfile> => {
  const response = await fetch(PROFILE_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    let spotifyError: string | undefined
    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === 'string') spotifyError = body.error
    } catch (error) {
      console.error('profile_response_parse_failed', error)
    }
    throw new SpotifyOAuthError('Spotify profile fetch failed', 'profile_fetch_failed', response.status, spotifyError)
  }

  return (await response.json()) as SpotifyProfile
}
