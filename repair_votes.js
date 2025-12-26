
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function repairVotes() {
    console.log('--- Iniciando reparación de votos (V4) ---');

    const brokenVotes = await prisma.vote.findMany({
        where: {
            subdivisionId: null
        }
    });

    const validVotes = brokenVotes.filter(v => v.latitude != null && v.longitude != null);
    console.log(`Encontrados ${brokenVotes.length} votos sin subdivisión. ${validVotes.length} tienen coordenadas.`);

    let repairedCount = 0;
    for (const vote of validVotes) {
        try {
            const nearest = await prisma.$queryRaw`
        SELECT subdivision_id, name
        FROM subdivisions
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY 
          ((latitude - ${vote.latitude}) * (latitude - ${vote.latitude}) + 
           (longitude - ${vote.longitude}) * (longitude - ${vote.longitude}))
        LIMIT 1
      `;

            if (nearest && nearest.length > 0) {
                // En SQLite/Prisma a veces las keys vienen como esten en la DB
                const entry = nearest[0];
                const subId = entry.subdivision_id || entry.subdivisionId || entry.SUBDIVISION_ID;

                if (subId) {
                    console.log(`Reparando voto ${vote.id} -> ${subId}`);
                    await prisma.vote.update({
                        where: { id: vote.id },
                        data: { subdivisionId: subId }
                    });
                    repairedCount++;
                } else {
                    console.log(`Voto ${vote.id}: No se pudo extraer ID de`, entry);
                }
            }
        } catch (err) {
            console.error(`Error en voto ${vote.id}:`, err);
        }
    }

    console.log(`--- Reparación completada: ${repairedCount} votos actualizados ---`);
}

repairVotes()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
