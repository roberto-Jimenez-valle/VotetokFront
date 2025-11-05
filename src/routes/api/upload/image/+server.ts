/**
 * Endpoint para subir imágenes de forma segura
 * Validaciones: tipo, tamaño, escaneo básico
 */

import { json, error, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/middleware/auth';
import { rateLimitByUser } from '$lib/server/middleware/rateLimit';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Tipos MIME permitidos
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

// Extensiones permitidas
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

// Tamaño máximo: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Directorio de uploads
const UPLOAD_DIR = path.join(process.cwd(), 'static', 'uploads', 'polls');

/**
 * Validar que el archivo es realmente una imagen
 */
function validateImageSignature(buffer: Buffer): boolean {
  // Magic numbers de archivos de imagen
  const signatures = {
    jpg: [0xFF, 0xD8, 0xFF],
    png: [0x89, 0x50, 0x4E, 0x47],
    gif: [0x47, 0x49, 0x46, 0x38],
    webp: [0x52, 0x49, 0x46, 0x46] // RIFF
  };

  // Verificar los primeros bytes
  for (const [type, sig] of Object.entries(signatures)) {
    let matches = true;
    for (let i = 0; i < sig.length; i++) {
      if (buffer[i] !== sig[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }

  return false;
}

/**
 * Escaneo básico de malware (patterns comunes)
 */
function basicMalwareScan(buffer: Buffer): { safe: boolean; reason?: string } {
  const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
  
  // Patrones sospechosos
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /<iframe/i,
    /eval\(/i,
    /base64,/i,
    /<\?php/i,
    /<%/,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      return { 
        safe: false, 
        reason: `Suspicious pattern detected: ${pattern.source}` 
      };
    }
  }

  return { safe: true };
}

/**
 * Generar nombre de archivo único
 */
function generateUniqueFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const hash = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `poll_${timestamp}_${hash}${ext}`;
}

export const POST: RequestHandler = async (event) => {
  try {
    // DESARROLLO: Permitir sin autenticación en localhost
    const isDevelopment = process.env.NODE_ENV === 'development' ||
                         event.url.hostname === 'localhost' ||
                         event.url.hostname === '127.0.0.1';
    
    let user: any = null;
    
    if (!isDevelopment) {
      // Requerir autenticación en producción
      user = await requireAuth(event);
      
      // Rate limiting: máximo 50 uploads por día
      await rateLimitByUser(user.userId, user.role, 'image_upload', {
        max: 50,
        windowMs: 86400000 // 24 horas
      });
    } else {
      const authUser = event.locals.user;
      user = authUser || { userId: 1, role: 'user' };
      console.log('[DEV] Subiendo imagen sin autenticación - userId:', user.userId);
    }

    // Obtener FormData
    const formData = await event.request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      throw error(400, { 
        message: 'No se proporcionó ningún archivo',
        code: 'NO_FILE'
      });
    }

    // Validar tipo MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw error(400, {
        message: `Tipo de archivo no permitido: ${file.type}. Solo se permiten imágenes.`,
        code: 'INVALID_FILE_TYPE',
        allowed: ALLOWED_MIME_TYPES
      });
    }

    // Validar extensión
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw error(400, {
        message: `Extensión de archivo no permitida: ${ext}`,
        code: 'INVALID_EXTENSION',
        allowed: ALLOWED_EXTENSIONS
      });
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      throw error(400, {
        message: `El archivo es demasiado grande. Máximo: 5MB. Tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        code: 'FILE_TOO_LARGE',
        maxSize: MAX_FILE_SIZE,
        fileSize: file.size
      });
    }

    // Leer el archivo
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validar firma del archivo (magic numbers)
    if (!validateImageSignature(buffer)) {
      throw error(400, {
        message: 'El archivo no es una imagen válida (verificación de firma falló)',
        code: 'INVALID_IMAGE_SIGNATURE'
      });
    }

    // Escaneo básico de malware
    const scanResult = basicMalwareScan(buffer);
    if (!scanResult.safe) {
      console.error('[Upload] ⚠️ Archivo sospechoso detectado:', scanResult.reason);
      throw error(400, {
        message: 'El archivo contiene contenido sospechoso y fue rechazado',
        code: 'SUSPICIOUS_CONTENT'
      });
    }

    // Crear directorio si no existe
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generar nombre único
    const filename = generateUniqueFilename(file.name);
    const filepath = path.join(UPLOAD_DIR, filename);

    // Guardar archivo
    await writeFile(filepath, buffer);

    // URL pública (relativa a /static)
    const publicUrl = `/uploads/polls/${filename}`;

    console.log('[Upload] ✅ Imagen subida:', {
      originalName: file.name,
      filename,
      size: file.size,
      type: file.type,
      userId: user.userId
    });

    return json({
      success: true,
      url: publicUrl,
      filename,
      size: file.size,
      type: file.type
    });

  } catch (err: any) {
    console.error('[Upload] Error:', err);
    
    // Si ya es un error de SvelteKit, re-lanzarlo
    if (err.status) {
      throw err;
    }
    
    // Error genérico
    throw error(500, {
      message: 'Error al subir la imagen',
      code: 'UPLOAD_FAILED'
    });
  }
};
