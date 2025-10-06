import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  // Retornar datos vacíos - este endpoint ya no usa votes-example.json
  return json({ votes: [] });
};
