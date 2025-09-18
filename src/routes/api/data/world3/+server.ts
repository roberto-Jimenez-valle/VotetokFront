import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ fetch }) => {
  const res = await fetch('/data/WORLD3.json');
  if (!res.ok) {
    return json({ error: 'WORLD3 data not found' }, { status: 404 });
  }
  const data = await res.json();
  return json(data);
};
