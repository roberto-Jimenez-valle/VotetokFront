import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// DELETE - Eliminar un comentario
export const DELETE: RequestHandler = async ({ params, request }) => {
  const pollId = parseInt(params.pollId);
  const commentId = parseInt(params.commentId);
  
  if (isNaN(pollId) || isNaN(commentId)) {
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
