/**
 * Script para crear UNA SOLA encuesta con datos completos
 * 
 * Uso: npx tsx scripts/create-single-poll-with-data.ts
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

// Países
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
	
	// 1. Eliminar TODAS las encuestas existentes
		await prisma.vote.deleteMany({});
	await prisma.pollOption.deleteMany({});
	await prisma.poll.deleteMany({});
	
	// 2. Obtener primer usuario o crear uno nuevo
	let user = await prisma.user.findFirst();
	
	if (!user) {
		user = await prisma.user.create({
			data: {
				username: 'user_' + Date.now(),
				email: 'user_' + Date.now() + '@votetok.com',
				displayName: 'Usuario Demo',
				avatarUrl: '/default-avatar.svg',
				verified: true
			}
		});
	}

	
	// 3. Crear UNA encuesta
	
	const poll = await prisma.poll.create({
		data: {
			userId: user.id,
			title: '¿Cuál es tu flor favorita?',
			description: 'Vota por la flor que más te gusta',
			category: 'lifestyle',
			status: 'active',
			totalViews: 5000,
			totalVotes: 0,
			options: {
				create: [
					{ optionKey: 'rosa', optionLabel: 'Rosa 🌹', color: '#ec4899', displayOrder: 0, voteCount: 0 },
					{ optionKey: 'tulipan', optionLabel: 'Tulipán 🌷', color: '#f97316', displayOrder: 1, voteCount: 0 },
					{ optionKey: 'girasol', optionLabel: 'Girasol 🌻', color: '#eab308', displayOrder: 2, voteCount: 0 },
					{ optionKey: 'orquidea', optionLabel: 'Orquídea 🌺', color: '#a855f7', displayOrder: 3, voteCount: 0 }
				]
			}
		},
		include: { options: true }
	});

		
	// 4. Crear votos con geolocalización
	
	let totalVotes = 0;

	for (const country of COUNTRIES) {
		const baseVotes = country.iso === 'ESP' ? 300 : Math.floor(Math.random() * 100) + 50;

		// Distribuir votos entre opciones
		const optionVotes = poll.options.map((option, index) => {
			let weight = 1;
			if (country.iso === 'ESP' && index === 0) weight = 1.5;
			if (country.iso === 'FRA' && index === 1) weight = 1.4;
			if (country.iso === 'JPN' && index === 3) weight = 1.3;

			return {
				option,
				votes: Math.floor((Math.random() * baseVotes * weight) / poll.options.length) + 15
			};
		});

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
					userId: user.id,
					latitude: finalLat,
					longitude: finalLng,
					countryIso3: country.iso,
					countryName: country.name,
					subdivisionId: subdivisionId,
					subdivisionName: subdivisionName,
					ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
					userAgent: 'Mozilla/5.0'
				});
			}

			await prisma.vote.createMany({ data: votesToCreate });

			await prisma.pollOption.update({
				where: { id: option.id },
				data: { voteCount: { increment: votes } }
			});

			totalVotes += votes;
		}

			}

	// Actualizar total
	await prisma.poll.update({
		where: { id: poll.id },
		data: { totalVotes: totalVotes }
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
