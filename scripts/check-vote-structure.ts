import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	
	// Obtener un voto de ejemplo
	const sampleVote = await prisma.vote.findFirst({
		take: 1
	});

	if (!sampleVote) {
						return;
	}

		
	// Verificar campos disponibles
		Object.keys(sampleVote).forEach(key => {
		const value = (sampleVote as any)[key];
			});

	// Contar votos con subdivision
	const votesWithSubdivision = await prisma.vote.count({
		where: {
			subdivisionId: {
				not: null
			}
		}
	});

	
	// Verificar si existe subdivisionId2
	const voteFields = Object.keys(sampleVote);
	const hasSubdivisionId2 = voteFields.includes('subdivisionId2');
	
		
	if (!hasSubdivisionId2) {
									}
}

main()
	.catch((e) => {
		console.error('❌ Error:', e.message);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
