/**
 * Script para crear datos COMPLETOS y REALISTAS de encuestas con votos geográficos
 * 
 * Uso: npx tsx scripts/seed-complete-realistic-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapeo de subdivisiones de España con coordenadas aproximadas
const SPAIN_SUBDIVISIONS = [
	{ id: '1', name: 'Andalucía', lat: 37.5, lng: -4.5 },
	{ id: '2', name: 'Aragón', lat: 41.5, lng: -1.0 },
	{ id: '3', name: 'Asturias', lat: 43.3, lng: -6.0 },
	{ id: '4', name: 'Baleares', lat: 39.5, lng: 2.8 },
	{ id: '5', name: 'Canarias', lat: 28.3, lng: -16.5 },
	{ id: '6', name: 'Cantabria', lat: 43.2, lng: -4.0 },
	{ id: '7', name: 'Castilla y León', lat: 41.8, lng: -4.5 },
	{ id: '8', name: 'Castilla-La Mancha', lat: 39.5, lng: -3.5 },
	{ id: '9', name: 'Cataluña', lat: 41.8, lng: 1.5 },
	{ id: '10', name: 'Comunidad Valenciana', lat: 39.5, lng: -0.5 },
	{ id: '11', name: 'Extremadura', lat: 39.0, lng: -6.0 },
	{ id: '12', name: 'Galicia', lat: 42.8, lng: -8.0 },
	{ id: '13', name: 'Madrid', lat: 40.4, lng: -3.7 },
	{ id: '14', name: 'Murcia', lat: 38.0, lng: -1.5 },
	{ id: '15', name: 'Navarra', lat: 42.7, lng: -1.6 },
	{ id: '16', name: 'País Vasco', lat: 43.0, lng: -2.7 },
	{ id: '17', name: 'La Rioja', lat: 42.3, lng: -2.5 }
];

// Países con coordenadas
const COUNTRIES = [
	{ iso: 'ESP', name: 'Spain', lat: 40.4, lng: -3.7 },
	{ iso: 'FRA', name: 'France', lat: 48.8, lng: 2.3 },
	{ iso: 'DEU', name: 'Germany', lat: 52.5, lng: 13.4 },
	{ iso: 'ITA', name: 'Italy', lat: 41.9, lng: 12.5 },
	{ iso: 'GBR', name: 'United Kingdom', lat: 51.5, lng: -0.1 },
	{ iso: 'USA', name: 'United States', lat: 38.9, lng: -77.0 },
	{ iso: 'MEX', name: 'Mexico', lat: 19.4, lng: -99.1 },
	{ iso: 'ARG', name: 'Argentina', lat: -34.6, lng: -58.4 },
	{ iso: 'BRA', name: 'Brazil', lat: -15.8, lng: -47.9 },
	{ iso: 'JPN', name: 'Japan', lat: 35.7, lng: 139.7 }
];

async function main() {
	
	// 1. Crear usuarios
		
	const users = await Promise.all([
		prisma.user.upsert({
			where: { username: 'maria_garcia' },
			update: {},
			create: {
				username: 'maria_garcia',
				email: 'maria@example.com',
				displayName: 'María García',
				avatarUrl: '/default-avatar.svg',
				verified: true,
				role: 'user'
			}
		}),
		prisma.user.upsert({
			where: { username: 'juan_lopez' },
			update: {},
			create: {
				username: 'juan_lopez',
				email: 'juan@example.com',
				displayName: 'Juan López',
				avatarUrl: '/default-avatar.svg',
				verified: true,
				role: 'user'
			}
		}),
		prisma.user.upsert({
			where: { username: 'ana_martinez' },
			update: {},
			create: {
				username: 'ana_martinez',
				email: 'ana@example.com',
				displayName: 'Ana Martínez',
				avatarUrl: '/default-avatar.svg',
				verified: false,
				role: 'user'
			}
		}),
		prisma.user.upsert({
			where: { username: 'carlos_rodriguez' },
			update: {},
			create: {
				username: 'carlos_rodriguez',
				email: 'carlos@example.com',
				displayName: 'Carlos Rodríguez',
				avatarUrl: '/default-avatar.svg',
				verified: true,
				role: 'user'
			}
		}),
		prisma.user.upsert({
			where: { username: 'laura_sanchez' },
			update: {},
			create: {
				username: 'laura_sanchez',
				email: 'laura@example.com',
				displayName: 'Laura Sánchez',
				avatarUrl: '/default-avatar.svg',
				verified: true,
				role: 'user'
			}
		})
	]);

	
	// 2. Crear encuestas trending
	
	const polls = [];

	// ENCUESTA 1: ¿Cuál es tu estación favorita?
		const poll1 = await prisma.poll.create({
		data: {
			userId: users[0].id,
			title: '¿Cuál es tu estación favorita?',
			description: 'Vota por la estación del año que más te gusta',
			category: 'lifestyle',
			status: 'active',
			totalVotes: 0,
			totalViews: 1250,
			options: {
				create: [
					{ optionKey: 'spring', optionLabel: 'Primavera', color: '#90EE90', voteCount: 0, displayOrder: 0 },
					{ optionKey: 'summer', optionLabel: 'Verano', color: '#FFD700', voteCount: 0, displayOrder: 1 },
					{ optionKey: 'autumn', optionLabel: 'Otoño', color: '#FF8C00', voteCount: 0, displayOrder: 2 },
					{ optionKey: 'winter', optionLabel: 'Invierno', color: '#87CEEB', voteCount: 0, displayOrder: 3 }
				]
			}
		},
		include: { options: true }
	});
	polls.push(poll1);

	// ENCUESTA 2: ¿Qué prefieres para desayunar?
		const poll2 = await prisma.poll.create({
		data: {
			userId: users[1].id,
			title: '¿Qué prefieres para desayunar?',
			description: 'El desayuno más importante del día',
			category: 'food',
			status: 'active',
			totalVotes: 0,
			totalViews: 980,
			options: {
				create: [
					{ optionKey: 'coffee', optionLabel: 'Café', color: '#8B4513', voteCount: 0, displayOrder: 0 },
					{ optionKey: 'tea', optionLabel: 'Té', color: '#90EE90', voteCount: 0, displayOrder: 1 },
					{ optionKey: 'juice', optionLabel: 'Zumo', color: '#FFA500', voteCount: 0, displayOrder: 2 }
				]
			}
		},
		include: { options: true }
	});
	polls.push(poll2);

	// ENCUESTA 3: ¿Cuál es tu deporte favorito?
		const poll3 = await prisma.poll.create({
		data: {
			userId: users[2].id,
			title: '¿Cuál es tu deporte favorito?',
			description: 'Vota por el deporte que más te gusta ver o practicar',
			category: 'sports',
			status: 'active',
			totalVotes: 0,
			totalViews: 1500,
			options: {
				create: [
					{ optionKey: 'football', optionLabel: 'Fútbol', color: '#228B22', voteCount: 0, displayOrder: 0 },
					{ optionKey: 'basketball', optionLabel: 'Baloncesto', color: '#FF6347', voteCount: 0, displayOrder: 1 },
					{ optionKey: 'tennis', optionLabel: 'Tenis', color: '#FFD700', voteCount: 0, displayOrder: 2 },
					{ optionKey: 'swimming', optionLabel: 'Natación', color: '#4169E1', voteCount: 0, displayOrder: 3 }
				]
			}
		},
		include: { options: true }
	});
	polls.push(poll3);

	// ENCUESTA 4: ¿Prefieres playa o montaña?
		const poll4 = await prisma.poll.create({
		data: {
			userId: users[3].id,
			title: '¿Prefieres playa o montaña?',
			description: 'El eterno debate de las vacaciones',
			category: 'travel',
			status: 'active',
			totalVotes: 0,
			totalViews: 2100,
			options: {
				create: [
					{ optionKey: 'beach', optionLabel: 'Playa', color: '#00CED1', voteCount: 0, displayOrder: 0 },
					{ optionKey: 'mountain', optionLabel: 'Montaña', color: '#8B4513', voteCount: 0, displayOrder: 1 }
				]
			}
		},
		include: { options: true }
	});
	polls.push(poll4);

	// ENCUESTA 5: ¿Qué tipo de música escuchas más?
		const poll5 = await prisma.poll.create({
		data: {
			userId: users[4].id,
			title: '¿Qué tipo de música escuchas más?',
			description: 'Tu género musical favorito',
			category: 'music',
			status: 'active',
			totalVotes: 0,
			totalViews: 1800,
			options: {
				create: [
					{ optionKey: 'pop', optionLabel: 'Pop', color: '#FF69B4', voteCount: 0, displayOrder: 0 },
					{ optionKey: 'rock', optionLabel: 'Rock', color: '#DC143C', voteCount: 0, displayOrder: 1 },
					{ optionKey: 'electronic', optionLabel: 'Electrónica', color: '#00FFFF', voteCount: 0, displayOrder: 2 },
					{ optionKey: 'classical', optionLabel: 'Clásica', color: '#FFD700', voteCount: 0, displayOrder: 3 }
				]
			}
		},
		include: { options: true }
	});
	polls.push(poll5);

	
	// 3. Crear votos REALISTAS con geolocalización
	
	let totalVotesCreated = 0;

	for (const poll of polls) {
		
		// Crear votos para cada país
		for (const country of COUNTRIES) {
			// Número de votos por país (varía según país)
			const baseVotes = country.iso === 'ESP' ? 200 : Math.floor(Math.random() * 100) + 50;

			// Distribuir votos entre opciones (con tendencias por país)
			const optionVotes = poll.options.map((option, index) => {
				// Crear tendencias: algunos países prefieren ciertas opciones
				let weight = 1;
				
				// España prefiere opciones locales
				if (country.iso === 'ESP' && index === 0) weight = 1.5;
				// USA prefiere opciones diferentes
				if (country.iso === 'USA' && index === 1) weight = 1.3;
				// Japón prefiere últimas opciones
				if (country.iso === 'JPN' && index === poll.options.length - 1) weight = 1.4;

				return {
					option,
					votes: Math.floor((Math.random() * baseVotes * weight) / poll.options.length) + 10
				};
			});

			// Crear votos individuales
			for (const { option, votes } of optionVotes) {
				const votesToCreate = [];

				for (let i = 0; i < votes; i++) {
					// Generar coordenadas con variación alrededor del centro del país
					const latVariation = (Math.random() - 0.5) * 5;
					const lngVariation = (Math.random() - 0.5) * 5;

					// Para España, asignar subdivisión
					let subdivisionId = null;
					let subdivisionName = null;
					let finalLat = country.lat + latVariation;
					let finalLng = country.lng + lngVariation;

					if (country.iso === 'ESP') {
						// Asignar a una subdivisión aleatoria
						const subdivision = SPAIN_SUBDIVISIONS[Math.floor(Math.random() * SPAIN_SUBDIVISIONS.length)];
						subdivisionId = subdivision.id;
						subdivisionName = subdivision.name;
						// Usar coordenadas de la subdivisión con pequeña variación
						finalLat = subdivision.lat + (Math.random() - 0.5) * 0.5;
						finalLng = subdivision.lng + (Math.random() - 0.5) * 0.5;
					}

					votesToCreate.push({
						pollId: poll.id,
						optionId: option.id,
						userId: users[Math.floor(Math.random() * users.length)].id,
						latitude: finalLat,
						longitude: finalLng,
						countryIso3: country.iso,
						countryName: country.name,
						subdivisionId,
						subdivisionName,
						ipAddress: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
						userAgent: 'Mozilla/5.0 (realistic seed)'
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

	// 4. Crear interacciones (likes, shares)
		
	for (const poll of polls) {
		// Algunos usuarios dan like
		for (let i = 0; i < Math.min(users.length, 3); i++) {
			await prisma.pollInteraction.upsert({
				where: {
					pollId_userId_interactionType: {
						pollId: poll.id,
						userId: users[i].id,
						interactionType: 'like'
					}
				},
				update: {},
				create: {
					pollId: poll.id,
					userId: users[i].id,
					interactionType: 'like'
				}
			});
		}
	}

	
	// 5. Resumen final
								
								}

main()
	.catch((e) => {
		console.error('❌ Error seeding data:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
