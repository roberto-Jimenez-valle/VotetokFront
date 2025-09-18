import { json, type RequestHandler } from '@sveltejs/kit';
import { featuredUsers } from '$lib/data/featured-users';

export const GET: RequestHandler = async () => {
  return json({ data: featuredUsers });
};
