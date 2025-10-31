// Servidor HTTP simple para servir la app estática en producción
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const BUILD_DIR = join(__dirname, 'build');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.topojson': 'application/json',
  '.webmanifest': 'application/manifest+json'
};

const server = createServer((req, res) => {
  let filePath = join(BUILD_DIR, req.url === '/' ? 'index.html' : req.url);
  
  // Si el archivo no existe y no es una petición a un archivo estático, servir index.html (SPA)
  if (!existsSync(filePath) && !extname(req.url)) {
    filePath = join(BUILD_DIR, 'index.html');
  }
  
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  try {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath);
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
      });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  } catch (error) {
    res.writeHead(500);
    res.end('Server error');
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
