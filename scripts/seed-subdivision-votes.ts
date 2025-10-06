/**
 * Script para agregar votos de prueba con datos de subdivisión
 * 
 * Uso: npx tsx scripts/seed-subdivision-votes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapeo de subdivisiones de España (ejemplo)
const SPAIN_SUBDIVISIONS = [
	{ id: '1', name: 'Andalucía' },
	{ id: '2', name: 'Aragón' },
	{ id: '3', name: 'Asturias' },
	{ id: '4', name: 'Baleares' },
	{ id: '5', name: 'Canarias' },
	{ id: '6', name: 'Cantabria' },
	{ id: '7', name: 'Castilla y León' },
	{ id: '8', name: 'Castilla-La Mancha' },
	{ id: '9', name: 'Cataluña' },
	{ id: '10', name: 'Comunidad Valenciana' },
	{ id: '11', name: 'Extremadura' },
	{ id: '12', name: 'Galicia' },
	{ id: '13', name: 'Madrid' },
	{ id: '14', name: 'Murcia' },
	{ id: '15', name: 'Navarra' },
	{ id: '16', name: 'País Vasco' },
	{ id: '17', name: 'La Rioja' }
];

async function main() {
	
	// Obtener todas las encuestas activas
	const polls = await prisma.poll.findMany({
		where: { status: 'active' },
		include: {
			options: true
		},
		take: 5
	});

	if (polls.length === 0) {
				return;
	}

	
	let totalVotesCreated = 0;

	for (const poll of polls) {
		
		if (poll.options.length === 0) {
						continue;
		}

		// Crear votos para cada subdivisión de España
		for (const subdivision of SPAIN_SUBDIVISIONS) {
			// Generar votos aleatorios para cada opción
			const votesPerOption = poll.options.map(option => ({
				option,
				votes: Math.floor(Math.random() * 100) + 20 // Entre 20 y 120 votos
			}));

			// Ordenar por votos para ver cuál gana
			votesPerOption.sort((a, b) => b.votes - a.votes);

			
			for (const { option, votes } of votesPerOption) {
				// Crear votos individuales
				const votesToCreate = [];

				for (let i = 0; i < votes; i++) {
					// Generar coordenadas aleatorias dentro de España
					const lat = 36 + Math.random() * 7; // Aprox. latitud de España
					const lng = -9 + Math.random() * 12; // Aprox. longitud de España

					votesToCreate.push({
						pollId: poll.id,
						optionId: option.id,
						latitude: lat,
						longitude: lng,
						countryIso3: 'ESP',
						countryName: 'Spain',
						subdivisionId: subdivision.id,
						subdivisionName: subdivision.name,
						ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
						userAgent: 'Mozilla/5.0 (seed script)'
					});
				}

				// Insertar votos en batch
				await prisma.vote.createMany({
					data: votesToCreate
				});

				// Actualizar contador de votos de la opción
				await prisma.pollOption.update({
					where: { id: option.id },
					data: {
						voteCount: {
							increment: votes
						}
					}
				});

				totalVotesCreated += votes;

							}

					}

		// Actualizar total de votos de la encuesta
		const totalPollVotes = await prisma.vote.count({
			where: { pollId: poll.id }
		});

		await prisma.poll.update({
			where: { id: poll.id },
			data: { totalVotes: totalPollVotes }
		});
	}

				}

main()
	.catch((e) => {
		console.error('❌ Error seeding data:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
