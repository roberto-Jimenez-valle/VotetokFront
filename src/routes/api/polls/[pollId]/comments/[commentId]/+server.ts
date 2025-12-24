import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal } from '$lib/server/hashids';

// DELETE - Eliminar un comentario
export const DELETE: RequestHandler = async ({ params, request }) => {
  const pollId = parsePollIdInternal(params.pollId);
  const commentId = parseInt(params.commentId);
  
  if (!pollId || isNaN(commentId)) {
    return json({ error: 'IDs inválidos' }, { status: 400 });
  }
  
  try {
    // Verificar que el comentario existe y pertenece a esta encuesta
    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        pollId
      }
    });
    
    if (!comment) {
      return json({ error: 'Comentario no encontrado' }, { status: 404 });
    }
    
    // Eliminar comentario (y sus respuestas en cascada)
    await prisma.comment.delete({
      where: { id: commentId }
    });
    
    return json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return json({ error: 'Error al eliminar comentario' }, { status: 500 });
  }
};
