import { json, type RequestHandler } from '@sveltejs/kit';
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
      return json({ message: 'Invalid JSON in request body' }, { status: 400 });
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
    return json({ message: 'optionId es requerido y debe ser un número' }, { status: 400 });
  }

  if (latitude === undefined || latitude === null || typeof latitude !== 'number') {
    console.error('[API Vote] ❌ latitude inválida:', latitude);
    return json({ message: 'latitude es requerida y debe ser un número' }, { status: 400 });
  }

  if (longitude === undefined || longitude === null || typeof longitude !== 'number') {
    console.error('[API Vote] ❌ longitude inválida:', longitude);
    return json({ message: 'longitude es requerida y debe ser un número' }, { status: 400 });
  }

  if (subdivisionId !== null && subdivisionId !== undefined && typeof subdivisionId !== 'number') {
    console.error('[API Vote] ❌ subdivisionId inválido:', subdivisionId);
    return json({ message: 'subdivisionId debe ser un número (ID de BD) o null' }, { status: 400 });
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
    return json({ message: 'Opción no encontrada' }, { status: 404 });
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
        userId: userId || null,
        latitude,
        longitude,
        subdivisionId,
        userAgent: request.headers.get('user-agent'),
      },
      include: {
        subdivision: true  // Incluir datos de subdivisión en respuesta
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
      return json({ message: 'Ya existe un voto para esta combinación' }, { status: 400 });
    }
    
    // Si es un error conocido de SvelteKit
    if (err.status) {
      throw err;
    }
    
    // Error genérico
    return json({ message: `Error al procesar el voto: ${err.message}` }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, request, getClientAddress, locals }) => {
  try {
    console.log('[API Vote DELETE] 🗑️ Iniciando eliminación de voto');
    
    const { id } = params;
    
    // Obtener userId del contexto de sesión (locals.user) o null para anónimos
    const userId = locals.user?.userId || null;
    const ipAddress = getClientAddress();
    
    console.log('[API Vote DELETE] Buscando voto para pollId:', id, 'userId:', userId, 'IP:', ipAddress);
    
    // Buscar el voto existente
    const existingVote = await prisma.vote.findFirst({
      where: {
        pollId: Number(id),
        OR: [
          userId ? { userId: Number(userId) } : { ipAddress },
          { ipAddress },
        ],
      },
    });
    
    if (!existingVote) {
      console.log('[API Vote DELETE] ⚠️ No se encontró voto para eliminar');
      return json({ message: 'No se encontró el voto' }, { status: 404 });
    }
    
    // Eliminar el voto
    await prisma.vote.delete({
      where: { id: existingVote.id },
    });
    
    console.log('[API Vote DELETE] ✅ Voto eliminado correctamente:', existingVote.id);
    
    return json({ success: true, message: 'Voto eliminado correctamente' });
  } catch (err: any) {
    console.error('[API Vote DELETE] ❌ Error:', err);
    
    if (err.status) {
      throw err;
    }
    
    return json({ message: `Error al eliminar el voto: ${err.message}` }, { status: 500 });
  }
};
