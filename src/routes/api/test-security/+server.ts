import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'

export const GET: RequestHandler = async () => {
  const APP_SECRET = env.APP_SECRET
  const JWT_SECRET = env.JWT_SECRET
  
  return json({
    message: 'Security Test Endpoint',
    environment: {
      hasAppSecret: !!APP_SECRET,
      appSecretLength: APP_SECRET?.length || 0,
      appSecretPreview: APP_SECRET ? APP_SECRET.substring(0, 10) + '...' : 'undefined',
      hasJwtSecret: !!JWT_SECRET,
      jwtSecretLength: JWT_SECRET?.length || 0,
      jwtSecretPreview: JWT_SECRET ? JWT_SECRET.substring(0, 10) + '...' : 'undefined'
    },
    timestamp: new Date().toISOString()
  })
}
