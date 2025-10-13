import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
  console.log('═'.repeat(60));
  console.log('[API Vote] 🚀 ENDPOINT LLAMADO - Inicio del proceso de votación');
  console.log('═'.repeat(60));
  
  const { id } = params;
  console.log('[API Vote] 📌 Poll ID:', id);
  
  let body;
  try {
    body = await request.json();
    console.log('[API Vote] 📦 Body recibido:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('[API Vote] ❌ Error parseando JSON:', err);
    throw error(400, 'Invalid JSON in request body');
  }
  
  const { optionId, userId, latitude, longitude, countryIso3, countryName, subdivisionId, subdivisionName, cityName } = body;

  console.log('[API Vote] 📥 Voto recibido y parseado:', {
    pollId: id,
    optionId,
    userId: userId || 'anónimo',
    latitude,
    longitude,
    countryIso3,
    countryName,
    subdivisionId,
    subdivisionName
  });

  // Validar campos requeridos
  if (!optionId || typeof optionId !== 'number') {
    console.error('[API Vote] ❌ optionId inválido:', optionId);
    throw error(400, 'optionId es requerido y debe ser un número');
  }

  if (latitude === undefined || latitude === null || typeof latitude !== 'number') {
    console.error('[API Vote] ❌ latitude inválida:', latitude);
    throw error(400, 'latitude es requerida y debe ser un número');
  }

  if (longitude === undefined || longitude === null || typeof longitude !== 'number') {
    console.error('[API Vote] ❌ longitude inválida:', longitude);
    throw error(400, 'longitude es requerida y debe ser un número');
  }

  if (!countryIso3 || typeof countryIso3 !== 'string') {
    console.error('[API Vote] ❌ countryIso3 inválido:', countryIso3);
    throw error(400, 'countryIso3 es requerido y debe ser un string');
  }

  // Validar que la opción pertenece a la encuesta
  const option = await prisma.pollOption.findFirst({
    where: { 
      id: optionId, 
      pollId: Number(id) 
    },
  });

  if (!option) {
    console.error('[API Vote] ❌ Opción no encontrada:', optionId);
    throw error(404, 'Opción no encontrada');
  }

  // Verificar si el usuario ya votó en esta encuesta
  const ipAddress = getClientAddress();
  console.log('[API Vote] 🔍 Verificando voto existente para userId:', userId, 'IP:', ipAddress);
  
  // Buscar voto existente por userId (si está autenticado) O por IP (si es anónimo)
  const existingVote = await prisma.vote.findFirst({
    where: {
      pollId: Number(id),
      OR: [
        userId ? { userId: Number(userId) } : { ipAddress },
        { ipAddress }, // Fallback a IP si userId no coincide
      ],
    },
  });

  let vote;
  let isUpdate = false;

  if (existingVote) {
    console.log('[API Vote] 🔄 Voto existente detectado. Actualizando...');
    isUpdate = true;
    
    // Calcular diferencia de contadores entre opciones
    const oldOptionId = existingVote.optionId;
    const optionChanged = oldOptionId !== optionId;
    
    // Actualizar el voto existente con la nueva ubicación
    vote = await prisma.vote.update({
      where: { id: existingVote.id },
      data: {
        optionId,
        userId: userId || null,  // Actualizar userId si existe
        latitude,
        longitude,
        countryIso3,
        countryName,
        subdivisionId,      // Actualizar ID de subdivisión
        subdivisionName,
        cityName,
        userAgent: request.headers.get('user-agent'),
      },
    });

    console.log('[API Vote] 💾 Voto actualizado en BD...');

    // Si cambió de opción, actualizar contadores
    if (optionChanged) {
      await Promise.all([
        // Decrementar contador de la opción anterior
        prisma.pollOption.update({
          where: { id: oldOptionId },
          data: { voteCount: { decrement: 1 } },
        }),
        // Incrementar contador de la nueva opción
        prisma.pollOption.update({
          where: { id: optionId },
          data: { voteCount: { increment: 1 } },
        }),
      ]);
      console.log('[API Vote] 📊 Contadores actualizados: -1 opción', oldOptionId, '+1 opción', optionId);
    } else {
      console.log('[API Vote] ℹ️ Misma opción, solo se actualizó la ubicación');
    }

  } else {
    console.log('[API Vote] 🆕 Nuevo voto. Creando registro...');
    
    // Crear nuevo voto con subdivisionId
    vote = await prisma.vote.create({
      data: {
        pollId: Number(id),
        optionId,
        userId: userId || null,  // Guardar userId si el usuario está autenticado
        latitude,
        longitude,
        countryIso3,
        countryName,
        subdivisionId,      // Guardar ID de subdivisión
        subdivisionName,
        cityName,
        ipAddress,
        userAgent: request.headers.get('user-agent'),
      },
    });

    console.log('[API Vote] 💾 Voto guardado en BD...');

    // Actualizar contadores (nuevo voto)
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
  }

  console.log('[API Vote] ✅ Operación exitosa. ID:', vote.id, 'Tipo:', isUpdate ? 'Actualización' : 'Nuevo');

  return json({ success: true, vote, isUpdate });
};
