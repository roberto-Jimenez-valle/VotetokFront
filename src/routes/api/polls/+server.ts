import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const data = await request.json();
    const { 
      title, 
      description, 
      category, 
      type, 
      imageUrl, 
      duration, 
      hashtags, 
      location, 
      options,
      settings,
      userId 
    } = data;

    // Validaciones
    if (!title || title.trim().length === 0) {
      return error(400, { message: 'El título es requerido' });
    }
    
    if (!options || options.length < 2) {
      return error(400, { message: 'Se requieren al menos 2 opciones' });
    }

    // Calcular closedAt basado en duration
    let closedAt: Date | null = null;
    if (duration && duration !== 'never') {
      const daysMatch = duration.match(/^(\d+)d$/);
      if (daysMatch) {
        const days = parseInt(daysMatch[1]);
        closedAt = new Date();
        closedAt.setDate(closedAt.getDate() + days);
      }
    }

    // Determinar el userId a usar
    let finalUserId = userId;
    
    // Si no se proporciona userId, intentar obtenerlo de locals (sesión)
    if (!finalUserId && locals.user) {
      finalUserId = locals.user.id;
    }
    
    // Si aún no hay userId, usar usuario demo como fallback
    if (!finalUserId) {
      const demoUser = await prisma.user.findFirst({
        where: { username: 'demo_user' }
      });
      
      if (demoUser) {
        finalUserId = demoUser.id;
      } else {
        // Crear usuario demo si no existe
        const newDemoUser = await prisma.user.create({
          data: {
            username: 'demo_user',
            email: 'demo@votetok.com',
            displayName: 'Usuario Demo',
            role: 'user',
            verified: false
          }
        });
        finalUserId = newDemoUser.id;
      }
    }

    // Crear la encuesta con opciones y hashtags en una transacción
    const poll = await prisma.$transaction(async (tx) => {
      // Crear la encuesta
      const newPoll = await tx.poll.create({
        data: {
          userId: finalUserId,
          title: title.trim(),
          description: description?.trim() || null,
          category: category || 'general',
          type: type || 'poll',
          imageUrl: imageUrl || null,
          status: 'active',
          closedAt: closedAt,
          options: {
            create: options.map((opt: any, index: number) => ({
              optionKey: opt.optionKey,
              optionLabel: opt.optionLabel,
              color: opt.color,
              createdById: opt.createdById || finalUserId,
              displayOrder: opt.displayOrder ?? index
            }))
          }
        },
        include: {
          options: true,
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

      // Procesar hashtags si existen
      if (hashtags && Array.isArray(hashtags) && hashtags.length > 0) {
        for (const tag of hashtags) {
          if (!tag || tag.trim().length === 0) continue;
          
          const cleanTag = tag.trim().toLowerCase();
          
          // Crear o encontrar el hashtag
          const hashtag = await tx.hashtag.upsert({
            where: { tag: cleanTag },
            update: { usageCount: { increment: 1 } },
            create: { tag: cleanTag, usageCount: 1 }
          });

          // Asociar con el poll
          await tx.pollHashtag.create({
            data: {
              pollId: newPoll.id,
              hashtagId: hashtag.id
            }
          });
        }
      }

      return newPoll;
    });

    return json({
      success: true,
      data: poll
    });

  } catch (err: any) {
    console.error('Error creating poll:', err);
    return error(500, { message: err.message || 'Error al crear la encuesta' });
  }
};

export const GET: RequestHandler = async ({ url }) => {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');
  const userId = url.searchParams.get('userId');

  const where = {
    status: 'active',
    // Excluir rells del listado general, a menos que se filtre por userId
    // (en ese caso se incluyen los rells de ese usuario)
    ...(!userId && { isRell: false }),
    ...(category && { category }),
    ...(userId && { userId: Number(userId) }),
    ...(search && {
      OR: [
        { title: { contains: search } },
        { description: { contains: search } },
      ],
    }),
  };

  const [polls, total] = await Promise.all([
    prisma.poll.findMany({
      where,
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
        originalPoll: {
          select: {
            id: true,
            title: true,
            options: {
              orderBy: { displayOrder: 'asc' },
              include: {
                createdBy: {
                  select: {
                    id: true,
                    avatarUrl: true,
                    displayName: true
                  }
                },
                _count: {
                  select: {
                    votes: true
                  }
                }
              }
            }
          },
        },
        options: {
          orderBy: { displayOrder: 'asc' },
          include: {
            createdBy: {
              select: {
                id: true,
                avatarUrl: true,
                displayName: true
              }
            },
            _count: {
              select: {
                votes: true
              }
            }
          }
        },
        _count: {
          select: {
            votes: true,
            comments: true,
            interactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.poll.count({ where }),
  ]);

  // Transformar datos: calcular voteCount para cada opción desde votos reales
  const transformedPolls = polls.map(poll => {
    // Si es un rell sin opciones propias, usar las opciones del poll original
    let pollOptions = poll.options;
    
    if (poll.isRell && poll.originalPoll && poll.options.length === 0 && poll.originalPoll.options) {
      console.log('[API polls] ✅ Rell sin opciones, usando las del original. Rell ID:', poll.id, 'Original:', poll.originalPollId);
      pollOptions = poll.originalPoll.options;
    }
    
    return {
      ...poll,
      options: pollOptions.map((option: any) => ({
        ...option,
        voteCount: option._count?.votes || 0,
        // Mantener avatarUrl del creador para compatibilidad con frontend
        avatarUrl: option.createdBy?.avatarUrl || null
      }))
    };
  });

  return json({
    data: transformedPolls,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};
