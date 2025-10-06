/**
 * Script de diagnóstico para verificar datos de subdivisiones
 * 
 * Uso: npx tsx scripts/diagnose-subdivision-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	
	// 1. Verificar que existen votos con subdivision_id
	const votesWithSubdivision = await prisma.vote.count({
		where: {
			subdivisionId: {
				not: null
			}
		}
	});

	
	if (votesWithSubdivision === 0) {
						return;
	}

	// 2. Verificar votos por país
	const votesByCountry = await prisma.vote.groupBy({
		by: ['countryIso3'],
		where: {
			subdivisionId: {
				not: null
			}
		},
		_count: true
	});

		for (const country of votesByCountry) {
			}

	// 3. Verificar subdivisiones de España
	const spainSubdivisions = await prisma.vote.groupBy({
		by: ['subdivisionId', 'subdivisionName'],
		where: {
			countryIso3: 'ESP',
			subdivisionId: {
				not: null
			}
		},
		_count: true
	});

		for (const sub of spainSubdivisions) {
			}

	// 4. Verificar encuestas activas
	const activePolls = await prisma.poll.findMany({
		where: { status: 'active' },
		include: {
			options: true,
			_count: {
				select: {
					votes: true
				}
			}
		},
		take: 5
	});

		for (const poll of activePolls) {
								
		// Verificar votos por subdivisión para esta encuesta
		const pollSubdivisionVotes = await prisma.vote.groupBy({
			by: ['subdivisionId'],
			where: {
				pollId: poll.id,
				countryIso3: 'ESP',
				subdivisionId: {
					not: null
				}
			},
			_count: true
		});

				
		if (pollSubdivisionVotes.length > 0) {
						for (const sub of pollSubdivisionVotes.slice(0, 3)) {
							}
		}
	}

	// 5. Simular consulta del API
	if (activePolls.length > 0) {
		const testPoll = activePolls[0];
				
		const votes = await prisma.vote.findMany({
			where: {
				pollId: testPoll.id,
				countryIso3: 'ESP',
				subdivisionId: {
					not: null
				}
			},
			select: {
				subdivisionId: true,
				optionId: true
			}
		});

		
		// Agrupar por subdivisión
		const subdivisionVotes: Record<string, Record<number, number>> = {};
		for (const vote of votes) {
			if (!vote.subdivisionId) continue;
			
			if (!subdivisionVotes[vote.subdivisionId]) {
				subdivisionVotes[vote.subdivisionId] = {};
			}
			
			subdivisionVotes[vote.subdivisionId][vote.optionId] = 
				(subdivisionVotes[vote.subdivisionId][vote.optionId] || 0) + 1;
		}

						
		const sampleSubdivisions = Object.entries(subdivisionVotes).slice(0, 3);
		for (const [subdivisionId, optionVotes] of sampleSubdivisions) {
						for (const [optionId, count] of Object.entries(optionVotes)) {
				const option = testPoll.options.find(o => o.id === parseInt(optionId));
							}
		}
	}

							}

main()
	.catch((e) => {
		console.error('❌ Error:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
