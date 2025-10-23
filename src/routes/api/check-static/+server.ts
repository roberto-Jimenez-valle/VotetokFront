import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export const GET: RequestHandler = async () => {
  try {
    // Verificar diferentes posibles ubicaciones de archivos estáticos
    const possiblePaths = [
      join(process.cwd(), 'static'),
      join(process.cwd(), 'build', 'client'),
      join(process.cwd(), 'build', 'static'),
      join(process.cwd(), 'client'),
    ];

    const results: any = {
      cwd: process.cwd(),
      paths: {}
    };

    for (const path of possiblePaths) {
      const exists = existsSync(path);
      results.paths[path] = {
        exists,
        contents: exists ? readdirSync(path).slice(0, 10) : null
      };

      // Verificar específicamente la carpeta geojson
      const geojsonPath = join(path, 'geojson');
      if (existsSync(geojsonPath)) {
        const files = readdirSync(geojsonPath);
        results.paths[path].geojson = {
          exists: true,
          fileCount: files.length,
          sampleFiles: files.slice(0, 5)
        };
      }

      // Verificar específicamente la carpeta maps
      const mapsPath = join(path, 'maps');
      if (existsSync(mapsPath)) {
        const files = readdirSync(mapsPath);
        results.paths[path].maps = {
          exists: true,
          files: files
        };
      }
    }

    return json(results);
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
};
