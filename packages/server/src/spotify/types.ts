export type SpotifyBindings = {
  SPOTIFY_CLIENT_ID: string
  SPOTIFY_CLIENT_SECRET: string
  SPOTIFY_REDIRECT_URI: string
  SESSION_COOKIE_NAME: string
  SESSION_COOKIE_DOMAIN?: string
  SESSION_CRYPTO_KEY: string
  KV_NAMESPACE_OAUTH_STATES: KVNamespace
  KV_AUTH_SESSIONS: KVNamespace
  KV_SPOTIFY_TOKENS: KVNamespace
}

export type StoredAuthorizeState = {
  codeVerifier: string
  redirectPath: string
  scope: string
  createdAt: string
}

export type StoredSession = {
  provider: 'spotify'
  userId: string
  updatedAt: number
}

export type StoredSpotifyTokenRecord = {
  encryptedAccessToken: string
  encryptedRefreshToken: string | null
  scope: string
  expiresAt: number
  updatedAt: number
}

export type SpotifyTokenState = {
  accessToken: string
  refreshToken: string | null
  scope: string
  expiresAt: number
  updatedAt: number
}

export type SpotifyProfile = {
  id: string
  display_name?: string
  email?: string
}
