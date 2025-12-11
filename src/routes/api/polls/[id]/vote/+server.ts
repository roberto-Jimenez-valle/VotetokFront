import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const { id } = params;
    
    // 🔐 AUTENTICACIÓN OBLIGATORIA
    const userId = locals?.user?.userId;
    if (!userId) {
      console.log('[API Vote] ❌ Usuario no autenticado');
      throw error(401, 'Debes iniciar sesión para votar');
    }
    
    console.log('[API Vote] ✅ Usuario autenticado:', userId);
    
    let body;
    try {
      body = await request.json();
    } catch (err) {
      throw error(400, 'Invalid JSON in request body');
    }
  
  const { optionId, latitude, longitude, subdivisionId } = body;

  console.log('[API Vote] 📥 Voto recibido:', {
    pollId: id,
    optionId,
    userId,
    latitude,
    longitude,
    subdivisionId
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

  if (subdivisionId !== null && subdivisionId !== undefined && typeof subdivisionId !== 'number') {
    console.error('[API Vote] ❌ subdivisionId inválido:', subdivisionId);
    throw error(400, 'subdivisionId debe ser un número (ID de BD) o null');
  }

  // Validar que la opción pertenece a la encuesta y obtener info de la encuesta
  const option = await prisma.pollOption.findFirst({
    where: { 
      id: optionId, 
      pollId: Number(id) 
    },
    include: {
      poll: true  // Incluir datos de la encuesta para saber si es múltiple
    }
  });

  if (!option) {
    console.error('[API Vote] ❌ Opción no encontrada:', optionId);
    throw error(404, 'Opción no encontrada');
  }

  // Determinar si es encuesta múltiple (usar campo 'type' de la BD)
  const isMultiplePoll = option.poll.type === 'multiple';
  console.log('[API Vote] 📊 Tipo de encuesta:', option.poll.type, '| Múltiple:', isMultiplePoll);

  // Verificar si el usuario ya votó (solo por userId, no por IP)
  
  let existingVote;
  
  // AUTENTICACIÓN OBLIGATORIA: buscar solo por userId (no por IP)
  if (isMultiplePoll) {
    // ENCUESTA MÚLTIPLE: buscar si ya votó por esta OPCIÓN específica
    existingVote = await prisma.vote.findFirst({
      where: {
        pollId: Number(id),
        optionId: optionId,
        userId: Number(userId)
      },
    });
    console.log('[API Vote] 🔄 Múltiple: Buscando voto del usuario', userId, 'para opción:', optionId);
  } else {
    // ENCUESTA SIMPLE: buscar si ya votó en cualquier opción
    existingVote = await prisma.vote.findFirst({
      where: {
        pollId: Number(id),
        userId: Number(userId)
      },
    });
    console.log('[API Vote] 🔄 Simple: Buscando voto existente del usuario', userId);
  }

  let vote;
  let isUpdate = false;

  if (existingVote) {
    if (isMultiplePoll) {
      // En múltiple, si ya votó por esta opción, eliminar el voto (toggle)
      console.log('[API Vote] 🔄 Múltiple: Eliminando voto existente para opción:', optionId);
      await prisma.vote.delete({
        where: { id: existingVote.id }
      });
      console.log('[API Vote] ✅ Voto eliminado (toggle off)');
      return json({ success: true, action: 'removed', optionId });
    }
    
    console.log('[API Vote] 🔄 Simple: Voto existente detectado. Actualizando...');
    isUpdate = true;
    
    // Actualizar el voto existente con la nueva opción
    vote = await prisma.vote.update({
      where: { id: existingVote.id },
      data: {
        optionId,
        userId: Number(userId),
        latitude,
        longitude,
        subdivisionId,
        userAgent: request.headers.get('user-agent'),
      },
      include: {
        subdivision: true
      }
    });

    console.log('[API Vote] 💾 Voto actualizado en BD...');
    console.log('[API Vote] ℹ️ Los contadores se calcularán automáticamente desde los votos');

  } else {
    console.log('[API Vote] 🆕 Nuevo voto. Creando registro...');
    
    // Crear nuevo voto
    vote = await prisma.vote.create({
      data: {
        pollId: Number(id),
        optionId,
        userId: Number(userId),
        latitude,
        longitude,
        subdivisionId,
        userAgent: request.headers.get('user-agent'),
      },
      include: {
        subdivision: true  // Incluir datos de subdivisión en respuesta
      }
    });

    console.log('[API Vote] 💾 Voto guardado en BD...');
    console.log('[API Vote] ℹ️ Los contadores se calcularán automáticamente desde los votos');
  }

    console.log('[API Vote] ✅ Operación exitosa. ID:', vote.id, 'Tipo:', isUpdate ? 'Actualización' : 'Nuevo');

    return json({ success: true, vote, isUpdate });
  } catch (err: any) {
    console.error('[API Vote] ❌❌❌ ERROR CRÍTICO ❌❌❌');
    console.error('[API Vote] Error message:', err.message);
    console.error('[API Vote] Error stack:', err.stack);
    console.error('[API Vote] Error completo:', err);
    
    // Si es un error de validación de Prisma
    if (err.code === 'P2002') {
      console.error('[API Vote] ⚠️ Violación de constraint único:', err.meta);
      throw error(400, 'Ya existe un voto para esta combinación');
    }
    
    // Si es un error conocido de SvelteKit
    if (err.status) {
      throw err;
    }
    
    // Error genérico
    throw error(500, `Error al procesar el voto: ${err.message}`);
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const { id } = params;
    
    // 🔐 AUTENTICACIÓN OBLIGATORIA
    const userId = locals?.user?.userId;
    if (!userId) {
      throw error(401, 'Debes iniciar sesión para eliminar tu voto');
    }
    
    // Buscar votos del usuario en esta encuesta
    // IMPORTANTE: Convertir userId a Number para asegurar match correcto
    const existingVotes = await prisma.vote.findMany({
      where: {
        pollId: Number(id),
        userId: Number(userId)
      },
    });
    
    if (existingVotes.length === 0) {
      throw error(404, 'No tienes votos en esta encuesta');
    }
    
    // Eliminar TODOS los votos
    const deletedCount = await prisma.vote.deleteMany({
      where: {
        id: { in: existingVotes.map(v => v.id) }
      },
    });
    
    console.log('[API Vote DELETE] ✅ Votos eliminados correctamente:', deletedCount.count);
    
    return json({ success: true, message: `${deletedCount.count} voto(s) eliminado(s) correctamente`, count: deletedCount.count });
  } catch (err: any) {
    console.error('[API Vote DELETE] ❌ Error:', err);
    
    if (err.status) {
      throw err;
    }
    
    throw error(500, `Error al eliminar el voto: ${err.message}`);
  }
};
