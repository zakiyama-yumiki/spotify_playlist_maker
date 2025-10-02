import { Hono } from 'hono'
import authRouter, { type AuthBindings } from './api/auth/router'

const app = new Hono<{ Bindings: AuthBindings }>()

app.route('/api/auth', authRouter)

app.get('/health', (c) => {
  console.log('SPOTIFY_CLIENT_ID:', c.env.SPOTIFY_CLIENT_ID)
  return c.json({ ok: true })
})

export default app
