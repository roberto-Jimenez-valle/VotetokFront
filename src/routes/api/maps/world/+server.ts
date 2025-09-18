import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ fetch, url }) => {
  const res = await fetch('/maps/world.topojson.json');
  if (!res.ok) {
    return json({ error: 'Map not found' }, { status: 404 });
  }
  const data = await res.json();
  return json(data);
};
