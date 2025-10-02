import { Hono } from 'hono'

export const createAuthRouter = () => {
  const router = new Hono()

  router.post('/authorize', async (c) => {
    // PKCE の code_challenge 生成と state 保存処理
  })

  router.get('/callback', async (c) => {
    // state 検証とトークン交換処理
  })

  // 他に /refresh, /logout, /session などを順次追加

  return router
}

export default createAuthRouter()
