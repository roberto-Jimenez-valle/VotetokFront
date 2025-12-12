import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { requireAuth } from '$lib/server/middleware/auth';
import { rateLimitByUser } from '$lib/server/middleware/rateLimit';
import { sanitizePollData } from '$lib/server/utils/sanitize';
import {
  validateTitle,
  validateDescription,
  validateOptions,
  validateHexColor,
  validateUrl,
  validateHashtags,
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  OPTIONS_MIN_COUNT,
  OPTIONS_MAX_COUNT,
  HASHTAGS_MAX_COUNT
} from '$lib/validation/pollValidation';

export const POST: RequestHandler = async (event) => {
  try {
    // DESARROLLO: Permitir crear encuestas sin autenticación en localhost e IPs locales
    const isDevelopment = process.env.NODE_ENV === 'development' ||
                         event.url.hostname === 'localhost' ||
                         event.url.hostname === '127.0.0.1' ||
                         event.url.hostname.startsWith('192.168.') ||
                         event.url.hostname.startsWith('172.') ||
                         event.url.hostname.startsWith('10.');
    
    let user: any = null;
    
    if (!isDevelopment) {
      // REQUERIR AUTENTICACIÓN - Solo usuarios logueados pueden crear encuestas
      user = await requireAuth(event);
      
      // RATE LIMITING - Máximo 20 encuestas por día
      await rateLimitByUser(user.userId, user.role, 'poll_create');
    } else {
      // En desarrollo, usar un usuario por defecto si no está autenticado
      const authUser = event.locals.user;
      if (authUser) {
        user = authUser;
      } else {
        // Buscar o crear usuario de prueba para desarrollo
        let devUser = await prisma.user.findFirst({
          where: { email: 'dev@local.test' }
        });
        
        if (!devUser) {
          console.log('[DEV] Creando usuario de prueba...');
          devUser = await prisma.user.create({
            data: {
              email: 'dev@local.test',
              username: 'dev_user',
              displayName: 'Dev User',
              avatarUrl: null,
              bio: null,
              verified: false,
              countryIso3: 'ESP'
            }
          });
        }
        
        user = { userId: devUser.id, role: 'user' };
        console.log('[DEV] Creando encuesta sin autenticación - usando userId:', user.userId);
      }
    }
    
    const rawData = await event.request.json();
    
    // ========================================
    // SANITIZACIÓN (prevenir XSS)
    // ========================================
    const data = sanitizePollData(rawData);
    
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

    // ========================================
    // VALIDACIONES COMPLETAS
    // ========================================
    
    // Validar título
    const titleValidation = validateTitle(title);
    if (!titleValidation.valid) {
      throw error(400, { 
        message: titleValidation.error, 
        code: 'INVALID_TITLE',
        constraints: { min: TITLE_MIN_LENGTH, max: TITLE_MAX_LENGTH }
      });
    }
    
    // Validar descripción
    if (description) {
      const descValidation = validateDescription(description);
      if (!descValidation.valid) {
        throw error(400, { 
          message: descValidation.error, 
          code: 'INVALID_DESCRIPTION'
        });
      }
    }
    
    // Validar opciones
    if (!options || !Array.isArray(options)) {
      throw error(400, { 
        message: 'Las opciones son requeridas', 
        code: 'MISSING_OPTIONS'
      });
    }
    
    const optionsValidation = validateOptions(options);
    if (!optionsValidation.valid) {
      throw error(400, { 
        message: optionsValidation.error, 
        code: 'INVALID_OPTIONS',
        constraints: { min: OPTIONS_MIN_COUNT, max: OPTIONS_MAX_COUNT }
      });
    }
    
    // Validar colores de opciones
    for (const opt of options) {
      if (opt.color) {
        const colorValidation = validateHexColor(opt.color);
        if (!colorValidation.valid) {
          throw error(400, { 
            message: colorValidation.error, 
            code: 'INVALID_COLOR'
          });
        }
      }
    }
    
    // Validar URL de imagen
    if (imageUrl) {
      const urlValidation = validateUrl(imageUrl);
      if (!urlValidation.valid) {
        throw error(400, { 
          message: urlValidation.error, 
          code: 'INVALID_IMAGE_URL'
        });
      }
    }
    
    // Validar hashtags
    if (hashtags && Array.isArray(hashtags) && hashtags.length > 0) {
      const hashtagsValidation = validateHashtags(hashtags);
      if (!hashtagsValidation.valid) {
        throw error(400, { 
          message: hashtagsValidation.error, 
          code: 'INVALID_HASHTAGS',
          constraints: { max: HASHTAGS_MAX_COUNT }
        });
      }
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

    // Usar el userId del usuario autenticado
    const finalUserId = user.userId;

    // Crear la encuesta con opciones y hashtags en una transacción
    const poll = await prisma.$transaction(async (tx) => {
      // Crear la encuesta
      const newPoll = await tx.poll.create({
        data: {
          userId: finalUserId,
          title: title.trim(),
          description: description?.trim() || null,
          category: category || 'general',
          type: type || 'simple',
          imageUrl: imageUrl || null,
          status: 'active',
          closedAt: closedAt,
          options: {
            create: options.map((opt: any, index: number) => ({
              optionKey: opt.optionKey,
              optionLabel: opt.optionLabel,
              color: opt.color,
              imageUrl: opt.imageUrl || null,
              createdBy: { connect: { id: opt.createdById || finalUserId } },
              displayOrder: opt.displayOrder ?? index,
              isCorrect: opt.isCorrect || false,
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

      // Procesar hashtags si existen (ya validados y sanitizados)
      if (hashtags && Array.isArray(hashtags) && hashtags.length > 0) {
        for (const tag of hashtags) {
          if (!tag || tag.trim().length === 0) continue;
          
          // Los hashtags ya vienen sanitizados de sanitizePollData
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
    
    // Si ya es un error de validación, re-lanzarlo
    if (err.status) {
      throw err;
    }
    
    // Error genérico
    throw error(500, { 
      message: err.message || 'Error al crear la encuesta',
      code: 'INTERNAL_ERROR'
    });
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
