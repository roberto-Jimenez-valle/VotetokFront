import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { EMBED_CONFIG } from '$lib/config/embed';
import { getPalette, getDefaultPalette } from '$lib/config/palettes';
import { parsePollId, encodePollId, encodeUserId } from '$lib/server/hashids';

export const load: PageServerLoad = async ({ params, url }) => {
  // SOLO acepta hashIds - IDs numéricos son rechazados
  const pollId = parsePollId(params.pollId);
  
  if (!pollId) {
    console.warn(`[Embed] ⚠️ ID inválido: ${params.pollId}`);
    throw error(400, 'ID de encuesta inválido');
  }
  
  // Sanitizar parámetros de personalización
  const theme = EMBED_CONFIG.sanitizeTheme(url.searchParams.get('theme'));
  
  // Paleta de colores (por índice o nombre, según tema)
  const paletteParam = url.searchParams.get('palette');
  const palette = getPalette(paletteParam, theme) || getDefaultPalette(theme);
  
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          verified: true,
        },
      },
      options: {
        include: {
          _count: {
            select: {
              votes: true
            }
          }
        },
        orderBy: { displayOrder: 'asc' },
      },
      _count: {
        select: {
          votes: true,
          comments: true,
        },
      },
    },
  });

  if (!poll) {
    console.warn(`[Embed] ⚠️ Encuesta no encontrada: ${pollId}`);
    throw error(404, 'Encuesta no encontrada');
  }

  // Verificar si la encuesta está cerrada
  const now = new Date();
  const isClosed = poll.closedAt && new Date(poll.closedAt) < now;
  
  // Log de acceso al embed
  console.log(`[Embed] 📊 Acceso a encuesta ${pollId} - "${poll.title.substring(0, 50)}..." - Cerrada: ${isClosed}`);
  
  // Log de opciones con sus imageUrls para debugging
  poll.options.forEach((opt, i) => {
    console.log(`[Embed] 📋 Opción ${i+1}: "${opt.optionLabel?.substring(0, 30)}" - imageUrl: ${opt.imageUrl || 'NO TIENE'}`);
  });

  // Calcular total de votos y porcentajes
  const totalVotes = poll._count.votes;
  
  // Transformar al formato esperado por el frontend
  // Incluir hashId para URLs públicas
  const transformedPoll = {
    id: poll.id,
    hashId: encodePollId(poll.id), // ID hasheado para URLs públicas
    title: poll.title,
    description: poll.description,
    createdAt: poll.createdAt.toISOString(),
    closedAt: poll.closedAt?.toISOString() || null,
    totalVotes,
    allowMultiple: poll.allowMultiple || false,
    user: poll.user ? {
      ...poll.user,
      hashId: encodeUserId(poll.user.id),
    } : null,
    options: poll.options.map(option => ({
      id: option.id,
      key: option.optionKey,
      label: option.optionLabel || `Opción ${option.optionKey}`,
      text: option.optionLabel || `Opción ${option.optionKey}`,
      color: option.color || '#6366f1',
      votes: option._count.votes,
      percentage: totalVotes > 0 ? Math.round((option._count.votes / totalVotes) * 100) : 0,
      imageUrl: option.imageUrl,
    }))
  };

  return {
    poll: transformedPoll,
    theme,
    palette,
    isClosed,
    baseUrl: `${url.protocol}//${url.host}`
  };
};
