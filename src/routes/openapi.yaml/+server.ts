import { readFileSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  try {
    const specPath = join(process.cwd(), 'src', 'lib', 'openapi', 'spec.yaml');
    const spec = readFileSync(specPath, 'utf-8');
    
    return new Response(spec, {
      headers: {
        'Content-Type': 'application/x-yaml',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('Error loading OpenAPI spec:', error);
    return new Response('OpenAPI specification not found', { status: 404 });
  }
};
