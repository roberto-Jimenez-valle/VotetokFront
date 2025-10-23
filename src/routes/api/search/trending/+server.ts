import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const limit = parseInt(url.searchParams.get('limit') || '20', 10);
		const days = parseInt(url.searchParams.get('days') || '7', 10);

		// Calcular fecha límite (últimos N días)
		const dateLimit = new Date();
		dateLimit.setDate(dateLimit.getDate() - days);

		// Obtener encuestas con más votos recientes
		const trendingPolls = await prisma.$queryRaw<Array<{
			poll_id: number;
			title: string;
			votes_count: number;
		}>>`
			SELECT 
				p.id as poll_id,
				p.title,
				COUNT(v.id) as votes_count
			FROM polls p
			LEFT JOIN votes v ON v.poll_id = p.id AND v.created_at >= ${dateLimit}
			WHERE p.status = 'active'
			GROUP BY p.id, p.title
			HAVING COUNT(v.id) > 0
			ORDER BY votes_count DESC
			LIMIT ${limit}
		`;

		// Obtener detalles completos de las encuestas trending
		const pollIds = trendingPolls.map(p => p.poll_id);
		
		const polls = await prisma.poll.findMany({
			where: {
				id: { in: pollIds }
			},
			include: {
				user: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true
					}
				},
				options: {
					select: {
						id: true,
						optionKey: true,
						optionLabel: true,
						color: true
					}
				},
				_count: {
					select: {
						votes: true,
						comments: true
					}
				}
			}
		});

		// Ordenar por votos recientes y agregar el count de votos recientes
		const pollsMap = new Map(polls.map(p => [p.id, p]));
		const sortedPolls = trendingPolls
			.map(trending => {
				const poll = pollsMap.get(trending.poll_id);
				if (!poll) return null;
				
				return {
					id: poll.id,
					title: poll.title,
					description: poll.description,
					category: poll.category,
					imageUrl: poll.imageUrl,
					type: poll.type,
					createdAt: poll.createdAt,
					user: poll.user,
					options: poll.options,
					votesCount: poll._count.votes,
					recentVotesCount: Number(trending.votes_count),
					commentsCount: poll._count.comments
				};
			})
			.filter(p => p !== null);

		return json({
			success: true,
			data: sortedPolls,
			period: {
				days,
				from: dateLimit.toISOString(),
				to: new Date().toISOString()
			}
		});

	} catch (error) {
		console.error('[Trending API] Error:', error);
		return json(
			{
				success: false,
				error: 'Error al obtener tendencias',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
