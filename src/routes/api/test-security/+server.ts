import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { APP_SECRET, JWT_SECRET } from '$env/static/private'

export const GET: RequestHandler = async () => {
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
