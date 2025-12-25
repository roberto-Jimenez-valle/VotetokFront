import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { Prisma } from '@prisma/client';
import { requireAuth } from '$lib/server/middleware/auth';
import { rateLimitByUser } from '$lib/server/middleware/rateLimit';
import { sanitizePollData } from '$lib/server/utils/sanitize';
import { encodePollId, encodeUserId, encodeOptionId } from '$lib/server/hashids';
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
      settings,
      visibility // Extraer visibility
    } = data;

    // ========================================
    // VALIDACIONES COMPLETAS
    // ========================================

    // Validar título
    const titleValidation = validateTitle(title);
    if (!titleValidation.valid) {
      throw error(400, {
        message: titleValidation.error || 'Título inválido',
        code: 'INVALID_TITLE'
      });
    }

    // Validar descripción
    if (description) {
      const descValidation = validateDescription(description);
      if (!descValidation.valid) {
        throw error(400, {
          message: descValidation.error || 'Descripción inválida',
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
        message: optionsValidation.error || 'Opciones inválidas',
        code: 'INVALID_OPTIONS'
      });
    }

    // Validar colores de opciones
    for (const opt of options) {
      if (opt.color) {
        const colorValidation = validateHexColor(opt.color);
        if (!colorValidation.valid) {
          throw error(400, {
            message: colorValidation.error || 'Color inválido',
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
          message: urlValidation.error || 'URL inválida',
          code: 'INVALID_IMAGE_URL'
        });
      }
    }

    // Validar hashtags
    if (hashtags && Array.isArray(hashtags) && hashtags.length > 0) {
      const hashtagsValidation = validateHashtags(hashtags);
      if (!hashtagsValidation.valid) {
        throw error(400, {
          message: hashtagsValidation.error || 'Hashtags inválidos',
          code: 'INVALID_HASHTAGS'
        });
      }
    }

    // Calcular closedAt basado en duration
    // Calcular closedAt basado en duration
    let closedAt: Date | null = null;
    if (duration && duration !== 'never') {
      if (duration.startsWith('custom:')) {
        // Formato custom:ISOString
        const dateStr = duration.replace('custom:', '');
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          closedAt = date;
        }
      } else {
        // Formatos cortos: 15m, 24h, 7d
        const match = duration.match(/^(\d+)([mdh])$/);
        if (match) {
          const value = parseInt(match[1]);
          const unit = match[2];
          closedAt = new Date();

          if (unit === 'm') {
            closedAt.setMinutes(closedAt.getMinutes() + value);
          } else if (unit === 'h') {
            closedAt.setHours(closedAt.getHours() + value);
          } else if (unit === 'd') {
            closedAt.setDate(closedAt.getDate() + value);
          }
        }
      }
    }

    // Usar el userId del usuario autenticado
    const finalUserId = user.userId;

    // Crear la encuesta con opciones y hashtags en una transacción
    const poll = await prisma.$transaction(async (tx) => {
      // Crear la encuesta
      let newPoll = await tx.poll.create({
        data: {
          userId: finalUserId,
          title: title.trim(),
          description: description?.trim() || null,
          category: category || 'general',
          type: type || 'simple',
          imageUrl: imageUrl || null,
          status: 'active',
          visibility: visibility || 'public',
          collabMode: settings?.collabMode || 'me',
          closedAt: closedAt,
          options: {
            create: options.map((opt: any, index: number) => ({
              optionKey: opt.optionKey,
              optionLabel: opt.optionLabel,
              color: opt.color,
              imageUrl: opt.imageUrl || null,
              createdBy: { connect: { id: opt.createdById || finalUserId } },
              displayOrder: opt.displayOrder ?? index,
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

      // ACTUALIZACIÓN TRIVIAL: Asignar opción correcta si es tipo Quiz
      if (type === 'quiz' && options) {
        const correctOptInput = options.find((o: any) => o.isCorrect);
        if (correctOptInput) {
          const createdCorrectOption = newPoll.options.find(
            (o) => o.optionKey === correctOptInput.optionKey
          );

          if (createdCorrectOption) {
            newPoll = await tx.poll.update({
              where: { id: newPoll.id },
              data: { correctOptionId: createdCorrectOption.id },
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
          }
        }
      }

      // Guardar colaboradores si el modo es "selected"
      if (settings?.collabMode === 'selected' && settings?.selectedUserIds?.length > 0) {
        const collaboratorIds = settings.selectedUserIds.map((id: any) => Number(id)).filter((n: number) => !isNaN(n));
        if (collaboratorIds.length > 0) {
          await tx.pollCollaborator.createMany({
            data: collaboratorIds.map((uid: number) => ({
              pollId: newPoll.id,
              userId: uid
            })),
            skipDuplicates: true
          });
        }
      }

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

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const userId = url.searchParams.get('userId');

    // Get current user's followed IDs for checking "isFollowing" status
    const currentUserId = locals.user?.userId;
    let followingIds = new Set<number>();
    let pendingIds = new Set<number>();
    let bookmarkedPollIds = new Set<number>();

    if (currentUserId) {
      // Get follows
      const follows = await prisma.userFollower.findMany({
        where: { followerId: currentUserId },
        select: { followingId: true, status: true }
      });
      follows.forEach(f => {
        if (f.status === 'accepted') followingIds.add(f.followingId);
        else if (f.status === 'pending') pendingIds.add(f.followingId);
      });

      // Get bookmarks
      const bookmarks = await prisma.pollInteraction.findMany({
        where: {
          userId: currentUserId,
          interactionType: 'bookmark'
        },
        select: { pollId: true }
      });
      bookmarks.forEach(b => bookmarkedPollIds.add(b.pollId));
    }

    const where = {
      status: 'active',
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

    const pollInclude = {
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
      collaborators: {
        select: { userId: true }
      }
    } satisfies Prisma.PollInclude;

    const pollsQuery = prisma.poll.findMany({
      where,
      include: pollInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const countQuery = prisma.poll.count({ where });

    const [polls, total] = await Promise.all([pollsQuery, countQuery]);

    type PollWithData = Prisma.PollGetPayload<{ include: typeof pollInclude }>;

    const transformedPolls = (polls as PollWithData[]).map(poll => {
      let pollOptions = poll.options;

      if (poll.isRell && poll.originalPoll && poll.options.length === 0 && poll.originalPoll.options) {
        // console.log('[API polls] ✅ Rell sin opciones, usando las del original. Rell ID:', poll.id);
        pollOptions = poll.originalPoll.options;
      }

      let correctOptionHashId: string | null = null;
      if (poll.correctOptionId) {
        const correctOpt = pollOptions.find(o => o.id === poll.correctOptionId);
        if (correctOpt) {
          correctOptionHashId = encodeOptionId(correctOpt.id);
        }
      }

      return {
        ...poll,
        hashId: encodePollId(poll.id),
        correctOptionHashId,
        isFollowing: followingIds.has(poll.userId),
        isPending: pendingIds.has(poll.userId),
        isBookmarked: bookmarkedPollIds.has(poll.id),
        user: poll.user ? {
          ...poll.user,
          hashId: encodeUserId(poll.user.id),
        } : null,
        options: pollOptions.map((option: any) => ({
          ...option,
          hashId: encodeOptionId(option.id),
          voteCount: option._count?.votes || 0,
          avatarUrl: option.createdBy?.avatarUrl || null,
          createdBy: option.createdBy ? {
            ...option.createdBy,
            hashId: encodeUserId(option.createdBy.id),
          } : null,
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
  } catch (error) {
    console.error('[API GET /polls] Error:', error);
    return json({ error: 'Internal Server Error', details: (error as Error).message }, { status: 500 });
  }
};
