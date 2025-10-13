import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const POST: RequestHandler = async ({ request }) => {
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
      settings 
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

    // Crear la encuesta con opciones y hashtags en una transacción
    const poll = await prisma.$transaction(async (tx) => {
      // Obtener o crear usuario demo (para testing)
      let user = await tx.user.findFirst({
        where: { username: 'demo_user' }
      });
      
      if (!user) {
        user = await tx.user.create({
          data: {
            username: 'demo_user',
            email: 'demo@votetok.com',
            displayName: 'Usuario Demo',
            role: 'user',
            verified: false
          }
        });
      }

      // Crear la encuesta
      const newPoll = await tx.poll.create({
        data: {
          userId: user.id,
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
              avatarUrl: opt.avatarUrl || null,
              displayOrder: opt.displayOrder ?? index,
              voteCount: 0
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

  const where = {
    status: 'active',
    ...(category && { category }),
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
        options: {
          orderBy: { displayOrder: 'asc' },
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

  return json({
    data: polls,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};
