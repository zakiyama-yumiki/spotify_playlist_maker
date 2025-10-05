import { Hono } from 'hono'
import spotifyAuthRouter, { type SpotifyAuthBindings } from './spotify/router'

const app = new Hono<{ Bindings: SpotifyAuthBindings }>()

app.route('/api/spotify', spotifyAuthRouter)

app.get('/health', (c) => {
  console.log('SPOTIFY_CLIENT_ID:', c.env.SPOTIFY_CLIENT_ID)
  return c.json({ ok: true })
})

export default app
