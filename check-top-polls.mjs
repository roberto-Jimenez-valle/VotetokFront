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
    console.log('🔍 Buscando encuestas con más votos...\n');

    try {
        // Top encuestas por votos
        const topPolls = await prisma.poll.findMany({
            where: {
                status: 'active'
            },
            select: {
                id: true,
                title: true,
                createdAt: true,
                _count: {
                    select: {
                        votes: true
                    }
                }
            },
            orderBy: {
                votes: {
                    _count: 'desc'
                }
            },
            take: 20
        });

        console.log('📊 Top 20 encuestas por número de votos:\n');
        console.table(topPolls.map(p => ({
            id: p.id,
            title: p.title.substring(0, 50),
            votes: p._count.votes,
            createdAt: p.createdAt.toISOString().split('T')[0],
            age_days: Math.floor((Date.now() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        })));

        // Verificar cuántos países tiene la encuesta con más votos
        if (topPolls.length > 0) {
            const topPollId = topPolls[0].id;
            console.log(`\n🔍 Verificando países para poll ${topPollId} (${topPolls[0]._count.votes} votos)...\n`);

            const votes = await prisma.vote.findMany({
                where: { pollId: topPollId },
                select: {
                    subdivision: {
                        select: {
                            subdivisionId: true
                        }
                    }
                }
            });

            const countries = {};
            for (const vote of votes) {
                if (vote.subdivision?.subdivisionId) {
                    const country = vote.subdivision.subdivisionId.substring(0, 3);
                    countries[country] = (countries[country] || 0) + 1;
                }
            }

            console.log(`📊 Distribución de votos por país (top 20):\n`);
            const sorted = Object.entries(countries)
                .map(([country, count]) => ({ country, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 20);

            console.table(sorted);
            console.log(`\n✅ Total países con datos: ${Object.keys(countries).length}`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
