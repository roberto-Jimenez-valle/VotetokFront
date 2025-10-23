import { json, type RequestHandler } from '@sveltejs/kit';
import { FILE_MAP } from '$lib/config/file-map';

export const GET: RequestHandler = async ({ fetch, url }) => {
  const filePath = FILE_MAP.getPath('maps', 'world.topojson');
  const res = await fetch(filePath);
  if (!res.ok) {
    return json({ error: 'Map not found' }, { status: 404 });
  }
  const data = await res.json();
  return json(data);
};
