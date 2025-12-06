import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
  try {
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
  
  const { optionId, userId, latitude, longitude, subdivisionId } = body;

  console.log('[API Vote] 📥 Voto recibido y parseado:', {
    pollId: id,
    optionId,
    userId: userId || 'anónimo',
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

  // Verificar si el usuario ya votó
  const ipAddress = getClientAddress();
  console.log('[API Vote] 🔍 Verificando voto existente para userId:', userId, 'IP:', ipAddress);
  
  let existingVote;
  
  if (isMultiplePoll) {
    // ENCUESTA MÚLTIPLE: buscar si ya votó por esta OPCIÓN específica
    existingVote = await prisma.vote.findFirst({
      where: {
        pollId: Number(id),
        optionId: optionId,  // Buscar por opción específica
        OR: [
          userId ? { userId: Number(userId) } : { ipAddress },
          { ipAddress },
        ],
      },
    });
    console.log('[API Vote] 🔄 Múltiple: Buscando voto para opción específica:', optionId);
  } else {
    // ENCUESTA SIMPLE: buscar si ya votó en cualquier opción
    existingVote = await prisma.vote.findFirst({
      where: {
        pollId: Number(id),
        OR: [
          userId ? { userId: Number(userId) } : { ipAddress },
          { ipAddress },
        ],
      },
    });
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
    // IMPORTANTE: Incluir ipAddress para que se pueda encontrar después
    vote = await prisma.vote.update({
      where: { id: existingVote.id },
      data: {
        optionId,
        userId: userId || null,
        ipAddress, // <-- Agregar IP para que GET pueda encontrarlo
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
        userId: userId || null,
        latitude,
        longitude,
        subdivisionId,
        ipAddress,
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

export const DELETE: RequestHandler = async ({ params, request, getClientAddress, locals }) => {
  try {
    console.log('[API Vote DELETE] 🗑️ Iniciando eliminación de voto(s)');
    
    const { id } = params;
    
    // Obtener userId del contexto de sesión (locals.user) o null para anónimos
    const userId = locals.user?.userId || locals.user?.id || null;
    const ipAddress = getClientAddress();
    
    console.log('[API Vote DELETE] locals.user:', locals.user);
    console.log('[API Vote DELETE] Buscando votos para pollId:', id, 'userId:', userId, 'IP:', ipAddress);
    
    // Buscar TODOS los votos del usuario en esta encuesta (para múltiples)
    const existingVotes = await prisma.vote.findMany({
      where: {
        pollId: Number(id),
        OR: [
          userId ? { userId: Number(userId) } : { ipAddress },
          { ipAddress },
        ],
      },
    });
    
    if (existingVotes.length === 0) {
      console.log('[API Vote DELETE] ⚠️ No se encontraron votos para eliminar');
      throw error(404, 'No se encontraron votos');
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
