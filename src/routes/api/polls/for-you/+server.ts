import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { encodePollId, encodeUserId, encodeOptionId } from '$lib/server/hashids';

/**
 * GET /api/polls/for-you
 * Obtiene encuestas personalizadas para el usuario actual
 * 
 * Algoritmo de recomendación basado en:
 * 1. Intereses del usuario (categorías con las que ha interactuado)
 * 2. Hashtags que sigue
 * 3. Usuarios que sigue
 * 4. Ubicación geográfica (país/región)
 * 5. Historial de votos y patrones de comportamiento
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? '10')));
    
    // Obtener userId del query param (simulación de autenticación)
    // En producción, esto vendría de locals.user o session
    const userId = Number(url.searchParams.get('userId'));
    
    if (!userId) {
      // Si no hay usuario, devolver trending genérico
      return json({ 
        data: [], 
        meta: { 
          error: 'No user authenticated. Please provide userId or login.',
          recommendation: 'Use /api/polls/trending for global trending polls'
        } 
      });
    }

    // 1. Obtener datos del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        interests: true,
        hashtagFollows: {
          include: { hashtag: true }
        },
        following: {
          include: {
            following: {
              select: { id: true }
            }
          }
        },
        votes: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            poll: {
              select: { category: true }
            }
          }
        }
      }
    });

    if (!user) {
      return json({ data: [], meta: { error: 'User not found' } }, { status: 404 });
    }

    // 2. Calcular categorías de interés basado en historial de votos
    const categoryScores = new Map<string, number>();
    
    // Agregar categorías explícitas de intereses
    user.interests.forEach(interest => {
      categoryScores.set(interest.category, interest.score);
    });
    
    // Agregar categorías implícitas del historial de votos
    user.votes.forEach(vote => {
      if (vote.poll.category) {
        const current = categoryScores.get(vote.poll.category) || 0;
        categoryScores.set(vote.poll.category, current + 0.5);
      }
    });

    // 3. Obtener IDs de hashtags seguidos
    const followedHashtagIds = user.hashtagFollows.map(hf => hf.hashtagId);
    
    // 4. Obtener IDs de usuarios seguidos
    const followedUserIds = user.following.map(f => f.following.id);

    // 5. Construir query de búsqueda de encuestas
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 30); // Últimos 30 días

    // Obtener encuestas candidatas (excluyendo rells)
    const candidatePolls = await prisma.poll.findMany({
      where: {
        status: 'active',
        isRell: false, // Excluir rells del feed
        createdAt: { gte: dateLimit },
        // Excluir encuestas ya votadas por el usuario
        votes: {
          none: { userId: userId }
        }
      },
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
          },
          orderBy: { displayOrder: 'asc' },
        },
        hashtags: {
          include: {
            hashtag: true
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
      take: 100, // Obtener más candidatos para luego rankear
    });

    // 6. Calcular score personalizado para cada encuesta
    const pollsWithScore = candidatePolls.map(poll => {
      let personalizedScore = 0;

      // Factor 1: Categoría de interés (peso: 5.0)
      if (poll.category && categoryScores.has(poll.category)) {
        personalizedScore += categoryScores.get(poll.category)! * 5.0;
      }

      // Factor 2: Usuario seguido (peso: 10.0 - muy importante)
      if (followedUserIds.includes(poll.userId)) {
        personalizedScore += 10.0;
      }

      // Factor 3: Hashtags seguidos (peso: 3.0 por hashtag)
      const pollHashtagIds = poll.hashtags.map(ph => ph.hashtagId);
      const matchingHashtags = pollHashtagIds.filter(id => followedHashtagIds.includes(id));
      personalizedScore += matchingHashtags.length * 3.0;

      // Factor 4: Ubicación geográfica (peso: 4.0)
      // Si hay votos en la encuesta del mismo país/región
      if (user.countryIso3) {
        // Nota: necesitaríamos una query adicional para esto, por ahora es placeholder
        // Podrías agregar un campo aggregatedCountries en Poll para optimizar
      }

      // Factor 5: Engagement general (peso: 0.5)
      const totalVotes = poll._count.votes;
      const engagementScore = (
        totalVotes * 0.1 +
        poll._count.comments * 0.3 +
        poll._count.interactions * 0.2
      );
      personalizedScore += engagementScore;

      // Factor 6: Recencia (peso variable)
      const hoursOld = (Date.now() - poll.createdAt.getTime()) / (1000 * 60 * 60);
      const recencyFactor = Math.max(0, 1 - (hoursOld / 720)); // 30 días
      personalizedScore *= (1 + recencyFactor * 0.5);

      return {
        ...poll,
        personalizedScore: Math.round(personalizedScore * 100) / 100,
      };
    });

    // 7. Ordenar por score personalizado y tomar top
    // Agregar hashIds para URLs públicas
    const recommendedPolls = pollsWithScore
      .filter(p => p.personalizedScore > 0) // Solo encuestas con algún match
      .sort((a, b) => b.personalizedScore - a.personalizedScore)
      .slice(0, limit)
      .map(poll => ({
        ...poll,
        hashId: encodePollId(poll.id),
        user: poll.user ? {
          ...poll.user,
          hashId: encodeUserId(poll.user.id),
        } : null,
        options: poll.options.map(option => ({
          ...option,
          hashId: encodeOptionId(option.id),
          voteCount: option._count.votes,
          avatarUrl: option.createdBy?.avatarUrl || null,
          createdBy: option.createdBy ? {
            ...option.createdBy,
            hashId: encodeUserId(option.createdBy.id),
          } : null,
        }))
      }));

    // 8. Si no hay suficientes recomendaciones personalizadas, rellenar con trending
    if (recommendedPolls.length < limit) {
      const remaining = limit - recommendedPolls.length;
      const trendingPolls = await prisma.poll.findMany({
        where: {
          status: 'active',
          isRell: false, // Excluir rells del trending fallback
          createdAt: { gte: dateLimit },
          id: {
            notIn: recommendedPolls.map(p => p.id)
          },
          votes: {
            none: { userId: userId }
          }
        },
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
            },
            orderBy: { displayOrder: 'asc' },
          },
          hashtags: {
            include: {
              hashtag: true
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
        orderBy: { createdAt: 'desc' }, // No se puede ordenar por totalVotes virtual
        take: remaining,
      });

      // Agregar trending al final con score bajo (ya transformados con hashIds)
      trendingPolls.forEach(poll => {
        recommendedPolls.push({
          ...poll,
          hashId: encodePollId(poll.id),
          user: poll.user ? {
            ...poll.user,
            hashId: encodeUserId(poll.user.id),
          } : null,
          options: poll.options.map(option => ({
            ...option,
            hashId: encodeOptionId(option.id),
            voteCount: option._count.votes,
            avatarUrl: option.createdBy?.avatarUrl || null,
            createdBy: option.createdBy ? {
              ...option.createdBy,
              hashId: encodeUserId(option.createdBy.id),
            } : null,
          })),
          personalizedScore: 0.1,
        });
      });
    }

    return json({
      data: recommendedPolls,
      meta: {
        userId,
        totalRecommendations: recommendedPolls.length,
        categoriesTracked: Array.from(categoryScores.keys()),
        followedHashtags: user.hashtagFollows.length,
        followedUsers: followedUserIds.length,
      },
    });
  } catch (error) {
    console.error('[API] Error getting personalized polls:', error);
    // Retornar detalles del error para debugging
    return json({ 
      data: [], 
      meta: { 
        error: 'Failed to get personalized recommendations',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      } 
    }, { status: 500 });
  }
};
