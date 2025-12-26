
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSubdivisions() {
    const count = await prisma.subdivision.count();
    const levels = await prisma.subdivision.groupBy({
        by: ['level'],
        _count: true
    });
    const sample = await prisma.subdivision.findMany({ take: 5 });

    console.log('Subdivisions Status:', {
        count,
        levels,
        sample
    });
}

checkSubdivisions()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
