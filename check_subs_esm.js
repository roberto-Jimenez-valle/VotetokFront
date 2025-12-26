
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkSubdivisions() {
    const count = await prisma.subdivision.count();
    const levels = await prisma.subdivision.groupBy({
        by: ['level'],
        _count: true
    });
    const sample = await prisma.subdivision.findMany({ take: 5 });

    console.log('Subdivisions Status:', JSON.stringify({
        count,
        levels,
        sample
    }, null, 2));
}

checkSubdivisions()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
