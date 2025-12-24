import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { createNotification } from '$lib/server/notifications';
import { parsePollIdInternal } from '$lib/server/hashids';

// GET - Obtener comentarios de una encuesta
export const GET: RequestHandler = async ({ params }) => {
  const pollId = parsePollIdInternal(params.pollId);

  if (!pollId) {
    return json({ error: 'ID de encuesta inválido' }, { status: 400 });
  }

  try {
    const comments = await prisma.comment.findMany({
      where: {
        pollId,
        parentCommentId: null // Solo comentarios principales
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verified: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                verified: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return json({ data: comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return json({ error: 'Error al obtener comentarios' }, { status: 500 });
  }
};

// POST - Crear nuevo comentario
export const POST: RequestHandler = async ({ params, request, locals }) => {
  console.log('[Comments POST] Params:', params);
  const pollId = parsePollIdInternal(params.pollId);
  console.log('[Comments POST] Parsed ID:', pollId);

  if (!pollId) {
    return json({ error: 'ID de encuesta inválido' }, { status: 400 });
  }

  // 🔐 AUTENTICACIÓN OBLIGATORIA - usar userId del JWT, no del body
  const userId = locals.user?.userId;
  if (!userId) {
    return json({ error: 'Debes iniciar sesión para comentar' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { content, parentCommentId } = body;

    if (!content || !String(content).trim()) {
      return json({ error: 'El comentario no puede estar vacío' }, { status: 400 });
    }

    // Verificar que la encuesta existe
    const poll = await prisma.poll.findUnique({
      where: { id: pollId }
    });

    if (!poll) {
      return json({ error: 'Encuesta no encontrada' }, { status: 404 });
    }

    // Crear comentario
    console.log('[Comments POST] Creating comment with:', {
      pollId,
      userId,
      content: String(content).trim(),
      parentCommentId: parentCommentId || null
    });

    const comment = await prisma.comment.create({
      data: {
        pollId,
        userId,
        content: String(content).trim(),
        parentCommentId: parentCommentId || null
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verified: true
          }
        }
      }
    });
    
    console.log('[Comments POST] Comment created successfully:', comment.id);

    // Notificar al creador de la encuesta
    try {
      createNotification({
        userId: poll.userId,
        actorId: Number(userId),
        type: 'COMMENT',
        message: 'comentó en',
        data: {
          pollId: poll.id,
          pollTitle: poll.title,
          commentId: comment.id
        }
      }).catch(err => console.error('[Comment Notification] Error:', err));
    } catch (e) {
      console.error('[Comment Notification Trigger] Error:', e);
    }

    // PROCESAR MENCIONES
    try {
      // Buscar patrones @username
      const mentionRegex = /@(\w+)/g;
      const matches = [...String(content).matchAll(mentionRegex)];
      const mentionedUsernames = [...new Set(matches.map(m => m[1]))]; // Unique usernames

      if (mentionedUsernames.length > 0) {
        // Buscar usuarios por username
        prisma.user.findMany({
          where: {
            username: { in: mentionedUsernames },
            id: { not: Number(userId) } // No notificarse a sí mismo
          },
          select: { id: true, username: true }
        }).then(mentionedUsers => {
          // Crear notificaciones para cada usuario mencionado
          mentionedUsers.forEach(user => {
            createNotification({
              userId: user.id,
              actorId: Number(userId),
              type: 'MENTION',
              message: 'te mencionó en un comentario',
              data: {
                pollId: poll.id,
                pollTitle: poll.title,
                commentId: comment.id,
                contentSnippet: String(content).length > 50 ? String(content).substring(0, 47) + '...' : String(content)
              }
            }).catch(err => console.error(`[Mention Notification] Error notifying ${user.username}:`, err));
          });
        }).catch(err => console.error('[Mention Processing] Error:', err));
      }
    } catch (mentionError) {
      console.error('[Mention Logic] Error:', mentionError);
      // No fallar el request completo si falla la lógica de menciones
    }

    return json({ data: comment }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating comment:', error);
    return json({ 
      error: 'Error al crear comentario', 
      details: error.message || String(error) 
    }, { status: 500 });
  }
};
