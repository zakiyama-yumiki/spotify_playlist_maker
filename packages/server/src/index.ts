import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => {
  console.log('SPOTIFY_CLIENT_ID:', c.env.SPOTIFY_CLIENT_ID) // デバッグ用
  return c.json({ ok: true })
})

export default app
