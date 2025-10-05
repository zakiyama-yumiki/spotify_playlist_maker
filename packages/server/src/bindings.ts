export type AuthBindings = {
  AUTH0_DOMAIN: string
  AUTH0_AUDIENCE: string
  AUTH0_CLIENT_ID: string
  AUTH0_CLIENT_SECRET: string
  AUTH0_CALLBACK_URL: string
  AUTH0_LOGOUT_RETURN_TO: string
  AUTH0_MGMT_CLIENT_ID: string
  AUTH0_MGMT_CLIENT_SECRET: string
  AUTH0_MGMT_AUDIENCE: string
  AUTH0_SPOTIFY_CONNECTION?: string
  SESSION_COOKIE_NAME: string
  SESSION_COOKIE_DOMAIN?: string
  SESSION_CRYPTO_KEY: string
  SESSION_SYNC_TOKEN: string
  SPOTIFY_CLIENT_ID: string
  SPOTIFY_CLIENT_SECRET: string
  KV_AUTH_SESSIONS: KVNamespace
  KV_SPOTIFY_TOKENS: KVNamespace
  KV_AUTH_INDEXES?: KVNamespace
}

export type SessionRecord = {
  userId: string
  auth0AccessToken: string
  auth0RefreshToken?: string
  expiresAt: number
  updatedAt: number
}

export type StateRecord = {
  codeVerifier: string
  redirectPath: string
  createdAt: string
}

export type SpotifyTokenRecord = {
  encryptedAccessToken: string
  encryptedRefreshToken?: string
  scope?: string
  expiresAt: number
  updatedAt: number
}

export type SessionSyncPayload = {
  auth0UserId: string
  accessToken: string
  refreshToken?: string
  scope?: string
  expiresAt: number
}
