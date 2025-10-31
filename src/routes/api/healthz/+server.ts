import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Healthcheck básico sin dependencia de BD
export const GET: RequestHandler = async () => {
  return json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
};
