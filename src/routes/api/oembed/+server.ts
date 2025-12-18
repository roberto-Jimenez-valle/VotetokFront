import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { parsePollId, encodePollId } from '$lib/server/hashids';

/**
 * oEmbed endpoint - permite que otras apps generen embeds automáticamente
 * Sigue la especificación oEmbed: https://oembed.com/
 * 
 * Uso: GET /api/oembed?url=https://votetok.com/poll/ZWk4YXxJ (hashId)
 */
export const GET: RequestHandler = async ({ url }) => {
  const targetUrl = url.searchParams.get('url');
  const format = url.searchParams.get('format') || 'json';
  const maxwidth = parseInt(url.searchParams.get('maxwidth') || '600');
  const maxheight = parseInt(url.searchParams.get('maxheight') || '400');
  
  if (!targetUrl) {
    throw error(400, 'El parámetro "url" es requerido');
  }
  
  if (format !== 'json') {
    throw error(501, 'Solo se soporta formato JSON');
  }

  // Extraer ID de la encuesta de la URL (soporta hashId y numérico)
  const pollIdMatch = targetUrl.match(/\/poll\/([^\/\?]+)/);
  if (!pollIdMatch) {
    throw error(400, 'URL no válida. Debe ser del formato: /poll/{id}');
  }
  
  const pollId = parsePollId(pollIdMatch[1]);
  if (!pollId) {
    throw error(400, 'ID de encuesta inválido');
  }

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      user: {
        select: {
          displayName: true,
          username: true,
        },
      },
      _count: {
        select: {
          votes: true,
        },
      },
    },
  });

  if (!poll) {
    throw error(404, 'Encuesta no encontrada');
  }

  const baseUrl = `${url.protocol}//${url.host}`;
  
  // Calcular dimensiones respetando maxwidth/maxheight
  const width = Math.min(maxwidth, 600);
  const height = Math.min(maxheight, 352);
  
  const hashId = encodePollId(poll.id);
  const embedUrl = `${baseUrl}/embed/poll/${hashId}?theme=dark`;
  const authorName = poll.user?.displayName || poll.user?.username || 'Usuario';

  // Respuesta oEmbed tipo "rich"
  const oembedResponse = {
    version: '1.0',
    type: 'rich',
    provider_name: 'VouTop',
    provider_url: baseUrl,
    title: poll.title,
    author_name: authorName,
    author_url: poll.user ? `${baseUrl}/user/${poll.user.username}` : undefined,
    html: `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0" allowtransparency="true" style="border-radius:12px"></iframe>`,
    width,
    height,
    thumbnail_url: `${baseUrl}/api/polls/${hashId}/og-image`,
    thumbnail_width: 1200,
    thumbnail_height: 630,
    cache_age: 3600, // 1 hora
  };

  return json(oembedResponse, {
    headers: {
      'Content-Type': 'application/json+oembed',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
