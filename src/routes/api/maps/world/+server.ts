import { json, type RequestHandler } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import { join } from 'path';

export const GET: RequestHandler = async () => {
  try {
    // Leer desde static/maps/world.topojson.json
    const filePath = join(process.cwd(), 'static', 'maps', 'world.topojson.json');
    const fileContent = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    return json(data);
  } catch (error) {
    console.error('[API /api/maps/world] Error:', error);
    return json({ error: 'Map not found' }, { status: 404 });
  }
};
