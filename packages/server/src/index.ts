import { Hono } from 'hono'
import { createSpotifyApiRouter, createSpotifyAuthRouter } from './spotify/router'
import type { SpotifyBindings } from './spotify/types'

const app = new Hono<{ Bindings: SpotifyBindings }>()

const spotifyApiRouter = createSpotifyApiRouter()
const spotifyAuthRouter = createSpotifyAuthRouter()

app.route('/api/spotify', spotifyApiRouter)
app.route('/auth/spotify', spotifyAuthRouter)

app.get('/health', (c) => {
  console.log('SPOTIFY_CLIENT_ID:', c.env.SPOTIFY_CLIENT_ID)
  return c.json({ ok: true })
})

export default app
