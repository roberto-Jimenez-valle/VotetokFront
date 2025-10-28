import { json, error, type RequestHandler } from '@sveltejs/kit';
import { fetchMetadata } from '$lib/server/metadata';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { url } = await request.json();
    
    if (!url || typeof url !== 'string') {
      throw error(400, { message: 'URL es requerida' });
    }

    // Validar formato de URL
    let validUrl: string;
    try {
      validUrl = new URL(url).href;
    } catch {
      throw error(400, { message: 'URL inválida' });
    }

    // Obtener metadatos
    const metadata = await fetchMetadata(validUrl);
    
    if (!metadata) {
      throw error(400, { message: 'No se pudo obtener información de la URL' });
    }

    // Generar thumbnail personalizado si es necesario
    const thumbnailUrl = await generateCustomThumbnail(validUrl, metadata);

    return json({
      success: true,
      data: {
        url: validUrl,
        title: metadata.title,
        description: metadata.description,
        image: thumbnailUrl || metadata.image,
        type: detectContentType(validUrl, metadata),
        isValid: true
      }
    });

  } catch (err: any) {
    console.error('[Validate Preview] Error:', err);
    return error(500, { 
      message: err.message || 'Error al validar la URL',
      code: 'VALIDATION_ERROR'
    });
  }
};

function detectContentType(url: string, metadata: any): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'video';
  if (url.includes('spotify.com')) return 'audio';
  if (url.includes('vimeo.com')) return 'video';
  if (url.includes('soundcloud.com')) return 'audio';
  if (url.includes('twitch.tv')) return 'video';
  if (url.includes('instagram.com')) return 'image';
  if (url.includes('tiktok.com')) return 'video';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'text';
  if (url.includes('facebook.com')) return 'social';
  if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) return 'image';
  return 'website';
}

async function generateCustomThumbnail(url: string, metadata: any): Promise<string | null> {
  try {
    const hostname = new URL(url).hostname;
    const title = metadata.title || 'Contenido';
    const description = metadata.description || hostname;
    
    // Para plataformas específicas, generar thumbnails personalizados
    if (url.includes('instagram.com')) {
      return generateSocialThumbnail('Instagram', title, '#E4405F', '#fff');
    }
    if (url.includes('tiktok.com')) {
      return generateSocialThumbnail('TikTok', title, '#000', '#fff');
    }
    if (url.includes('twitter.com') || url.includes('x.com')) {
      return generateSocialThumbnail('X', title, '#1DA1F2', '#fff');
    }
    if (url.includes('facebook.com')) {
      return generateSocialThumbnail('Facebook', title, '#1877F2', '#fff');
    }
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return generateVideoThumbnail('YouTube', title, '#FF0000', '#fff');
    }
    if (url.includes('spotify.com')) {
      return generateAudioThumbnail('Spotify', title, '#1DB954', '#fff');
    }
    
    // Para imágenes directas, no generar thumbnail personalizado
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
      return null;
    }
    
    // Thumbnail genérico para otros sitios
    return generateGenericThumbnail(hostname, title, description);
    
  } catch (err) {
    console.error('[Generate Thumbnail] Error:', err);
    return null;
  }
}

function generateSocialThumbnail(platform: string, title: string, bgColor: string, textColor: string): string {
  const encodedTitle = encodeURIComponent(title.substring(0, 50));
  const encodedPlatform = encodeURIComponent(platform);
  return `https://ui-avatars.com/api/?name=${encodedPlatform}&background=${bgColor.replace('#', '')}&color=${textColor.replace('#', '')}&size=220&font-size=0.6&bold=true`;
}

function generateVideoThumbnail(platform: string, title: string, bgColor: string, textColor: string): string {
  const encodedTitle = encodeURIComponent(title.substring(0, 30));
  const encodedPlatform = encodeURIComponent(platform);
  return `https://ui-avatars.com/api/?name=${encodedPlatform}&background=${bgColor.replace('#', '')}&color=${textColor.replace('#', '')}&size=220&font-size=0.5&bold=true`;
}

function generateAudioThumbnail(platform: string, title: string, bgColor: string, textColor: string): string {
  const encodedTitle = encodeURIComponent(title.substring(0, 30));
  const encodedPlatform = encodeURIComponent(platform);
  return `https://ui-avatars.com/api/?name=${encodedPlatform}&background=${bgColor.replace('#', '')}&color=${textColor.replace('#', '')}&size=220&font-size=0.5&bold=true`;
}

function generateGenericThumbnail(hostname: string, title: string, description: string): string {
  const domain = hostname.replace('www.', '');
  const firstLetter = domain.charAt(0).toUpperCase();
  return `https://ui-avatars.com/api/?name=${firstLetter}&background=333&color=fff&size=220&font-size=0.8&bold=true`;
}
