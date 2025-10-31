/**
 * SEED MEGA COMPLETO - Todas las encuestas con datos absolutamente realistas
 * 
 * Incluye:
 * - Encuestas existentes + nuevas (flores, comida, viajes, etc.)
 * - Votos con geolocalización real
 * - Subdivisiones de España
 * - Múltiples países
 * - Interacciones completas
 * 
 * Uso: npx tsx scripts/seed-mega-complete.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Subdivisiones de España con coordenadas
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
	{ iso: 'JPN', name: 'Japan', lat: 35.7, lng: 139.7 },
	{ iso: 'AUS', name: 'Australia', lat: -35.3, lng: 149.1 },
	{ iso: 'CAN', name: 'Canada', lat: 45.4, lng: -75.7 },
	{ iso: 'CHN', name: 'China', lat: 39.9, lng: 116.4 },
	{ iso: 'IND', name: 'India', lat: 28.6, lng: 77.2 },
	{ iso: 'RUS', name: 'Russia', lat: 55.8, lng: 37.6 }
];

async function createVotesForPoll(poll: any, users: any[]) {
	let totalVotesCreated = 0;

	for (const country of COUNTRIES) {
		// Número de votos por país (España tiene más)
		const baseVotes = country.iso === 'ESP' ? 300 : Math.floor(Math.random() * 150) + 50;

		// Distribuir votos entre opciones con tendencias por país
		const optionVotes = poll.options.map((option: any, index: number) => {
			let weight = 1;
			
			// Tendencias por país
			if (country.iso === 'ESP' && index === 0) weight = 1.5;
			if (country.iso === 'USA' && index === 1) weight = 1.4;
			if (country.iso === 'JPN' && index === poll.options.length - 1) weight = 1.3;
			if (country.iso === 'FRA' && index === 1) weight = 1.2;
			if (country.iso === 'DEU' && index === 0) weight = 1.3;

			return {
				option,
				votes: Math.floor((Math.random() * baseVotes * weight) / poll.options.length) + 15
			};
		});

		// Crear votos individuales
		for (const { option, votes } of optionVotes) {
			const votesToCreate = [];

			for (let i = 0; i < votes; i++) {
				let subdivisionId = null;
				let subdivisionName = null;
				let finalLat = country.lat + (Math.random() - 0.5) * 5;
				let finalLng = country.lng + (Math.random() - 0.5) * 5;

				// Para España, asignar subdivisión
				if (country.iso === 'ESP') {
					const subdivision = SPAIN_SUBDIVISIONS[Math.floor(Math.random() * SPAIN_SUBDIVISIONS.length)];
					subdivisionId = subdivision.id;
					subdivisionName = subdivision.name;
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
					subdivisionId: subdivisionId,        // ✅ ID numérico ("1", "2", etc.)
					subdivisionName: subdivisionName,    // ✅ Nombre ("Andalucía", etc.)
					ipAddress: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
					userAgent: 'Mozilla/5.0 (mega seed)'
				});
			}

			// Insertar votos en batch
			await prisma.vote.createMany({ data: votesToCreate });

			// Actualizar contador
			await prisma.pollOption.update({
				where: { id: option.id },
				data: { voteCount: { increment: votes } }
			});

			totalVotesCreated += votes;
		}
	}

	// Actualizar total de votos
	await prisma.poll.update({
		where: { id: poll.id },
		data: { totalVotes: totalVotesCreated }
	});

	return totalVotesCreated;
}

async function main() {
	
	// 1. Limpiar datos existentes (opcional)
		await prisma.vote.deleteMany({});
	await prisma.pollOption.deleteMany({});
	await prisma.poll.deleteMany({});
	await prisma.featuredUser.deleteMany({});
	await prisma.user.deleteMany({});
	
	// 2. Crear usuarios
		const users = await Promise.all([
		prisma.user.upsert({
			where: { username: 'maria_gonzalez' },
			update: {},
			create: {
				username: 'maria_gonzalez',
				email: 'maria@voutop.com',
				displayName: 'María González',
				avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
				verified: true,
				bio: 'Activista social y política'
			}
		}),
		prisma.user.upsert({
			where: { username: 'carlos_lopez' },
			update: {},
			create: {
				username: 'carlos_lopez',
				email: 'carlos@voutop.com',
				displayName: 'Carlos López',
				avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
				verified: true,
				bio: 'Analista político'
			}
		}),
		prisma.user.upsert({
			where: { username: 'laura_sanchez' },
			update: {},
			create: {
				username: 'laura_sanchez',
				email: 'laura@voutop.com',
				displayName: 'Laura Sánchez',
				avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop',
				verified: false,
				bio: 'Periodista independiente'
			}
		}),
		prisma.user.upsert({
			where: { username: 'juan_martin' },
			update: {},
			create: {
				username: 'juan_martin',
				email: 'juan@voutop.com',
				displayName: 'Juan Martín',
				avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
				verified: true,
				bio: 'Economista'
			}
		}),
		prisma.user.upsert({
			where: { username: 'sofia_herrera' },
			update: {},
			create: {
				username: 'sofia_herrera',
				email: 'sofia@voutop.com',
				displayName: 'Sofía Herrera',
				avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop',
				verified: false,
				bio: 'Estudiante de ciencias políticas'
			}
		}),
		prisma.user.upsert({
			where: { username: 'pedro_ramirez' },
			update: {},
			create: {
				username: 'pedro_ramirez',
				email: 'pedro@voutop.com',
				displayName: 'Pedro Ramírez',
				avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop',
				verified: true,
				bio: 'Ingeniero ambiental'
			}
		}),
		prisma.user.upsert({
			where: { username: 'ana_torres' },
			update: {},
			create: {
				username: 'ana_torres',
				email: 'ana@voutop.com',
				displayName: 'Ana Torres',
				avatarUrl: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop',
				verified: true,
				bio: 'Chef profesional'
			}
		}),
		prisma.user.upsert({
			where: { username: 'diego_fernandez' },
			update: {},
			create: {
				username: 'diego_fernandez',
				email: 'diego@voutop.com',
				displayName: 'Diego Fernández',
				avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop',
				verified: false,
				bio: 'Fotógrafo de naturaleza'
			}
		})
	]);

	
	// 3. Crear encuestas MEGA COMPLETAS
	
	const polls = [];

	// ENCUESTA 1: Flores favoritas 🌸
		const poll1 = await prisma.poll.create({
		data: {
			userId: users[7].id,
			title: '¿Cuál es tu flor favorita?',
			description: 'Vota por la flor que más te gusta',
			category: 'lifestyle',
			status: 'active',
			totalViews: 9850,
			totalVotes: 0,
			options: {
				create: [
					{ optionKey: 'rosa', optionLabel: 'Rosa 🌹', color: '#ec4899', displayOrder: 0, voteCount: 0 },
					{ optionKey: 'tulipan', optionLabel: 'Tulipán 🌷', color: '#f97316', displayOrder: 1, voteCount: 0 },
					{ optionKey: 'girasol', optionLabel: 'Girasol 🌻', color: '#eab308', displayOrder: 2, voteCount: 0 },
					{ optionKey: 'orquidea', optionLabel: 'Orquídea 🌺', color: '#a855f7', displayOrder: 3, voteCount: 0 },
					{ optionKey: 'margarita', optionLabel: 'Margarita 🌼', color: '#ffffff', displayOrder: 4, voteCount: 0 }
				]
			}
		},
		include: { options: true }
	});
	polls.push(poll1);

	// ENCUESTA 2: Comida favorita 🍕
		const poll2 = await prisma.poll.create({
		data: {
			userId: users[6].id,
			title: '¿Cuál es tu comida favorita?',
			description: 'El eterno debate gastronómico',
			category: 'food',
			status: 'active',
			totalViews: 18200,
			totalVotes: 0,
			options: {
				create: [
					{ optionKey: 'pizza', optionLabel: 'Pizza 🍕', color: '#ef4444', displayOrder: 0, voteCount: 0 },
					{ optionKey: 'sushi', optionLabel: 'Sushi 🍣', color: '#06b6d4', displayOrder: 1, voteCount: 0 },
					{ optionKey: 'pasta', optionLabel: 'Pasta 🍝', color: '#f59e0b', displayOrder: 2, voteCount: 0 },
					{ optionKey: 'tacos', optionLabel: 'Tacos 🌮', color: '#84cc16', displayOrder: 3, voteCount: 0 },
					{ optionKey: 'hamburguesa', optionLabel: 'Hamburguesa 🍔', color: '#a16207', displayOrder: 4, voteCount: 0 }
				]
			}
		},
		include: { options: true }
	});
	polls.push(poll2);

	// ENCUESTA 3: Destino de vacaciones ✈️
		const poll3 = await prisma.poll.create({
		data: {
			userId: users[3].id,
			title: '¿Cuál es tu destino de vacaciones ideal?',
			description: 'Elige tu escapada perfecta',
			category: 'travel',
			status: 'active',
			totalViews: 14500,
			totalVotes: 0,
			options: {
				create: [
					{ optionKey: 'playa', optionLabel: 'Playa 🏖️', color: '#06b6d4', displayOrder: 0, voteCount: 0 },
					{ optionKey: 'montana', optionLabel: 'Montaña ⛰️', color: '#78716c', displayOrder: 1, voteCount: 0 },
					{ optionKey: 'ciudad', optionLabel: 'Ciudad 🏙️', color: '#6366f1', displayOrder: 2, voteCount: 0 },
					{ optionKey: 'campo', optionLabel: 'Campo 🌾', color: '#84cc16', displayOrder: 3, voteCount: 0 }
				]
			}
		},
		include: { options: true }
	});
	polls.push(poll3);

	// ENCUESTA 4: Estación del año 🍂
		const poll4 = await prisma.poll.create({
		data: {
			userId: users[4].id,
			title: '¿Cuál es tu estación favorita?',
			description: 'Vota por la estación del año que más te gusta',
			category: 'lifestyle',
			status: 'active',
			totalViews: 11200,
			totalVotes: 0,
			options: {
				create: [
					{ optionKey: 'primavera', optionLabel: 'Primavera 🌸', color: '#f9a8d4', displayOrder: 0, voteCount: 0 },
					{ optionKey: 'verano', optionLabel: 'Verano ☀️', color: '#fbbf24', displayOrder: 1, voteCount: 0 },
					{ optionKey: 'otono', optionLabel: 'Otoño 🍂', color: '#f97316', displayOrder: 2, voteCount: 0 },
					{ optionKey: 'invierno', optionLabel: 'Invierno ❄️', color: '#60a5fa', displayOrder: 3, voteCount: 0 }
				]
			}
		},
		include: { options: true }
	});
	polls.push(poll4);

	// ENCUESTA 5: Deporte favorito ⚽
		const poll5 = await prisma.poll.create({
		data: {
			userId: users[5].id,
			title: '¿Cuál es tu deporte favorito?',
			description: 'Vota por el deporte que más te gusta ver o practicar',
			category: 'sports',
			status: 'active',
			totalViews: 16800,
			totalVotes: 0,
			options: {
				create: [
					{ optionKey: 'futbol', optionLabel: 'Fútbol ⚽', color: '#22c55e', displayOrder: 0, voteCount: 0 },
					{ optionKey: 'baloncesto', optionLabel: 'Baloncesto 🏀', color: '#f97316', displayOrder: 1, voteCount: 0 },
					{ optionKey: 'tenis', optionLabel: 'Tenis 🎾', color: '#eab308', displayOrder: 2, voteCount: 0 },
					{ optionKey: 'natacion', optionLabel: 'Natación 🏊', color: '#3b82f6', displayOrder: 3, voteCount: 0 }
				]
			}
		},
		include: { options: true }
	});
	polls.push(poll5);

	// ENCUESTA 6: Música 🎵
		const poll6 = await prisma.poll.create({
		data: {
			userId: users[0].id,
			title: '¿Qué tipo de música escuchas más?',
			description: 'Tu género musical favorito',
			category: 'music',
			status: 'active',
			totalViews: 13400,
			totalVotes: 0,
			options: {
				create: [
					{ optionKey: 'pop', optionLabel: 'Pop 🎤', color: '#ec4899', displayOrder: 0, voteCount: 0 },
					{ optionKey: 'rock', optionLabel: 'Rock 🎸', color: '#dc2626', displayOrder: 1, voteCount: 0 },
					{ optionKey: 'electronica', optionLabel: 'Electrónica 🎧', color: '#8b5cf6', displayOrder: 2, voteCount: 0 },
					{ optionKey: 'clasica', optionLabel: 'Clásica 🎻', color: '#d97706', displayOrder: 3, voteCount: 0 },
					{ optionKey: 'reggaeton', optionLabel: 'Reggaeton 🔥', color: '#f59e0b', displayOrder: 4, voteCount: 0 }
				]
			}
		},
		include: { options: true }
	});
	polls.push(poll6);

	// ENCUESTA 7: Mascotas 🐕
		const poll7 = await prisma.poll.create({
		data: {
			userId: users[1].id,
			title: '¿Perros o gatos?',
			description: 'El debate eterno',
			category: 'lifestyle',
			status: 'active',
			totalViews: 20100,
			totalVotes: 0,
			options: {
				create: [
					{ optionKey: 'perros', optionLabel: 'Perros 🐕', color: '#a16207', displayOrder: 0, voteCount: 0 },
					{ optionKey: 'gatos', optionLabel: 'Gatos 🐈', color: '#6b7280', displayOrder: 1, voteCount: 0 },
					{ optionKey: 'ambos', optionLabel: 'Ambos 🐾', color: '#ec4899', displayOrder: 2, voteCount: 0 },
					{ optionKey: 'ninguno', optionLabel: 'Ninguno', color: '#64748b', displayOrder: 3, voteCount: 0 }
				]
			}
		},
		include: { options: true }
	});
	polls.push(poll7);

	
	// 4. Crear votos para TODAS las encuestas
	
	let totalVotesGlobal = 0;

	for (const poll of polls) {
				const votes = await createVotesForPoll(poll, users);
				totalVotesGlobal += votes;
	}

	// 5. Crear interacciones
		
	for (const poll of polls) {
		// Algunos usuarios dan like
		for (let i = 0; i < Math.min(users.length, 4); i++) {
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

	
	// 6. Crear usuarios destacados
		await Promise.all([
		prisma.featuredUser.upsert({
			where: { userId: users[0].id },
			update: {},
			create: {
				userId: users[0].id,
				roleTitle: 'Activista Social',
				citationsCount: 312,
				displaySize: 55,
				highlightColor: '#ec4899',
				featuredOrder: 1
			}
		}),
		prisma.featuredUser.upsert({
			where: { userId: users[1].id },
			update: {},
			create: {
				userId: users[1].id,
				roleTitle: 'Analista Político',
				citationsCount: 189,
				displaySize: 35,
				highlightColor: '#3b82f6',
				featuredOrder: 2
			}
		}),
		prisma.featuredUser.upsert({
			where: { userId: users[3].id },
			update: {},
			create: {
				userId: users[3].id,
				roleTitle: 'Economista',
				citationsCount: 156,
				displaySize: 30,
				highlightColor: '#10b981',
				featuredOrder: 3
			}
		})
	]);
	
	// 7. Resumen final
									
			polls.forEach((poll, i) => {
			});

							}

main()
	.catch((e) => {
		console.error('❌ Error:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
