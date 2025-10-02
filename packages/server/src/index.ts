import { Hono } from 'hono'
import authRouter from './api/auth/router'

const app = new Hono()

app.route('/api/auth', authRouter)

app.get('/health', (c) => {
  console.log('SPOTIFY_CLIENT_ID:', c.env.SPOTIFY_CLIENT_ID) // デバッグ用
  return c.json({ ok: true })
})


export default app
