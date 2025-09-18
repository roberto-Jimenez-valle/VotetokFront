import { json, type RequestHandler } from '@sveltejs/kit';

// Servimos archivos como /data/clusters-<id>.json
export const GET: RequestHandler = async ({ fetch, params }) => {
  const id = params.id;
  const res = await fetch(`/data/clusters-${id}.json`);
  if (!res.ok) {
    return json({ error: 'Clusters data not found' }, { status: 404 });
  }
  const data = await res.json();
  return json(data);
};
