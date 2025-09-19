import type { RequestHandler } from '@sveltejs/kit';
import { open as fsOpen, stat as fsStat } from 'node:fs/promises';
import path from 'node:path';

// Absolute path to the PMTiles file on disk
const PMTILES_PATH = path.resolve(process.cwd(), 'static', 'maps', 'geoBoundariesCGAZ_ADM1.pmtiles');

// Detect content type from tile bytes
function sniffContentType(buf: Uint8Array): { type: string; encoding?: string } {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { type: 'image/png' };
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    return { type: 'image/jpeg' };
  }
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return { type: 'image/webp' };
  }
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    // gzipped vector tile (mvt)
    return { type: 'application/x-protobuf', encoding: 'gzip' };
  }
  // Default to protobuf for unknown binary
  return { type: 'application/octet-stream' };
}

// Node-compatible Source for pmtiles: reads from fs and returns Uint8Array slices
class NodeFsSource {
  private fd: any;
  private key: string;
  constructor(fd: any, key: string) {
    this.fd = fd;
    this.key = key;
  }
  getKey(): string { return this.key; }
  async getBytes(a: number | { offset: number; length: number }, b?: number): Promise<ArrayBuffer> {
    const offset = typeof a === 'number' ? a : a.offset;
    const length = typeof a === 'number' ? (b as number) : a.length;
    const buf = Buffer.allocUnsafe(length);
    const { bytesRead } = await this.fd.read(buf, 0, length, offset);
    // Return a standalone ArrayBuffer with exact bytes (copy)
    const out = new ArrayBuffer(bytesRead);
    new Uint8Array(out).set(buf.subarray(0, bytesRead));
    return out;
  }
}

let pm: any | null = null;
let fd: any | null = null;
async function getPM(): Promise<any> {
  if (pm) return pm;
  const st = await fsStat(PMTILES_PATH);
  if (!st || st.size === 0) throw new Error('PMTiles file missing or empty');
  const { PMTiles } = await import('pmtiles');
  fd = await fsOpen(PMTILES_PATH, 'r');
  const source = new NodeFsSource(fd, PMTILES_PATH);
  pm = new PMTiles(source as any);
  // Validate header early
  try { pm.header?.(); } catch (e: any) { throw new Error(`Header error: ${e?.message || e}`); }
  // Ensure file handle is closed on process exit
  const closer = async () => { try { await fd?.close?.(); } catch {} };
  process.once('exit', closer);
  process.once('SIGINT', () => { closer().finally(() => process.exit()); });
  process.once('SIGTERM', () => { closer().finally(() => process.exit()); });
  return pm;
}

export const GET: RequestHandler = async ({ params }) => {
  try {
    const z = parseInt(params.z as string, 10);
    const x = parseInt(params.x as string, 10);
    const y = parseInt(params.y as string, 10);
    if (Number.isNaN(z) || Number.isNaN(x) || Number.isNaN(y)) {
      return new Response('Bad coordinates', { status: 400 });
    }

    const pmtiles = await getPM();
    // Touch header once to ensure source is valid
    try { pmtiles.header?.(); } catch (e: any) { return new Response(`Header error: ${e?.message || e}`, { status: 500 }); }

    let entry: any;
    try {
      entry = await pmtiles.getZxy(z, x, y);
    } catch (e: any) {
      const msg = (e && (e.stack || e.message)) ? (e.stack || e.message) : 'PMTiles read error';
      return new Response(msg, { status: 500 });
    }
    if (!entry) {
      // Try TMS flip for Y
      const yTms = (1 << z) - 1 - y;
      try { entry = await pmtiles.getZxy(z, x, yTms); } catch {}
      if (!entry) {
        return new Response('Tile not found', { status: 404 });
      }
    }

    // Normalize to Uint8Array for response & content sniffing
    let data: Uint8Array;
    if (entry.data instanceof Uint8Array) {
      data = entry.data;
    } else if (entry.data instanceof ArrayBuffer) {
      data = new Uint8Array(entry.data);
    } else if (entry.data && entry.data.buffer instanceof ArrayBuffer) {
      data = new Uint8Array(entry.data.buffer);
    } else {
      // In case library returns a view-like object
      try {
        data = new Uint8Array(entry.data as any);
      } catch {
        return new Response('Invalid tile data type', { status: 500 });
      }
    }
    const sniff = sniffContentType(data);

    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Content-Length', String(data.byteLength));
    headers.set('Content-Type', sniff.type);
    if (sniff.encoding) headers.set('Content-Encoding', sniff.encoding);

    return new Response(data, { status: 200, headers });
  } catch (err: any) {
    const message = err?.stack || err?.message || 'Internal Server Error';
    return new Response(message, { status: 500 });
  }
};
