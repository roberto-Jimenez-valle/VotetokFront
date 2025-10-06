import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
  const { id } = params;
  const body = await request.json();
  const { optionId, latitude, longitude, countryIso3, countryName, subdivisionId, subdivisionName, cityName } = body;

  // Validar que la opción pertenece a la encuesta
  const option = await prisma.pollOption.findFirst({
    where: { 
      id: optionId, 
      pollId: Number(id) 
    },
  });

  if (!option) {
    throw error(404, 'Opción no encontrada');
  }

  // Prevenir votos duplicados por IP (opcional)
  const ipAddress = getClientAddress();
  const existingVote = await prisma.vote.findFirst({
    where: {
      pollId: Number(id),
      ipAddress,
    },
  });

  if (existingVote) {
    throw error(400, 'Ya has votado en esta encuesta');
  }

  // 🔥 MEJORADO: Crear voto con subdivisionId
  const vote = await prisma.vote.create({
    data: {
      pollId: Number(id),
      optionId,
      latitude,
      longitude,
      countryIso3,
      countryName,
      subdivisionId,      // 🔥 NUEVO: Guardar ID de subdivisión
      subdivisionName,
      cityName,
      ipAddress,
      userAgent: request.headers.get('user-agent'),
    },
  });

  // Actualizar contadores
  await Promise.all([
    prisma.pollOption.update({
      where: { id: optionId },
      data: { voteCount: { increment: 1 } },
    }),
    prisma.poll.update({
      where: { id: Number(id) },
      data: { totalVotes: { increment: 1 } },
    }),
  ]);

  return json({ success: true, vote });
};
