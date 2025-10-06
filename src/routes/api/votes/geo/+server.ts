import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ url }) => {
  const pollId = url.searchParams.get('poll');
  const country = url.searchParams.get('country');
  const subdivision = url.searchParams.get('subdivision');
  const city = url.searchParams.get('city');

  if (!pollId) {
    throw error(400, 'Poll ID is required');
  }

  // Construir filtros
  const where: any = {
    pollId: Number(pollId),
  };

  if (country) {
    where.countryIso3 = country;
  }

  if (subdivision) {
    where.subdivisionName = subdivision;
  }

  if (city) {
    where.cityName = city;
  }

  // Obtener votos geolocalizados
  const votes = await prisma.vote.findMany({
    where,
    include: {
      option: {
        select: {
          id: true,
          optionKey: true,
          optionLabel: true,
          color: true,
        },
      },
      user: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Formatear para compatibilidad con el formato anterior
  const formattedVotes = votes.map((vote) => ({
    id: `VOTE-${vote.id}`,
    iso3: vote.countryIso3,
    lat: vote.latitude,
    lng: vote.longitude,
    tag: vote.option.optionKey,
    city: vote.cityName,
    timestamp: vote.createdAt.toISOString(),
    option: {
      key: vote.option.optionKey,
      label: vote.option.optionLabel,
      color: vote.option.color,
    },
    user: vote.user ? {
      id: vote.user.id,
      name: vote.user.displayName,
      avatar: vote.user.avatarUrl,
    } : null,
  }));

  return json({
    data: formattedVotes,
    meta: {
      total: votes.length,
      filters: {
        pollId: Number(pollId),
        country,
        subdivision,
        city,
      },
    },
  });
};
