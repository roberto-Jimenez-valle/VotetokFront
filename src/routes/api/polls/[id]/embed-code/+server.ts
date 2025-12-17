import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal, encodePollId } from '$lib/server/hashids';

/**
 * Genera el código de embed para una encuesta
 * Similar a cómo Spotify genera su código de embed
 */
export const GET: RequestHandler = async ({ params, url }) => {
  // Soporta tanto IDs numéricos (interno) como hashes
  const pollId = parsePollIdInternal(params.id);
  
  if (!pollId) {
    throw error(400, 'ID de encuesta inválido');
  }

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: {
      id: true,
      title: true,
    },
  });

  if (!poll) {
    throw error(404, 'Encuesta no encontrada');
  }

  // Usar hashId para URLs públicas
  const hashId = encodePollId(poll.id);
  const baseUrl = `${url.protocol}//${url.host}`;
  
  // Parámetros opcionales del embed
  const theme = url.searchParams.get('theme') || 'dark';
  const compact = url.searchParams.get('compact') === 'true';
  const width = url.searchParams.get('width') || '100%';
  const height = url.searchParams.get('height') || '352';

  // URL del embed - usar hashId
  const embedUrl = `${baseUrl}/embed/poll/${hashId}?theme=${theme}${compact ? '&compact=true' : ''}`;
  
  // URL para compartir (con Open Graph) - usar hashId
  const shareUrl = `${baseUrl}/poll/${hashId}`;

  // Código iframe
  const iframeCode = `<iframe 
  src="${embedUrl}" 
  width="${width}" 
  height="${height}" 
  frameborder="0" 
  allowtransparency="true" 
  allow="encrypted-media"
  style="border-radius: 12px;"
></iframe>`;

  // Código HTML compacto (una línea)
  const iframeCodeCompact = `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0" allowtransparency="true" style="border-radius:12px"></iframe>`;

  return json({
    success: true,
    data: {
      pollId: poll.id,
      title: poll.title,
      embedUrl,
      shareUrl,
      oembedUrl: `${baseUrl}/api/oembed?url=${encodeURIComponent(shareUrl)}`,
      iframe: {
        code: iframeCode,
        codeCompact: iframeCodeCompact,
        width,
        height,
      },
      options: {
        theme,
        compact,
        availableThemes: ['dark', 'light'],
      }
    }
  });
};
