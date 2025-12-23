
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Searching for recent polls...");
    const polls = await prisma.poll.findMany({
        orderBy: {
            createdAt: 'desc'
        },
        take: 5,
        select: {
            id: true,
            title: true,
            createdAt: true,
            closedAt: true,
            status: true,
            type: true,
            userId: true
        }
    });

    console.log(JSON.stringify(polls, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
