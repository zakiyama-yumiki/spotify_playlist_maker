import { refreshAccessToken, SpotifyOAuthError } from './oauth'
import {
  deleteSpotifyTokens,
  loadSpotifyTokens,
  persistSpotifyTokens,
} from './storage'
import type { SpotifyBindings, SpotifyTokenState } from './types'

export const TOKEN_REFRESH_THRESHOLD_SECONDS = 60
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

export type TokenAcquisitionResult =
  | { status: 'ok'; tokens: SpotifyTokenState }
  | { status: 'not_linked' }
  | { status: 'requires_relink' }

const needsRefresh = (tokens: SpotifyTokenState): boolean => {
  const now = Math.floor(Date.now() / 1000)
  return tokens.expiresAt - now <= TOKEN_REFRESH_THRESHOLD_SECONDS
}

export const getValidSpotifyTokens = async (
  env: SpotifyBindings,
  userId: string
): Promise<TokenAcquisitionResult> => {
  const existing = await loadSpotifyTokens(env, userId)
  if (!existing) return { status: 'not_linked' }

  if (!needsRefresh(existing)) {
    return { status: 'ok', tokens: existing }
  }

  if (!existing.refreshToken) {
    return { status: 'requires_relink' }
  }

  try {
    const refreshed = await refreshAccessToken(env, existing.refreshToken)
    const scope = refreshed.scope ?? existing.scope
    const refreshToken = refreshed.refresh_token ?? existing.refreshToken
    const persisted = await persistSpotifyTokens(env, {
      userId,
      accessToken: refreshed.access_token,
      refreshToken,
      scope,
      expiresIn: refreshed.expires_in,
    })

    return { status: 'ok', tokens: persisted }
  } catch (error) {
    if (error instanceof SpotifyOAuthError && error.spotifyError === 'invalid_grant') {
      await deleteSpotifyTokens(env, userId)
      return { status: 'requires_relink' }
    }
    throw error
  }
}

const applyAuthHeader = (init: RequestInit | undefined, accessToken: string): RequestInit => {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  return { ...init, headers }
}

type FetchResult =
  | { status: 'ok'; response: Response }
  | { status: 'requires_relink'; response?: Response }
  | { status: 'not_linked' }

export const spotifyApiFetch = async (
  env: SpotifyBindings,
  userId: string,
  input: string,
  init?: RequestInit
): Promise<FetchResult> => {
  const tokenResult = await getValidSpotifyTokens(env, userId)
  if (tokenResult.status === 'not_linked') return { status: 'not_linked' }
  if (tokenResult.status === 'requires_relink') return { status: 'requires_relink' }

  const requestInit = applyAuthHeader(init, tokenResult.tokens.accessToken)
  let response = await fetch(input, requestInit)

  if (response.status !== 401) {
    return { status: 'ok', response }
  }

  const tokensAfter401 = await getValidSpotifyTokens(env, userId)
  if (tokensAfter401.status !== 'ok') {
    await deleteSpotifyTokens(env, userId)
    return { status: 'requires_relink', response }
  }

  response = await fetch(input, applyAuthHeader(init, tokensAfter401.tokens.accessToken))
  if (response.status === 401) {
    await deleteSpotifyTokens(env, userId)
    return { status: 'requires_relink', response }
  }

  return { status: 'ok', response }
}

export const buildApiUrl = (path: string, params?: URLSearchParams): string => {
  const url = new URL(path, `${SPOTIFY_API_BASE}/`)
  if (params) {
    params.forEach((value, key) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value)
      }
    })
  }
  return url.toString()
}
