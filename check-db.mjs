import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:ajlnBQueMwvXXqyIsJHUSSZbDbwvLzSn@metro.proxy.rlwy.net:54076/railway'
        }
    }
});

async function main() {
    console.log('🔍 Verificando base de datos...\n');

    try {
        // Total de votos
        const totalVotes = await prisma.vote.count();
        console.log(`📊 Total de votos: ${totalVotes.toLocaleString()}\n`);

        // Votos por país - Usando Prisma para evitar problemas de tipos
        console.log('📡 Cargando votos...');
        const votes = await prisma.vote.findMany({
            select: {
                subdivision: {
                    select: {
                        subdivisionId: true
                    }
                }
            }
        });

        console.log('📊 Procesando datos...\n');
        // Agrupar por país en JavaScript
        const countryCount = {};
        for (const vote of votes) {
            if (vote.subdivision?.subdivisionId) {
                const country = vote.subdivision.subdivisionId.substring(0, 3);
                countryCount[country] = (countryCount[country] || 0) + 1;
            }
        }

        // Convertir a array y ordenar
        const votesByCountry = Object.entries(countryCount)
            .map(([country, votes]) => ({ country, votes }))
            .sort((a, b) => b.votes - a.votes);

        console.log('🌍 Votos por país (top 50):');
        console.table(votesByCountry.slice(0, 50));

        console.log(`\n✅ Total de países con datos: ${votesByCountry.length}`);
        console.log(`\n📊 Distribución:`);
        console.log(`   - Top 5 países: ${votesByCountry.slice(0, 5).map(c => `${c.country} (${c.votes.toLocaleString()})`).join(', ')}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
