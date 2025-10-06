/**
 * Script para eliminar todas las encuestas menos una
 * 
 * Uso: npx tsx scripts/keep-one-poll.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	
	// Obtener todas las encuestas
	const allPolls = await prisma.poll.findMany({
		orderBy: { id: 'asc' },
		select: {
			id: true,
			title: true,
			_count: {
				select: {
					votes: true,
					options: true
				}
			}
		}
	});

	if (allPolls.length === 0) {
				return;
	}

		
	allPolls.forEach((poll, index) => {
					});

	// Mantener la primera encuesta (la que tiene más votos o la primera)
	const pollToKeep = allPolls[0];
	const pollsToDelete = allPolls.slice(1);

		
	// Eliminar las demás encuestas
	for (const poll of pollsToDelete) {
				
		// Prisma eliminará automáticamente:
		// - Votos (onDelete: Cascade)
		// - Opciones (onDelete: Cascade)
		// - Interacciones (onDelete: Cascade)
		// - Comentarios (onDelete: Cascade)
		await prisma.poll.delete({
			where: { id: poll.id }
		});
		
			}

				
	// Verificar encuestas restantes
	const remainingPolls = await prisma.poll.findMany({
		include: {
			options: true,
			_count: {
				select: {
					votes: true
				}
			}
		}
	});

		remainingPolls.forEach(poll => {
										poll.options.forEach(opt => {
					});
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
